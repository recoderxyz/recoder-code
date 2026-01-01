/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, ToolActionReturn, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

/**
 * Command to find files by name pattern with fuzzy matching and relevance scoring.
 * 
 * Examples:
 *   /find "*.ts"                          - Find all TypeScript files
 *   /find "test"                          - Find files with "test" in name
 *   /find "component" --ext tsx           - Find React components
 *   /find "util" --path src               - Find in src directory only
 *   /find "config" --exclude node_modules - Exclude directories
 */
export const findCommand: SlashCommand = {
  name: 'find',
  description: 'Find files by name with fuzzy matching',
  kind: CommandKind.BUILT_IN,
  action: (context: CommandContext, args: string): ToolActionReturn | MessageActionReturn => {
    const { config } = context.services;
    
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Config not loaded.',
      };
    }

    const toolRegistry = config.getToolRegistry();
    if (!toolRegistry) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Tool registry not available.',
      };
    }

    // Use glob tool for pattern matching
    const globTool = toolRegistry.getTool('glob');
    if (!globTool) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'File search tool not available.',
      };
    }

    // Parse arguments
    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return {
        type: 'message',
        messageType: 'info',
        content: '🔎 Smart File Finder\n\n' +
          'Find files quickly with pattern matching and filters:\n\n' +
          '**Basic Usage:**\n' +
          '  /find "*.ts"                     - All TypeScript files\n' +
          '  /find "test"                     - Files with "test" in name\n' +
          '  /find "component*"               - Files starting with "component"\n\n' +
          '**With Filters:**\n' +
          '  /find "util" --ext ts            - TypeScript utils only\n' +
          '  /find "config" --path src        - Search in src/ only\n' +
          '  /find "*.json" --exclude dist    - Exclude dist directory\n' +
          '  /find "test" --max 50            - Limit to 50 results\n\n' +
          '**Fuzzy Matching:**\n' +
          '  /find "compon"                   - Matches "component", "components", etc.\n' +
          '  /find "usrctrl"                  - Matches "user-controller", etc.\n\n' +
          '**Tips:**\n' +
          '  • Use * for wildcards: *.test.ts\n' +
          '  • Use ** for recursive: src/**/*.ts\n' +
          '  • Results sorted by relevance\n' +
          '  • Fuzzy matching for typo tolerance',
      };
    }

    // Extract pattern
    const quoteMatch = trimmedArgs.match(/"([^"]+)"/);
    let pattern = quoteMatch ? quoteMatch[1] : trimmedArgs.split(/\s+/)[0];

    // Parse optional filters
    const extMatch = trimmedArgs.match(/--ext\s+(\S+)/);
    const pathMatch = trimmedArgs.match(/--path\s+(\S+)/);
    const excludeMatch = trimmedArgs.match(/--exclude\s+(\S+)/);
    const maxMatch = trimmedArgs.match(/--max\s+(\d+)/);

    // Build enhanced pattern with filters
    if (extMatch && !pattern.includes('.')) {
      // If extension specified and pattern doesn't have extension, add it
      pattern = `${pattern}*.${extMatch[1]}`;
    }

    if (pathMatch) {
      // Prepend path to pattern
      const path = pathMatch[1];
      pattern = `${path}/**/${pattern}`;
    }

    // Remove quotes if present
    const cleanPattern = pattern.replace(/^["']|["']$/g, '');

    const toolArgs: Record<string, unknown> = { 
      pattern: cleanPattern,
    };

    if (excludeMatch) {
      toolArgs.ignore_pattern = excludeMatch[1];
    }

    if (maxMatch) {
      toolArgs.max_results = parseInt(maxMatch[1], 10);
    }

    // Return tool action for framework to execute
    return {
      type: 'tool',
      toolName: 'glob',
      toolArgs,
    };
  },
  subCommands: [
    {
      name: 'recent',
      description: 'Find recently modified files',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): MessageActionReturn => {
        const limit = parseInt(args.trim()) || 10;
        return {
          type: 'message',
          messageType: 'info',
          content: `🕒 Recent Files (last ${limit})\n\n` +
            'This would show the most recently modified files.\n' +
            'Implementation requires file system stat tool.\n\n' +
            'Suggested command:\n' +
            '  find . -type f -mtime -1 | head -n ' + limit,
        };
      },
    },
    {
      name: 'large',
      description: 'Find largest files',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): MessageActionReturn => {
        const limit = parseInt(args.trim()) || 10;
        return {
          type: 'message',
          messageType: 'info',
          content: `📊 Largest Files (top ${limit})\n\n` +
            'This would show the largest files in the project.\n' +
            'Implementation requires file system stat tool.\n\n' +
            'Suggested command:\n' +
            '  find . -type f -exec du -h {} + | sort -rh | head -n ' + limit,
        };
      },
    },
  ],
};
