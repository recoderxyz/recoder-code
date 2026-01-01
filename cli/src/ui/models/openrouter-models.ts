/**
 * OpenRouter Models for Recoder Code
 * Curated list of available AI models via OpenRouter
 */

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: 'free' | 'paid';
  category: 'coding' | 'general' | 'reasoning' | 'vision';
}

export const OPENROUTER_MODELS: ModelInfo[] = [
  // Free Coding Models with Tool Support
  {
    id: 'deepseek/deepseek-chat-v3.1:free',
    name: 'DeepSeek Chat V3.1 (Free)',
    description: 'Fast, capable coding model - Best free option with tool calling',
    contextLength: 128000,
    pricing: 'free',
    category: 'coding',
  },
  {
    id: 'deepseek/deepseek-v3-0324:free',
    name: 'DeepSeek V3 0324 (Free)',
    description: '685B MoE model - Excellent for complex tasks with tool use',
    contextLength: 164000,
    pricing: 'free',
    category: 'coding',
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen3 Coder 480B A35B (Free)',
    description: '480B MoE optimized for agentic coding, function calling & tool use',
    contextLength: 262000,
    pricing: 'free',
    category: 'coding',
  },
  {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen3 235B A22B (Free)',
    description: '235B MoE with thinking mode, strong reasoning & tool calling',
    contextLength: 131000,
    pricing: 'free',
    category: 'coding',
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    name: 'GLM 4.5 Air (Free)',
    description: 'Lightweight MoE for agents with thinking/non-thinking modes & tool use',
    contextLength: 131000,
    pricing: 'free',
    category: 'coding',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'Excellent coding and reasoning',
    contextLength: 64000,
    pricing: 'free',
    category: 'coding',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen Coder 32B',
    description: 'Specialized for code generation',
    contextLength: 32000,
    pricing: 'free',
    category: 'coding',
  },
  
  // Premium Coding Models
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Top-tier coding and reasoning',
    contextLength: 200000,
    pricing: 'paid',
    category: 'coding',
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'Advanced reasoning and coding',
    contextLength: 128000,
    pricing: 'paid',
    category: 'coding',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'Latest OpenAI with vision',
    contextLength: 128000,
    pricing: 'paid',
    category: 'vision',
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Highest quality, best for complex tasks',
    contextLength: 200000,
    pricing: 'paid',
    category: 'reasoning',
  },
  
  // Free General Models with Tool Support
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Experimental (Free)',
    description: 'Fast TTFT, multimodal understanding, coding & function calling',
    contextLength: 1050000,
    pricing: 'free',
    category: 'vision',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    description: 'Optimized for multilingual dialogue with strong tool support',
    contextLength: 66000,
    pricing: 'free',
    category: 'general',
  },
  {
    id: 'mistralai/mistral-small-3.2-24b:free',
    name: 'Mistral Small 3.2 24B (Free)',
    description: 'Improved function calling, repetition reduction & structured outputs',
    contextLength: 131000,
    pricing: 'free',
    category: 'general',
  },
  {
    id: 'mistralai/mistral-small-3.1-24b:free',
    name: 'Mistral Small 3.1 24B (Free)',
    description: 'Text & vision with function calling and 128k context',
    contextLength: 128000,
    pricing: 'free',
    category: 'general',
  },
  {
    id: 'alibaba/tongyi-deepresearch-30b-a3b:free',
    name: 'Tongyi DeepResearch 30B A3B (Free)',
    description: 'Agentic model optimized for deep research, tool use & multi-step reasoning',
    contextLength: 131000,
    pricing: 'free',
    category: 'reasoning',
  },
  {
    id: 'meituan/longcat-flash-chat:free',
    name: 'LongCat Flash Chat (Free)',
    description: '560B MoE with ~27B active, optimized for conversational & agentic tasks',
    contextLength: 131000,
    pricing: 'free',
    category: 'general',
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct:free',
    name: 'Llama 3.1 70B (Free)',
    description: 'Meta\'s powerful open model',
    contextLength: 131072,
    pricing: 'free',
    category: 'general',
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B (Free)',
    description: 'Fast and efficient',
    contextLength: 32000,
    pricing: 'free',
    category: 'general',
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    description: 'Google\'s advanced model',
    contextLength: 2000000,
    pricing: 'paid',
    category: 'reasoning',
  },
];

export function getModelsByCategory(category: ModelInfo['category']): ModelInfo[] {
  return OPENROUTER_MODELS.filter(m => m.category === category);
}

export function getFreeModels(): ModelInfo[] {
  return OPENROUTER_MODELS.filter(m => m.pricing === 'free');
}

export function getPaidModels(): ModelInfo[] {
  return OPENROUTER_MODELS.filter(m => m.pricing === 'paid');
}

export function getModelById(id: string): ModelInfo | undefined {
  return OPENROUTER_MODELS.find(m => m.id === id);
}

export const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3.1:free';

export const MODEL_CATEGORIES = {
  coding: 'Best for Code',
  general: 'General Purpose',
  reasoning: 'Advanced Reasoning',
  vision: 'Vision Capable',
};
