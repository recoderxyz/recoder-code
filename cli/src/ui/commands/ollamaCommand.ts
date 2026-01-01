/**
 * Ollama slash command - Manage local Ollama models
 */

import type { SlashCommand, CommandContext, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

async function checkOllama(): Promise<{ available: boolean; models: string[] }> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return { available: false, models: [] };
    const data = (await response.json()) as { models: Array<{ name: string }> };
    return { available: true, models: data.models.map((m) => m.name) };
  } catch {
    return { available: false, models: [] };
  }
}

async function pullModel(model: string, context: CommandContext): Promise<void> {
  context.ui.addItem({ type: 'info', text: `Pulling ${model}...` }, Date.now());

  try {
    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    });

    if (response.ok) {
      context.ui.addItem({ type: 'info', text: `✓ Successfully pulled ${model}` }, Date.now());
    } else {
      context.ui.addItem({ type: 'error', text: `Failed to pull ${model}` }, Date.now());
    }
  } catch (e) {
    context.ui.addItem({ type: 'error', text: `Error: ${e}` }, Date.now());
  }
}

export const ollamaCommand: SlashCommand = {
  name: 'ollama',
  description: 'Manage local Ollama models',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List installed Ollama models',
      kind: CommandKind.BUILT_IN,
      action: async (context): Promise<MessageActionReturn> => {
        const { available, models } = await checkOllama();

        if (!available) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Ollama is not running. Start it with: ollama serve',
          };
        }

        if (models.length === 0) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'No models installed. Pull one with: /ollama pull llama3.1:8b',
          };
        }

        const modelList = models.map((m) => `  • ollama/${m}`).join('\n');
        return {
          type: 'message',
          messageType: 'info',
          content: `Installed Ollama models:\n${modelList}\n\nUse with: /model ollama/<model-name>`,
        };
      },
    },
    {
      name: 'pull',
      description: 'Pull an Ollama model (e.g., /ollama pull llama3.1:8b)',
      kind: CommandKind.BUILT_IN,
      action: async (context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /ollama pull <model>\nExample: /ollama pull llama3.1:8b',
          };
        }

        const { available } = await checkOllama();
        if (!available) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Ollama is not running. Start it with: ollama serve',
          };
        }

        await pullModel(args.trim(), context);
        return { type: 'message', messageType: 'info', content: '' };
      },
    },
    {
      name: 'use',
      description: 'Switch to an Ollama model (e.g., /ollama use llama3.1:8b)',
      kind: CommandKind.BUILT_IN,
      action: async (context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /ollama use <model>\nExample: /ollama use llama3.1:8b',
          };
        }

        const model = args.trim();
        const fullModel = model.startsWith('ollama/') ? model : `ollama/${model}`;

        // Set the model via config
        if (context.services.config) {
          await context.services.config.setModel(fullModel, {});
          return {
            type: 'message',
            messageType: 'info',
            content: `Switched to ${fullModel}`,
          };
        }

        return {
          type: 'message',
          messageType: 'error',
          content: 'Could not switch model - config not available',
        };
      },
    },
  ],
  action: async (_context): Promise<MessageActionReturn> => {
    const { available, models } = await checkOllama();

    if (!available) {
      return {
        type: 'message',
        messageType: 'info',
        content: `Ollama Status: Not running

Start Ollama: ollama serve
Install: https://ollama.com

Commands:
  /ollama list  - List installed models
  /ollama pull  - Pull a model
  /ollama use   - Switch to a model`,
      };
    }

    return {
      type: 'message',
      messageType: 'info',
      content: `Ollama Status: Running ✓
Models: ${models.length} installed

Commands:
  /ollama list  - List installed models
  /ollama pull  - Pull a model (e.g., /ollama pull llama3.1:8b)
  /ollama use   - Switch to a model (e.g., /ollama use llama3.1:8b)`,
    };
  },
};
