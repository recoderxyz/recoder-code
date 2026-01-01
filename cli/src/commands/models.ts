/**
 * Models command - List and select AI models
 */

import chalk from 'chalk';
import { OPENROUTER_MODELS, getFreeModels, getPaidModels, MODEL_CATEGORIES } from '../ui/models/openrouter-models.js';

export function listModels(showAll: boolean = false) {
  console.log(chalk.bold.cyan('\n🤖 Available AI Models\n'));
  
  if (!showAll) {
    console.log(chalk.yellow('Free Models (No Cost):'));
    console.log(chalk.gray('─'.repeat(50)));
    
    getFreeModels().forEach((model, idx) => {
      console.log(
        chalk.white(`${idx + 1}. `) +
        chalk.bold.green(model.name)
      );
      console.log(chalk.gray(`   ID: ${model.id}`));
      console.log(chalk.gray(`   ${model.description}`));
      console.log(chalk.gray(`   Context: ${(model.contextLength / 1000).toFixed(0)}K tokens`));
      console.log();
    });
    
    console.log(chalk.yellow('\n💎 Premium Models (Paid):'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray('Use --all flag to see premium models\n'));
  } else {
    // Show all models by category
    Object.entries(MODEL_CATEGORIES).forEach(([category, label]) => {
      const models = OPENROUTER_MODELS.filter(m => m.category === category);
      if (models.length === 0) return;
      
      console.log(chalk.yellow(`\n${label}:`));
      console.log(chalk.gray('─'.repeat(50)));
      
      models.forEach((model, idx) => {
        const priceTag = model.pricing === 'free' ? chalk.green('[FREE]') : chalk.yellow('[PAID]');
        console.log(
          chalk.white(`${idx + 1}. `) +
          chalk.bold.white(model.name) +
          ' ' + priceTag
        );
        console.log(chalk.gray(`   ID: ${model.id}`));
        console.log(chalk.gray(`   ${model.description}`));
        console.log(chalk.gray(`   Context: ${(model.contextLength / 1000).toFixed(0)}K tokens`));
        console.log();
      });
    });
  }
  
  console.log(chalk.cyan('\n📝 Usage:'));
  console.log(chalk.white('  recoder-code --model MODEL_ID -p "your prompt"'));
  console.log(chalk.white('  recoder-code --model deepseek/deepseek-chat-v3.1:free -p "hello"'));
  
  console.log(chalk.cyan('\n💡 Recommended:'));
  console.log(chalk.white('  Free: deepseek/deepseek-chat-v3.1:free (fast & capable)'));
  console.log(chalk.white('  Paid: anthropic/claude-3.5-sonnet (best quality)'));
  console.log();
}

export function showModelInfo(modelId: string) {
  const model = OPENROUTER_MODELS.find(m => m.id === modelId);
  
  if (!model) {
    console.log(chalk.red(`\n❌ Model not found: ${modelId}\n`));
    console.log(chalk.yellow('Run "recoder-code --list-models" to see available models'));
    return;
  }
  
  console.log(chalk.bold.cyan(`\n🤖 ${model.name}\n`));
  console.log(chalk.white('ID:          ') + chalk.gray(model.id));
  console.log(chalk.white('Description: ') + chalk.gray(model.description));
  console.log(chalk.white('Context:     ') + chalk.gray(`${(model.contextLength / 1000).toFixed(0)}K tokens`));
  console.log(chalk.white('Pricing:     ') + (model.pricing === 'free' ? chalk.green('FREE') : chalk.yellow('PAID')));
  console.log(chalk.white('Category:    ') + chalk.gray(MODEL_CATEGORIES[model.category]));
  console.log();
}
