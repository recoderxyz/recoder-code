/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

/**
 * OpenRouter model information from API
 */
interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
  };
}

/**
 * OpenRouter generation metadata
 */
interface GenerationMetadata {
  id: string;
  model: string;
  streamed: boolean;
  generation_time: number;
  created_at: string;
  tokens_prompt: number;
  tokens_completion: number;
  native_tokens_prompt?: number;
  native_tokens_completion?: number;
  num_media_generations?: number;
  origin?: string;
  total_cost: number;
}

/**
 * Fetch models from OpenRouter API
 */
async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    return [];
  }
}

/**
 * Fetch generation metadata from OpenRouter API
 */
async function fetchGenerationMetadata(generationId: string): Promise<GenerationMetadata | null> {
  try {
    const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('API key not found');
    }

    const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch generation metadata:', error);
    return null;
  }
}

/**
 * Format price for display
 */
function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (num === 0) return 'Free';
  if (num < 0.000001) return '<$0.01/M';
  if (num < 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(2)}`;
}

/**
 * Format context length
 */
function formatContext(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

export const openrouterCommand: SlashCommand = {
  name: 'openrouter',
  description: 'OpenRouter model exploration and configuration',
  kind: CommandKind.BUILT_IN,
  // Default action: show setup instructions
  action: async (): Promise<MessageActionReturn> => {
    const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
    const model = process.env['OPENAI_MODEL'];
    const baseUrl = process.env['OPENAI_BASE_URL'];

    let status = '🔧 OpenRouter Setup\n\n';

    status += '1. API Key: ';
    if (apiKey) {
      status += '✅ Configured\n';
    } else {
      status += '❌ Not set\n   Set with: export OPENROUTER_API_KEY=<your-key>\n';
    }

    status += '2. Base URL: ';
    if (baseUrl?.includes('openrouter')) {
      status += '✅ Configured\n';
    } else {
      status += '❌ Not set to OpenRouter\n   Set with: export OPENAI_BASE_URL=https://openrouter.ai/api/v1\n';
    }

    status += '3. Model: ';
    if (model) {
      status += `✅ ${model}\n`;
    } else {
      status += '❌ Not set\n   Set with: export OPENAI_MODEL=<model-id>\n';
    }

    status += '\n📋 Available Commands:\n';
    status += '  /openrouter free       - List all free models\n';
    status += '  /openrouter premium    - List premium models\n';
    status += '  /openrouter search     - Search for models\n';
    status += '  /openrouter info       - Get model details\n';
    status += '  /openrouter generation - Get request metadata\n';
    status += '  /openrouter credits    - Check remaining credits\n';
    status += '  /openrouter activity   - View recent API usage\n';
    status += '  /openrouter estimate   - Estimate cost before sending\n';
    status += '  /openrouter cache      - Check prompt caching status\n';
    status += '  /openrouter transforms - Check message transforms status\n';
    status += '  /openrouter setup      - Show this help\n\n';
    status += '💰 Cost Optimization:\n';
    status += '  • Prompt caching: 90% off on cached tokens (Claude models)\n';
    status += '  • Middle-out compression: Automatic context optimization\n';
    status += '  • Model fallbacks: Automatic failover for reliability\n\n';
    status += '🔑 Get API key: https://openrouter.ai/keys\n';
    status += '📚 Full docs: https://openrouter.ai/docs';

    return {
      type: 'message',
      messageType: 'info',
      content: status,
    };
  },
  subCommands: [
    {
      name: 'list',
      description: 'List all available OpenRouter models (live data)',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const models = await fetchOpenRouterModels();
        
        if (models.length === 0) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Failed to fetch models from OpenRouter API.\n\n' +
              'Please check your internet connection or try again later.\n' +
              'Alternatively, use /browse-models for offline browsing.',
          };
        }

        // Get free models
        const freeModels = models.filter(m => 
          m.id.includes(':free') || parseFloat(m.pricing.prompt) === 0
        );

        let content = `🌐 Live OpenRouter Models (${models.length} total)\n\n`;
        content += `🆓 Free Models: ${freeModels.length}\n`;
        content += `💎 Premium Models: ${models.length - freeModels.length}\n\n`;
        content += `💡 Use /openrouter info <model-id> for details\n`;
        content += `📋 Use /browse-models to search and add models\n`;
        content += `🔍 Visit https://openrouter.ai/models for full catalog`;

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'info',
      description: 'Get detailed information about a specific model',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const modelId = context.invocation?.args?.trim();
        
        if (!modelId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please specify a model ID.\n\n' +
              'Usage: /openrouter info <model-id>\n' +
              'Example: /openrouter info anthropic/claude-3.5-sonnet',
          };
        }

        const models = await fetchOpenRouterModels();
        const model = models.find(m => m.id === modelId || m.id.includes(modelId));

        if (!model) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Model not found: ${modelId}\n\n` +
              'Use /openrouter list to see all available models\n' +
              'Or use /browse-models search <query> to find models',
          };
        }

        let content = `📊 ${model.name}\n\n`;
        content += `**Model ID:** ${model.id}\n`;
        content += `**Context Length:** ${formatContext(model.context_length)}\n`;
        
        // Pricing
        const promptPrice = formatPrice(model.pricing.prompt);
        const completionPrice = formatPrice(model.pricing.completion);
        content += `**Pricing:**\n`;
        content += `  • Prompt: ${promptPrice}\n`;
        content += `  • Completion: ${completionPrice}\n`;
        
        if (model.pricing.image) {
          content += `  • Image: ${formatPrice(model.pricing.image)}\n`;
        }

        // Modality
        if (model.architecture?.modality) {
          content += `**Modality:** ${model.architecture.modality}\n`;
        }

        // Top provider info
        if (model.top_provider) {
          if (model.top_provider.context_length) {
            content += `**Max Context:** ${formatContext(model.top_provider.context_length)}\n`;
          }
          if (model.top_provider.max_completion_tokens) {
            content += `**Max Completion:** ${formatContext(model.top_provider.max_completion_tokens)}\n`;
          }
        }

        // Description
        if (model.description) {
          content += `\n**Description:**\n${model.description}\n`;
        }

        // Add command
        content += `\n**To add this model:**\n`;
        content += `/add-model ${model.id} "${model.name}"\n`;
        content += `\n**Or set as default:**\n`;
        content += `export OPENAI_MODEL="${model.id}"`;

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'free',
      description: 'List all free models with live pricing data',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const models = await fetchOpenRouterModels();
        
        if (models.length === 0) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Failed to fetch models. Use /browse-models free for offline list.',
          };
        }

        const freeModels = models.filter(m => 
          m.id.includes(':free') || parseFloat(m.pricing.prompt) === 0
        ).sort((a, b) => b.context_length - a.context_length);

        let content = `🆓 Free OpenRouter Models (${freeModels.length})\n\n`;

        freeModels.slice(0, 20).forEach(model => {
          content += `• **${model.name}**\n`;
          content += `  ${model.id}\n`;
          content += `  ${formatContext(model.context_length)} context`;
          if (model.architecture?.modality && model.architecture.modality !== 'text') {
            content += ` • ${model.architecture.modality}`;
          }
          content += `\n  /add-model ${model.id}\n\n`;
        });

        if (freeModels.length > 20) {
          content += `... and ${freeModels.length - 20} more\n\n`;
        }

        content += `💡 Use /openrouter info <model-id> for details`;

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'premium',
      description: 'List popular premium models with pricing',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const models = await fetchOpenRouterModels();
        
        if (models.length === 0) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Failed to fetch models. Use /browse-models premium for offline list.',
          };
        }

        // Get premium models sorted by popularity (rough heuristic)
        const premiumModels = models
          .filter(m => !m.id.includes(':free') && parseFloat(m.pricing.prompt) > 0)
          .filter(m => 
            m.id.includes('claude') || 
            m.id.includes('gpt') || 
            m.id.includes('gemini') ||
            m.id.includes('o1')
          )
          .sort((a, b) => {
            // Sort by provider popularity
            const order = ['anthropic', 'openai', 'google'];
            const aProvider = a.id.split('/')[0];
            const bProvider = b.id.split('/')[0];
            return (order.indexOf(aProvider) || 999) - (order.indexOf(bProvider) || 999);
          });

        let content = `💎 Premium OpenRouter Models\n\n`;

        premiumModels.slice(0, 15).forEach(model => {
          const promptPrice = formatPrice(model.pricing.prompt);
          const completionPrice = formatPrice(model.pricing.completion);
          
          content += `• **${model.name}**\n`;
          content += `  ${model.id}\n`;
          content += `  ${formatContext(model.context_length)} context • ${promptPrice} prompt / ${completionPrice} completion\n`;
          content += `  /add-model ${model.id}\n\n`;
        });

        content += `💡 Use /openrouter info <model-id> for full details\n`;
        content += `⚡ Claude models support prompt caching (90% off cached tokens)`;

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'search',
      description: 'Search for models by name or provider',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const query = context.invocation?.args?.trim().toLowerCase();
        
        if (!query) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please provide a search query.\n\n' +
              'Usage: /openrouter search <query>\n' +
              'Examples:\n' +
              '  /openrouter search claude\n' +
              '  /openrouter search gpt-4\n' +
              '  /openrouter search qwen',
          };
        }

        const models = await fetchOpenRouterModels();
        
        if (models.length === 0) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Failed to fetch models. Use /browse-models search for offline search.',
          };
        }

        const matches = models.filter(m =>
          m.id.toLowerCase().includes(query) ||
          m.name.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
          return {
            type: 'message',
            messageType: 'info',
            content: `No models found matching "${query}"\n\n` +
              'Try searching for:\n' +
              '  • Provider: claude, gpt, gemini, llama\n' +
              '  • Feature: free, vision, code\n' +
              '  • Model name: opus, sonnet, turbo',
          };
        }

        let content = `🔍 Found ${matches.length} model(s) matching "${query}"\n\n`;

        matches.slice(0, 10).forEach(model => {
          const isFree = model.id.includes(':free') || parseFloat(model.pricing.prompt) === 0;
          const badge = isFree ? '🆓' : '💎';
          const price = isFree ? 'Free' : formatPrice(model.pricing.prompt);
          
          content += `${badge} **${model.name}**\n`;
          content += `  ${model.id}\n`;
          content += `  ${formatContext(model.context_length)} • ${price}\n`;
          content += `  /add-model ${model.id}\n\n`;
        });

        if (matches.length > 10) {
          content += `... and ${matches.length - 10} more matches\n\n`;
        }

        content += `💡 Use /openrouter info <model-id> for details`;

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'generation',
      description: 'Get detailed metadata for a specific generation/request',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const generationId = context.invocation?.args?.trim();
        
        if (!generationId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Please provide a generation ID.\n\n' +
              'Usage: /openrouter generation <generation-id>\n' +
              'Example: /openrouter generation gen-abc123xyz\n\n' +
              'Generation IDs are returned in API responses and can be used to:\n' +
              '  • Track request costs\n' +
              '  • Debug issues\n' +
              '  • Analyze performance\n' +
              '  • View token usage',
          };
        }

        const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
        if (!apiKey) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'OpenRouter API key not found.\n\n' +
              'Set your API key:\n' +
              '  export OPENROUTER_API_KEY=<your-key>\n' +
              '  Or: export OPENAI_API_KEY=<your-key>\n\n' +
              'Get your API key: https://openrouter.ai/keys',
          };
        }

        const metadata = await fetchGenerationMetadata(generationId);

        if (!metadata) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Generation not found: ${generationId}\n\n` +
              'Possible reasons:\n' +
              '  • Invalid generation ID\n' +
              '  • Generation is too old (data retention limits)\n' +
              '  • Wrong API key\n\n' +
              'Generation IDs start with "gen-" followed by random characters.',
          };
        }

        // Format the metadata for display
        let content = `📊 Generation Metadata\n\n`;
        content += `**Generation ID:** ${metadata.id}\n`;
        content += `**Model:** ${metadata.model}\n`;
        content += `**Created:** ${formatDate(metadata.created_at)}\n`;
        content += `**Streaming:** ${metadata.streamed ? 'Yes' : 'No'}\n`;
        content += `**Generation Time:** ${metadata.generation_time.toFixed(2)}s\n\n`;

        // Token usage
        content += `**Token Usage:**\n`;
        content += `  • Prompt: ${metadata.tokens_prompt.toLocaleString()} tokens\n`;
        content += `  • Completion: ${metadata.tokens_completion.toLocaleString()} tokens\n`;
        content += `  • Total: ${(metadata.tokens_prompt + metadata.tokens_completion).toLocaleString()} tokens\n`;

        // Native tokens (if different)
        if (metadata.native_tokens_prompt && metadata.native_tokens_prompt !== metadata.tokens_prompt) {
          content += `\n**Native Token Count:**\n`;
          content += `  • Prompt: ${metadata.native_tokens_prompt.toLocaleString()} tokens\n`;
          if (metadata.native_tokens_completion) {
            content += `  • Completion: ${metadata.native_tokens_completion.toLocaleString()} tokens\n`;
          }
        }

        // Media generations
        if (metadata.num_media_generations) {
          content += `\n**Media Generations:** ${metadata.num_media_generations}\n`;
        }

        // Cost
        content += `\n**Cost:** ${formatPrice(metadata.total_cost)}\n`;

        // Origin
        if (metadata.origin) {
          content += `**Origin:** ${metadata.origin}\n`;
        }

        // Cost breakdown estimate
        const costPerPromptToken = metadata.total_cost / (metadata.tokens_prompt + metadata.tokens_completion) * metadata.tokens_prompt;
        const costPerCompletionToken = metadata.total_cost - costPerPromptToken;
        content += `\n**Cost Breakdown:**\n`;
        content += `  • Prompt: ${formatPrice(costPerPromptToken)} (${metadata.tokens_prompt.toLocaleString()} tokens)\n`;
        content += `  • Completion: ${formatPrice(costPerCompletionToken)} (${metadata.tokens_completion.toLocaleString()} tokens)\n`;

        // Performance metrics
        const tokensPerSecond = (metadata.tokens_prompt + metadata.tokens_completion) / metadata.generation_time;
        content += `\n**Performance:**\n`;
        content += `  • Speed: ${tokensPerSecond.toFixed(1)} tokens/second\n`;
        content += `  • Latency: ${metadata.generation_time.toFixed(2)}s\n`;

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'setup',
      description: 'Show OpenRouter setup instructions',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
        const model = process.env['OPENAI_MODEL'];
        const baseUrl = process.env['OPENAI_BASE_URL'];
        
        let status = '🔧 OpenRouter Setup\n\n';
        
        status += '1. API Key: ';
        if (apiKey) {
          status += '✅ Configured\n';
        } else {
          status += '❌ Not set\n   Set with: export OPENROUTER_API_KEY=<your-key>\n';
        }
        
        status += '2. Base URL: ';
        if (baseUrl?.includes('openrouter')) {
          status += '✅ Configured\n';
        } else {
          status += '❌ Not set to OpenRouter\n   Set with: export OPENAI_BASE_URL=https://openrouter.ai/api/v1\n';
        }
        
        status += '3. Model: ';
        if (model) {
          status += `✅ ${model}\n`;
        } else {
          status += '❌ Not set\n   Set with: export OPENAI_MODEL=<model-id>\n';
        }
        
        status += '\n🚀 Quick Start (100% Free with Tool Calling):\n';
        status += '  export OPENROUTER_API_KEY=<your-key>\n';
        status += '  export OPENAI_BASE_URL=https://openrouter.ai/api/v1\n';
        status += '  export OPENAI_MODEL=qwen/qwen3-coder:free\n\n';
        status += '📋 Commands:\n';
        status += '  /openrouter free       - List all free models\n';
        status += '  /openrouter premium    - List premium models\n';
        status += '  /openrouter search     - Search for models\n';
        status += '  /openrouter info       - Get model details\n';
        status += '  /openrouter generation - Get request metadata\n';
        status += '  /openrouter credits    - Check remaining credits\n';
        status += '  /openrouter activity   - View recent API usage\n';
        status += '  /openrouter estimate   - Estimate cost before sending\n';
        status += '  /openrouter cache      - Check prompt caching status\n';
        status += '  /openrouter transforms - Check message transforms status\n\n';
        status += '💰 Cost Optimization Features:\n';
        status += '  • Prompt caching (90% discount on Claude models)\n';
        status += '  • Middle-out compression (automatic)\n';
        status += '  • Model fallbacks (reliability)\n\n';
        status += '🔑 Get API key: https://openrouter.ai/keys\n';
        status += '📚 Full docs: https://openrouter.ai/docs';
        
        return {
          type: 'message',
          messageType: 'info',
          content: status,
        };
      },
    },
    {
      name: 'credits',
      description: 'Check remaining credits and rate limits',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
        if (!apiKey) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'OpenRouter API key not found.\n\n' +
              'Set your API key:\n' +
              '  export OPENROUTER_API_KEY=<your-key>\n' +
              '  Or: export OPENAI_API_KEY=<your-key>\n\n' +
              'Get your API key: https://openrouter.ai/keys',
          };
        }

        try {
          const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          const keyData = data.data;

          let content = '💳 OpenRouter Credits\n\n';
          
          // Account tier
          if (keyData.is_free_tier) {
            content += '**Tier:** 🆓 Free\n';
          } else {
            content += '**Tier:** 💎 Paid\n';
          }

          // Credits
          if (keyData.limit !== null && keyData.limit !== undefined) {
            const limit = parseFloat(keyData.limit);
            const usage = parseFloat(keyData.usage || 0);
            const remaining = limit - usage;
            const percentUsed = limit > 0 ? ((usage / limit) * 100).toFixed(1) : 0;

            content += `**Total Limit:** ${formatPrice(limit)}\n`;
            content += `**Used:** ${formatPrice(usage)} (${percentUsed}%)\n`;
            content += `**Remaining:** ${formatPrice(remaining)}\n\n`;

            // Warning if running low
            if (remaining < 1 && !keyData.is_free_tier) {
              content += '⚠️ Low balance! Consider adding credits.\n\n';
            }
          } else {
            content += '**Credits:** Unlimited or pay-as-you-go\n\n';
          }

          // Rate limits
          if (keyData.rate_limit) {
            content += '**Rate Limit:**\n';
            content += `  • ${keyData.rate_limit.requests} requests per ${keyData.rate_limit.interval}\n\n`;
          }

          // Label
          if (keyData.label) {
            content += `**Label:** ${keyData.label}\n\n`;
          }

          // Key info
          if (keyData.key_name) {
            content += `**Key Name:** ${keyData.key_name}\n`;
          }

          content += '\n💡 Tips:\n';
          if (keyData.is_free_tier) {
            content += '  • Free tier models have no cost\n';
            content += '  • Premium models use credits\n';
            content += '  • Use /openrouter free to see free models\n';
          } else {
            content += '  • Use prompt caching with Claude models (90% off)\n';
            content += '  • Enable middle-out compression for long contexts\n';
            content += '  • Use /openrouter activity to track spending\n';
          }

          content += '\n🔑 Manage credits: https://openrouter.ai/credits';

          return {
            type: 'message',
            messageType: 'info',
            content,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Failed to fetch credits information.\n\n' +
              'Possible reasons:\n' +
              '  • Invalid API key\n' +
              '  • Network error\n' +
              '  • API temporarily unavailable\n\n' +
              `Error: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'activity',
      description: 'View recent API usage and costs',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
        if (!apiKey) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'OpenRouter API key not found.\n\n' +
              'Set your API key:\n' +
              '  export OPENROUTER_API_KEY=<your-key>\n' +
              '  Or: export OPENAI_API_KEY=<your-key>\n\n' +
              'Get your API key: https://openrouter.ai/keys',
          };
        }

        try {
          const args = context.invocation?.args?.trim() || '';
          const limit = parseInt(args) || 10;

          const response = await fetch(`https://openrouter.ai/api/v1/activity?limit=${limit}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          const activities = data.data || [];

          if (activities.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: '📊 No recent activity found.\n\n' +
                'Start using the API to see activity here.\n' +
                'Activity includes:\n' +
                '  • Token usage\n' +
                '  • Costs per request\n' +
                '  • Model performance\n' +
                '  • Request status',
            };
          }

          let content = `📊 Recent Activity (${activities.length} requests)\n\n`;

          let totalCost = 0;
          let totalTokens = 0;

          activities.forEach((activity: any, index: number) => {
            const cost = parseFloat(activity.total_cost || 0);
            const tokens = (activity.input_tokens || 0) + (activity.output_tokens || 0);
            totalCost += cost;
            totalTokens += tokens;

            content += `**${index + 1}. ${activity.model}**\n`;
            content += `  Time: ${formatDate(activity.created_at)}\n`;
            content += `  Tokens: ${(activity.input_tokens || 0).toLocaleString()} in / ${(activity.output_tokens || 0).toLocaleString()} out\n`;
            content += `  Cost: ${formatPrice(cost)}\n`;
            content += `  Status: ${activity.status || 'unknown'}\n`;
            if (activity.latency_ms) {
              content += `  Latency: ${activity.latency_ms}ms\n`;
            }
            if (activity.id) {
              content += `  /openrouter generation ${activity.id}\n`;
            }
            content += '\n';
          });

          // Summary
          content += '**Summary:**\n';
          content += `  • Total Cost: ${formatPrice(totalCost)}\n`;
          content += `  • Total Tokens: ${totalTokens.toLocaleString()}\n`;
          content += `  • Avg Cost/Request: ${formatPrice(totalCost / activities.length)}\n`;

          if (limit === 10) {
            content += '\n💡 Use `/openrouter activity <number>` to see more (e.g., `/openrouter activity 25`)';
          }

          return {
            type: 'message',
            messageType: 'info',
            content,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Failed to fetch activity.\n\n' +
              'Possible reasons:\n' +
              '  • Invalid API key\n' +
              '  • Network error\n' +
              '  • API temporarily unavailable\n\n' +
              `Error: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'estimate',
      description: 'Estimate cost for a request before sending it',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim() || '';
        const parts = args.split(/\s+/);
        
        // Parse arguments: model inputTokens outputTokens
        if (parts.length < 3) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Estimate cost for a request before sending.\n\n' +
              'Usage: /openrouter estimate <model> <input-tokens> <output-tokens>\n\n' +
              'Examples:\n' +
              '  /openrouter estimate anthropic/claude-3.5-sonnet 1000 500\n' +
              '  /openrouter estimate openai/gpt-4o 2000 1000\n' +
              '  /openrouter estimate deepseek/deepseek-chat-v3.1:free 5000 2000\n\n' +
              '💡 Check actual costs with /openrouter activity',
          };
        }

        const [modelId, inputTokensStr, outputTokensStr] = parts;
        const inputTokens = parseInt(inputTokensStr);
        const outputTokens = parseInt(outputTokensStr);

        if (isNaN(inputTokens) || isNaN(outputTokens)) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Invalid token counts. Please provide numbers.\n\n' +
              'Usage: /openrouter estimate <model> <input-tokens> <output-tokens>\n' +
              'Example: /openrouter estimate anthropic/claude-3.5-sonnet 1000 500',
          };
        }

        // Fetch model pricing
        const models = await fetchOpenRouterModels();
        const model = models.find(m => m.id === modelId || m.id.includes(modelId));

        if (!model) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Model not found: ${modelId}\n\n` +
              'Use /openrouter search <query> to find models\n' +
              'Example: /openrouter search claude',
          };
        }

        // Calculate costs
        const promptPrice = parseFloat(model.pricing.prompt);
        const completionPrice = parseFloat(model.pricing.completion);
        
        // Prices are per million tokens
        const inputCost = (inputTokens / 1_000_000) * promptPrice;
        const outputCost = (outputTokens / 1_000_000) * completionPrice;
        const totalCost = inputCost + outputCost;

        // Calculate with prompt caching (if Claude model)
        let cachedContent = '';
        if (model.id.includes('claude') && model.id.includes('anthropic')) {
          // Assume 70% of prompt can be cached (system message + early context)
          const cacheableTokens = Math.floor(inputTokens * 0.7);
          const normalTokens = inputTokens - cacheableTokens;
          
          // Cache writes cost same as normal, cache reads cost 10% (90% discount)
          const cacheWriteCost = (cacheableTokens / 1_000_000) * promptPrice;
          const cacheReadCost = (cacheableTokens / 1_000_000) * promptPrice * 0.1;
          const normalCost = (normalTokens / 1_000_000) * promptPrice;
          
          // First request: cache write + normal tokens
          const firstRequestCost = cacheWriteCost + normalCost + outputCost;
          
          // Subsequent requests: cache read + normal tokens (reuse cache)
          const cachedRequestCost = cacheReadCost + normalCost + outputCost;
          
          // Savings on subsequent requests
          const savings = totalCost - cachedRequestCost;
          const savingsPercent = ((savings / totalCost) * 100).toFixed(0);
          
          cachedContent = '\n\n**With Prompt Caching (Claude models):**\n';
          cachedContent += `  • First request: ${formatPrice(firstRequestCost)}\n`;
          cachedContent += `  • Cached requests: ${formatPrice(cachedRequestCost)}\n`;
          cachedContent += `  • Savings: ${formatPrice(savings)} (${savingsPercent}% off)\n`;
          cachedContent += `  • Cached tokens: ${cacheableTokens.toLocaleString()} (70% of input)\n\n`;
          cachedContent += '⚡ Prompt caching is automatically enabled for Claude models!\n';
          cachedContent += '   System messages, early context, and tools are cached.';
        }

        let content = `💰 Cost Estimate: ${model.name}\n\n`;
        content += `**Model:** ${model.id}\n`;
        content += `**Context:** ${formatContext(model.context_length)}\n\n`;
        
        content += '**Request Details:**\n';
        content += `  • Input tokens: ${inputTokens.toLocaleString()}\n`;
        content += `  • Output tokens: ${outputTokens.toLocaleString()}\n`;
        content += `  • Total tokens: ${(inputTokens + outputTokens).toLocaleString()}\n\n`;
        
        content += '**Pricing:**\n';
        content += `  • Input: ${formatPrice(promptPrice)}/1M tokens\n`;
        content += `  • Output: ${formatPrice(completionPrice)}/1M tokens\n\n`;
        
        content += '**Estimated Cost:**\n';
        content += `  • Input cost: ${formatPrice(inputCost)}\n`;
        content += `  • Output cost: ${formatPrice(outputCost)}\n`;
        content += `  • Total: ${formatPrice(totalCost)}\n`;
        
        content += cachedContent;
        
        content += '\n\n💡 Tips to reduce costs:\n';
        if (!model.id.includes(':free')) {
          content += '  • Use free models for testing: /openrouter free\n';
        }
        content += '  • Enable middle-out compression (automatic)\n';
        if (model.id.includes('claude')) {
          content += '  • Prompt caching saves 90% on cached tokens\n';
        }
        content += '  • Reduce output token limits when possible\n';
        content += '  • Use /openrouter activity to track actual costs';

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'cache',
      description: 'Show prompt caching status and configuration',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const model = process.env['OPENAI_MODEL'] || 'Not set';
        const baseURL = process.env['OPENAI_BASE_URL'] || 'Not set';
        const isOpenRouter = baseURL.includes('openrouter');
        const isClaude = model.toLowerCase().includes('claude') && model.toLowerCase().includes('anthropic');
        
        let content = '⚡ Prompt Caching Status\n\n';
        
        content += '**Current Configuration:**\n';
        content += `  • Model: ${model}\n`;
        content += `  • Base URL: ${isOpenRouter ? '✅ OpenRouter' : '❌ Not OpenRouter'}\n`;
        content += `  • Caching: ${isClaude && isOpenRouter ? '✅ Enabled' : '❌ Not available'}\n\n`;
        
        if (isClaude && isOpenRouter) {
          content += '**Caching is Active!** 🎉\n\n';
          content += 'Your requests are using prompt caching with:\n';
          content += '  • 90% discount on cached tokens\n';
          content += '  • System messages cached\n';
          content += '  • Early conversation context cached\n';
          content += '  • Tool definitions cached\n\n';
          
          content += '**How it works:**\n';
          content += '1. First request: Normal cost + cache write\n';
          content += '2. Subsequent requests: 90% off on cached parts\n';
          content += '3. Cache valid for 5 minutes\n';
          content += '4. Automatic revalidation\n\n';
          
          content += '**What gets cached:**\n';
          content += '  • System prompt (highest priority)\n';
          content += '  • First 3 conversation turns\n';
          content += '  • All tool definitions\n\n';
          
          content += '💡 Use /openrouter estimate to see potential savings\n';
          content += '📊 Use /openrouter activity to see actual costs';
        } else if (!isOpenRouter) {
          content += '**Caching Not Available**\n\n';
          content += 'Prompt caching requires OpenRouter.\n\n';
          content += 'To enable:\n';
          content += '1. Set OpenRouter base URL:\n';
          content += '   export OPENAI_BASE_URL=https://openrouter.ai/api/v1\n';
          content += '2. Use a Claude model:\n';
          content += '   export OPENAI_MODEL=anthropic/claude-3.5-sonnet\n';
          content += '3. Restart your session\n\n';
          content += '🔑 Get API key: https://openrouter.ai/keys';
        } else if (!isClaude) {
          content += '**Caching Not Available for This Model**\n\n';
          content += 'Prompt caching is only available for Anthropic Claude models.\n\n';
          content += 'Supported models:\n';
          content += '  • anthropic/claude-3.5-sonnet\n';
          content += '  • anthropic/claude-3-opus\n';
          content += '  • anthropic/claude-3-haiku\n\n';
          content += 'Switch model:\n';
          content += '  export OPENAI_MODEL=anthropic/claude-3.5-sonnet\n\n';
          content += '💰 Save up to 90% on repeated contexts!';
        } else {
          content += '**Configuration Issue**\n\n';
          content += 'Please check your configuration:\n';
          content += `  • Model: ${model}\n`;
          content += `  • Base URL: ${baseURL}\n\n`;
          content += 'Expected:\n';
          content += '  • OpenRouter base URL\n';
          content += '  • Anthropic Claude model';
        }

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'transforms',
      description: 'Show message transform status (middle-out compression)',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const model = process.env['OPENAI_MODEL'] || 'Not set';
        const baseURL = process.env['OPENAI_BASE_URL'] || 'Not set';
        const isOpenRouter = baseURL.includes('openrouter');
        const transformsEnv = process.env['OPENROUTER_TRANSFORMS'];
        
        let content = '🔄 Message Transforms Status\n\n';
        
        content += '**Current Configuration:**\n';
        content += `  • Model: ${model}\n`;
        content += `  • Base URL: ${isOpenRouter ? '✅ OpenRouter' : '❌ Not OpenRouter'}\n`;
        content += `  • Transforms: ${isOpenRouter ? '✅ Enabled' : '❌ Not available'}\n\n`;
        
        if (isOpenRouter) {
          content += '**Middle-Out Compression is Active!** 🎉\n\n';
          content += 'Your requests automatically use middle-out compression:\n';
          content += '  • No more context window errors\n';
          content += '  • Intelligent context trimming\n';
          content += '  • Preserves recent + early context\n';
          content += '  • Removes middle messages when needed\n\n';
          
          content += '**How it works:**\n';
          content += '1. Keeps system message (always)\n';
          content += '2. Keeps most recent messages (important)\n';
          content += '3. Keeps early context (for continuity)\n';
          content += '4. Removes middle when needed\n\n';
          
          content += '**Why middle-out?**\n';
          content += 'Research shows LLMs pay less attention to the middle\n';
          content += 'of long contexts. Removing it has minimal impact on\n';
          content += 'quality while enabling longer conversations.\n\n';
          
          content += '**Configuration:**\n';
          if (transformsEnv) {
            content += `  Current: ${transformsEnv}\n`;
          } else {
            content += '  Default: middle-out (automatic)\n';
          }
          content += '\n';
          
          content += 'To disable (not recommended):\n';
          content += '  export OPENROUTER_TRANSFORMS=""\n\n';
          
          content += 'To customize:\n';
          content += '  export OPENROUTER_TRANSFORMS="middle-out,other"\n\n';
          
          content += '💡 This feature is free and automatic!\n';
          content += '📚 Read more: https://openrouter.ai/docs/transforms';
        } else {
          content += '**Transforms Not Available**\n\n';
          content += 'Message transforms require OpenRouter.\n\n';
          content += 'To enable:\n';
          content += '  export OPENAI_BASE_URL=https://openrouter.ai/api/v1\n';
          content += '  export OPENAI_MODEL=<your-preferred-model>\n\n';
          content += '🔑 Get API key: https://openrouter.ai/keys\n';
          content += '📚 Learn more: https://openrouter.ai/docs';
        }

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
  ],
};
