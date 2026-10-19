/**
 * Agent creation command - Create custom agents from templates
 */

import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const AGENTS_DIR_PROJECT = '.recoder/agents';
const AGENTS_DIR_USER = path.join(os.homedir(), '.recoder-code', 'agents');

const AGENT_TEMPLATES = [
  {
    name: 'explorer',
    description: 'Code discovery & research specialist',
    systemPrompt: `You are an expert code explorer and researcher. Your role is to:
- Search and analyze codebases to understand structure and patterns
- Find relevant code examples and implementations
- Identify dependencies and relationships between components
- Discover best practices and conventions used in the project
- Provide comprehensive reports on code organization

Always be thorough and cite specific file paths and line numbers.`,
  },
  {
    name: 'coder',
    description: 'Implementation specialist',
    systemPrompt: `You are an expert software engineer focused on implementation. Your role is to:
- Write clean, production-ready code following best practices
- Implement features with proper error handling and edge cases
- Follow the project's existing patterns and conventions
- Write self-documenting code with clear variable names
- Consider performance and maintainability

Always write complete, working implementations - no placeholders or TODOs.`,
  },
  {
    name: 'reviewer',
    description: 'Code quality & security specialist',
    systemPrompt: `You are an expert code reviewer focused on quality and security. Your role is to:
- Review code for bugs, security vulnerabilities, and performance issues
- Check adherence to best practices and design patterns
- Identify potential edge cases and error scenarios
- Suggest improvements for readability and maintainability
- Verify proper error handling and input validation

Provide specific, actionable feedback with examples.`,
  },
  {
    name: 'tester',
    description: 'Test creation specialist',
    systemPrompt: `You are an expert test engineer. Your role is to:
- Write comprehensive unit, integration, and e2e tests
- Cover edge cases and error scenarios
- Follow testing best practices (AAA pattern, clear assertions)
- Create meaningful test descriptions
- Ensure high code coverage

Write tests that are maintainable and serve as documentation.`,
  },
  {
    name: 'documenter',
    description: 'Documentation specialist',
    systemPrompt: `You are an expert technical writer. Your role is to:
- Create clear, comprehensive documentation
- Write API documentation with examples
- Document architecture and design decisions
- Create user guides and tutorials
- Maintain README files and changelogs

Write documentation that is accessible to both beginners and experts.`,
  },
  {
    name: 'custom',
    description: 'Start from scratch',
    systemPrompt: `You are a helpful AI assistant. Customize this prompt for your specific needs.`,
  },
];

export async function createAgent(): Promise<void> {
  console.log(chalk.bold.cyan('\n🤖 Create Custom Agent\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Choose a template:',
      choices: AGENT_TEMPLATES.map(t => ({
        name: `${t.name} - ${t.description}`,
        value: t.name,
      })),
    },
    {
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (input: string) => {
        if (!input) return 'Name is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: (answers: any) => {
        const template = AGENT_TEMPLATES.find(t => t.name === answers.template);
        return template?.description || '';
      },
    },
    {
      type: 'list',
      name: 'location',
      message: 'Save location:',
      choices: [
        { name: 'Project (.recoder/agents/) - Available in this project only', value: 'project' },
        { name: 'User (~/.recoder-code/agents/) - Available globally', value: 'user' },
      ],
      default: 'project',
    },
    {
      type: 'confirm',
      name: 'customize',
      message: 'Customize system prompt now?',
      default: false,
    },
  ]);

  const template = AGENT_TEMPLATES.find(t => t.name === answers.template);
  let systemPrompt = template?.systemPrompt || '';

  if (answers.customize) {
    const { prompt } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'prompt',
        message: 'Edit system prompt:',
        default: systemPrompt,
      },
    ]);
    systemPrompt = prompt;
  }

  const dir = answers.location === 'project' ? AGENTS_DIR_PROJECT : AGENTS_DIR_USER;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${answers.name}.md`);
  
  if (fs.existsSync(filePath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Agent "${answers.name}" already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow('\n❌ Cancelled'));
      return;
    }
  }

  const content = `---
name: ${answers.name}
description: ${answers.description}
template: ${answers.template}
---

${systemPrompt}
`;

  fs.writeFileSync(filePath, content, 'utf-8');

  console.log(chalk.green(`\n✅ Agent "${answers.name}" created successfully!`));
  console.log(chalk.gray(`   Location: ${filePath}`));
  console.log(chalk.cyan('\n💡 Usage:'));
  console.log(chalk.gray(`   In chat: "Let the ${answers.name} agent help with this"`));
  console.log(chalk.gray(`   Edit: ${filePath}`));
  console.log();
}
