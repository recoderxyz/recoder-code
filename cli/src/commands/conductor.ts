/**
 * `recoder conductor` — end-to-end client for the parallel-agent conductor.
 *
 * Subcommands hit `/api/conductor/*` (workspaces: list/create/get/diff/merge/pr/
 * archive, raw tmux sessions, health) and the device-flow auth endpoints at
 * `/api/auth/cli/*`. Backend URL + credential are resolved from the environment
 * and the `~/.recoder/auth.json` token store via `conductor-config`.
 *
 * Every command is degrade-safe and truthful: it prints the real backend error
 * (including "not authenticated" / "cannot reach backend") rather than faking
 * success, and surfaces approval-gate 409s from PR/merge as a clear next step.
 *
 * Ported into recoder-code from the legacy packages/cli conductor command set,
 * re-expressed as a yargs CommandModule to match recoder-code conventions.
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import {
  createConductorClient,
  type ConductorWorkspace,
} from '../services/conductor/conductor-client.js';
import { createConductorAuthClient } from '../services/conductor/conductor-auth.js';
import {
  resolveBackendUrl,
  resolveCredential,
  readAuthData,
  clearAuthData,
} from '../services/conductor/conductor-config.js';

function stateColor(state: string): string {
  switch (state) {
    case 'merged':
    case 'ready':
      return chalk.green(state);
    case 'running':
    case 'merging':
    case 'setting_up':
      return chalk.cyan(state);
    case 'awaiting_approval':
    case 'awaiting_review':
    case 'changes_requested':
      return chalk.yellow(state);
    case 'failed':
    case 'cancelled':
      return chalk.red(state);
    default:
      return chalk.gray(state);
  }
}

function printWorkspaceRow(ws: ConductorWorkspace): void {
  console.log(
    `  ${chalk.white(ws.workspaceId)}  ${stateColor(ws.state)}  ` +
      `${chalk.gray(ws.runtimeId)}  ${chalk.gray(ws.branch)} ← ${chalk.gray(ws.baseRef)}`,
  );
}

function printWorkspaceDetail(ws: ConductorWorkspace): void {
  console.log(chalk.cyan('\nWorkspace'));
  console.log(`  ID:        ${chalk.white(ws.workspaceId)}`);
  console.log(`  State:     ${stateColor(ws.state)}`);
  console.log(`  Runtime:   ${ws.runtimeId} (${ws.substrate})`);
  console.log(`  Branch:    ${ws.branch} ← ${ws.baseRef}`);
  console.log(`  Space:     ${ws.spaceId} / project ${ws.projectId} / task ${ws.taskId}`);
  if (ws.runId) console.log(`  Run:       ${ws.runId}`);
  if (ws.worktreePath) console.log(`  Worktree:  ${ws.worktreePath}`);
  if (ws.sessionName) console.log(`  Session:   ${ws.sessionName}`);
  console.log(`  Created:   ${ws.createdAt} by ${ws.createdBy}`);
}

/** Require a credential; print guidance and return false when absent. */
function ensureAuthenticated(): boolean {
  if (resolveCredential()) {
    return true;
  }
  console.log(chalk.yellow('\nNot authenticated.'));
  console.log(chalk.gray('Run "recoder conductor login" (device flow), or set one of:'));
  console.log(chalk.gray('  RECODER_API_KEY=sk_...    (first-party platform key)'));
  console.log(chalk.gray('  RECODER_TOKEN=<token>     (explicit bearer token)\n'));
  return false;
}

// --- auth: login / whoami / logout -----------------------------------------

const loginCommand: CommandModule = {
  command: 'login',
  describe: 'Authenticate to recoder.xyz via device flow (RFC 8628)',
  builder: (yargs: Argv) =>
    yargs
      .option('client-id', { type: 'string', describe: 'OAuth client id for the device grant' })
      .option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    console.log(chalk.cyan('\nRecoder Conductor — Device Login\n'));
    const client = createConductorAuthClient(argv.url);
    console.log(chalk.gray(`Backend: ${client.baseUrl}`));

    const result = await client.login({
      clientId: argv['client-id'],
      onPrompt: (auth) => {
        console.log(chalk.white(`\n1. Open: ${chalk.underline(auth.verificationUri)}`));
        console.log(chalk.white(`2. Enter code: ${chalk.yellow(auth.userCode)}`));
        if (auth.verificationUriComplete) {
          console.log(chalk.gray(`   Or visit directly: ${auth.verificationUriComplete}`));
        }
        console.log(chalk.blue('\nWaiting for authorization...'));
      },
      onPoll: () => process.stdout.write(chalk.gray('.')),
    });

    console.log('');
    if (!result.ok) {
      console.log(chalk.red(`\nLogin failed: ${result.error}`));
      process.exitCode = 1;
      return;
    }
    const email = result.data?.email || 'authenticated user';
    console.log(chalk.green(`\nLogged in as ${email}`));
    console.log(chalk.gray('Token stored at ~/.recoder/auth.json\n'));
  },
};

