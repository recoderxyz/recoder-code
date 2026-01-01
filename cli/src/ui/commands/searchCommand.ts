/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, ToolActionReturn, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

/**
 * Command to search codebase content with enhanced features.
 * 
 * Examples:
 *   /search "function"                    - Search for "function" in all files
 *   /search "class User" --ext ts         - Search in TypeScript files only
 *   /search "TODO" --path src             - Search in src directory
 *   /search "import" --context 3          - Show 3 lines of context around matches
 *   /search "bug" --ignore test           - Ignore test files
 */
export const searchCommand: SlashCommand = {
  name: 'search',
  description: 'Search codebase content with context preview',
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

    // Try ripgrep first (faster), fallback to grep
    const searchTool = toolRegistry.getTool('ripgrep') || toolRegistry.getTool('grep');
    if (!searchTool) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Search tool not available.',
      };
    }

    // Parse arguments
    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return {
        type: 'message',
        messageType: 'info',
        content: '🔍 Smart Code Search\n\n' +
          'Search your codebase with powerful filters and context:\n\n' +
          '**Basic Usage:**\n' +
          '  /search "pattern"                - Search for pattern\n' +
          '  /search "function.*render"       - Regex search\n\n' +
          '**File Filtering:**\n' +
          '  /search "TODO" --ext ts          - TypeScript files only\n' +
          '  /search "TODO" --ext "ts,tsx"    - Multiple extensions\n' +
          '  /search "bug" --path src         - Search in src/ only\n' +
          '  /search "test" --ignore test     - Ignore test files\n\n' +
          '**Context & Display:**\n' +
          '  /search "error" --context 3      - Show 3 lines around match\n' +
          '  /search "class" --max 20         - Limit to 20 results\n\n' +
          '**Tips:**\n' +
          '  • Use quotes for patterns with spaces\n' +
          '  • Supports regular expressions\n' +
          '  • Case-sensitive by default\n' +
          '  • Results show file, line number, and context',
      };
    }

    // Extract search pattern (first quoted string or first word)
    const quoteMatch = trimmedArgs.match(/"([^"]+)"/);
    const pattern = quoteMatch ? quoteMatch[1] : trimmedArgs.split(/\s+/)[0];

    // Extract optional parameters with new enhanced options
    const extMatch = trimmedArgs.match(/--ext(?:ension)?\s+["']?([^"'\s]+)["']?/);
    const pathMatch = trimmedArgs.match(/--path\s+(\S+)/);
    const contextMatch = trimmedArgs.match(/--context\s+(\d+)/);
    const maxMatch = trimmedArgs.match(/--max\s+(\d+)/);
    const ignoreMatch = trimmedArgs.match(/--ignore\s+(\S+)/);

    const toolArgs: Record<string, unknown> = {
      pattern,
    };

    // Map CLI args to tool args
    if (extMatch) {
      // Convert --ext to file_pattern format
      const extensions = extMatch[1].split(',');
      if (extensions.length === 1) {
        toolArgs.file_pattern = `*.${extensions[0]}`;
      } else {
        toolArgs.file_pattern = `*.{${extensions.join(',')}}`;
      }
    }

    if (pathMatch) {
      toolArgs.path = pathMatch[1];
    }

    if (contextMatch) {
      toolArgs.context_lines = parseInt(contextMatch[1], 10);
    }

    if (maxMatch) {
      toolArgs.max_results = parseInt(maxMatch[1], 10);
    }

    if (ignoreMatch) {
      toolArgs.ignore_pattern = ignoreMatch[1];
    }

    // Return tool action for framework to execute
    return {
      type: 'tool',
      toolName: searchTool.name,
      toolArgs,
    };
  },
  subCommands: [
    {
      name: 'files',
      description: 'Search only in file names',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): ToolActionReturn | MessageActionReturn => {
        // Delegate to find command for file name search
        const findTool = context.services.config?.getToolRegistry()?.getTool('glob');
        if (!findTool) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'File search tool not available.',
          };
        }

        const pattern = args.trim();
        if (!pattern) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please provide a file name pattern\n\n' +
              'Usage: /search files <pattern>\n' +
              'Example: /search files "*.test.ts"',
          };
        }

        return {
          type: 'tool',
          toolName: 'glob',
          toolArgs: { pattern },
        };
      },
    },
  ],
};
