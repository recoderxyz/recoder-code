/**
 * Parallel Mode - Execute multiple tasks simultaneously using git worktrees
 * Based on Kilo Code (Apache-2.0 License)
 *
 * Parallel mode allows multiple Recoder instances to work on the same repository
 * without conflicts. Each instance operates in a separate git worktree.
 */

import path from 'path';
import os from 'os';
import simpleGit from 'simple-git';
import {
  getGitInfo,
  generateBranchName,
  branchExists,
  createWorktree,
  removeWorktree,
} from './git-utils.js';

export const COMMIT_COMPLETION_TIMEOUT = 40000;

export interface ParallelModeInput {
  cwd: string;
  prompt: string;
  timeout?: number;
  existingBranch?: string;
}

export interface ParallelModeParams {
  worktreeBranch: string;
  worktreePath: string;
}

export interface ParallelModeResult {
  success: boolean;
  branch: string;
  worktreePath: string;
  message: string;
}

/**
 * Determine the branch and worktree path for parallel mode
 */
export async function determineParallelBranch({
  cwd,
  prompt,
  existingBranch,
}: ParallelModeInput): Promise<ParallelModeParams> {
  const { isRepo, branch } = await getGitInfo(cwd);

  if (!isRepo) {
    throw new Error('Parallel mode requires the current working directory to be a git repository');
  }

  if (!branch) {
    throw new Error('Could not determine current git branch');
  }

  // Determine the branch to use
  let worktreeBranch: string;

  if (existingBranch) {
    // Check if the existing branch exists
    const exists = await branchExists(cwd, existingBranch);

    if (!exists) {
      throw new Error(`Branch "${existingBranch}" does not exist`);
    }

    worktreeBranch = existingBranch;
    console.log(`📌 Using existing branch: ${worktreeBranch}`);
  } else {
    // Generate branch name from prompt
    worktreeBranch = generateBranchName(prompt);
    console.log(`🌿 Creating new branch: ${worktreeBranch}`);
  }

  // Create worktree directory path in OS temp directory
  const tempDir = os.tmpdir();
  const worktreePath = path.join(tempDir, `recoder-worktree-${worktreeBranch.replace(/\//g, '-')}`);

  // Create worktree
  try {
    await createWorktree(cwd, worktreePath, worktreeBranch, !existingBranch);
    console.log(`📁 Created worktree at: ${worktreePath}`);
  } catch (error) {
    console.error('Failed to create worktree:', error);
    throw error;
  }

  return { worktreeBranch, worktreePath };
}

/**
 * Get parameters for parallel mode execution
 */