const whoamiCommand: CommandModule = {
  command: 'whoami',
  describe: 'Show the current credential + verify it against recoder.xyz',
  builder: (yargs: Argv) =>
    yargs.option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    const cred = resolveCredential();
    const baseUrl = resolveBackendUrl(argv.url);
    console.log(chalk.cyan('\nRecoder Conductor — Identity\n'));
    console.log(chalk.gray(`Backend: ${baseUrl}`));

    if (!cred) {
      console.log(chalk.yellow('No credential configured (not authenticated).\n'));
      return;
    }
    console.log(chalk.white(`Credential source: ${cred.source}`));

    const auth = readAuthData();
    if (auth?.user) {
      console.log(
        chalk.white(`User: ${auth.user.email} (${auth.user.subscription_plan || 'unknown plan'})`),
      );
    }

    // Only a device-flow access token can be verified server-side.
    if (cred.source === 'auth-store' && auth?.access_token) {
      const authClient = createConductorAuthClient(argv.url);
      const verify = await authClient.verify(auth.access_token);
      if (verify.ok && verify.data?.valid) {
        console.log(chalk.green('Token verified against recoder.xyz\n'));
      } else if (verify.ok) {
        console.log(chalk.red('Token is no longer valid — run "recoder conductor login"\n'));
      } else {
        console.log(chalk.yellow(`Could not verify token: ${verify.error}\n`));
      }
    } else {
      console.log(chalk.gray('(verify is only available for device-flow tokens)\n'));
    }
  },
};

const logoutCommand: CommandModule = {
  command: 'logout',
  describe: 'Remove the stored device-flow token',
  handler: async () => {
    await clearAuthData();
    console.log(chalk.green('\nLogged out — removed ~/.recoder/auth.json\n'));
  },
};

// --- health + sessions -----------------------------------------------------

const healthCommand: CommandModule = {
  command: 'health',
  describe: 'Show conductor substrate availability',
  builder: (yargs: Argv) =>
    yargs.option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    console.log(chalk.cyan('\nConductor Health\n'));
    console.log(chalk.gray(`Backend: ${client.baseUrl}`));
    const result = await client.health();
    if (!result.ok) {
      console.log(chalk.red(`\nHealth check failed: ${result.error}\n`));
      process.exitCode = 1;
      return;
    }
    const data = result.data!;
    const available = data.available !== false;
    console.log(
      available ? chalk.green('\nConductor available') : chalk.red('\nConductor unavailable'),
    );
    if (data.reason) console.log(chalk.gray(`Reason: ${data.reason}`));
    console.log(chalk.gray(`\n${JSON.stringify(data, null, 2)}\n`));
  },
};

const sessionsCommand: CommandModule = {
  command: 'sessions',
  describe: 'List raw tmux sessions managed by the conductor',
  builder: (yargs: Argv) =>
    yargs.option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    const result = await client.listSessions();
    console.log(chalk.cyan('\nConductor Sessions\n'));
    if (!result.ok) {
      console.log(chalk.red(`Failed: ${result.error}\n`));
      process.exitCode = 1;
      return;
    }
    const sessions = result.data || [];
    if (sessions.length === 0) {
      console.log(chalk.gray('No active sessions.\n'));
      return;
    }
    sessions.forEach((s) => console.log(`  ${chalk.white(s.sessionId)}`));
    console.log('');
  },
};

// --- workspaces: list / get / create / diff / merge / pr / archive ---------

const listCommand: CommandModule = {
  command: 'list',
  aliases: ['ls'],
  describe: 'List conductor workspaces',
  builder: (yargs: Argv) =>
    yargs
      .option('url', { type: 'string', describe: 'Backend base URL override' })
      .option('json', { type: 'boolean', describe: 'Output raw JSON', default: false }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    const result = await client.listWorkspaces();
    if (!result.ok) {
      console.log(chalk.red(`\nFailed to list workspaces: ${result.error}\n`));
      process.exitCode = 1;
      return;
    }
    if (argv.json) {
      console.log(JSON.stringify(result.data, null, 2));
      return;
    }
    const workspaces = result.data || [];
    console.log(chalk.cyan(`\nWorkspaces (${workspaces.length})\n`));
    if (workspaces.length === 0) {
      console.log(chalk.gray('No workspaces. Create one with "recoder conductor create".\n'));
      return;
    }
    workspaces.forEach(printWorkspaceRow);
    console.log('');
  },
};

