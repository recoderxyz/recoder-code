/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { OpenRouterPDFProcessor } from 'recoder-code-core';

export const pdfCommand: SlashCommand = {
  name: 'pdf',
  description: 'Process and analyze PDF documents',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    return {
      type: 'message',
      messageType: 'info',
      content:
        '📄 PDF Processing\n\n' +
        '**Available Commands:**\n' +
        '  /pdf extract <file>       Extract text from PDF\n' +
        '  /pdf chat <file>          Chat with PDF content\n' +
        '  /pdf models               List supported models\n\n' +
        '**Examples:**\n' +
        '  /pdf extract document.pdf --pages 1-5\n' +
        '  /pdf chat paper.pdf "Summarize the key findings"\n\n' +
        '🔑 Requires: OPENROUTER_API_KEY',
    };
  },
  subCommands: [
    {
      name: 'extract',
      description: 'Extract text and content from PDF',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim();
        if (!args) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /pdf extract <file> [--pages 1-5] [--images] [--tables]',
          };
        }

        try {
          const parts = args.split('--');
          const filePath = parts[0].trim();
          
          const processor = new OpenRouterPDFProcessor();
          const result = await processor.process({
            pdfFile: filePath,
            extractImages: args.includes('--images'),
            extractTables: args.includes('--tables'),
          });

          let content = `✅ PDF extracted!\n\n**Pages:** ${result.metadata.pageCount}\n\n${result.text.substring(0, 1000)}${result.text.length > 1000 ? '...' : ''}`;

          return { type: 'message', messageType: 'info', content };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'chat',
      description: 'Ask questions about PDF content',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim();
        if (!args) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /pdf chat <file> "<question>"',
          };
        }

        try {
          const match = args.match(/(.+?)\s+"([^"]+)"/);
          if (!match) {
            throw new Error('Invalid format. Use: /pdf chat <file> "<question>"');
          }

          const [, filePath, question] = match;
          
          const processor = new OpenRouterPDFProcessor();
          const result = await processor.chat({
            pdfFile: filePath.trim(),
            instruction: question,
          });

          return {
            type: 'message',
            messageType: 'info',
            content: `📄 **PDF Analysis:**\n\n${result.response}\n\n**Tokens:** ${result.metadata.inputTokens + result.metadata.outputTokens}`,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `PDF chat failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'models',
      description: 'List PDF-capable models',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const models = OpenRouterPDFProcessor.listModels();
        let content = '📄 PDF-Capable Models\n\n';
        models.forEach((m) => {
          content += `• **${m.id}** - ${m.name} (${m.provider})\n  Max: ${(m.maxFileSize / 1024 / 1024).toFixed(1)}MB, ${m.maxPages} pages\n`;
        });
        return { type: 'message', messageType: 'info', content };
      },
    },
  ],
};
