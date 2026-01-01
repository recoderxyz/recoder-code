/**
 * Agents list command - Show all available agents
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface AgentInfo {
  name: string;
  description: string;
  level: string;
}

// Built-in agents (matches core/src/subagents/builtin-agents.ts)
const BUILTIN_AGENTS: AgentInfo[] = [
  { name: 'explorer', description: 'Code discovery & research - searches codebases, finds patterns', level: 'builtin' },
  { name: 'planner', description: 'Architecture & task planning - breaks down complex tasks', level: 'builtin' },
  { name: 'coder', description: 'Implementation specialist - writes production-ready code', level: 'builtin' },
  { name: 'reviewer', description: 'Code quality & security - reviews for best practices', level: 'builtin' },
  { name: 'tester', description: 'Test creation specialist - writes comprehensive tests', level: 'builtin' },
  { name: 'documenter', description: 'Documentation specialist - creates clear docs', level: 'builtin' },
];

const AGENTS_DIR_PROJECT = '.recoder/agents';
const AGENTS_DIR_USER = path.join(os.homedir(), '.recoder-code', 'agents');

function loadUserAgents(): AgentInfo[] {
  const agents: AgentInfo[] = [];

  // Project agents
  if (fs.existsSync(AGENTS_DIR_PROJECT)) {
    const files = fs.readdirSync(AGENTS_DIR_PROJECT).filter((f) => f.endsWith('.md'));
    files.forEach((f) => {
      agents.push({ name: f.replace('.md', ''), description: 'Project agent', level: 'project' });
    });
  }

  // User agents
  if (fs.existsSync(AGENTS_DIR_USER)) {
    const files = fs.readdirSync(AGENTS_DIR_USER).filter((f) => f.endsWith('.md'));
    files.forEach((f) => {
      agents.push({ name: f.replace('.md', ''), description: 'User agent', level: 'user' });
    });
  }

  return agents;
}

export async function listAgents() {
  console.log(chalk.bold.cyan('\n🤖 Available Agents\n'));

  console.log(chalk.yellow('Built-in Agents:'));
  console.log(chalk.gray('─'.repeat(50)));
  BUILTIN_AGENTS.forEach((agent) => {
    console.log(chalk.green('  • ') + chalk.bold.white(agent.name));
    console.log(chalk.gray(`    ${agent.description}`));
  });

  const userAgents = loadUserAgents();
  if (userAgents.length > 0) {
    console.log(chalk.yellow('\nCustom Agents:'));
    console.log(chalk.gray('─'.repeat(50)));
    userAgents.forEach((agent) => {
      const levelTag = agent.level === 'project' ? chalk.blue('[project]') : chalk.magenta('[user]');
      console.log(chalk.green('  • ') + chalk.bold.white(agent.name) + ' ' + levelTag);
    });
  }

  console.log(chalk.cyan('\n💡 Usage:'));
  console.log(chalk.gray('  In chat: "Let the explorer agent find all API routes"'));
  console.log(chalk.gray('  In chat: "Have the coder agent implement this feature"'));
  console.log(chalk.gray('  Create custom: /agents create'));
  console.log(chalk.gray('  Manage: /agents manage'));
  console.log();
}

export function createAgentFromTemplate(
  templateName: string,
  agentName: string,
  location: 'project' | 'user' = 'project'
): string | null {
  const template = BUILTIN_AGENTS.find((a) => a.name === templateName);
  if (!template) return null;

  const dir = location === 'project' ? AGENTS_DIR_PROJECT : AGENTS_DIR_USER;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${agentName}.md`);
  const content = `---
name: ${agentName}
description: Custom agent based on ${templateName}
---

You are a ${templateName} agent. ${template.description}.

Customize this prompt for your specific needs.
`;

  fs.writeFileSync(filePath, content);
  return filePath;
}
