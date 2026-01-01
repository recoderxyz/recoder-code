/**
 * Providers list command - Show all AI providers
 */

import chalk from 'chalk';
import { getOllamaProvider, getOpenRouterProvider } from '../../providers/index.js';

export async function listProviders() {
  console.log(chalk.bold.cyan('\n🔌 AI Providers\n'));

  const ollama = getOllamaProvider();
  const openrouter = getOpenRouterProvider();

  // Check Ollama
  const ollamaAvailable = await ollama.isAvailable();

  console.log(chalk.yellow('Local Providers:'));
  console.log(chalk.gray('─'.repeat(40)));

  if (ollamaAvailable) {
    console.log(chalk.green('✓ ') + chalk.bold('Ollama') + chalk.gray(' (localhost:11434)'));
    const models = await ollama.getModels();
    if (models.length > 0) {
      console.log(chalk.gray(`  ${models.length} model(s) installed`));
    } else {
      console.log(chalk.gray('  No models installed'));
    }
  } else {
    console.log(chalk.red('✗ ') + chalk.gray('Ollama (not running)'));
    console.log(chalk.gray('  Install: https://ollama.com'));
  }

  console.log(chalk.yellow('\nCloud Providers:'));
  console.log(chalk.gray('─'.repeat(40)));

  // OpenRouter
  console.log(
    (openrouter.isConfigured() ? chalk.green('✓ ') : chalk.red('✗ ')) +
      chalk.bold('OpenRouter') +
      chalk.gray(openrouter.isConfigured() ? ' (configured)' : ' (no API key)')
  );

  // Check env vars for other cloud providers
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  const openaiKey = process.env['OPENAI_API_KEY'];
  const groqKey = process.env['GROQ_API_KEY'];

  console.log(
    (anthropicKey ? chalk.green('✓ ') : chalk.red('✗ ')) +
      chalk.bold('Anthropic') +
      chalk.gray(anthropicKey ? ' (configured)' : ' (no API key)')
  );

  console.log(
    (openaiKey ? chalk.green('✓ ') : chalk.red('✗ ')) +
      chalk.bold('OpenAI') +
      chalk.gray(openaiKey ? ' (configured)' : ' (no API key)')
  );

  console.log(
    (groqKey ? chalk.green('✓ ') : chalk.red('✗ ')) +
      chalk.bold('Groq') +
      chalk.gray(groqKey ? ' (configured)' : ' (no API key)')
  );

  console.log(chalk.cyan('\n💡 Tips:'));
  console.log(chalk.gray('  • Start Ollama: ollama serve'));
  console.log(chalk.gray('  • Pull model: recoder providers pull llama3.1:8b'));
  console.log(chalk.gray('  • Set OpenRouter: export OPENROUTER_API_KEY=sk-or-...'));
  console.log();
}
