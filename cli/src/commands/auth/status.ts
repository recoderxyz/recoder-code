/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const statusCommand: CommandModule = {
  command: 'status',
  describe: 'Check authentication status',
  handler: async () => {
    try {
      const authService = new RecoderAuthService();
      const isAuth = await authService.isAuthenticated();

      if (!isAuth) {
        console.log('❌ Not authenticated');
        console.log('💡 Run: recoder-code auth login');
        process.exit(1);
      }

      const user = await authService.getUser();
      const quota = await authService.getQuota();

      console.log('✅ Authenticated');
      console.log(`📧 Email: ${user?.email}`);
      console.log(`👤 Name: ${user?.name}`);
      console.log(`📋 Plan: ${user?.subscription_plan?.toUpperCase()}`);

      if (quota) {
        console.log(`\n📊 Quota:`);
        console.log(`  • Requests: ${quota.requests_remaining}/${quota.requests_limit}`);
        console.log(`  • Resets: ${new Date(quota.reset_date).toLocaleDateString()}`);

        const percentUsed =
          ((quota.requests_limit - quota.requests_remaining) /
            quota.requests_limit) *
          100;
        console.log(`  • Usage: ${percentUsed.toFixed(1)}%`);
      }

      if (user?.subscription_plan === 'free') {
        if (user.has_own_api_key) {
          console.log('\n🔑 OpenRouter API key: Configured ✅');
        } else {
          console.log('\n⚠️  OpenRouter API key: Not configured');
          console.log('💡 Free tier requires your own API key');
          console.log('💡 Get one at: https://openrouter.ai');
          console.log('💡 Then run: recoder-code auth set-api-key <your-key>');
        }
      }

      process.exit(0);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  },
};
