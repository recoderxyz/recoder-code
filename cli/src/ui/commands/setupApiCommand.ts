/**
 * API Key Setup Command
 * Interactive command to configure AI API keys
 */

import type { MessageActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { runApiKeySetup, isApiKeyConfigured, loadApiKeyConfig } from '../../setup/apiKeySetup.js';

/**
 * Command to configure API keys for AI providers.
 * 
 * This command runs an interactive setup wizard to help users configure
 * their OpenRouter, OpenAI, or custom API keys.
 */
export const setupApiCommand: SlashCommand = {
  name: 'setup',
  description: 'Configure AI API keys (OpenRouter, OpenAI, or custom)',
  kind: CommandKind.BUILT_IN,

  action: async (): Promise<MessageActionReturn> => {
    try {
      // Check current configuration
      const isConfigured = isApiKeyConfigured();
      const currentConfig = loadApiKeyConfig();
      
      if (isConfigured && currentConfig) {
        const providerInfo = currentConfig.provider === 'openrouter' 
          ? 'OpenRouter' 
          : currentConfig.provider === 'openai' 
          ? 'OpenAI' 
          : 'Custom API';
        
        const message = `📝 Current Configuration:\n\n` +
          `Provider: ${providerInfo}\n` +
          `Base URL: ${currentConfig.baseUrl}\n` +
          `API Key: ${currentConfig.apiKey.substring(0, 10)}...${currentConfig.apiKey.substring(currentConfig.apiKey.length - 4)}\n` +
          (currentConfig.defaultModel ? `Default Model: ${currentConfig.defaultModel}\n` : '') +
          `\nRunning setup will update your configuration...`;
        
        return {
          type: 'message',
          content: message,
          messageType: 'info',
        };
      }

      // Run setup wizard in the background (non-blocking)
      // The actual setup happens in the terminal outside of Ink's rendering
      setTimeout(async () => {
        await runApiKeySetup();
      }, 100);

      return {
        type: 'message',
        content: '🚀 Starting API Key Setup Wizard...\n\n' +
          'The setup wizard will run in your terminal.\n' +
          'Please follow the prompts to configure your API key.\n\n' +
          'Supported providers:\n' +
          '  • OpenRouter - Access 30+ models (many free)\n' +
          '  • OpenAI - GPT-4, GPT-4o, etc.\n' +
          '  • Custom - Any OpenAI-compatible API',
        messageType: 'info',
      };
    } catch (error) {
      return {
        type: 'message',
        content: `❌ Setup failed: ${error}\n\n` +
          'You can also configure manually by creating ~/.recoder-code/.env\n' +
          'or setting OPENAI_API_KEY and OPENAI_BASE_URL environment variables.',
        messageType: 'error',
      };
    }
  },
};

/**
 * Alias command for /setup
 */
export const setupApiKeyCommand: SlashCommand = {
  name: 'setup-api',
  description: 'Configure AI API keys (alias for /setup)',
  kind: CommandKind.BUILT_IN,
  action: setupApiCommand.action,
};
