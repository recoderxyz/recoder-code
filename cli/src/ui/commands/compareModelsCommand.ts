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
 * Model comparison data
 */
interface ModelComparisonData {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  promptPrice: number; // per 1M tokens
  completionPrice: number; // per 1M tokens
  features: string[];
  speed: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  quality: 'excellent' | 'very-good' | 'good' | 'fair';
  specialties: string[];
}

/**
 * Model database for comparison
 */
const modelDatabase: Record<string, ModelComparisonData> = {
  'anthropic/claude-3.5-sonnet-20240620': {
    id: 'anthropic/claude-3.5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextLength: 200000,
    promptPrice: 3.0,
    completionPrice: 15.0,
    features: ['Coding', 'Vision', 'Tool calling', 'Prompt caching'],
    speed: 'fast',
    quality: 'excellent',
    specialties: ['Code generation', 'Debugging', 'Refactoring'],
  },
  'anthropic/claude-3-opus-20240229': {
    id: 'anthropic/claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    contextLength: 200000,
    promptPrice: 15.0,
    completionPrice: 75.0,
    features: ['Vision', 'Tool calling', 'Prompt caching', 'Multimodal'],
    speed: 'medium',
    quality: 'excellent',
    specialties: ['Complex reasoning', 'Image analysis', 'Research'],
  },
  'anthropic/claude-3-haiku-20240307': {
    id: 'anthropic/claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    contextLength: 200000,
    promptPrice: 0.25,
    completionPrice: 1.25,
    features: ['Tool calling', 'Prompt caching', 'Fast'],
    speed: 'ultra-fast',
    quality: 'very-good',
    specialties: ['Quick tasks', 'High volume', 'Cost efficiency'],
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextLength: 128000,
    promptPrice: 2.5,
    completionPrice: 10.0,
    features: ['Multimodal', 'Vision', 'Tool calling', 'Fast'],
    speed: 'fast',
    quality: 'excellent',
    specialties: ['General purpose', 'Multimodal', 'Versatile'],
  },
  'openai/o1-preview': {
    id: 'openai/o1-preview',
    name: 'O1 Preview',
    provider: 'OpenAI',
    contextLength: 128000,
    promptPrice: 15.0,
    completionPrice: 60.0,
    features: ['Advanced reasoning', 'Chain-of-thought', 'Problem solving'],
    speed: 'slow',
    quality: 'excellent',
    specialties: ['Deep reasoning', 'Math', 'Science', 'Planning'],
  },
  'deepseek/deepseek-v3': {
    id: 'deepseek/deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    contextLength: 164000,
    promptPrice: 0.27,
    completionPrice: 1.10,
    features: ['Coding', 'Math', 'Tool calling'],
    speed: 'fast',
    quality: 'excellent',
    specialties: ['Algorithms', 'Math', 'System design'],
  },
  'qwen/qwen3-coder:free': {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen3 Coder (Free)',
    provider: 'Qwen',
    contextLength: 262000,
    promptPrice: 0,
    completionPrice: 0,
    features: ['Coding', 'Tool calling', 'Free', 'Large context'],
    speed: 'fast',
    quality: 'very-good',
    specialties: ['Code generation', 'Multi-language', 'Free'],
  },
  'google/gemini-2.0-flash-exp:free': {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash (Free)',
    provider: 'Google',
    contextLength: 1000000,
    promptPrice: 0,
    completionPrice: 0,
    features: ['Vision', 'Multimodal', 'Free', 'Ultra-long context'],
    speed: 'ultra-fast',
    quality: 'very-good',
    specialties: ['Vision', 'Speed', 'Long documents'],
  },
};

/**
 * Format context length
 */
function formatContext(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
}

/**
 * Format price
 */
function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  if (price < 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(0)}`;
}

/**
 * Calculate cost for a typical request (1K input, 500 output)
 */
function calculateTypicalCost(data: ModelComparisonData): number {
  const inputTokens = 1000;
  const outputTokens = 500;
  
  const inputCost = (inputTokens / 1_000_000) * data.promptPrice;
  const outputCost = (outputTokens / 1_000_000) * data.completionPrice;
  
  return inputCost + outputCost;
}

/**
 * Model comparison command
 */
export const compareModelsCommand: SlashCommand = {
  name: 'compare',
  description: 'Compare multiple models side-by-side',
  kind: CommandKind.BUILT_IN,

  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const args = context.invocation?.args?.trim() || '';

    if (!args) {
      return {
        type: 'message',
        messageType: 'info',
        content: `🔍 Model Comparison Tool

Compare models side-by-side to find the best fit for your needs.

**Usage:**
  /compare <model1> <model2> [model3]

**Examples:**
  /compare claude sonnet gpt-4o
  /compare opus qwen gemini
  /compare haiku deepseek qwen-coder

**Popular Comparisons:**
  /compare claude sonnet gpt-4o      → Premium coding models
  /compare qwen-coder deepseek gemini → Free models
  /compare opus o1 deepseek          → Reasoning models
  /compare haiku gpt-4o-mini gemini  → Fast models

**Comparison Includes:**
  • Context length
  • Pricing (input/output)
  • Speed & quality ratings
  • Features & capabilities
  • Cost estimates
  • Best use cases

