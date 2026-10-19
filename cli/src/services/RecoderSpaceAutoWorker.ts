import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import type { AgentBridgeService, TaskAssignment } from './AgentBridgeService.js';
import { createTwoFilesPatch } from 'diff';
import { branchExists, createWorktree, generateBranchName, getGitInfo } from '../parallel/git-utils.js';

const DOCKER_BACKEND_URL = process.env['DOCKER_BACKEND_URL'] || 'http://localhost:3100';
const MAX_OUTPUT_CHARS = 24_000;
const MAX_PROGRESS_OUTPUT_CHARS = 600;
const MODEL_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_SNAPSHOT_FILE_BYTES = 512 * 1024;

interface CommandResult {
  command: string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ModelRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  command: string[];
}

interface RepoArtifacts {
  baselineStatus: string;
  finalStatus: string;
  diff: string;
  changedFiles: string;
}

interface ExecutionWorkspace {
  cwd: string;
  branchName: string | null;
  baseBranch: string | null;
  isolated: boolean;
}

interface RepoFileSnapshot {
  path: string;
  hash: string;
  content?: string;
}

interface RepoSnapshot {
  files: Map<string, RepoFileSnapshot>;
}

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveCliEntryPath(): string {
  const packageRoot = path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const candidates = [
    path.join(packageRoot, 'index.js'),
    path.join(packageRoot, 'index.ts'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to resolve Recoder Code CLI entrypoint for Space worker');
}

function buildWorkerPrompt(assignment: TaskAssignment, bridge: AgentBridgeService): string {
  return [
    'You are Recoder Code running as a connected worker inside a Recoder Space.',
    'Execute the task directly in the current local repository.',
    'Prefer making the smallest correct code changes needed to satisfy the request.',
    'When helpful, run tests, lint, or build commands and leave the repo in a reviewable state.',
    'Do not explain the plan first. Do the work.',
    '',
    `Workspace ID: ${bridge.getWorkspaceId() || 'unknown'}`,
    `Task ID: ${assignment.taskId}`,
    `Assigned Agent ID: ${bridge.getAgentId()}`,
    assignment.worktreeBranch ? `Suggested Worktree Branch: ${assignment.worktreeBranch}` : '',
    '',
    'Task Prompt:',
    assignment.prompt,
    '',
    'Structured Space Context:',
    '```json',
    JSON.stringify(assignment.context, null, 2),
    '```',
  ]
    .filter(Boolean)
    .join('\n');
}

async function prepareExecutionWorkspace(assignment: TaskAssignment): Promise<ExecutionWorkspace> {
  const sourceCwd = process.cwd();
  const gitInfo = await getGitInfo(sourceCwd);
  if (!gitInfo.isRepo || !gitInfo.branch) {
    return {
      cwd: sourceCwd,
      branchName: null,
      baseBranch: null,
      isolated: false,
    };
  }

  const requestedBranch = assignment.worktreeBranch?.trim();
  const branchName = requestedBranch || generateBranchName(assignment.prompt);
  const safeBranchSegment = branchName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'task';
  const worktreePath = path.join(
    os.tmpdir(),
    `recoder-space-${safeBranchSegment}-${assignment.taskId.slice(0, 8)}`,
  );

  if (!existsSync(worktreePath)) {
    const alreadyExists = await branchExists(sourceCwd, branchName);
    await createWorktree(sourceCwd, worktreePath, branchName, !alreadyExists);
  }

  return {
    cwd: worktreePath,
    branchName,
    baseBranch: gitInfo.branch,
    isolated: true,
  };
}

async function runCommand(command: string[], cwd: string, timeoutMs = 30_000): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        command,
        cwd,
        exitCode: 124,
        stdout: truncate(stdout),
        stderr: truncate(`${stderr}\nCommand timed out after ${timeoutMs}ms`),
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        cwd,
        exitCode: 1,
        stdout: truncate(stdout),
        stderr: truncate(`${stderr}\n${error.message}`),
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        cwd,
        exitCode: code ?? 1,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
      });
    });
  });
}

