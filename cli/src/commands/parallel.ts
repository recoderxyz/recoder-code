/**
 * 'recoder parallel' command
 * Run tasks in parallel using git worktrees
 *
 * Based on Kilo Code (Apache-2.0 License)
 */

import type { CommandModule } from 'yargs';
import {
  startParallelMode,
  finishParallelMode,
  listParallelWorktrees,
  cleanupStaleWorktrees,
} from '../parallel/index.js';

interface ParallelArgs {
  prompt?: string;
  'existing-branch'?: string;
  list?: boolean;
  cleanup?: boolean;
}

export const parallelCommand: CommandModule<{}, ParallelArgs> = {
  command: 'parallel [prompt]',
  describe: 'Run tasks in parallel using git worktrees',
  builder: (yargs) =>
    yargs
      .positional('prompt', {
        type: 'string',
        describe: 'Task prompt to execute in parallel mode',
      })
      .option('existing-branch', {
        alias: 'b',
        type: 'string',
        describe: 'Resume work on an existing parallel branch',
      })
      .option('list', {
        alias: 'l',
        type: 'boolean',
        describe: 'List active parallel mode worktrees',
      })
      .option('cleanup', {
        alias: 'c',
        type: 'boolean',
        describe: 'Clean up stale parallel mode worktrees',
      })
      .example([
        ['$0 parallel "implement user auth"', 'Start parallel task with new branch'],
        ['$0 parallel -b recoder/user-auth-123 "continue work"', 'Resume existing branch'],
        ['$0 parallel --list', 'List active parallel worktrees'],
        ['$0 parallel --cleanup', 'Clean up stale worktrees'],
      ]),
  handler: async (argv) => {
    const cwd = process.cwd();

    // Handle list command
    if (argv.list) {
      console.log('\n📋 Active parallel mode worktrees:\n');
      const worktrees = await listParallelWorktrees(cwd);

      if (worktrees.length === 0) {
        console.log('   No active parallel worktrees found.\n');
      } else {
        for (const wt of worktrees) {
          console.log(`   📁 ${wt}`);
        }
        console.log();
      }
      return;
    }

    // Handle cleanup command
    if (argv.cleanup) {
      console.log('\n🧹 Cleaning up stale parallel mode worktrees...\n');
      const cleaned = await cleanupStaleWorktrees(cwd);

      if (cleaned === 0) {
        console.log('   No stale worktrees to clean up.\n');
      } else {
        console.log(`\n✅ Cleaned up ${cleaned} stale worktree(s).\n`);
      }
      return;
    }

    // Require prompt for starting parallel mode
    if (!argv.prompt) {
      console.log('\n⚠️  Please provide a task prompt.\n');
      console.log('Usage:');
      console.log('  recoder parallel "your task description"');
      console.log('  recoder parallel --existing-branch <branch> "continue task"');
      console.log('  recoder parallel --list');
      console.log('  recoder parallel --cleanup\n');
      return;
    }

    try {
      // Start parallel mode
      const params = await startParallelMode(cwd, argv.prompt, argv['existing-branch']);

      console.log('\n📍 You can now work in the worktree directory:');
      console.log(`   cd ${params.worktreePath}\n`);
      console.log('💡 When done, run your task and then call:');
      console.log('   recoder parallel finish\n');

      // Store the worktree info for later
      console.log('Worktree info stored. Use "recoder parallel finish" when done.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to start parallel mode: ${message}\n`);
      process.exit(1);
    }
  },
};

interface ParallelFinishArgs {
  worktree?: string;
  branch?: string;
}

export const parallelFinishCommand: CommandModule<{}, ParallelFinishArgs> = {
  command: 'parallel-finish',
  describe: 'Finish parallel mode and commit changes',
  builder: (yargs) =>
    yargs
      .option('worktree', {
        alias: 'w',
        type: 'string',
        describe: 'Path to the worktree to finish',
      })
      .option('branch', {
        alias: 'b',
        type: 'string',
        describe: 'Branch name of the worktree',
      }),
  handler: async (argv) => {
    const cwd = process.cwd();

    // If worktree and branch provided, use them
    if (argv.worktree && argv.branch) {
      try {
        const result = await finishParallelMode(argv.worktree, argv.branch, cwd);

        if (result.success) {
          console.log(`\n✅ ${result.message}\n`);
        } else {
          console.error(`\n❌ ${result.message}\n`);
          process.exit(1);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ Failed to finish parallel mode: ${message}\n`);
        process.exit(1);
      }
      return;
    }

    // Otherwise, try to detect from current directory
    console.log('\n⚠️  Please provide worktree and branch:');
    console.log('   recoder parallel-finish --worktree <path> --branch <branch>\n');
    console.log('Or use "recoder parallel --list" to see active worktrees.\n');
  },
};
