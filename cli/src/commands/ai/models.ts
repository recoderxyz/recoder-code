/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAIService } from '../../services/RecoderAIService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const modelsCommand: CommandModule = {
  command: 'models',
  aliases: ['recommend'],
  describe: 'Get cost-optimized model recommendations',
  builder: (yargs) =>
    yargs
      .option('task', {
        alias: 't',
        type: 'string',
        description: 'Task type',
        default: 'code-generation',
        choices: ['code-generation', 'chat', 'refactoring', 'documentation'],
      })
      .option('budget', {
        alias: 'b',
        type: 'number',
        description: 'Maximum budget per request (USD)',
      }),
  handler: async (argv) => {
    try {
      const authService = new RecoderAuthService();
      const aiService = new RecoderAIService();

      // Check authentication
      if (!(await authService.isAuthenticated())) {
        console.error('\n❌ Please login first: recoder-code auth login\n');
        process.exit(1);
      }

      console.log('🔧 Model Recommendations\n');
      console.log('═'.repeat(60));

      // Get recommendations
      const recommendations = await aiService.getModelRecommendations(
        argv.task as string,
        argv.budget as number,
      );

      // Display recommendations
      console.log(`\nTask: ${argv.task}`);
      if (argv.budget) {
        console.log(`Max Budget: ${aiService.formatCost(argv.budget as number)}`);
      }
      console.log();

      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.model}`);
        console.log(`   💰 Est. Cost: ${aiService.formatCost(rec.estimatedCost)}`);
        console.log(`   ⭐ Quality: ${rec.quality}`);
        console.log(`   ⚡ Speed: ${rec.speed}`);
        console.log(`   💡 ${rec.reason}`);
        console.log();
      });

      // Show current budget
      try {
        const stats = await aiService.getUsageStats();
        const emoji = aiService.getBudgetEmoji(stats.percentUsed);
        console.log('─'.repeat(60));
        console.log(
          `${emoji} Your Budget: ${aiService.formatCost(stats.remainingBudget)} remaining (${stats.percentUsed.toFixed(1)}% used)`,
        );
      } catch {
        // Ignore if can't fetch stats
      }

      console.log('\n═'.repeat(60));
      console.log('\n💡 Usage:');
      console.log('   recoder-code ai generate "your prompt" --model <model-name>');
      console.log('   recoder-code ai chat --model <model-name>\n');

      process.exit(0);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
      process.exit(1);
    }
  },
};
