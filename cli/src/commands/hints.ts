/**
 * Hints command - Manage project hints
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import { loadHints, createHintsFile, hasHints } from '../utils/hints.js';

const showCommand: CommandModule = {
  command: 'show',
  describe: 'Show current project hints',
  handler: async () => {
    const hints = loadHints();
    if (hints) {
      console.log(chalk.cyan(`\n📋 Hints from ${hints.filePath}\n`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(hints.content);
    } else {
      console.log(chalk.yellow('\n⚠️  No hints file found'));
      console.log(chalk.gray('  Create one with: recoder hints init\n'));
    }
    process.exit(0);
  },
};

const initCommand: CommandModule = {
  command: 'init',
  describe: 'Create a .recoderhints file',
  handler: async () => {
    if (hasHints()) {
      console.log(chalk.yellow('\n⚠️  Hints file already exists'));
      const hints = loadHints();
      if (hints) {
        console.log(chalk.gray(`  Location: ${hints.filePath}\n`));
      }
    } else {
      const filePath = createHintsFile();
      console.log(chalk.green(`\n✓ Created ${filePath}`));
      console.log(chalk.gray('  Edit this file to add project context for the AI\n'));
    }
    process.exit(0);
  },
};

export const hintsCommand: CommandModule = {
  command: 'hints',
  describe: 'Manage project hints (.recoderhints)',
  builder: (yargs: Argv) =>
    yargs.command(showCommand).command(initCommand).demandCommand(0).version(false),
  handler: async () => {
    const hints = loadHints();
    if (hints) {
      console.log(chalk.cyan(`\n📋 Project hints: ${hints.filePath}`));
      console.log(chalk.gray(`  ${hints.content.split('\n').length} lines\n`));
    } else {
      console.log(chalk.yellow('\n⚠️  No hints file found'));
      console.log(chalk.gray('  Create one with: recoder hints init\n'));
    }
    process.exit(0);
  },
};