function shouldSkipRepoPath(filePath: string): boolean {
  return (
    filePath.startsWith('.recoder/') ||
    filePath.startsWith('.git/') ||
    filePath.includes('/.recoder/') ||
    filePath.includes('/.git/')
  );
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function isProbablyText(buffer: Buffer): boolean {
  return !buffer.includes(0);
}

function captureRepoSnapshot(cwd: string): RepoSnapshot {
  const files = new Map<string, RepoFileSnapshot>();

  const list = spawnSyncUtf8(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd);
  const paths = list.stdout
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !shouldSkipRepoPath(entry));

  for (const relativePath of paths) {
    const absolutePath = path.join(cwd, relativePath);
    if (!existsSync(absolutePath)) continue;
    const stat = statSync(absolutePath);
    if (!stat.isFile()) continue;

    const buffer = readFileSync(absolutePath);
    const snapshot: RepoFileSnapshot = {
      path: relativePath,
      hash: hashBuffer(buffer),
    };

    if (buffer.byteLength <= MAX_SNAPSHOT_FILE_BYTES && isProbablyText(buffer)) {
      snapshot.content = buffer.toString('utf8');
    }

    files.set(relativePath, snapshot);
  }

  return { files };
}

function spawnSyncUtf8(command: string[], cwd: string): { stdout: string; stderr: string; exitCode: number } {
  const child = spawnSync(command[0], command.slice(1), {
    cwd,
    env: process.env,
    encoding: 'utf8',
  });
  return {
    stdout: child.stdout || '',
    stderr: child.stderr || '',
    exitCode: child.status ?? 1,
  };
}

function buildTaskScopedDiff(before: RepoSnapshot, after: RepoSnapshot) {
  const changedFiles = new Set<string>([
    ...before.files.keys(),
    ...after.files.keys(),
  ]);

  const changedPaths: string[] = [];
  const patches: string[] = [];

  for (const filePath of changedFiles) {
    const previous = before.files.get(filePath);
    const next = after.files.get(filePath);
    const previousHash = previous?.hash ?? null;
    const nextHash = next?.hash ?? null;
    if (previousHash === nextHash) continue;

    changedPaths.push(filePath);

    if (previous?.content === undefined && next?.content === undefined) {
      continue;
    }

    if (!previous) {
      patches.push(
        createTwoFilesPatch('/dev/null', filePath, '', next?.content ?? '', '', '', { context: 3 }),
      );
      continue;
    }

    if (!next) {
      patches.push(
        createTwoFilesPatch(filePath, '/dev/null', previous.content ?? '', '', '', '', { context: 3 }),
      );
      continue;
    }

    patches.push(
      createTwoFilesPatch(filePath, filePath, previous.content ?? '', next.content ?? '', '', '', { context: 3 }),
    );
  }

  return {
    changedPaths,
    diff: patches.filter(Boolean).join('\n'),
  };
}

function writeArtifacts(
  taskId: string,
  prompt: string,
  context: Record<string, unknown>,
  modelRun: ModelRunResult,
  repoArtifacts: RepoArtifacts,
  executionWorkspace: ExecutionWorkspace,
) {
  const artifactDir = path.join(process.cwd(), '.recoder', 'artifacts', taskId);
  mkdirSync(artifactDir, { recursive: true });
  const createdAt = new Date().toISOString();

  const reportPath = path.join(artifactDir, 'report.md');
  const outputPath = path.join(artifactDir, 'model-output.txt');
  const diffPath = path.join(artifactDir, 'git.diff');
  const statusPath = path.join(artifactDir, 'git-status.txt');
  const changedFilesPath = path.join(artifactDir, 'changed-files.txt');

  const report = [
    '# Recoder Space Task Execution Report',
    '',
    `- Task ID: ${taskId}`,
    `- Prompt: ${prompt}`,
    `- Source Working Directory: ${process.cwd()}`,
    `- Execution Directory: ${executionWorkspace.cwd}`,
    `- Isolated Worktree: ${executionWorkspace.isolated ? 'yes' : 'no'}`,
    executionWorkspace.branchName ? `- Execution Branch: ${executionWorkspace.branchName}` : '',
    executionWorkspace.baseBranch ? `- Base Branch: ${executionWorkspace.baseBranch}` : '',
    `- Model Exit Code: ${modelRun.exitCode}`,
    `- Duration (ms): ${modelRun.durationMs}`,
    '',
    '## Context',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
    '',
    '## Repo Status Before/After',
    '### Before',
    '```text',
    repoArtifacts.baselineStatus || '(clean or unavailable)',
    '```',
    '',
    '### After',
    '```text',
    repoArtifacts.finalStatus || '(clean or unavailable)',
    '```',
  ].join('\n');

  const output = [
    '# Model stdout',
    '',
    modelRun.stdout || '(empty)',
    '',
    '# Model stderr',
    '',
    modelRun.stderr || '(empty)',
  ].join('\n');

  writeFileSync(reportPath, report, 'utf8');
  writeFileSync(outputPath, output, 'utf8');
  writeFileSync(diffPath, repoArtifacts.diff || '', 'utf8');
  writeFileSync(statusPath, repoArtifacts.finalStatus || repoArtifacts.baselineStatus || '', 'utf8');
  writeFileSync(changedFilesPath, repoArtifacts.changedFiles || '', 'utf8');

  return {
    report: { path: reportPath, content: readFileSync(reportPath, 'utf8') },
    output: { path: outputPath, content: readFileSync(outputPath, 'utf8') },
    diff: { path: diffPath, content: readFileSync(diffPath, 'utf8') },
    status: { path: statusPath, content: readFileSync(statusPath, 'utf8') },
    changedFiles: { path: changedFilesPath, content: readFileSync(changedFilesPath, 'utf8') },
  };
}

