/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const setApiKeyCommand: CommandModule = {
  command: 'set-api-key <api-key>',
  describe: 'Set OpenRouter API key (for free tier users)',
  builder: (yargs) =>
    yargs.positional('api-key', {
      type: 'string',
      description: 'Your OpenRouter API key (starts with sk-or-)',
      demandOption: true,
    }),
  handler: async (argv) => {
    try {
      const authService = new RecoderAuthService();

      // Check if authenticated
      if (!(await authService.isAuthenticated())) {
        console.error('❌ Not authenticated');
        console.log('💡 Run: recoder-code auth login');
        process.exit(1);
      }

      const user = await authService.getUser();
      if (user?.subscription_plan !== 'free') {
        console.log('ℹ️  Premium users don\'t need to provide an API key');
        console.log('🎉 You can use all features directly!');
        process.exit(0);
      }

      const apiKey = argv['api-key'] as string;

      if (!apiKey) {
        console.error('❌ Please provide your OpenRouter API key');
        console.log('\nUsage:');
        console.log('  recoder-code auth set-api-key <your-api-key>');
        console.log('\nGet your API key at: https://openrouter.ai');
        process.exit(1);
      }

      await authService.setOpenRouterApiKey(apiKey);
      process.exit(0);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
