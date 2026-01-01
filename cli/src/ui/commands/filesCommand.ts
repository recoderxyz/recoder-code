/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, ToolActionReturn, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

/**
 * Command to list and explore project files with enhanced filtering.
 * 
 * Examples:
 *   /files                                - List files in current directory
 *   /files src                            - List files in src directory
 *   /files src -r                         - List files recursively
 *   /files . --ext ts                     - List TypeScript files only
 *   /files src --exclude test             - Exclude test files
 */
export const filesCommand: SlashCommand = {
  name: 'files',
  description: 'List and explore project files with filters',
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

    // Get the ls tool from registry
    const lsTool = toolRegistry.getTool('ls');
    if (!lsTool) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'File listing tool not available.',
      };
    }

    // Show help if no args
    if (!args.trim()) {
      return {
        type: 'message',
        messageType: 'info',
        content: '📁 File Explorer\n\n' +
          'Browse and filter project files efficiently:\n\n' +
          '**Basic Usage:**\n' +
          '  /files                           - List current directory\n' +
          '  /files src                       - List src/ directory\n' +
          '  /files . -r                      - Recursive listing\n' +
          '  /files . --recursive             - Same as -r\n\n' +
          '**Filtering:**\n' +
          '  /files . --ext ts                - TypeScript files only\n' +
          '  /files . --ext "ts,tsx,js"       - Multiple extensions\n' +
          '  /files src --exclude test        - Exclude test files\n' +
          '  /files . --exclude "test,spec"   - Multiple exclusions\n\n' +
          '**Display Options:**\n' +
          '  /files . --files-only            - Hide directories\n' +
          '  /files . --dirs-only             - Hide files\n' +
          '  /files . --max 50                - Limit results\n\n' +
          '**Smart Features:**\n' +
          '  • Auto-excludes: node_modules, .git, dist\n' +
          '  • Shows file sizes and types\n' +
          '  • Sorts by name or size\n' +
          '  • Relative path display\n\n' +
          '**Tips:**\n' +
          '  • Use -r for recursive search\n' +
          '  • Combine filters for precision\n' +
          '  • Results show full relative paths',
      };
    }

    // Parse arguments
    const parts = args.trim().split(/\s+/).filter(Boolean);
    const path = parts.find(p => !p.startsWith('-')) || '.';
    const recursive = parts.includes('--recursive') || parts.includes('-r');
    const extMatch = args.match(/--ext\s+["']?([^"'\s]+)["']?/);
    const excludeMatch = args.match(/--exclude\s+["']?([^"'\s]+)["']?/);
    const filesOnly = args.includes('--files-only');
    const dirsOnly = args.includes('--dirs-only');
    const maxMatch = args.match(/--max\s+(\d+)/);
    
    // Return tool action for framework to execute
    const toolArgs: Record<string, unknown> = {
      path,
      recursive: recursive ? 'true' : 'false',
    };

    if (extMatch) {
      const extensions = extMatch[1].split(',');
      if (extensions.length === 1) {
        toolArgs.file_pattern = `*.${extensions[0]}`;
      } else {
        toolArgs.file_pattern = `*.{${extensions.join(',')}}`;
      }
    }

    if (excludeMatch) {
      toolArgs.ignore_pattern = excludeMatch[1];
    } else if (recursive) {
      // Default exclusions for recursive mode
      toolArgs.ignore_pattern = 'node_modules,.git,dist,build,.next,coverage';
    }

    if (filesOnly) {
      toolArgs.files_only = 'true';
    }

    if (dirsOnly) {
      toolArgs.dirs_only = 'true';
    }

    if (maxMatch) {
      toolArgs.max_results = parseInt(maxMatch[1], 10);
    }

    return {
      type: 'tool',
      toolName: 'ls',
      toolArgs,
    };
  },
  subCommands: [
    {
      name: 'recent',
      description: 'List recently modified files',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): MessageActionReturn => {
        const limit = parseInt(args.trim()) || 10;
        return {
          type: 'message',
          messageType: 'info',
          content: `🕒 Recently Modified Files (last ${limit})\n\n` +
            'This would show recently changed files.\n' +
            'Implementation requires file system stat tool.\n\n' +
            'Suggested command:\n' +
            '  git ls-files -z | xargs -0 stat -f "%m %N" | sort -rn | head -' + limit,
        };
      },
    },
    {
      name: 'stats',
      description: 'Show file statistics',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): MessageActionReturn => {
        return {
          type: 'message',
          messageType: 'info',
          content: '📊 File Statistics\n\n' +
            'This would show:\n' +
            '  • Total files by type\n' +
            '  • Total lines of code\n' +
            '  • Largest files\n' +
            '  • Most modified files\n' +
            '  • File type breakdown\n\n' +
            'Implementation requires file system stat tool.',
        };
      },
    },
  ],
};
