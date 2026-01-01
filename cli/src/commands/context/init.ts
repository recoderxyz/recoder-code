/**
 * recoder context init
 * Initialize .recoder/ directory in current project
 */

import fs from 'fs/promises';
import path from 'path';
import { Command } from 'commander';

const DEFAULT_CONTEXT = `# Project Context

This file provides context about your project to the AI assistant.

## Project Overview
Describe what your project does and its main goals.

## Tech Stack
List the main technologies, frameworks, and libraries used.

## Coding Conventions
- Describe your preferred coding style
- Naming conventions
- File organization

## Important Notes
Any specific requirements or constraints the AI should know about.
`;

const DEFAULT_SPEC = `# Project Specification

## Features
List the main features of your project.

## Requirements
- Functional requirements
- Non-functional requirements

## Constraints
Any technical or business constraints.
`;

const DEFAULT_STYLE_GUIDE = `# Code Style Guide

## General Principles
- Write clean, readable code
- Follow DRY (Don't Repeat Yourself)
- Keep functions small and focused

## Naming Conventions
- Variables: camelCase
- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
`;

const DEFAULT_COMPONENT_PROMPT = `When generating components:
- Use functional components with hooks
- Include TypeScript types
- Add prop validation
- Include basic styling
- Add accessibility attributes
`;

export function createContextInitCommand() {
  return new Command('init')
    .description('Initialize .recoder/ directory in current project')
    .option('-t, --template <type>', 'Use template (nextjs, react, api, fullstack)')
    .option('-f, --force', 'Overwrite existing files')
    .action(async (options) => {
      const cwd = process.cwd();
      const recoderDir = path.join(cwd, '.recoder');
      const promptsDir = path.join(recoderDir, 'prompts');

      try {
        // Check if already exists
        try {
          await fs.access(recoderDir);
          if (!options.force) {
            console.log('❌ .recoder/ directory already exists. Use --force to overwrite.');
            return;
          }
        } catch {
          // Directory doesn't exist, continue
        }

        // Create directories
        await fs.mkdir(recoderDir, { recursive: true });
        await fs.mkdir(promptsDir, { recursive: true });

        // Create default files
        await fs.writeFile(path.join(recoderDir, 'context.md'), DEFAULT_CONTEXT);
        await fs.writeFile(path.join(recoderDir, 'spec.md'), DEFAULT_SPEC);
        await fs.writeFile(path.join(recoderDir, 'style-guide.md'), DEFAULT_STYLE_GUIDE);
        await fs.writeFile(path.join(promptsDir, 'component.md'), DEFAULT_COMPONENT_PROMPT);

        console.log('✅ .recoder/ directory initialized!');
        console.log('\nCreated files:');
        console.log('  📝 .recoder/context.md');
        console.log('  📋 .recoder/spec.md');
        console.log('  🎨 .recoder/style-guide.md');
        console.log('  ⚛️  .recoder/prompts/component.md');
        console.log('\n💡 Edit these files to provide project-specific context to AI.');
        console.log('   Context will be automatically included in AI prompts.');

      } catch (error: any) {
        console.error('❌ Failed to initialize .recoder/:', error.message);
        process.exit(1);
      }
    });
}
