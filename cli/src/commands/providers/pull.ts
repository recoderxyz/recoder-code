/**
 * Providers pull command - Pull Ollama models
 */

import chalk from 'chalk';
import { getOllamaProvider } from '../../providers/index.js';

export async function pullModel(modelName: string) {
  const ollama = getOllamaProvider();

  if (!(await ollama.isAvailable())) {
    console.log(chalk.red('\n❌ Ollama is not running'));
    console.log(chalk.gray('Start it with: ollama serve\n'));
    return;
  }

  console.log(chalk.cyan(`\n📥 Pulling ${modelName}...\n`));

  const success = await ollama.pullModel(modelName, (status) => {
    process.stdout.write(`\r${chalk.gray(status.slice(0, 60).padEnd(60))}`);
  });

  console.log(); // New line after progress

  if (success) {
    console.log(chalk.green(`\n✓ Successfully pulled ${modelName}`));
    console.log(chalk.gray(`Use with: recoder --model ollama/${modelName}\n`));
  } else {
    console.log(chalk.red(`\n❌ Failed to pull ${modelName}`));
    console.log(chalk.gray('Check model name at: https://ollama.com/library\n'));
  }
}
