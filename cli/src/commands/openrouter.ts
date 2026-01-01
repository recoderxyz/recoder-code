/**
 * OpenRouter Explorer - Interactive tool for exploring OpenRouter models and endpoints
 */

import chalk from 'chalk';
import { getOpenRouterClient } from 'recoder-code-core';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  supported_parameters?: string[];
}

interface EndpointInfo {
  name: string;
  context_length: number;
  pricing: {
    request: string;
    image: string;
    prompt: string;
    completion: string;
  };
  provider_name: string;
  quantization: string | null;
  max_completion_tokens: number | null;
  max_prompt_tokens: number | null;
  supported_parameters: string[];
  status: string;
  uptime_last_30m: number | null;
}

/**
 * List all available models with optional filtering
 */
export async function exploreModels(options: {
  category?: string;
  feature?: 'tools' | 'vision' | 'streaming';
  showDetails?: boolean;
}) {
  try {
    console.log(chalk.bold.cyan('\n🔍 Exploring OpenRouter Models...\n'));
    
    const client = getOpenRouterClient();
    let models: ModelInfo[];
    
    if (options.feature) {
      console.log(chalk.yellow(`Filtering by feature: ${options.feature}\n`));
      models = await client.getModelsWithFeature(options.feature);
    } else {
      const filters = options.category ? { category: options.category } : undefined;
      models = await client.listModels(filters);
    }
    
    if (models.length === 0) {
      console.log(chalk.red('❌ No models found matching your criteria\n'));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${models.length} models\n`));
    
    // Group models by provider
    const modelsByProvider = models.reduce((acc, model) => {
      const provider = model.id.split('/')[0];
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    }, {} as Record<string, ModelInfo[]>);
    
    // Display models grouped by provider
    Object.entries(modelsByProvider).forEach(([provider, providerModels]) => {
      console.log(chalk.bold.yellow(`\n${provider.toUpperCase()} (${providerModels.length} models)`));
      console.log(chalk.gray('─'.repeat(70)));
      
      providerModels.forEach((model, idx) => {
        const contextSize = model.context_length 
          ? `${(model.context_length / 1000).toFixed(0)}K`
          : 'N/A';
        
        console.log(
          chalk.white(`${idx + 1}. `) +
          chalk.bold.cyan(model.name) +
          chalk.gray(` (${contextSize})`)
        );
        
        if (options.showDetails) {
          console.log(chalk.gray(`   ID: ${model.id}`));
          console.log(chalk.gray(`   ${model.description.substring(0, 100)}${model.description.length > 100 ? '...' : ''}`));
          
          if (model.pricing) {
            const promptPrice = parseFloat(model.pricing.prompt) * 1_000_000;
            const completionPrice = parseFloat(model.pricing.completion) * 1_000_000;
            
            if (promptPrice === 0 && completionPrice === 0) {
              console.log(chalk.green('   💰 FREE'));
            } else {
              console.log(chalk.yellow(`   💰 $${promptPrice.toFixed(2)}/M input, $${completionPrice.toFixed(2)}/M output`));
            }
          }
          
          if (model.supported_parameters && model.supported_parameters.length > 0) {
            const features = model.supported_parameters.slice(0, 5).join(', ');
            console.log(chalk.blue(`   ✨ ${features}${model.supported_parameters.length > 5 ? '...' : ''}`));
          }
          console.log();
        } else {
          console.log(chalk.gray(`   ${model.id}`));
        }
      });
    });
    
    console.log(chalk.cyan('\n💡 Tip: Use --show-details for more information'));
    console.log(chalk.cyan('💡 Tip: Use --endpoints MODEL_ID to see provider endpoints\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error exploring models:'), error);
    throw error;
  }
}

/**
 * List endpoints for a specific model
 */
export async function exploreModelEndpoints(modelId: string, options: { detailed?: boolean } = {}) {
  try {
    console.log(chalk.bold.cyan(`\n🔍 Exploring Endpoints for ${modelId}...\n`));
    
    const client = getOpenRouterClient();
    const endpointData = await client.listModelEndpoints(modelId);
    
    if (!endpointData || !endpointData.endpoints) {
      console.log(chalk.red('❌ No endpoints found for this model\n'));
      return;
    }
    
    // Display model information
    console.log(chalk.bold.yellow('Model Information:'));
    console.log(chalk.gray('─'.repeat(70)));
    console.log(chalk.white('Name:        ') + chalk.cyan(endpointData.name));
    console.log(chalk.white('ID:          ') + chalk.gray(endpointData.id));
    console.log(chalk.white('Description: ') + chalk.gray(endpointData.description.substring(0, 80)));
    
    if (endpointData.architecture) {
      console.log(chalk.white('Tokenizer:   ') + chalk.gray(endpointData.architecture.tokenizer || 'N/A'));
      console.log(chalk.white('Modalities:  ') + chalk.gray(
        `Input: ${endpointData.architecture.input_modalities.join(', ')}, ` +
        `Output: ${endpointData.architecture.output_modalities.join(', ')}`
      ));
    }
    
    // Display endpoints
    console.log(chalk.bold.yellow(`\n\nAvailable Endpoints (${endpointData.endpoints.length}):`));
    console.log(chalk.gray('─'.repeat(70)));
    
    endpointData.endpoints.forEach((endpoint: EndpointInfo, idx: number) => {
      const uptime = endpoint.uptime_last_30m !== null 
        ? `${(endpoint.uptime_last_30m * 100).toFixed(1)}%`
        : 'N/A';
      
      const statusColor = endpoint.status === 'online' ? chalk.green : chalk.red;
      
      console.log(
        chalk.white(`\n${idx + 1}. `) +
        chalk.bold.cyan(endpoint.provider_name) +
        ' ' + statusColor(`[${endpoint.status.toUpperCase()}]`) +
        chalk.gray(` - Uptime: ${uptime}`)
      );
      
      console.log(chalk.gray(`   Context: ${(endpoint.context_length / 1000).toFixed(0)}K tokens`));
      
      if (endpoint.max_completion_tokens) {
        console.log(chalk.gray(`   Max Output: ${(endpoint.max_completion_tokens / 1000).toFixed(0)}K tokens`));
      }
      
      if (endpoint.quantization) {
        console.log(chalk.gray(`   Quantization: ${endpoint.quantization}`));
      }
      
      // Pricing information
      const promptPrice = parseFloat(endpoint.pricing.prompt) * 1_000_000;
      const completionPrice = parseFloat(endpoint.pricing.completion) * 1_000_000;
      
      if (promptPrice === 0 && completionPrice === 0) {
        console.log(chalk.green('   💰 FREE'));
      } else {
        console.log(chalk.yellow(
          `   💰 $${promptPrice.toFixed(3)}/M input, $${completionPrice.toFixed(3)}/M output`
        ));
        
        if (endpoint.pricing.image && parseFloat(endpoint.pricing.image) > 0) {
          const imagePrice = parseFloat(endpoint.pricing.image);
          console.log(chalk.yellow(`   🖼️  $${imagePrice.toFixed(3)}/image`));
        }
      }
      
      // Supported parameters
      if (options.detailed && endpoint.supported_parameters.length > 0) {
        console.log(chalk.blue(`   ✨ Features: ${endpoint.supported_parameters.join(', ')}`));
      }
    });
    
    // Summary and recommendations
    console.log(chalk.bold.yellow('\n\n📊 Summary:'));
    console.log(chalk.gray('─'.repeat(70)));
    
    const onlineEndpoints = endpointData.endpoints.filter((e: EndpointInfo) => e.status === 'online');
    const freeEndpoints = endpointData.endpoints.filter(
      (e: EndpointInfo) => parseFloat(e.pricing.prompt) === 0 && parseFloat(e.pricing.completion) === 0
    );
    
    console.log(chalk.white(`Online Endpoints: `) + chalk.green(`${onlineEndpoints.length}/${endpointData.endpoints.length}`));
    console.log(chalk.white(`Free Endpoints:   `) + chalk.green(freeEndpoints.length.toString()));
    
    if (freeEndpoints.length > 0) {
      console.log(chalk.green('\n✅ Free endpoints available!'));
    }
    
    // Best endpoint recommendation
    const bestEndpoint = onlineEndpoints.sort((a: EndpointInfo, b: EndpointInfo) => {
      const uptimeA = a.uptime_last_30m || 0;
      const uptimeB = b.uptime_last_30m || 0;
      return uptimeB - uptimeA;
    })[0];
    
    if (bestEndpoint) {
      console.log(chalk.cyan(`\n💡 Recommended: ${bestEndpoint.provider_name} (${((bestEndpoint.uptime_last_30m || 0) * 100).toFixed(1)}% uptime)`));
    }
    
    console.log();
    
  } catch (error) {
    console.error(chalk.red('❌ Error exploring endpoints:'), error);
    throw error;
  }
}

/**
 * Compare pricing across different endpoints
 */
export async function comparePricing(modelIds: string[]) {
  try {
    console.log(chalk.bold.cyan('\n💰 Comparing Model Pricing...\n'));
    
    const client = getOpenRouterClient();
    const modelsData: ModelInfo[] = [];
    
    for (const modelId of modelIds) {
      try {
        const endpoints = await client.listModelEndpoints(modelId);
        if (endpoints) {
          modelsData.push({
            id: endpoints.id,
            name: endpoints.name,
            description: endpoints.description,
            context_length: endpoints.endpoints[0]?.context_length || 0,
            pricing: endpoints.endpoints[0]?.pricing || { prompt: '0', completion: '0' },
          });
        }
      } catch (err) {
        console.error(chalk.yellow(`⚠️  Could not fetch data for ${modelId}`));
      }
    }
    
    if (modelsData.length === 0) {
      console.log(chalk.red('❌ No valid models to compare\n'));
      return;
    }
    
    console.log(chalk.gray('─'.repeat(70)));
    console.log(
      chalk.bold.white('Model').padEnd(40) +
      chalk.bold.white('Input ($/M)').padEnd(15) +
      chalk.bold.white('Output ($/M)')
    );
    console.log(chalk.gray('─'.repeat(70)));
    
    modelsData.forEach(model => {
      const promptPrice = (parseFloat(model.pricing.prompt) * 1_000_000).toFixed(3);
      const completionPrice = (parseFloat(model.pricing.completion) * 1_000_000).toFixed(3);
      
      const priceColor = parseFloat(promptPrice) === 0 ? chalk.green : chalk.yellow;
      
      console.log(
        chalk.cyan(model.name.substring(0, 38).padEnd(40)) +
        priceColor(promptPrice.padEnd(15)) +
        priceColor(completionPrice)
      );
    });
    
    console.log(chalk.gray('─'.repeat(70)) + '\n');
    
  } catch (error) {
    console.error(chalk.red('❌ Error comparing pricing:'), error);
    throw error;
  }
}

/**
 * Show models that support tool calling
 */
export async function showToolCallingModels() {
  console.log(chalk.bold.cyan('\n🛠️  Models with Tool/Function Calling Support\n'));
  
  await exploreModels({ 
    feature: 'tools',
    showDetails: true 
  });
  
  console.log(chalk.cyan('\n📚 Learn more about tool calling:'));
  console.log(chalk.white('   https://openrouter.ai/docs/features/tool-calling\n'));
}

/**
 * Show quick reference for OpenRouter features
 */
export function showQuickReference() {
  console.log(chalk.bold.cyan('\n📖 OpenRouter Quick Reference\n'));
  
  console.log(chalk.yellow('Available Commands:'));
  console.log(chalk.gray('─'.repeat(70)));
  console.log(chalk.white('  recoder-code openrouter list') + chalk.gray('           - List all models'));
  console.log(chalk.white('  recoder-code openrouter list --category CODE') + chalk.gray(' - Filter by category'));
  console.log(chalk.white('  recoder-code openrouter tools') + chalk.gray('           - Show tool-capable models'));
  console.log(chalk.white('  recoder-code openrouter endpoints MODEL_ID') + chalk.gray(' - View model endpoints'));
  console.log(chalk.white('  recoder-code openrouter compare MODEL1 MODEL2') + chalk.gray(' - Compare pricing'));
  
  console.log(chalk.yellow('\n\nCommon Use Cases:'));
  console.log(chalk.gray('─'.repeat(70)));
  console.log(chalk.white('  Free coding assistant:'));
  console.log(chalk.cyan('    recoder-code --model deepseek/deepseek-chat-v3.1:free'));
  
  console.log(chalk.white('\n  Tool calling with Claude:'));
  console.log(chalk.cyan('    recoder-code --model anthropic/claude-3.5-sonnet --tools'));
  
  console.log(chalk.white('\n  Vision models:'));
  console.log(chalk.cyan('    recoder-code openrouter list --feature vision'));
  
  console.log(chalk.yellow('\n\nEnvironment Variables:'));
  console.log(chalk.gray('─'.repeat(70)));
  console.log(chalk.white('  OPENROUTER_API_KEY') + chalk.gray('   - Your OpenRouter API key'));
  console.log(chalk.white('  OPENROUTER_MODEL') + chalk.gray('      - Default model to use'));
  
  console.log(chalk.cyan('\n🔗 More info: https://openrouter.ai/docs\n'));
}
