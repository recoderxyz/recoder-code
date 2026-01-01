/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const quotaCommand: CommandModule = {
  command: 'quota',
  describe: 'View usage quota information',
  handler: async () => {
    try {
      const authService = new RecoderAuthService();

      // Check if authenticated
      if (!(await authService.isAuthenticated())) {
        console.error('❌ Not authenticated');
        console.log('💡 Run: recoder-code auth login');
        process.exit(1);
      }

      const user = await authService.getUser();
      const quota = await authService.getQuota();

      if (!quota) {
        console.error('❌ Unable to fetch quota information');
        process.exit(1);
      }

      console.log('📊 Quota Information');
      console.log('─'.repeat(50));
      console.log(`Plan: ${user?.subscription_plan?.toUpperCase()}`);
      console.log(`\nRequests:`);
      console.log(`  • Used: ${quota.requests_limit - quota.requests_remaining}`);
      console.log(`  • Remaining: ${quota.requests_remaining}`);
      console.log(`  • Limit: ${quota.requests_limit}`);

      const percentUsed =
        ((quota.requests_limit - quota.requests_remaining) /
          quota.requests_limit) *
        100;
      console.log(`  • Usage: ${percentUsed.toFixed(1)}%`);

      console.log(`\nReset Date: ${new Date(quota.reset_date).toLocaleString()}`);

      // Show progress bar
      const barLength = 30;
      const filled = Math.floor(
        ((quota.requests_limit - quota.requests_remaining) /
          quota.requests_limit) *
          barLength,
      );
      const empty = barLength - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      console.log(`\n[${bar}] ${percentUsed.toFixed(1)}%`);

      if (percentUsed > 90) {
        console.log('\n⚠️  Warning: You\'re approaching your quota limit');
        console.log('💡 Consider upgrading your plan at: https://recoder.xyz/pricing');
      }

      process.exit(0);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  },
};
