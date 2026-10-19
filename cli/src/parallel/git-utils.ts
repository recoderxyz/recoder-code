/**
 * Git utilities for parallel mode
 * Based on Kilo Code (Apache-2.0 License)
 */

import simpleGit, { SimpleGit } from 'simple-git';

export interface GitInfo {
  branch: string | null;
  isClean: boolean;
  isRepo: boolean;
}

/**
 * Get Git repository information for a given directory
 */
export async function getGitInfo(cwd: string): Promise<GitInfo> {
  const defaultResult: GitInfo = {
    branch: null,
    isClean: true,
    isRepo: false,
  };

  if (!cwd) {
    return defaultResult;
  }

  try {
    const git: SimpleGit = simpleGit(cwd);

    // Check if it's a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return defaultResult;
    }

    // Get current branch
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

    // Check if working directory is clean
    const status = await git.status();
    const isClean = status.files.length === 0;

    return {
      branch: branch.trim() || null,
      isClean,
      isRepo: true,
    };
  } catch (error) {
    console.debug('Failed to get git info:', error);
    return defaultResult;
  }
}

/**
 * Get just the branch name (faster than full git info)
 */
export async function getGitBranch(cwd: string): Promise<string | null> {
  if (!cwd) {
    return null;
  }

  try {
    const git: SimpleGit = simpleGit(cwd);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return null;
    }

    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim() || null;
  } catch (error) {
    console.debug('Failed to get git branch:', error);
    return null;
  }
}

/**
 * Check if a branch exists in the repository
 */
export async function branchExists(cwd: string, branchName: string): Promise<boolean> {
  if (!cwd || !branchName) {
    return false;
  }

  try {
    const git: SimpleGit = simpleGit(cwd);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return false;
    }

    // Get all branches (local and remote)
    const branches = await git.branch();

    // Check if branch exists in local branches
    return branches.all.includes(branchName) || branches.all.includes(`remotes/origin/${branchName}`);
  } catch (error) {
    console.debug('Failed to check if branch exists:', error);
    return false;
  }
}

/**
 * Generate a valid git branch name from a prompt
 * Sanitizes the prompt to create a safe branch name
 */
export function generateBranchName(prompt: string): string {
  // Take first 50 chars, convert to lowercase, replace spaces and special chars with hyphens
  const sanitized = prompt
    .slice(0, 50)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens

  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  return `recoder/${sanitized || 'task'}-${timestamp}`;
}

/**
 * Check if a directory is a git worktree
 */
export async function isGitWorktree(cwd: string): Promise<boolean> {
  if (!cwd) {
    return false;
  }

  try {
    const git: SimpleGit = simpleGit(cwd);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return false;
    }

    // In a worktree, --git-dir points to .git/worktrees/<name>
    // In a normal repo, --git-dir points to .git
    const gitDir = await git.revparse(['--git-dir']);
    return gitDir.trim().includes('worktrees');
  } catch (error) {
    console.debug('Failed to check if git worktree:', error);
    return false;
  }
}

/**
 * Create a git worktree
 */
export async function createWorktree(
  cwd: string,
  worktreePath: string,
  branchName: string,
  isNewBranch: boolean
): Promise<void> {
  const git = simpleGit(cwd);

  const args = isNewBranch
    ? ['worktree', 'add', '-b', branchName, worktreePath]
    : ['worktree', 'add', worktreePath, branchName];

  await git.raw(args);
}

/**
 * Remove a git worktree
 */
export async function removeWorktree(cwd: string, worktreePath: string): Promise<void> {
  const git = simpleGit(cwd);
  await git.raw(['worktree', 'remove', worktreePath]);
}

/**
 * List all worktrees for a repository
 */
export async function listWorktrees(cwd: string): Promise<string[]> {
  try {
    const git = simpleGit(cwd);
    const result = await git.raw(['worktree', 'list', '--porcelain']);

    const worktrees: string[] = [];
    const lines = result.split('\n');

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktrees.push(line.replace('worktree ', '').trim());
      }
    }

    return worktrees;
  } catch (error) {
    console.debug('Failed to list worktrees:', error);
    return [];
  }
}