async function claimTask(token: string, bridge: AgentBridgeService, taskId: string): Promise<void> {
  const sessionId = bridge.getSessionId();
  if (!sessionId) {
    throw new Error('Bridge session is not registered yet');
  }

  const response = await fetch(`${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/claim`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      agent_id: bridge.getAgentId(),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Task claim failed (${response.status}): ${text}`);
  }
}

async function publishReviewMetadata(
  token: string,
  taskId: string,
  assignment: TaskAssignment,
  bridge: AgentBridgeService,
  executionWorkspace: ExecutionWorkspace,
  changedFiles: string[],
): Promise<void> {
  const metadataPatch = {
    worktree: {
      isolated: executionWorkspace.isolated,
      branchName: executionWorkspace.branchName,
      baseBranch: executionWorkspace.baseBranch,
      worktreePath: executionWorkspace.cwd,
      taskId,
      reviewReady: true,
      changedFiles,
    },
    handoff: {
      status: 'review-ready',
      intent: 'review',
      prompt: assignment.prompt,
      reviewTarget: executionWorkspace.branchName,
      reviewPath: executionWorkspace.cwd,
      assignedBy: bridge.getAgentId(),
      workspaceId: bridge.getWorkspaceId(),
    },
    merge: {
      status: 'pending-review',
      branchName: executionWorkspace.branchName,
      baseBranch: executionWorkspace.baseBranch,
      changedFiles,
      suggestedAction: executionWorkspace.branchName ? 'review-worktree-branch' : 'review-task-artifacts',
    },
  };

  await fetch(`${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadataPatch,
      triggeredBy: bridge.getAgentId(),
      reason: 'Publish Recoder Space review and merge metadata',
    }),
  });
}

async function runModelDrivenTask(
  assignment: TaskAssignment,
  bridge: AgentBridgeService,
  executionWorkspace: ExecutionWorkspace,
): Promise<ModelRunResult> {
  const cliEntry = resolveCliEntryPath();
  const prompt = buildWorkerPrompt(assignment, bridge);
  const command = [
    process.execPath,
    cliEntry,
    '--prompt',
    prompt,
    '--approval-mode',
    'yolo',
    '--all-files',
  ];

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command[0], command.slice(1), {
      cwd: executionWorkspace.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RECODER_SPACE_DISABLE_AUTO_WORKER: '1',
        GEMINI_CLI_NO_RELAUNCH: 'true',
      },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let progressValue = 20;

    const emitChunk = (label: string, chunk: string) => {
      progressValue = Math.min(progressValue + 5, 85);
      bridge.sendProgress(
        assignment.taskId,
        progressValue,
        `${label}: ${truncate(chunk.trim() || '(empty)', MAX_PROGRESS_OUTPUT_CHARS)}`,
      );
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        exitCode: 124,
        stdout: truncate(stdout),
        stderr: truncate(`${stderr}\nModel-driven worker timed out after ${MODEL_TIMEOUT_MS}ms`),
        durationMs: Date.now() - startedAt,
        command,
      });
    }, MODEL_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      emitChunk('stdout', text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitChunk('stderr', text);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: truncate(stdout),
        stderr: truncate(`${stderr}\n${error.message}`),
        durationMs: Date.now() - startedAt,
        command,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        durationMs: Date.now() - startedAt,
        command,
      });
    });
  });
}

