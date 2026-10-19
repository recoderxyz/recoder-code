/**
 * Interactive model selection with fuzzy search
 */

import inquirer from 'inquirer';
import { getProviderRegistry } from '../../providers/registry.js';
import chalk from 'chalk';

interface ModelChoice {
  name: string;
  value: string;
  provider: string;
  contextLength?: number;
  isFree?: boolean;
}

export async function selectModel(): Promise<void> {
  console.log(chalk.bold.cyan('\n🤖 Select AI Model\n'));

  const registry = getProviderRegistry();
  const providers = registry.getAllProviders();

  // Gather all models from all providers
  const allModels: ModelChoice[] = [];

  for (const provider of providers) {
    try {
      const models = await registry.getModels(provider.id);
      models.forEach(model => {
        const contextInfo = model.contextLength ? ` (${Math.round(model.contextLength / 1000)}k ctx)` : '';
        const freeTag = model.isFree ? chalk.green(' [FREE]') : '';
        const providerTag = chalk.gray(` - ${provider.name}`);
        
        allModels.push({
          name: `${model.id}${contextInfo}${freeTag}${providerTag}`,
          value: `${provider.id}/${model.id}`,
          provider: provider.id,
          contextLength: model.contextLength,
          isFree: model.isFree,
        });
      });
    } catch (err) {
      // Skip providers that fail to load models
    }
  }

  if (allModels.length === 0) {
    console.log(chalk.red('❌ No models available'));
    console.log(chalk.gray('   Run: recoder providers detect'));
    return;
  }

  // Sort: free models first, then by context length
  allModels.sort((a, b) => {
    if (a.isFree && !b.isFree) return -1;
    if (!a.isFree && b.isFree) return 1;
    return (b.contextLength || 0) - (a.contextLength || 0);
  });

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select a model:',
      choices: allModels.slice(0, 30),
      pageSize: 15,
    },
  ]);

  const selected = allModels.find(m => m.value === answer.model);
  
  if (selected) {
    console.log(chalk.green(`\n✅ Selected: ${selected.value}`));
    console.log(chalk.cyan('\n💡 Usage:'));
    console.log(chalk.gray(`   recoder --model ${selected.value}`));
    console.log(chalk.gray(`   Or set as default: recoder models set-default ${selected.value}`));
  }
}
