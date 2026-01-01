/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAIService } from '../../services/RecoderAIService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const usageCommand: CommandModule = {
  command: 'usage',
  aliases: ['stats', 'quota'],
  describe: 'View AI usage statistics and budget',
  handler: async () => {
    try {
      const authService = new RecoderAuthService();
      const aiService = new RecoderAIService();

      // Check authentication
      if (!(await authService.isAuthenticated())) {
        console.error('\n❌ Please login first: recoder-code auth login\n');
        process.exit(1);
      }

      console.log('📊 AI Usage Statistics\n');
      console.log('═'.repeat(60));

      // Get usage stats
      const stats = await aiService.getUsageStats();

      // Plan info
      console.log(`\n📋 Plan: ${stats.plan.toUpperCase()}`);
      console.log(`💰 Monthly Limit: ${aiService.formatCost(stats.monthlyLimit)}`);
      
      // Budget info
      const emoji = aiService.getBudgetEmoji(stats.percentUsed);
      console.log(`\n${emoji} Budget Status:`);
      console.log(`   Spent: ${aiService.formatCost(stats.currentSpend)}`);
      console.log(`   Remaining: ${aiService.formatCost(stats.remainingBudget)}`);
      console.log(`   Used: ${stats.percentUsed.toFixed(1)}%`);

      // Progress bar
      const barLength = 40;
      const filled = Math.floor((stats.percentUsed / 100) * barLength);
      const empty = barLength - filled;
      const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
      console.log(`\n   [${bar}] ${stats.percentUsed.toFixed(1)}%`);

      // Request stats
      console.log(`\n📈 Request Statistics:`);
      console.log(`   Total Requests: ${stats.totalRequests.toLocaleString()}`);
      console.log(`   Average Cost: ${aiService.formatCost(stats.averageCostPerRequest)}`);

      // Reset info
      const resetDate = new Date(stats.resetDate);
      console.log(`\n🔄 Reset Information:`);
      console.log(`   Reset Date: ${resetDate.toLocaleDateString()}`);
      console.log(`   Days Until Reset: ${stats.daysUntilReset}`);

      // Top models
      if (stats.topModels && stats.topModels.length > 0) {
        console.log(`\n🔧 Most Used Models:`);
        stats.topModels.slice(0, 5).forEach((model, index) => {
          console.log(
            `   ${index + 1}. ${model.model}: ${model.requests} requests (${aiService.formatCost(model.cost)})`,
          );
        });
      }

      // Warnings
      if (stats.percentUsed >= 95) {
        console.log('\n🚨 Warning: You are approaching your monthly limit!');
        console.log('💡 Consider upgrading at: https://recoder.xyz/pricing');
      } else if (stats.percentUsed >= 75) {
        console.log('\n⚠️  You have used 75% of your monthly budget');
      }

      console.log('\n═'.repeat(60));
      process.exit(0);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
      process.exit(1);
    }
  },
};
