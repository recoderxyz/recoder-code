/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, ToolActionReturn, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

/**
 * Command to search the web for information with enhanced filtering.
 * 
 * Examples:
 *   /web "how to use async await in TypeScript"
 *   /web "OpenRouter API documentation" --max 5
 *   /web "latest React 19 features" --recent
 *   /web "TypeScript generics" --domain docs.microsoft.com
 */
export const webCommand: SlashCommand = {
  name: 'web',
  description: 'Search the web for information',
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

    // Get the web-search tool from registry
    const webSearchTool = toolRegistry.getTool('web-search');
    if (!webSearchTool) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Web search tool not available.',
      };
    }

    const trimmedArgs = args.trim();
    if (!trimmedArgs) {
      return {
        type: 'message',
        messageType: 'info',
        content: '🌐 Web Search\n\n' +
          'Search the web for information with smart filtering:\n\n' +
          '**Basic Usage:**\n' +
          '  /web "search query"              - Basic web search\n' +
          '  /web "TypeScript tutorial"       - Find tutorials\n' +
          '  /web "OpenRouter API docs"       - Find documentation\n\n' +
          '**Advanced Filtering:**\n' +
          '  /web "query" --max 5             - Limit to 5 results\n' +
          '  /web "query" --recent            - Recent results only\n' +
          '  /web "query" --domain github.com - Search specific domain\n\n' +
          '**Search Types:**\n' +
          '  /web docs "React"                - Documentation search\n' +
          '  /web news "AI breakthroughs"     - News search\n' +
          '  /web github "openrouter"         - GitHub search\n\n' +
          '**Tips:**\n' +
          '  • Use quotes for exact phrases\n' +
          '  • Be specific in your queries\n' +
          '  • Results include snippets and links\n' +
          '  • Great for API docs and tutorials',
      };
    }

    // Extract query (first quoted string or all text before flags)
    const quoteMatch = trimmedArgs.match(/"([^"]+)"/);
    let query = quoteMatch ? quoteMatch[1] : trimmedArgs.split(/\s+--/)[0].trim();

    // Parse optional parameters
    const maxMatch = trimmedArgs.match(/--max\s+(\d+)/);
    const domainMatch = trimmedArgs.match(/--domain\s+(\S+)/);
    const recent = trimmedArgs.includes('--recent');

    // Build enhanced query
    if (domainMatch) {
      query = `site:${domainMatch[1]} ${query}`;
    }

    if (recent) {
      // Add time constraint to query (implementation depends on search API)
      query = `${query} (recent OR latest OR 2024 OR 2025)`;
    }

    // Remove quotes if present
    const cleanQuery = query.replace(/^["']|["']$/g, '');

    const toolArgs: Record<string, unknown> = {
      query: cleanQuery,
    };

    if (maxMatch) {
      toolArgs.max_results = parseInt(maxMatch[1], 10);
    }

    // Return tool action for framework to execute
    return {
      type: 'tool',
      toolName: 'web-search',
      toolArgs,
    };
  },
  subCommands: [
    {
      name: 'docs',
      description: 'Search for documentation',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): ToolActionReturn | MessageActionReturn => {
        const toolRegistry = context.services.config?.getToolRegistry();
        const webSearchTool = toolRegistry?.getTool('web-search');
        
        if (!webSearchTool) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Web search tool not available.',
          };
        }

        const query = args.trim();
        if (!query) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please provide a documentation topic\n\n' +
              'Usage: /web docs "topic"\n' +
              'Example: /web docs "React hooks"',
          };
        }

        return {
          type: 'tool',
          toolName: 'web-search',
          toolArgs: {
            query: `${query} documentation OR docs OR guide OR tutorial`,
          },
        };
      },
    },
    {
      name: 'github',
      description: 'Search GitHub repositories',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): ToolActionReturn | MessageActionReturn => {
        const toolRegistry = context.services.config?.getToolRegistry();
        const webSearchTool = toolRegistry?.getTool('web-search');
        
        if (!webSearchTool) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Web search tool not available.',
          };
        }

        const query = args.trim();
        if (!query) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please provide a GitHub search query\n\n' +
              'Usage: /web github "query"\n' +
              'Example: /web github "openrouter typescript"',
          };
        }

        return {
          type: 'tool',
          toolName: 'web-search',
          toolArgs: {
            query: `site:github.com ${query}`,
          },
        };
      },
    },
    {
      name: 'news',
      description: 'Search for recent news',
      kind: CommandKind.BUILT_IN,
      action: (context: CommandContext, args: string): ToolActionReturn | MessageActionReturn => {
        const toolRegistry = context.services.config?.getToolRegistry();
        const webSearchTool = toolRegistry?.getTool('web-search');
        
        if (!webSearchTool) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Web search tool not available.',
          };
        }

        const query = args.trim();
        if (!query) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please provide a news topic\n\n' +
              'Usage: /web news "topic"\n' +
              'Example: /web news "AI developments"',
          };
        }

        return {
          type: 'tool',
          toolName: 'web-search',
          toolArgs: {
            query: `${query} news (2024 OR 2025)`,
          },
        };
      },
    },
  ],
};
