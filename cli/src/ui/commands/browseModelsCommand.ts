/**
 * @license
 * Copyright 2025 Recoder
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

/**
 * Command to browse OpenRouter models using web search
 * 
 * Usage:
 *   /browse-models                    - Show popular models and instructions
 *   /browse-models search <query>     - Search for models (e.g., "claude", "coding")
 *   /browse-models free               - Show free models with tool calling
 *   /browse-models premium            - Show premium models
 *   /browse-models vision             - Show models with vision support
 *   /browse-models compare <model1> <model2> - Compare models side-by-side
 * 
 * Examples:
 *   /browse-models
 *   /browse-models search claude
 *   /browse-models free
 *   /browse-models search coding models
 *   /browse-models compare claude gpt-4o
 */
export const browseModelsCommand: SlashCommand = {
  name: 'browse-models',
  description: 'Browse and search OpenRouter models',
  kind: CommandKind.BUILT_IN,

  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const args = context.invocation?.args?.trim() || '';
    
    // Handle subcommands
    if (!args) {
      return handleShowHelp();
    }
    
    if (args === 'free') {
      return handleShowFreeModels();
    }
    
    if (args === 'premium') {
      return handleShowPremiumModels();
    }
    
    if (args === 'vision') {
      return handleShowVisionModels();
    }
    
    if (args.startsWith('search ')) {
      const query = args.substring(7).trim();
      return handleSearchModels(query);
    }

    if (args.startsWith('compare ')) {
      return {
        type: 'message',
        messageType: 'info',
        content: `To compare models, use:\n\n  /compare ${args.substring(8)}\n\nExample: /compare claude gpt-4o deepseek`,
      };
    }
    
    // Unknown command
    return {
      type: 'message',
      messageType: 'error',
      content: `Unknown command: "${args}"\n\nUse /browse-models to see available options.`,
    };
  },
};

/**
 * Show help and popular models
 */
function handleShowHelp(): MessageActionReturn {
  return {
    type: 'message',
    messageType: 'info',
    content: `🔍 Browse OpenRouter Models

**Usage:**
  /browse-models                     Show this help
  /browse-models search <query>      Search for models
  /browse-models free                Show free models
  /browse-models premium             Show premium models  
  /browse-models vision              Show vision models

**Examples:**
  /browse-models search claude       Find Claude models
  /browse-models search coding       Find coding-optimized models
  /browse-models free                List all free models
  /browse-models premium             List premium models

**Quick Actions:**
After finding a model, add it with:
  /add-model <model-id>
  /add-model <model-id> "Custom Label"

**Popular Models:**
  • anthropic/claude-3.5-sonnet - Best for coding
  • anthropic/claude-3-opus-20240229 - Most capable
  • deepseek/deepseek-v3 - Excellent coder
  • openai/o1-preview - Advanced reasoning
  • google/gemini-2.0-flash-exp - Fast + vision

**Free Models with Tool Calling:**
  • z-ai/glm-4.5-air:free - 131K ctx, thinking
  • qwen/qwen3-coder:free - 262K ctx, coding
  • deepseek/deepseek-chat-v3-0324:free - 164K ctx
  • google/gemini-2.0-flash-exp:free - 1M ctx, vision

💡 Tip: Visit https://openrouter.ai/models to see all 200+ models
    Use /browse-models search <query> to find specific types`,
  };
}

/**
 * Show free models with tool calling support
 */
function handleShowFreeModels(): MessageActionReturn {
  return {
    type: 'message',
    messageType: 'info',
    content: `🆓 Free OpenRouter Models with Tool Calling

These models are 100% free and support tool/function calling:

**Best for Coding:**
  • qwen/qwen3-coder:free
    262K context | Best for code generation and debugging
    /add-model qwen/qwen3-coder:free "Qwen Coder"

**Best for Reasoning:**
  • z-ai/glm-4.5-air:free
    131K context | Thinking mode, agent tasks, MoE
    /add-model z-ai/glm-4.5-air:free "GLM 4.5 Air"

  • deepseek/deepseek-chat-v3-0324:free
    164K context | 685B params, strong reasoning
    /add-model deepseek/deepseek-chat-v3-0324:free "DeepSeek V3"

**Best for Research:**
  • alibaba/tongyi-deepresearch-30b-a3b:free
    131K context | Agentic, research-oriented
    /add-model alibaba/tongyi-deepresearch-30b-a3b:free "DeepResearch"

**Best for Vision:**
  • google/gemini-2.0-flash-exp:free
    1M context | Multimodal, image understanding
    /add-model google/gemini-2.0-flash-exp:free "Gemini Flash"

  • mistralai/mistral-small-3.2-24b:free
    131K context | Vision + general tasks
    /add-model mistralai/mistral-small-3.2-24b:free "Mistral Small"

**Other Free Models:**
  • qwen/qwen3-235b-a22b:free
    131K context | Multilingual, strong reasoning
    /add-model qwen/qwen3-235b-a22b:free "Qwen 235B"

  • meta-llama/llama-3.3-70b-instruct:free
    66K context | Versatile, multilingual
    /add-model meta-llama/llama-3.3-70b-instruct:free "Llama 3.3"

  • meituan/longcat-flash-chat:free
    131K context | 560B MoE, fast responses
    /add-model meituan/longcat-flash-chat:free "LongCat"

💡 All these models support:
   ✓ Tool/function calling
   ✓ Streaming responses
   ✓ Long context windows
   ✓ Zero API costs

📋 To add a model: Copy the /add-model command above
🔄 To switch models: Use /model after adding`,
  };
}

