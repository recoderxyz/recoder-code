/**
 * Multi-model comparison mode
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { getProviderRegistry } from '../../providers/registry.js';

interface ComparisonResult {
  model: string;
  response: string;
  responseTime: number;
  tokenCount?: number;
  error?: string;
}

export async function compareModels(): Promise<void> {
  console.log(chalk.bold.cyan('\n⚖️  Multi-Model Comparison\n'));

  const registry = getProviderRegistry();
  const providers = registry.getAllProviders();

  // Get available models
  const modelChoices: string[] = [];
  for (const provider of providers) {
    try {
      const models = await registry.getModels(provider.id);
      models.forEach(m => {
        modelChoices.push(`${provider.id}/${m.id}`);
      });
    } catch {
      // Skip
    }
  }

  if (modelChoices.length < 2) {
    console.log(chalk.red('❌ Need at least 2 models to compare'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'models',
      message: 'Select models to compare (2-4):',
      choices: modelChoices.slice(0, 20),
      validate: (input: string[]) => {
        if (input.length < 2) return 'Select at least 2 models';
        if (input.length > 4) return 'Select at most 4 models';
        return true;
      },
    },
    {
      type: 'input',
      name: 'prompt',
      message: 'Enter prompt to test:',
      validate: (input: string) => input.length > 0 || 'Prompt required',
    },
  ]);

  console.log(chalk.cyan('\n🔄 Running comparison...\n'));

  const results: ComparisonResult[] = [];

  for (const model of answers.models) {
    const start = Date.now();
    
    try {
      // Simulate API call (replace with actual implementation)
      const response = `Response from ${model}`;
      const responseTime = Date.now() - start;
      
      results.push({
        model,
        response,
        responseTime,
      });
    } catch (err: any) {
      results.push({
        model,
        response: '',
        responseTime: Date.now() - start,
        error: err.message,
      });
    }
  }

  // Display results
  console.log(chalk.bold('Comparison Results:'));
  console.log(chalk.gray('═'.repeat(60)));

  results.forEach((result, i) => {
    console.log(chalk.bold.cyan(`\n${i + 1}. ${result.model}`));
    console.log(chalk.gray(`   Response time: ${result.responseTime}ms`));
    
    if (result.error) {
      console.log(chalk.red(`   Error: ${result.error}`));
    } else {
      console.log(chalk.white(`   ${result.response.substring(0, 200)}...`));
    }
  });

  console.log(chalk.gray('\n═'.repeat(60)));

  // Show fastest
  const fastest = results.filter(r => !r.error).sort((a, b) => a.responseTime - b.responseTime)[0];
  if (fastest) {
    console.log(chalk.green(`\n⚡ Fastest: ${fastest.model} (${fastest.responseTime}ms)`));
  }

  console.log();
}
