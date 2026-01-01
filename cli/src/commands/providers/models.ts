/**
 * Providers models command - List models from all providers
 */

import chalk from 'chalk';
import { getOllamaProvider, getOpenRouterProvider } from '../../providers/index.js';

export async function listProviderModels(provider?: string) {
  console.log(chalk.bold.cyan('\n🤖 Available Models\n'));

  const ollama = getOllamaProvider();
  const openrouter = getOpenRouterProvider();

  // Ollama models
  if (!provider || provider === 'ollama') {
    const ollamaAvailable = await ollama.isAvailable();
    if (ollamaAvailable) {
      console.log(chalk.yellow('Ollama (Local):'));
      console.log(chalk.gray('─'.repeat(40)));

      const models = await ollama.getModels();
      if (models.length > 0) {
        models.forEach((m, i) => {
          console.log(
            chalk.white(`${i + 1}. `) + chalk.bold.green(m.name) + (m.size ? chalk.gray(` (${m.size})`) : '')
          );
        });
      } else {
        console.log(chalk.gray('  No models installed'));
        console.log(chalk.gray('  Pull one: recoder providers pull qwen2.5-coder:7b'));
      }
      console.log();
    }
  }

  // OpenRouter models
  if (!provider || provider === 'openrouter') {
    if (openrouter.isConfigured()) {
      console.log(chalk.yellow('OpenRouter (Cloud):'));
      console.log(chalk.gray('─'.repeat(40)));

      const models = await openrouter.getModels();
      const freeModels = models.filter((m) => m.isFree).slice(0, 10);
      const paidModels = models.filter((m) => !m.isFree).slice(0, 5);

      if (freeModels.length > 0) {
        console.log(chalk.green('Free:'));
        freeModels.forEach((m) => {
          console.log(chalk.gray('  • ') + chalk.white(m.id.replace('openrouter/', '')));
        });
      }

      if (paidModels.length > 0) {
        console.log(chalk.yellow('Paid (top 5):'));
        paidModels.forEach((m) => {
          console.log(chalk.gray('  • ') + chalk.white(m.id.replace('openrouter/', '')));
        });
      }

      console.log(chalk.gray(`  ... ${models.length} total models available`));
      console.log();
    }
  }

  console.log(chalk.cyan('💡 Usage:'));
  console.log(chalk.gray('  recoder --model ollama/qwen2.5-coder:7b'));
  console.log(chalk.gray('  recoder --model openrouter/anthropic/claude-3.5-sonnet'));
  console.log();
}
