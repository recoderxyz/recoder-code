/**
 * /connect slash command - Interactive provider configuration
 */

import type { SlashCommand, CommandContext, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { getProviderRegistry } from '../../providers/registry.js';
import { BUILTIN_PROVIDERS } from '../../providers/types.js';

export const connectCommand: SlashCommand = {
  name: 'connect',
  description: 'Configure AI provider credentials',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List all providers and their status',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const registry = getProviderRegistry();
        const lines: string[] = ['AI Providers:', ''];

        // Local providers
        lines.push('Local:');
        for (const p of BUILTIN_PROVIDERS.filter((p) => p.isLocal)) {
          const available = await registry.isProviderAvailable(p.id);
          lines.push(`  ${available ? '✓' : '✗'} ${p.name} (${p.id}) - ${p.baseUrl}`);
        }

        // Cloud providers
        lines.push('', 'Cloud:');
        for (const p of BUILTIN_PROVIDERS.filter((p) => !p.isLocal)) {
          const hasKey = p.apiKeyEnv ? !!process.env[p.apiKeyEnv] : false;
          lines.push(`  ${hasKey ? '✓' : '✗'} ${p.name} (${p.id}) ${hasKey ? '- configured' : `- set ${p.apiKeyEnv}`}`);
        }

        // Custom providers
        const custom = registry.getAllProviders().filter((p) => !p.isBuiltin);
        if (custom.length > 0) {
          lines.push('', 'Custom:');
          for (const p of custom) {
            lines.push(`  ✓ ${p.name} (${p.id}) - ${p.baseUrl}`);
          }
        }

        lines.push('', 'Commands:', '  /connect add    - Add custom provider', '  /connect remove - Remove custom provider');

        return { type: 'message', messageType: 'info', content: lines.join('\n') };
      },
    },
    {
      name: 'add',
      description: 'Add a custom provider (e.g., /connect add myapi openai https://api.example.com/v1)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'info',
            content: `Add Custom Provider

Usage: /connect add <id> <engine> <base-url> [api-key-env]

Engines: openai, anthropic, ollama, google

Examples:
  /connect add corporate openai https://api.corp.com/v1 CORP_API_KEY
  /connect add lmstudio openai http://localhost:1234/v1
  /connect add vllm openai http://localhost:8000/v1

The provider will be saved to ~/.recoder-code/custom_providers/<id>.json`,
          };
        }

        const parts = args.trim().split(/\s+/);
        if (parts.length < 3) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /connect add <id> <engine> <base-url> [api-key-env]',
          };
        }

        const [id, engine, baseUrl, apiKeyEnv] = parts;
        const validEngines = ['openai', 'anthropic', 'ollama', 'google'];
        
        if (!validEngines.includes(engine)) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Invalid engine: ${engine}. Use: ${validEngines.join(', ')}`,
          };
        }

        const registry = getProviderRegistry();
        const provider = {
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          engine: engine as 'openai' | 'anthropic' | 'ollama' | 'google',
          baseUrl,
          apiKeyEnv,
          models: [],
          isLocal: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
        };

        registry.addCustomProvider(provider);
        registry.saveCustomProviderFile(provider);

        return {
          type: 'message',
          messageType: 'info',
          content: `✓ Added provider: ${id}

Config saved to: ~/.recoder-code/custom_providers/${id}.json

Use with: /model ${id}/<model-name>
${apiKeyEnv ? `Set API key: export ${apiKeyEnv}=your-key` : ''}`,
        };
      },
    },
    {
      name: 'remove',
      description: 'Remove a custom provider',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /connect remove <provider-id>',
          };
        }

        const registry = getProviderRegistry();
        const id = args.trim();

        // Check if it's a builtin
        if (BUILTIN_PROVIDERS.some((p) => p.id === id)) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Cannot remove built-in provider: ${id}`,
          };
        }

        if (registry.removeCustomProvider(id)) {
          return {
            type: 'message',
            messageType: 'info',
            content: `✓ Removed provider: ${id}`,
          };
        }

        return {
          type: 'message',
          messageType: 'error',
          content: `Provider not found: ${id}`,
        };
      },
    },
  ],
  action: async (): Promise<MessageActionReturn> => {
    // Default action - show status
    const registry = getProviderRegistry();
    const available = await registry.getAvailableProviders();
    const def = registry.getDefault();

    const lines = [
      'Provider Status',
      '',
      `Default: ${def.model}`,
      '',
      `Available (${available.length}):`,
      ...available.map((p) => `  • ${p.name} (${p.id})`),
      '',
      'Commands:',
      '  /connect list   - Show all providers',
      '  /connect add    - Add custom provider',
      '  /connect remove - Remove custom provider',
      '  /model          - Switch model',
    ];

    return { type: 'message', messageType: 'info', content: lines.join('\n') };
  },
};
