/**
 * Providers slash command - Manage AI providers
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

async function checkOllama(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const providersCommand: SlashCommand = {
  name: 'providers',
  description: 'Show available AI providers',
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<MessageActionReturn> => {
    const ollamaAvailable = await checkOllama();
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    const groqKey = process.env['GROQ_API_KEY'];
    const openrouterKey = process.env['OPENROUTER_API_KEY'];

    const providers = [
      `Local:`,
      `  ${ollamaAvailable ? '✓' : '✗'} Ollama ${ollamaAvailable ? '(running)' : '(not running)'}`,
      ``,
      `Cloud:`,
      `  ${openrouterKey ? '✓' : '✗'} OpenRouter ${openrouterKey ? '(configured)' : ''}`,
      `  ${anthropicKey ? '✓' : '✗'} Anthropic ${anthropicKey ? '(configured)' : ''}`,
      `  ${openaiKey ? '✓' : '✗'} OpenAI ${openaiKey ? '(configured)' : ''}`,
      `  ${groqKey ? '✓' : '✗'} Groq ${groqKey ? '(configured)' : ''}`,
      ``,
      `Usage:`,
      `  /model ollama/<model>     - Use local Ollama`,
      `  /model openrouter/<model> - Use OpenRouter`,
      `  /ollama list              - List Ollama models`,
      `  /openrouter               - Browse OpenRouter models`,
    ];

    return {
      type: 'message',
      messageType: 'info',
      content: providers.join('\n'),
    };
  },
};