export async function getParallelModeParams({
  cwd,
  prompt,
  existingBranch,
}: ParallelModeInput): Promise<ParallelModeParams> {
  try {
    return await determineParallelBranch({ cwd, prompt, existingBranch });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start parallel mode: ${message}`);
    throw error;
  }
}

/**
 * Helper function to commit changes with a fallback message
 */
async function commitWithFallback(cwd: string): Promise<void> {
  const fallbackMessage = 'chore: recoder parallel mode task completion';
  const git = simpleGit(cwd);

  await git.commit(fallbackMessage);
  console.log('📝 Changes committed with fallback message');
}

/**
 * Poll git status to check if commit is complete
 * Returns true if commit was made, false if timeout reached
 */
async function waitForCommitCompletion(cwd: string): Promise<boolean> {
  const pollIntervalMs = 1000;
  const startTime = Date.now();
  const git = simpleGit(cwd);

  while (Date.now() - startTime < COMMIT_COMPLETION_TIMEOUT) {
    try {
      const stagedDiff = await git.diff(['--staged']);

      // If no staged changes, commit was successful
      if (!stagedDiff.trim()) {
        return true;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error('Error checking commit status:', error);
      return false;
    }
  }

  return false;
}

/**
 * Finish parallel mode by committing changes and cleaning up worktree
 */
export async function finishParallelMode(
  worktreePath: string,
  worktreeBranch: string,
  originalCwd: string
): Promise<ParallelModeResult> {
  const git = simpleGit(worktreePath);

  try {
    const status = await git.status();

    if (!status.isClean()) {
      console.log('📦 Staging all changes...');
      await git.add('-A');

      const diff = await git.diff(['--staged']);

      if (!diff.trim()) {
        console.warn('⚠️ No staged changes found after git add');
      } else {
        console.log('📝 Committing changes...');
        await commitWithFallback(worktreePath);
      }
    } else {
      console.log('✨ No changes to commit');
    }

    // Print completion message
    const green = '\x1b[32m';
    const cyan = '\x1b[36m';
    const yellow = '\x1b[33m';
    const bold = '\x1b[1m';
    const reset = '\x1b[0m';

    console.log('\n' + cyan + '─'.repeat(80) + reset);
    console.log(
      `${green}✓${reset} ${bold}Parallel mode complete!${reset} Changes committed to: ${cyan}${worktreeBranch}${reset}`
    );
    console.log(`\n${bold}Review and merge changes:${reset}`);
    console.log(`  ${yellow}git diff ...${worktreeBranch}${reset}`);
    console.log(`  ${yellow}git merge ${worktreeBranch}${reset}`);
    console.log(`\n${bold}💡 Tip:${reset} Resume work with ${yellow}--existing-branch${reset}:`);
    console.log(`  ${yellow}recoder --parallel --existing-branch ${worktreeBranch} "<prompt>"${reset}`);
    console.log(cyan + '─'.repeat(80) + reset + '\n');

    return {
      success: true,
      branch: worktreeBranch,
      worktreePath,
      message: `Changes committed to branch: ${worktreeBranch}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to commit changes:', errorMessage);

    return {
      success: false,
      branch: worktreeBranch,
      worktreePath,
      message: `Failed to commit: ${errorMessage}`,
    };
  } finally {
    // Clean up worktree
    try {
      console.log(`🧹 Removing worktree at: ${worktreePath}`);
      await removeWorktree(originalCwd, worktreePath);
      console.log('✅ Worktree removed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('⚠️ Failed to remove worktree:', errorMessage);
    }
  }
}

/**
 * Start parallel mode - creates worktree and returns the working directory
 */
export async function startParallelMode(
  cwd: string,
  prompt: string,
  existingBranch?: string
): Promise<ParallelModeParams> {
  console.log('\n🚀 Starting Recoder Parallel Mode...\n');

  const params = await getParallelModeParams({
    cwd,
    prompt,
    existingBranch,
  });

  console.log(`\n✅ Parallel mode ready!`);
  console.log(`📍 Working in: ${params.worktreePath}`);
  console.log(`🌿 Branch: ${params.worktreeBranch}\n`);

  return params;
}

/**
 * List active parallel mode worktrees
 */
export async function listParallelWorktrees(cwd: string): Promise<string[]> {
  const git = simpleGit(cwd);

  try {
    const result = await git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: string[] = [];
    const lines = result.split('\n');

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        const path = line.replace('worktree ', '').trim();
        // Only include recoder worktrees
        if (path.includes('recoder-worktree-')) {
          worktrees.push(path);
        }
      }
    }

    return worktrees;
  } catch (error) {
    console.debug('Failed to list worktrees:', error);
    return [];
  }
}

/**
 * Clean up stale parallel mode worktrees
 */
export async function cleanupStaleWorktrees(cwd: string): Promise<number> {
  const worktrees = await listParallelWorktrees(cwd);
  let cleaned = 0;

  for (const worktreePath of worktrees) {
    try {
      await removeWorktree(cwd, worktreePath);
      cleaned++;
      console.log(`🧹 Removed stale worktree: ${worktreePath}`);
    } catch (error) {
      console.debug(`Failed to remove worktree ${worktreePath}:`, error);
    }
  }

  return cleaned;
}
