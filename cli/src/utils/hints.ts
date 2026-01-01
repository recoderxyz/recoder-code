/**
 * Recoder Hints - Project context file support
 * Reads .recoderhints or .recoder/hints.md for project-specific instructions
 */

import * as fs from 'fs';
import * as path from 'path';

const HINTS_FILES = ['.recoderhints', '.recoder/hints.md', 'RECODER.md', '.recoder/RECODER.md'];

export interface RecoderHints {
  content: string;
  filePath: string;
}

/**
 * Load hints from project directory
 */
export function loadHints(projectDir: string = process.cwd()): RecoderHints | null {
  for (const file of HINTS_FILES) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { content, filePath };
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Create default hints file
 */
export function createHintsFile(projectDir: string = process.cwd()): string {
  const filePath = path.join(projectDir, '.recoderhints');
  const defaultContent = `# Project Hints for Recoder

## Project Overview
<!-- Describe your project here -->

## Tech Stack
<!-- List technologies, frameworks, languages -->

## Code Style
<!-- Describe coding conventions, patterns to follow -->

## Important Files
<!-- List key files the AI should know about -->

## Do's and Don'ts
<!-- Specific instructions for the AI -->
`;

  fs.writeFileSync(filePath, defaultContent);
  return filePath;
}

/**
 * Check if hints file exists
 */
export function hasHints(projectDir: string = process.cwd()): boolean {
  return HINTS_FILES.some((file) => fs.existsSync(path.join(projectDir, file)));
}