export function installRecoderSpaceAutoWorker(
  bridge: AgentBridgeService,
  getToken: () => Promise<string | null>,
): void {
  bridge.on('task.assigned', (assignment: TaskAssignment) => {
    void (async () => {
      const token = await getToken();
      if (!token) return;

      try {
        await claimTask(token, bridge, assignment.taskId);

        bridge.sendProgress(assignment.taskId, 10, 'Claimed task in current Recoder Space');
        await sleep(150);
        const executionWorkspace = await prepareExecutionWorkspace(assignment);
        const workspaceMessage = executionWorkspace.isolated
          ? `Launching model-driven worker in isolated worktree ${executionWorkspace.branchName}`
          : 'Launching model-driven worker in current checkout';
        bridge.sendProgress(assignment.taskId, 15, workspaceMessage);

        const baselineStatus = await runCommand(['git', 'status', '--short'], executionWorkspace.cwd, 15_000);
        const beforeSnapshot = captureRepoSnapshot(executionWorkspace.cwd);
        const modelRun = await runModelDrivenTask(assignment, bridge, executionWorkspace);
        const afterSnapshot = captureRepoSnapshot(executionWorkspace.cwd);
        const finalStatus = await runCommand(['git', 'status', '--short'], executionWorkspace.cwd, 15_000);
        const taskScoped = buildTaskScopedDiff(beforeSnapshot, afterSnapshot);
        const repoArtifacts: RepoArtifacts = {
          baselineStatus: baselineStatus.stdout || baselineStatus.stderr,
          finalStatus: finalStatus.stdout || finalStatus.stderr,
          diff: taskScoped.diff,
          changedFiles: taskScoped.changedPaths.join('\n'),
        };
        const artifactCreatedAt = new Date().toISOString();
        const artifacts = writeArtifacts(
          assignment.taskId,
          assignment.prompt,
          assignment.context,
          modelRun,
          repoArtifacts,
          executionWorkspace,
        );

        const changedFiles = repoArtifacts.changedFiles
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const summary =
          modelRun.exitCode === 0
            ? `Model-driven Recoder Code worker completed task: ${assignment.prompt}`
            : `Model-driven Recoder Code worker exited with code ${modelRun.exitCode} for task: ${assignment.prompt}`;

        await publishReviewMetadata(
          token,
          assignment.taskId,
          assignment,
          bridge,
          executionWorkspace,
          changedFiles,
        );

        bridge.completeTask(assignment.taskId, {
          text: summary,
          data: {
            source: 'recoder-space-model-worker',
            workspaceId: bridge.getWorkspaceId(),
            executionPath: executionWorkspace.cwd,
            executionBranch: executionWorkspace.branchName,
            baseBranch: executionWorkspace.baseBranch,
            isolatedWorktree: executionWorkspace.isolated,
            exitCode: modelRun.exitCode,
            durationMs: modelRun.durationMs,
            changedFiles,
            command: modelRun.command.join(' '),
          },
          artifacts: [
            {
              key: `${assignment.taskId}-report.md`,
              artifact_type: 'report',
              mime_type: 'text/markdown',
              content: artifacts.report.content,
              path: artifacts.report.path,
              metadata: { createdAt: artifactCreatedAt },
            },
            {
              key: `${assignment.taskId}-model-output.txt`,
              artifact_type: 'log',
              mime_type: 'text/plain',
              content: artifacts.output.content,
              path: artifacts.output.path,
              metadata: { createdAt: artifactCreatedAt },
            },
            {
              key: `${assignment.taskId}-git.diff`,
              artifact_type: 'patch',
              mime_type: 'text/x-diff',
              content: artifacts.diff.content,
              path: artifacts.diff.path,
              metadata: { createdAt: artifactCreatedAt },
            },
            {
              key: `${assignment.taskId}-git-status.txt`,
              artifact_type: 'log',
              mime_type: 'text/plain',
              content: artifacts.status.content,
              path: artifacts.status.path,
              metadata: { createdAt: artifactCreatedAt },
            },
            {
              key: `${assignment.taskId}-changed-files.txt`,
              artifact_type: 'log',
              mime_type: 'text/plain',
              content: artifacts.changedFiles.content,
              path: artifacts.changedFiles.path,
              metadata: { createdAt: artifactCreatedAt },
            },
          ],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown task execution error';
        bridge.failTask(assignment.taskId, message);
      }
    })();
  });
}