const getCommand: CommandModule = {
  command: 'get <workspaceId>',
  describe: 'Show a single workspace',
  builder: (yargs: Argv) =>
    yargs
      .positional('workspaceId', { type: 'string', describe: 'Workspace id' })
      .option('url', { type: 'string', describe: 'Backend base URL override' })
      .option('json', { type: 'boolean', describe: 'Output raw JSON', default: false }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    const result = await client.getWorkspace(argv.workspaceId);
    if (!result.ok) {
      console.log(chalk.red(`\nFailed: ${result.error}\n`));
      process.exitCode = 1;
      return;
    }
    if (argv.json) {
      console.log(JSON.stringify(result.data, null, 2));
      return;
    }
    printWorkspaceDetail(result.data!);
    console.log('');
  },
};

const createCommand: CommandModule = {
  command: 'create',
  describe: 'Create + launch a workspace (isolated worktree + agent run)',
  builder: (yargs: Argv) =>
    yargs
      .option('space', { type: 'string', describe: 'Space id', demandOption: true })
      .option('project', { type: 'string', describe: 'Project id', demandOption: true })
      .option('task', { type: 'string', describe: 'Task id', demandOption: true })
      .option('repo', {
        type: 'string',
        describe: 'Absolute repo path on the backend host',
        demandOption: true,
      })
      .option('prompt', {
        type: 'string',
        describe: 'Agent prompt (one of --prompt|--command required)',
      })
      .option('command', {
        type: 'string',
        describe: 'Raw command to run (one of --prompt|--command required)',
      })
      .option('runtime', {
        type: 'string',
        describe: 'Runtime id (optional — backend planner defaults it)',
      })
      .option('substrate', {
        type: 'string',
        describe: 'Execution substrate (tmux_worktree|daytona|in_process)',
      })
      .option('model', { type: 'string', describe: 'Model id' })
      .option('branch', { type: 'string', describe: 'Branch name for the worktree' })
      .option('base-ref', { type: 'string', describe: 'Base ref to cut the branch from' })
      .option('created-by', { type: 'string', describe: 'Creator id', default: 'cli' })
      .option('url', { type: 'string', describe: 'Backend base URL override' })
      .option('json', { type: 'boolean', describe: 'Output raw JSON', default: false }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    if (!argv.prompt && !argv.command) {
      console.log(chalk.red('\nOne of --prompt or --command is required.\n'));
      process.exitCode = 1;
      return;
    }
    const client = createConductorClient({ baseUrl: argv.url });
    console.log(chalk.cyan('\nCreating workspace...\n'));
    const result = await client.createWorkspace({
      spaceId: argv.space,
      projectId: argv.project,
      taskId: argv.task,
      repoPath: argv.repo,
      createdBy: argv['created-by'],
      prompt: argv.prompt,
      command: argv.command,
      runtimeId: argv.runtime,
      substrate: argv.substrate,
      model: argv.model,
      branch: argv.branch,
      baseRef: argv['base-ref'],
    });
    if (!result.ok) {
      console.log(chalk.red(`Create failed: ${result.error}`));
      if (result.status === 429) {
        console.log(chalk.yellow('(resource budget exceeded — retry later)'));
      }
      process.exitCode = 1;
      return;
    }
    if (argv.json) {
      console.log(JSON.stringify(result.data, null, 2));
      return;
    }
    console.log(chalk.green('Workspace created.'));
    printWorkspaceDetail(result.data!);
    console.log('');
  },
};

const diffCommand: CommandModule = {
  command: 'diff <workspaceId>',
  describe: "Show the workspace's diff against its base ref",
  builder: (yargs: Argv) =>
    yargs
      .positional('workspaceId', { type: 'string', describe: 'Workspace id' })
      .option('url', { type: 'string', describe: 'Backend base URL override' })
      .option('json', { type: 'boolean', describe: 'Output raw JSON', default: false }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    const result = await client.diffWorkspace(argv.workspaceId);
    if (!result.ok) {
      console.log(chalk.red(`\nDiff failed: ${result.error}\n`));
      process.exitCode = 1;
      return;
    }
    if (argv.json) {
      console.log(JSON.stringify(result.data, null, 2));
      return;
    }
    const diff = result.data!;
    if (typeof diff.patch === 'string' && diff.patch.length > 0) {
      console.log(diff.patch);
      return;
    }
    if (Array.isArray(diff.files) && diff.files.length > 0) {
      console.log(chalk.cyan(`\nChanged files (${diff.files.length})\n`));
      diff.files.forEach((f) => {
        const stat = `+${f.additions ?? 0}/-${f.deletions ?? 0}`;
        console.log(`  ${chalk.white(f.path)}  ${chalk.gray(stat)}`);
      });
      console.log('');
      return;
    }
    console.log(chalk.gray('\nNo changes.\n'));
  },
};