💡 Use partial names for easier typing (e.g., "sonnet" → Claude 3.5 Sonnet)`,
      };
    }

    // Parse model queries
    const queries = args.toLowerCase().split(/\s+/).filter(q => q.length > 0);
    
    if (queries.length < 2) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Please provide at least 2 models to compare.\n\n' +
          'Example: /compare claude gpt-4o deepseek',
      };
    }

    if (queries.length > 4) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Maximum 4 models can be compared at once.\n\n' +
          'Example: /compare claude gpt-4o deepseek gemini',
      };
    }

    // Find matching models
    const matches: ModelComparisonData[] = [];
    const notFound: string[] = [];

    for (const query of queries) {
      const found = Object.values(modelDatabase).find(model => 
        model.id.toLowerCase().includes(query) ||
        model.name.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query)
      );

      if (found) {
        matches.push(found);
      } else {
        notFound.push(query);
      }
    }

    if (notFound.length > 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Models not found: ${notFound.join(', ')}\n\n` +
          'Available models:\n' +
          '  • claude, opus, sonnet, haiku (Anthropic)\n' +
          '  • gpt-4o, o1 (OpenAI)\n' +
          '  • deepseek (DeepSeek)\n' +
          '  • qwen, qwen-coder (Qwen)\n' +
          '  • gemini (Google)\n\n' +
          'Use /browse-models to see all models',
      };
    }

    if (matches.length < 2) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Need at least 2 valid models to compare.\n\n' +
          'Example: /compare claude gpt-4o',
      };
    }

    // Build comparison table
    let content = `🔍 Model Comparison\n\n`;

    // Header with model names
    content += '**Models:**\n';
    matches.forEach((model, i) => {
      content += `${i + 1}. ${model.name} (${model.provider})\n`;
    });
    content += '\n';

    // Context length comparison
    content += '**Context Length:**\n';
    const maxContext = Math.max(...matches.map(m => m.contextLength));
    matches.forEach((model, i) => {
      const isMax = model.contextLength === maxContext;
      const badge = isMax ? '👑' : '  ';
      content += `${i + 1}. ${badge} ${formatContext(model.contextLength)} tokens\n`;
    });
    content += '\n';

    // Pricing comparison
    content += '**Pricing (per 1M tokens):**\n';
    const minPromptPrice = Math.min(...matches.map(m => m.promptPrice));
    matches.forEach((model, i) => {
      const isCheapest = model.promptPrice === minPromptPrice;
      const badge = isCheapest ? '💰' : '  ';
      content += `${i + 1}. ${badge} ${formatPrice(model.promptPrice)} / ${formatPrice(model.completionPrice)}\n`;
    });
    content += '\n';

    // Typical request cost
    content += '**Cost per Request (1K in, 500 out):**\n';
    const costs = matches.map(m => calculateTypicalCost(m));
    const minCost = Math.min(...costs);
    matches.forEach((model, i) => {
      const cost = costs[i];
      const isCheapest = cost === minCost;
      const badge = isCheapest ? '💸' : '  ';
      const costStr = cost === 0 ? 'Free' : `$${cost.toFixed(4)}`;
      content += `${i + 1}. ${badge} ${costStr}\n`;
    });
    content += '\n';

    // Speed comparison
    content += '**Speed:**\n';
    const speedEmojis = {
      'ultra-fast': '⚡⚡',
      'fast': '⚡',
      'medium': '→',
      'slow': '🐢',
    };
    matches.forEach((model, i) => {
      content += `${i + 1}. ${speedEmojis[model.speed]} ${model.speed}\n`;
    });
    content += '\n';

    // Quality comparison
    content += '**Quality:**\n';
    const qualityEmojis = {
      'excellent': '⭐⭐⭐',
      'very-good': '⭐⭐',
      'good': '⭐',
      'fair': '✓',
    };
    matches.forEach((model, i) => {
      content += `${i + 1}. ${qualityEmojis[model.quality]} ${model.quality}\n`;
    });
    content += '\n';

    // Features comparison
    content += '**Key Features:**\n';
    matches.forEach((model, i) => {
      content += `${i + 1}. ${model.features.join(', ')}\n`;
    });
    content += '\n';

    // Specialties
    content += '**Best For:**\n';
    matches.forEach((model, i) => {
      content += `${i + 1}. ${model.specialties.join(', ')}\n`;
    });
    content += '\n';

    // Recommendations
    content += '**Recommendation:**\n';
    const freeModels = matches.filter(m => m.promptPrice === 0);
    const fastestModel = matches.reduce((a, b) => 
      a.speed === 'ultra-fast' ? a : (b.speed === 'ultra-fast' ? b : a)
    );
    const cheapestPaid = matches
      .filter(m => m.promptPrice > 0)
      .reduce((a, b) => calculateTypicalCost(a) < calculateTypicalCost(b) ? a : b, matches[0]);

    if (freeModels.length > 0) {
      content += `💰 Best Value: ${freeModels[0].name} (Free)\n`;
    }
    content += `⚡ Fastest: ${fastestModel.name}\n`;
    if (cheapestPaid.promptPrice > 0) {
      content += `💵 Cheapest Paid: ${cheapestPaid.name}\n`;
    }
    content += '\n';

    // Add models
    content += '**Add These Models:**\n';
    matches.forEach((model, i) => {
      content += `/add-model ${model.id} "${model.name}"\n`;
    });

    content += '\n💡 Use /recommend <task> for personalized suggestions';

    return {
      type: 'message',
      messageType: 'info',
      content,
    };
  },
};
