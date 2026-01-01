/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAIService } from '../../services/RecoderAIService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const generateCommand: CommandModule = {
  command: 'generate <prompt>',
  aliases: ['gen', 'g'],
  describe: 'Generate code with AI (Premium)',
  builder: (yargs) =>
    yargs
      .positional('prompt', {
        type: 'string',
        description: 'What to generate',
        demandOption: true,
      })
      .option('model', {
        alias: 'm',
        type: 'string',
        description: 'AI model to use (e.g., anthropic/claude-3.5-sonnet)',
      })
      .option('language', {
        alias: 'l',
        type: 'string',
        description: 'Programming language',
      })
      .option('framework', {
        alias: 'f',
        type: 'string',
        description: 'Framework to use',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output file path',
      })
      .option('max-tokens', {
        type: 'number',
        description: 'Maximum tokens to generate',
        default: 2000,
      })
      .option('temperature', {
        type: 'number',
        description: 'Creativity (0-1)',
        default: 0.7,
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
        console.error('\n⚠️  AI generation requires a premium plan');
        console.error('💡 Free users: Configure your OpenRouter API key');
        console.error('   Run: recoder-code auth set-api-key sk-or-v1-xxx');
        console.error('   Get key at: https://openrouter.ai');
        console.error('\n💎 Or upgrade to Pro/Premium at: https://recoder.xyz/pricing');
        console.error('   Pro ($20/mo): No API key needed, $17.50 AI budget');
        console.error('   Premium ($100/mo): No API key needed, $93 AI budget\n');
        process.exit(1);
      }

      console.log('🤖 Generating code with AI...\n');

      // Generate code
      const response = await aiService.generateCode({
        prompt: argv.prompt as string,
        model: argv.model as string,
        language: argv.language as string,
        framework: argv.framework as string,
        maxTokens: argv['max-tokens'] as number,
        temperature: argv.temperature as number,
      });

      // Handle budget exceeded
      if (!response.success && response.error === 'BUDGET_EXCEEDED') {
        aiService.handleBudgetExceeded(response);
        process.exit(1);
      }

      // Display result
      console.log('✅ Code generated successfully!\n');
      console.log('─'.repeat(60));
      console.log(response.data?.code);
      console.log('─'.repeat(60));

      // Display cost info
      if (response.data?.metadata) {
        aiService.displayCostInfo(response.data.metadata);
      }

      // Display warning if any
      aiService.displayWarning(response.warning);

      // Save to file if specified
      if (argv.output) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(argv.output as string, response.data?.code || '');
        console.log(`\n💾 Saved to: ${argv.output}`);
      }

      // Show tip for cost savings
      if (response.data?.metadata.budgetPercent > 75) {
        console.log('\n💡 Tip: Try cheaper models like "anthropic/claude-3-haiku" for simple tasks');
        console.log('   Run: recoder-code ai models --task code-generation');
      }

      process.exit(0);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
      process.exit(1);
    }
  },
};