const mergeCommand: CommandModule = {
  command: 'merge <workspaceId>',
  describe: 'Merge the workspace PR (approval-gated)',
  builder: (yargs: Argv) =>
    yargs
      .positional('workspaceId', { type: 'string', describe: 'Workspace id' })
      .option('strategy', { type: 'string', describe: 'Merge strategy (merge|squash|rebase)' })
      .option('delete-branch', {
        type: 'boolean',
        describe: 'Delete the branch after merge',
        default: false,
      })
      .option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    console.log(chalk.cyan(`\nMerging workspace ${argv.workspaceId}...\n`));
    const result = await client.mergeWorkspace(argv.workspaceId, {
      strategy: argv.strategy,
      deleteBranch: argv['delete-branch'],
    });
    if (!result.ok) {
      if (result.status === 409) {
        console.log(chalk.yellow(`Approval required: ${result.error}`));
        console.log(
          chalk.gray('The workspace was moved to awaiting_approval. Approve it, then retry.\n'),
        );
      } else {
        console.log(chalk.red(`Merge failed: ${result.error}\n`));
      }
      process.exitCode = 1;
      return;
    }
    console.log(chalk.green('Merge succeeded.'));
    console.log(chalk.gray(`${JSON.stringify(result.data, null, 2)}\n`));
  },
};

const prCommand: CommandModule = {
  command: 'pr <workspaceId>',
  describe: 'Open a PR for the workspace branch (approval-gated)',
  builder: (yargs: Argv) =>
    yargs
      .positional('workspaceId', { type: 'string', describe: 'Workspace id' })
      .option('title', { type: 'string', describe: 'PR title' })
      .option('body', { type: 'string', describe: 'PR body' })
      .option('base', { type: 'string', describe: 'Base branch for the PR' })
      .option('draft', { type: 'boolean', describe: 'Open as draft', default: false })
      .option('remote', { type: 'string', describe: 'Git remote' })
      .option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    console.log(chalk.cyan(`\nOpening PR for workspace ${argv.workspaceId}...\n`));
    const result = await client.openPr(argv.workspaceId, {
      title: argv.title,
      body: argv.body,
      base: argv.base,
      draft: argv.draft,
      remote: argv.remote,
    });
    if (!result.ok) {
      if (result.status === 409) {
        console.log(chalk.yellow(`Approval required: ${result.error}`));
        console.log(
          chalk.gray('The workspace was moved to awaiting_approval. Approve it, then retry.\n'),
        );
      } else {
        console.log(chalk.red(`PR failed: ${result.error}\n`));
      }
      process.exitCode = 1;
      return;
    }
    console.log(chalk.green('PR opened.'));
    if (result.data?.url) console.log(chalk.white(`URL: ${result.data.url}`));
    console.log('');
  },
};

const archiveCommand: CommandModule = {
  command: 'archive <workspaceId>',
  describe: 'Archive a finished workspace (stop session, remove worktree)',
  builder: (yargs: Argv) =>
    yargs
      .positional('workspaceId', { type: 'string', describe: 'Workspace id' })
      .option('url', { type: 'string', describe: 'Backend base URL override' }),
  handler: async (argv: any) => {
    if (!ensureAuthenticated()) return;
    const client = createConductorClient({ baseUrl: argv.url });
    const result = await client.archiveWorkspace(argv.workspaceId);
    if (!result.ok) {
      console.log(chalk.red(`\nArchive failed: ${result.error}\n`));
      process.exitCode = 1;
      return;
    }
    console.log(chalk.green(`\nWorkspace ${argv.workspaceId} archived.\n`));
  },
};

export const conductorCommand: CommandModule = {
  command: 'conductor',
  aliases: ['cd'],
  describe: 'Drive the parallel-agent conductor (workspaces, sessions, auth)',
  builder: (yargs: Argv) =>
    yargs
      .command(loginCommand)
      .command(whoamiCommand)
      .command(logoutCommand)
      .command(healthCommand)
      .command(sessionsCommand)
      .command(listCommand)
      .command(getCommand)
      .command(createCommand)
      .command(diffCommand)
      .command(mergeCommand)
      .command(prCommand)
      .command(archiveCommand)
      .demandCommand(1, 'You need at least one command. Try: recoder conductor list')
      .version(false),
  handler: () => {
    // yargs shows help automatically when no subcommand is provided.
  },
};

export default conductorCommand;
