/**
 * Agents command - Manage AI agents
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import { listAgents, createAgentFromTemplate } from './agents/list.js';
import { createAgent } from './agents/create.js';
import { browseMarketplace, shareAgent } from './agents/marketplace.js';
import { RecoderAuthService } from '../services/RecoderAuthService.js';

async function requireAuth(): Promise<void> {
  const authService = new RecoderAuthService();
  const session = await authService.getSession();
  if (!session) {
    console.error('❌ Please login first: recoder auth login');
    process.exit(1);
  }
}

const listCommand: CommandModule = {
  command: 'list',
  describe: 'List all available agents',
  handler: async () => {
    await requireAuth();
    await listAgents();
    process.exit(0);
  },
};

const createInteractiveCommand: CommandModule = {
  command: 'new',
  describe: 'Create a custom agent interactively',
  handler: async () => {
    await requireAuth();
    await createAgent();
    process.exit(0);
  },
};

const marketplaceCommand: CommandModule = {
  command: 'browse',
  describe: 'Browse agent marketplace',
  handler: async () => {
    await requireAuth();
    await browseMarketplace();
    process.exit(0);
  },
};

const shareCommand: CommandModule = {
  command: 'share',
  describe: 'Share your agent to marketplace',
  handler: async () => {
    await requireAuth();
    await shareAgent();
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
    await requireAuth();
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
    yargs
      .command(listCommand)
      .command(createInteractiveCommand)
      .command(marketplaceCommand)
      .command(shareCommand)
      .command(createCommand)
      .demandCommand(0)
      .version(false),
  handler: async () => {
    await requireAuth();
    await listAgents();
    process.exit(0);
  },
};