/**
 * Show premium models
 */
function handleShowPremiumModels(): MessageActionReturn {
  return {
    type: 'message',
    messageType: 'info',
    content: `💎 Premium OpenRouter Models

**Anthropic Claude (Best for Coding):**
  • anthropic/claude-3.5-sonnet-20240620
    Superior coding, fast, 200K context
    /add-model anthropic/claude-3.5-sonnet-20240620 "Claude Sonnet 3.5"

  • anthropic/claude-3-opus-20240229
    Most capable, 200K context, multimodal
    /add-model anthropic/claude-3-opus-20240229 "Claude Opus"

  • anthropic/claude-3-haiku-20240307
    Fast, affordable, 200K context
    /add-model anthropic/claude-3-haiku-20240307 "Claude Haiku"

**OpenAI GPT (General Purpose):**
  • openai/o1-preview
    Advanced reasoning, chain-of-thought
    /add-model openai/o1-preview "O1 Preview"

  • openai/o1-mini
    Fast reasoning, cost-effective
    /add-model openai/o1-mini "O1 Mini"

  • openai/gpt-4-turbo-preview
    Latest GPT-4, vision, 128K context
    /add-model openai/gpt-4-turbo-preview "GPT-4 Turbo"

  • openai/gpt-4o
    Fast, multimodal, 128K context
    /add-model openai/gpt-4o "GPT-4o"

**Google Gemini (Long Context):**
  • google/gemini-2.0-flash-thinking-exp
    Thinking mode, 1M context, vision
    /add-model google/gemini-2.0-flash-thinking-exp "Gemini Thinking"

  • google/gemini-pro-1.5
    2M context, multimodal
    /add-model google/gemini-pro-1.5 "Gemini Pro 1.5"

**Specialized Models:**
  • deepseek/deepseek-v3
    Excellent for code, math, reasoning
    /add-model deepseek/deepseek-v3 "DeepSeek V3"

  • meta-llama/llama-4-405b-instruct
    Latest Llama, very capable
    /add-model meta-llama/llama-4-405b-instruct "Llama 4 405B"

  • mistralai/mistral-large-2411
    Strong performance, multilingual
    /add-model mistralai/mistral-large-2411 "Mistral Large"

  • qwen/qwq-32b-preview
    Math and reasoning specialist
    /add-model qwen/qwq-32b-preview "QwQ Reasoning"

💰 Pricing: Check https://openrouter.ai/models for current rates
📊 Most models: $1-15 per million tokens
⚡ Prompt caching available for Claude models (90% off cached tokens)

💡 Tip: Use /browse-models free to see no-cost alternatives`,
  };
}

/**
 * Show vision-capable models
 */
function handleShowVisionModels(): MessageActionReturn {
  return {
    type: 'message',
    messageType: 'info',
    content: `👁️ Vision-Capable Models

**Free Vision Models:**
  • google/gemini-2.0-flash-exp:free
    1M context, fast, image understanding
    /add-model google/gemini-2.0-flash-exp:free "Gemini Flash Vision"

  • mistralai/mistral-small-3.2-24b:free
    131K context, vision + general tasks
    /add-model mistralai/mistral-small-3.2-24b:free "Mistral Vision"

**Premium Vision Models:**
  • anthropic/claude-3-opus-20240229
    Best vision quality, 200K context
    /add-model anthropic/claude-3-opus-20240229 "Claude Opus Vision"

  • anthropic/claude-3.5-sonnet-20240620
    Fast, high quality, 200K context
    /add-model anthropic/claude-3.5-sonnet-20240620 "Claude Sonnet Vision"

  • openai/gpt-4-vision-preview
    GPT-4 with vision, 128K context
    /add-model openai/gpt-4-vision-preview "GPT-4 Vision"

  • openai/gpt-4o
    Multimodal GPT-4o, fast
    /add-model openai/gpt-4o "GPT-4o Vision"

  • google/gemini-2.0-flash-thinking-exp
    Thinking mode + vision, 1M context
    /add-model google/gemini-2.0-flash-thinking-exp "Gemini Thinking"

**Use Cases:**
  • Code screenshot analysis
  • UI/UX design review
  • Diagram understanding
  • Document OCR
  • Image generation analysis

💡 To use vision: Attach images in your prompts
📸 Supported: JPEG, PNG, GIF, WebP
🎯 Best for code: Claude Opus or Sonnet`,
  };
}

/**
 * Search for models based on query
 */
