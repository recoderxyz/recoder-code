/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAIService } from '../../services/RecoderAIService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { detectFilePaths, formatPathsForDisplay } from '../../utils/filePathDetector.js';

export const chatCommand: CommandModule = {
  command: 'chat',
  describe: 'Interactive chat with AI (Premium)',
  builder: (yargs) =>
    yargs.option('model', {
      alias: 'm',
      type: 'string',
      description: 'AI model to use',
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

      // Check user plan
      const user = await authService.getUser();
      if (user?.subscription_plan === 'free') {
        console.error('\n⚠️  AI chat requires a premium plan');
        console.error('💡 Free users: Configure your OpenRouter API key');
        console.error('   Run: recoder-code auth set-api-key sk-or-v1-xxx');
        console.error('   Get key at: https://openrouter.ai');
        console.error('\n💎 Or upgrade to Pro/Premium at: https://recoder.xyz/pricing');
        console.error('   Pro ($20/mo): No API key needed');
        console.error('   Premium ($100/mo): No API key needed\n');
        process.exit(1);
      }

      console.log('💬 AI Chat (Premium)\n');
      console.log('═'.repeat(60));
      console.log('Type your message and press Enter. Type "exit" to quit.\n');

      const messages: Array<{ role: string; content: string }> = [];
      const readline = await import('readline');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Enable paste mode for file paths
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }

      const chat = async () => {
        rl.question('You: ', async (input) => {
          const message = input.trim();

          if (!message) {
            chat();
            return;
          }

          if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
            console.log('\n👋 Goodbye!\n');
            rl.close();
            process.exit(0);
            return;
          }

          // Detect file paths from paste/drag
          const paths = detectFilePaths(message);
          if (paths.length > 0) {
            console.log(formatPathsForDisplay(paths));
          }

          // Add user message
          messages.push({ role: 'user', content: message });

          // Get AI response
          console.log('\n🤖 Thinking...\n');

          try {
            const response = await aiService.chat({
              messages,
              model: argv.model as string,
            });

            // Handle budget exceeded
            if (!response.success && response.error === 'BUDGET_EXCEEDED') {
              aiService.handleBudgetExceeded(response);
              rl.close();
              process.exit(1);
              return;
            }

            // Add AI response
            messages.push({
              role: 'assistant',
              content: response.data?.message || '',
            });

            // Display response
            console.log(`AI: ${response.data?.message}\n`);

            // Display cost info (compact)
            if (response.data?.metadata) {
              const m = response.data.metadata;
              const emoji = aiService.getBudgetEmoji(m.budgetPercent);
              console.log(
                `${emoji} Cost: ${aiService.formatCost(m.costUSD)} | Remaining: ${aiService.formatCost(m.remainingBudget)} (${m.budgetPercent.toFixed(1)}%)`,
              );
            }

            // Display warning
            aiService.displayWarning(response.warning);

            console.log();
            chat();
          } catch (error: any) {
            console.error(`\n❌ Error: ${error.message}\n`);
            chat();
          }
        });
      };

      chat();
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
      process.exit(1);
    }
  },
};
