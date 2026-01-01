/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, ToolActionReturn, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

/**
 * Command to show directory tree structure with filtering options.
 * 
 * Examples:
 *   /tree                                 - Show tree of current directory
 *   /tree src                             - Show tree of src directory
 *   /tree . --depth 2                     - Limit tree depth to 2 levels
 *   /tree src --ext ts                    - Show only TypeScript files
 *   /tree . --exclude "node_modules,dist" - Exclude specific directories
 */
export const treeCommand: SlashCommand = {
  name: 'tree',
  description: 'Show directory tree structure with filtering',
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

    // Use ls tool with recursive option to build tree
    const lsTool = toolRegistry.getTool('ls');
    if (!lsTool) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Directory listing tool not available.',
      };
    }

    // Show help if no args
    if (!args.trim()) {
      return {
        type: 'message',
        messageType: 'info',
        content: '🌳 Directory Tree Viewer\n\n' +
          'Visualize your project structure with powerful filtering:\n\n' +
          '**Basic Usage:**\n' +
          '  /tree                            - Current directory tree\n' +
          '  /tree src                        - Tree of src/ directory\n' +
          '  /tree . --depth 3                - Limit to 3 levels deep\n\n' +
          '**Filtering:**\n' +
          '  /tree src --ext ts               - TypeScript files only\n' +
          '  /tree . --ext "ts,tsx"           - Multiple extensions\n' +
          '  /tree . --exclude test           - Exclude test directories\n' +
          '  /tree . --exclude "node_modules,dist,build" - Multiple exclusions\n\n' +
          '**Display Options:**\n' +
          '  /tree . --depth 2                - Shallow tree (faster)\n' +
          '  /tree . --files-only             - Hide directories\n' +
          '  /tree . --dirs-only              - Hide files\n\n' +
          '**Smart Defaults:**\n' +
          '  • Automatically excludes: node_modules, .git, dist, build\n' +
          '  • Shows file counts per directory\n' +
          '  • Sorts alphabetically\n' +
          '  • Indicates file types with icons\n\n' +
          '**Tips:**\n' +
          '  • Use --depth for large projects\n' +
          '  • Combine filters: --ext ts --exclude test\n' +
          '  • Tree shows relative paths from cwd',
      };
    }

    // Parse arguments
    const parts = args.trim().split(/\s+/).filter(Boolean);
    const path = parts.find(p => !p.startsWith('--')) || '.';
    const depthMatch = args.match(/--depth\s+(\d+)/);
    const extMatch = args.match(/--ext\s+["']?([^"'\s]+)["']?/);
    const excludeMatch = args.match(/--exclude\s+["']?([^"'\s]+)["']?/);
    const filesOnly = args.includes('--files-only');
    const dirsOnly = args.includes('--dirs-only');

    // Build tool arguments
    const toolArgs: Record<string, unknown> = {
      path,
      recursive: 'true',
    };

    if (depthMatch) {
      toolArgs.depth = String(parseInt(depthMatch[1], 10));
    }

    if (extMatch) {
      // Add file pattern filter for extensions
      const extensions = extMatch[1].split(',');
      if (extensions.length === 1) {
        toolArgs.file_pattern = `*.${extensions[0]}`;
      } else {
        toolArgs.file_pattern = `*.{${extensions.join(',')}}`;
      }
    }

    if (excludeMatch) {
      toolArgs.ignore_pattern = excludeMatch[1];
    } else {
      // Default exclusions for common directories
      toolArgs.ignore_pattern = 'node_modules,.git,dist,build,.next,coverage';
    }

    if (filesOnly) {
      toolArgs.files_only = 'true';
    }

    if (dirsOnly) {
      toolArgs.dirs_only = 'true';
    }

    // Return tool action for framework to execute
    return {
      type: 'tool',
      toolName: 'ls',
      toolArgs,
    };
  },
  subCommands: [
    {
      name: 'compact',
      description: 'Show compact tree (directories only)',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): ToolActionReturn | MessageActionReturn => {
        const { config } = context.services;
        const lsTool = config?.getToolRegistry()?.getTool('ls');
        
        if (!lsTool) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Directory listing tool not available.',
          };
        }

        const path = args.trim() || '.';
        return {
          type: 'tool',
          toolName: 'ls',
          toolArgs: {
            path,
            recursive: 'true',
            dirs_only: 'true',
            ignore_pattern: 'node_modules,.git,dist,build,.next,coverage',
          },
        };
      },
    },
    {
      name: 'stats',
      description: 'Show directory statistics',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): MessageActionReturn => {
        return {
          type: 'message',
          messageType: 'info',
          content: '📊 Directory Statistics\n\n' +
            'This would show:\n' +
            '  • Total files count\n' +
            '  • Total directories count\n' +
            '  • File type breakdown\n' +
            '  • Total size\n' +
            '  • Largest files\n' +
            '  • Deepest paths\n\n' +
            'Implementation requires file system stat tool.',
        };
      },
    },
  ],
};
