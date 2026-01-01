/**
 * Agents command - Manage AI agents
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import { listAgents, createAgentFromTemplate } from './agents/list.js';

const listCommand: CommandModule = {
  command: 'list',
  describe: 'List all available agents',
  handler: async () => {
    await listAgents();
    process.exit(0);
  },
};

const createCommand: CommandModule<{}, { name: string; template?: string; location?: string }> = {
  command: 'create <name>',
  describe: 'Create a new agent from template',
  builder: (yargs: Argv) =>
    yargs
      .positional('name', { describe: 'Agent name', type: 'string', demandOption: true })
      .option('template', {
        alias: 't',
        describe: 'Template (explorer, planner, coder, reviewer, tester, documenter)',
        type: 'string',
        default: 'coder',
      })
      .option('location', {
        alias: 'l',
        describe: 'Storage location (project, user)',
        type: 'string',
        default: 'project',
      }) as Argv<{ name: string; template?: string; location?: string }>,
  handler: async (argv) => {
    const location = argv.location === 'user' ? 'user' : 'project';
    const filePath = createAgentFromTemplate(argv.template || 'coder', argv.name, location);

    if (filePath) {
      console.log(chalk.green(`\n✓ Created agent: ${argv.name}`));
      console.log(chalk.gray(`  Template: ${argv.template}`));
      console.log(chalk.gray(`  Location: ${filePath}`));
      console.log(chalk.cyan('\n  Edit the file to customize the agent prompt.\n'));
    } else {
      console.log(chalk.red(`\n❌ Unknown template: ${argv.template}`));
      console.log(chalk.gray('  Available: explorer, planner, coder, reviewer, tester, documenter\n'));
    }
    process.exit(0);
  },
};

export const agentsCommand: CommandModule = {
  command: 'agents',
  describe: 'Manage AI agents (built-in and custom)',
  builder: (yargs: Argv) =>
    yargs.command(listCommand).command(createCommand).demandCommand(0).version(false),
  handler: async () => {
    await listAgents();
    process.exit(0);
  },
};
