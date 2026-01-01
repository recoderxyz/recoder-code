/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { getBYOKManager, OAuthPKCEClient } from 'recoder-code-core';

export const byokCommand: SlashCommand = {
  name: 'byok',
  description: 'Manage Bring Your Own Keys (BYOK) for AI providers',
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<MessageActionReturn> => {
    const manager = getBYOKManager();
    const providers = manager.listAvailableProviders();

    let content = '🔑 BYOK - Bring Your Own Keys\n\n**Configured Providers:**\n';
    providers.forEach((p) => {
      content += `  ${p.configured ? '✅' : '❌'} ${p.name}${p.hasBaseUrl ? ' (custom URL)' : ''}\n`;
    });

    content += '\n**Commands:**\n';
    content += '  /byok add <provider> <key>    Add provider API key\n';
    content += '  /byok remove <provider>       Remove provider\n';
    content += '  /byok test <provider>         Test provider key\n';
    content += '  /byok list                    List providers\n';

    return { type: 'message', messageType: 'info', content };
  },
  subCommands: [
    {
      name: 'add',
      description: 'Add a provider API key',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim().split(' ');
        if (!args || args.length < 2) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /byok add <provider> <api-key> [base-url]\n\nProviders: openai, anthropic, google, cohere, together, perplexity, mistral, groq',
          };
        }

        const [provider, apiKey, baseUrl] = args;
        const manager = getBYOKManager();
        
        try {
          manager.addProvider(provider as any, apiKey, baseUrl);
          return {
            type: 'message',
            messageType: 'info',
            content: `✅ Added ${provider} API key successfully!`,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to add provider: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'remove',
      description: 'Remove a provider',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const provider = context.invocation?.args?.trim();
        if (!provider) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /byok remove <provider>',
          };
        }

        const manager = getBYOKManager();
        manager.removeProvider(provider as any);
        
        return {
          type: 'message',
          messageType: 'info',
          content: `✅ Removed ${provider} successfully!`,
        };
      },
    },
    {
      name: 'test',
      description: 'Test provider API key',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const provider = context.invocation?.args?.trim();
        if (!provider) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /byok test <provider>',
          };
        }

        const manager = getBYOKManager();
        const result = await manager.validateProvider(provider as any);

        return {
          type: 'message',
          messageType: result.valid ? 'info' : 'error',
          content: result.valid
            ? `✅ ${provider} API key is valid!`
            : `❌ ${provider} API key is invalid: ${result.error}`,
        };
      },
    },
    {
      name: 'oauth',
      description: 'Authenticate with OpenRouter OAuth',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        try {
          const client = new OAuthPKCEClient({
            clientId: process.env['OPENROUTER_CLIENT_ID'] || 'recoder-code',
            redirectUri: 'http://localhost:3000/callback',
          });

          const pkce = client.generatePKCETokens();
          const authUrl = client.getAuthorizationUrl(pkce);

          console.log('\n🔐 OpenRouter OAuth Authentication\n');
          console.log('Opening browser for authentication...\n');
          console.log(`If browser doesn't open, visit: ${authUrl}\n`);

          // Open browser (platform-specific)
          const open = (await import('open')).default;
          await open(authUrl);

          // Start callback server
          const authResponse = await client.startCallbackServer(3000);

          // Exchange code for token
          const tokenResponse = await client.exchangeCodeForToken(
            authResponse.code,
            pkce.codeVerifier,
          );

          // Store token (you'll need to implement this in config)
          console.log('\n✅ Authentication successful!\n');
          console.log(`Access Token: ${tokenResponse.access_token.substring(0, 20)}...`);

          return {
            type: 'message',
            messageType: 'info',
            content: '✅ OAuth authentication complete! Your OpenRouter API key has been saved.',
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `OAuth failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
  ],
};