function handleSearchModels(query: string): MessageActionReturn {
  if (!query) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Please provide a search query.\n\nExample: /browse-models search claude',
    };
  }

  const lowerQuery = query.toLowerCase();
  
  // Define searchable model database
  const modelDatabase = [
    {
      id: 'anthropic/claude-3.5-sonnet-20240620',
      name: 'Claude 3.5 Sonnet',
      keywords: ['claude', 'anthropic', 'coding', 'sonnet', 'premium', 'fast'],
      description: 'Superior coding, fast responses, 200K context',
      category: 'Premium',
    },
    {
      id: 'anthropic/claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      keywords: ['claude', 'anthropic', 'opus', 'premium', 'vision', 'best'],
      description: 'Most capable Claude, 200K context, multimodal',
      category: 'Premium',
    },
    {
      id: 'deepseek/deepseek-v3',
      name: 'DeepSeek V3',
      keywords: ['deepseek', 'coding', 'code', 'math', 'reasoning', 'premium'],
      description: 'Excellent for code, math, and reasoning',
      category: 'Premium',
    },
    {
      id: 'openai/o1-preview',
      name: 'OpenAI O1 Preview',
      keywords: ['openai', 'o1', 'reasoning', 'thinking', 'premium', 'gpt'],
      description: 'Advanced reasoning with chain-of-thought',
      category: 'Premium',
    },
    {
      id: 'qwen/qwen3-coder:free',
      name: 'Qwen3 Coder (Free)',
      keywords: ['qwen', 'coder', 'coding', 'code', 'free', 'programming'],
      description: '262K context, best free model for coding',
      category: 'Free',
    },
    {
      id: 'z-ai/glm-4.5-air:free',
      name: 'GLM 4.5 Air (Free)',
      keywords: ['glm', 'free', 'thinking', 'agent', 'reasoning'],
      description: '131K context, thinking mode, agent tasks',
      category: 'Free',
    },
    {
      id: 'deepseek/deepseek-chat-v3-0324:free',
      name: 'DeepSeek V3 (Free)',
      keywords: ['deepseek', 'free', 'reasoning', 'code', 'coding'],
      description: '164K context, 685B params, strong reasoning',
      category: 'Free',
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Gemini 2.0 Flash (Free)',
      keywords: ['gemini', 'google', 'free', 'vision', 'multimodal', 'fast'],
      description: '1M context, multimodal, vision support',
      category: 'Free',
    },
    {
      id: 'google/gemini-2.0-flash-thinking-exp',
      name: 'Gemini 2.0 Flash Thinking',
      keywords: ['gemini', 'google', 'thinking', 'vision', 'premium', 'reasoning'],
      description: 'Thinking mode, 1M context, vision',
      category: 'Premium',
    },
    {
      id: 'meta-llama/llama-4-405b-instruct',
      name: 'Llama 4 405B',
      keywords: ['llama', 'meta', 'premium', 'large', 'capable'],
      description: 'Latest Llama, very capable, 128K context',
      category: 'Premium',
    },
  ];

  // Search for matches
  const matches = modelDatabase.filter(model => {
    // Check if query matches any keyword or name
    return model.keywords.some(keyword => keyword.includes(lowerQuery)) ||
           model.name.toLowerCase().includes(lowerQuery) ||
           model.description.toLowerCase().includes(lowerQuery);
  });

  if (matches.length === 0) {
    return {
      type: 'message',
      messageType: 'info',
      content: `🔍 No models found matching "${query}"

Try searching for:
  • Provider: claude, openai, gemini, llama, deepseek
  • Capability: coding, vision, reasoning, thinking
  • Cost: free, premium
  • Specialty: multimodal, agent, math

Or browse all categories:
  /browse-models free
  /browse-models premium
  /browse-models vision

Visit https://openrouter.ai/models to see all 200+ models`,
    };
  }

  // Format results
  const freeMatches = matches.filter(m => m.category === 'Free');
  const premiumMatches = matches.filter(m => m.category === 'Premium');

  let result = `🔍 Search Results for "${query}"\n\nFound ${matches.length} model(s):\n\n`;

  if (freeMatches.length > 0) {
    result += '🆓 **Free Models:**\n';
    freeMatches.forEach(model => {
      result += `\n  • ${model.name}\n`;
      result += `    ${model.description}\n`;
      result += `    /add-model ${model.id} "${model.name}"\n`;
    });
  }

  if (premiumMatches.length > 0) {
    if (freeMatches.length > 0) result += '\n';
    result += '💎 **Premium Models:**\n';
    premiumMatches.forEach(model => {
      result += `\n  • ${model.name}\n`;
      result += `    ${model.description}\n`;
      result += `    /add-model ${model.id} "${model.name}"\n`;
    });
  }

  result += '\n💡 Copy the /add-model command to add a model';
  result += '\n📋 Use /add-model list to see your added models';
  result += '\n🔄 Use /model to switch between models';

  return {
    type: 'message',
    messageType: 'info',
    content: result,
  };
}
