import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const RECODER_DIR = '.recoder';

const TEMPLATES = {
  'context.md': `# Project Context

## Overview
Brief description of the project.

## Tech Stack
- Framework:
- Language:
- Database:

## Key Features
1. Feature 1
2. Feature 2
`,
  'spec.md': `# Technical Specification

## Architecture
Describe system architecture.

## Components
List main components.

## Data Models
Define data structures.
`,
  'style-guide.md': `# Code Style Guide

## Naming Conventions
- Variables: camelCase
- Components: PascalCase
- Files: kebab-case

## Code Standards
- Use TypeScript
- Add JSDoc comments
- Write tests
`,
};

export const contextCommand = new Command('context')
  .description('Manage .recoder/ project context')
  .addCommand(
    new Command('init')
      .description('Initialize .recoder/ directory')
      .action(async () => {
        try {
          const recoderPath = path.join(process.cwd(), RECODER_DIR);
          
          if (await fs.pathExists(recoderPath)) {
            console.log(chalk.yellow('⚠️  .recoder/ directory already exists'));
            return;
          }

          await fs.mkdir(recoderPath, { recursive: true });
          await fs.mkdir(path.join(recoderPath, 'prompts'), { recursive: true });

          for (const [file, content] of Object.entries(TEMPLATES)) {
            await fs.writeFile(path.join(recoderPath, file), content);
          }

          console.log(chalk.green('✅ .recoder/ directory initialized'));
          console.log(chalk.gray('   Edit files in .recoder/ to customize AI behavior'));
        } catch (error: any) {
          console.error(chalk.red('❌ Failed to initialize:'), error.message);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List .recoder/ files')
      .action(async () => {
        try {
          const recoderPath = path.join(process.cwd(), RECODER_DIR);
          
          if (!(await fs.pathExists(recoderPath))) {
            console.log(chalk.yellow('⚠️  .recoder/ directory not found'));
            console.log(chalk.gray('   Run: recoder context init'));
            return;
          }

          const files = await fs.readdir(recoderPath, { recursive: true });
          console.log(chalk.blue('.recoder/ files:'));
          files.forEach(file => console.log(chalk.gray(`  - ${file}`)));
        } catch (error: any) {
          console.error(chalk.red('❌ Failed to list:'), error.message);
        }
      })
  );
