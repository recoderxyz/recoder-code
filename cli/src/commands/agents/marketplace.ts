/**
 * Agent marketplace - Share and discover custom agents
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const AGENTS_DIR_PROJECT = '.recoder/agents';
const AGENTS_DIR_USER = path.join(os.homedir(), '.recoder-code', 'agents');
const MARKETPLACE_URL = 'https://recoder.xyz/api/agents';

interface AgentMetadata {
  name: string;
  description: string;
  author: string;
  version: string;
  template: string;
  downloads?: number;
  rating?: number;
}

interface MarketplaceAgent extends AgentMetadata {
  id: string;
  content: string;
  createdAt: string;
}

export async function browseMarketplace(): Promise<void> {
  console.log(chalk.bold.cyan('\n🏪 Agent Marketplace\n'));
  console.log(chalk.gray('Discover and install community agents\n'));

  try {
    // Fetch agents from marketplace
    const response = await fetch(`${MARKETPLACE_URL}/list`);
    if (!response.ok) {
      throw new Error('Failed to fetch agents');
    }

    const agents: MarketplaceAgent[] = await response.json();

    if (agents.length === 0) {
      console.log(chalk.yellow('No agents available yet'));
      console.log(chalk.gray('Be the first to share: recoder agents share'));
      return;
    }

    const choices = agents.map(a => ({
      name: `${a.name} - ${a.description} ${chalk.gray(`(by ${a.author})`)}`,
      value: a.id,
    }));

    const { agentId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'agentId',
        message: 'Select an agent to install:',
        choices,
        pageSize: 10,
      },
    ]);

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const { location } = await inquirer.prompt([
      {
        type: 'list',
        name: 'location',
        message: 'Install location:',
        choices: [
          { name: 'Project (.recoder/agents/)', value: 'project' },
          { name: 'User (~/.recoder-code/agents/)', value: 'user' },
        ],
      },
    ]);

    await installAgent(agent, location);

    console.log(chalk.green(`\n✅ Installed: ${agent.name}`));
    console.log(chalk.cyan('💡 Usage:'));
    console.log(chalk.gray(`   In chat: "Let the ${agent.name} agent help"`));
  } catch (err: any) {
    console.log(chalk.red(`\n❌ Error: ${err.message}`));
    console.log(chalk.gray('Marketplace coming soon!'));
  }
}

export async function shareAgent(): Promise<void> {
  console.log(chalk.bold.cyan('\n📤 Share Agent to Marketplace\n'));

  // List local agents
  const localAgents: string[] = [];
  
  if (fs.existsSync(AGENTS_DIR_PROJECT)) {
    fs.readdirSync(AGENTS_DIR_PROJECT)
      .filter(f => f.endsWith('.md'))
      .forEach(f => localAgents.push(`project:${f.replace('.md', '')}`));
  }
  
  if (fs.existsSync(AGENTS_DIR_USER)) {
    fs.readdirSync(AGENTS_DIR_USER)
      .filter(f => f.endsWith('.md'))
      .forEach(f => localAgents.push(`user:${f.replace('.md', '')}`));
  }

  if (localAgents.length === 0) {
    console.log(chalk.yellow('No custom agents found'));
    console.log(chalk.gray('Create one first: recoder agents new'));
    return;
  }

  const { agent } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: 'Select agent to share:',
      choices: localAgents,
    },
  ]);

  const [location, name] = agent.split(':');
  const dir = location === 'project' ? AGENTS_DIR_PROJECT : AGENTS_DIR_USER;
  const filePath = path.join(dir, `${name}.md`);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Parse frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    console.log(chalk.red('Invalid agent format'));
    return;
  }

  const frontmatter = match[1];
  const description = frontmatter.match(/description: (.+)/)?.[1] || 'No description';

  const { author, confirm } = await inquirer.prompt([
    {
      type: 'input',
      name: 'author',
      message: 'Your name:',
      validate: (input: string) => input.length > 0 || 'Name required',
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: `Share "${name}" to marketplace?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n❌ Cancelled'));
    return;
  }

  try {
    const response = await fetch(`${MARKETPLACE_URL}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        author,
        content,
        version: '1.0.0',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to share agent');
    }

    console.log(chalk.green(`\n✅ Agent shared successfully!`));
    console.log(chalk.gray('   View at: https://recoder.xyz/agents'));
  } catch (err: any) {
    console.log(chalk.red(`\n❌ Error: ${err.message}`));
    console.log(chalk.gray('Marketplace coming soon!'));
  }
}

async function installAgent(agent: MarketplaceAgent, location: 'project' | 'user'): Promise<void> {
  const dir = location === 'project' ? AGENTS_DIR_PROJECT : AGENTS_DIR_USER;
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${agent.name}.md`);
  fs.writeFileSync(filePath, agent.content, 'utf-8');
}
