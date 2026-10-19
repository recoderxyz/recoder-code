/**
 * Parallel Mode - Git Worktree-based Parallel Execution
 *
 * Allows multiple Recoder instances to work on the same repository
 * without conflicts by using separate git worktrees.
 *
 * Usage:
 *   recoder --parallel "implement feature X"
 *   recoder --parallel --existing-branch recoder/feature-x-123 "continue work"
 *
 * Based on Kilo Code (Apache-2.0 License)
 */

export {
  startParallelMode,
  finishParallelMode,
  getParallelModeParams,
  listParallelWorktrees,
  cleanupStaleWorktrees,
  type ParallelModeInput,
  type ParallelModeParams,
  type ParallelModeResult,
} from './parallel-mode.js';

export {
  getGitInfo,
  getGitBranch,
  branchExists,
  generateBranchName,
  isGitWorktree,
  createWorktree,
  removeWorktree,
  listWorktrees,
  type GitInfo,
} from './git-utils.js';
