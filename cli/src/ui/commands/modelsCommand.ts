/**
 * /models slash command - Browse and select models
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { getProviderRegistry } from '../../providers/registry.js';

export const modelsCommand: SlashCommand = {
  name: 'models',
  description: 'Browse and select AI models',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List models from a provider (e.g., /models list ollama)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const registry = getProviderRegistry();
        const providerId = args?.trim() || 'ollama';

        const provider = registry.getProvider(providerId);
        if (!provider) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Provider not found: ${providerId}`,
          };
        }

        const models = await registry.getModels(providerId);
        if (models.length === 0) {
          return {
            type: 'message',
            messageType: 'info',
            content: `No models found for ${provider.name}. ${provider.isLocal ? 'Is the server running?' : 'Is the API key configured?'}`,
          };
        }

        const lines = [
          `${provider.name} Models (${models.length}):`,
          '',
          ...models.slice(0, 30).map((m) => {
            const info = [m.size, m.contextLength ? `${Math.round(m.contextLength / 1000)}k ctx` : ''].filter(Boolean).join(', ');
            return `  ${providerId}/${m.id}${info ? ` (${info})` : ''}`;
          }),
        ];

        if (models.length > 30) {
          lines.push(`  ... and ${models.length - 30} more`);
        }

        lines.push('', `Use: /model ${providerId}/<model-name>`);

        return { type: 'message', messageType: 'info', content: lines.join('\n') };
      },
    },
    {
      name: 'search',
      description: 'Search models (e.g., /models search llama)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /models search <query>',
          };
        }

        const query = args.trim().toLowerCase();
        const registry = getProviderRegistry();
        const available = await registry.getAvailableProviders();
        const results: string[] = [];

        for (const provider of available) {
          const models = await registry.getModels(provider.id);
          const matches = models.filter((m) => m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query));

          for (const m of matches.slice(0, 10)) {
            results.push(`  ${provider.id}/${m.id}`);
          }
        }

        if (results.length === 0) {
          return {
            type: 'message',
            messageType: 'info',
            content: `No models found matching: ${query}`,
          };
        }

        return {
          type: 'message',
          messageType: 'info',
          content: [`Models matching "${query}":`, '', ...results.slice(0, 30)].join('\n'),
        };
      },
    },
  ],
  action: async (): Promise<MessageActionReturn> => {
    const registry = getProviderRegistry();
    const available = await registry.getAvailableProviders();
    const def = registry.getDefault();

    const lines = [
      'AI Models',
      '',
      `Current: ${def.model}`,
      '',
      'Available Providers:',
    ];

    for (const provider of available) {
      const models = await registry.getModels(provider.id);
      lines.push(`  ${provider.name}: ${models.length} models`);
    }

    lines.push(
      '',
      'Commands:',
      '  /models list <provider> - List models from provider',
      '  /models search <query>  - Search all models',
      '  /model <provider/model> - Switch to model',
      '',
      'Examples:',
      '  /models list ollama',
      '  /models list openrouter',
      '  /model ollama/llama3.1:8b',
      '  /model openrouter/anthropic/claude-3.5-sonnet'
    );

    return { type: 'message', messageType: 'info', content: lines.join('\n') };
  },
};
