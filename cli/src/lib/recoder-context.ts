/**
 * .recoder/ Context Loader for CLI
 */

import fs from 'fs/promises';
import path from 'path';

export interface RecoderContext {
  spec?: string;
  prd?: string;
  architecture?: string;
  styleGuide?: string;
  apiDocs?: string;
  context?: string;
  prompts?: {
    component?: string;
    api?: string;
    test?: string;
  };
}

const RECODER_FILES = [
  'spec.md',
  'prd.md',
  'architecture.md',
  'style-guide.md',
  'api-docs.md',
  'context.md',
  'prompts/component.md',
  'prompts/api.md',
  'prompts/test.md',
];

/**
 * Load .recoder/ context from file system
 */
export async function loadRecoderContext(projectDir: string): Promise<RecoderContext> {
  const recoderDir = path.join(projectDir, '.recoder');
  const context: RecoderContext = { prompts: {} };

  // Check if .recoder/ exists
  try {
    await fs.access(recoderDir);
  } catch {
    return context; // Directory doesn't exist
  }

  for (const file of RECODER_FILES) {
    try {
      const filePath = path.join(recoderDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Map file to context property
      if (file === 'spec.md') context.spec = content;
      else if (file === 'prd.md') context.prd = content;
      else if (file === 'architecture.md') context.architecture = content;
      else if (file === 'style-guide.md') context.styleGuide = content;
      else if (file === 'api-docs.md') context.apiDocs = content;
      else if (file === 'context.md') context.context = content;
      else if (file === 'prompts/component.md') context.prompts!.component = content;
      else if (file === 'prompts/api.md') context.prompts!.api = content;
      else if (file === 'prompts/test.md') context.prompts!.test = content;
    } catch {
      // File doesn't exist, skip
      continue;
    }
  }

  return context;
}

/**
 * Format context for AI system prompt
 */
export function formatContextForAI(context: RecoderContext): string {
  const sections: string[] = [];

  if (context.context) {
    sections.push(`## Project Context\n${context.context}`);
  }

  if (context.spec) {
    sections.push(`## Specification\n${context.spec}`);
  }

  if (context.prd) {
    sections.push(`## Product Requirements\n${context.prd}`);
  }

  if (context.architecture) {
    sections.push(`## Architecture\n${context.architecture}`);
  }

  if (context.styleGuide) {
    sections.push(`## Style Guide\n${context.styleGuide}`);
  }

  if (context.apiDocs) {
    sections.push(`## API Documentation\n${context.apiDocs}`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `\n\n# Project-Specific Context\n\n${sections.join('\n\n')}`;
}

/**
 * Check if .recoder/ directory exists
 */
export async function hasRecoderContext(projectDir: string): Promise<boolean> {
  try {
    const contextFile = path.join(projectDir, '.recoder', 'context.md');
    await fs.access(contextFile);
    return true;
  } catch {
    return false;
  }
}
