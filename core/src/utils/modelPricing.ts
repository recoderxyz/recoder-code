/**
 * Model Pricing Database
 * Prices are in USD per million tokens
 */

export interface ModelPricing {
  promptPrice: number;  // Price per 1M prompt tokens
  completionPrice: number;  // Price per 1M completion tokens
  contextWindow: number;  // Maximum context window size
}

/**
 * Pricing data for popular models
 * Updated: 2025-01-14
 * Source: OpenRouter pricing page
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude models (most expensive)
  'anthropic/claude-3.5-sonnet': {
    promptPrice: 3.0,
    completionPrice: 15.0,
    contextWindow: 200000,
  },
  'anthropic/claude-sonnet-4': {
    promptPrice: 3.0,
    completionPrice: 15.0,
    contextWindow: 200000,
  },
  'anthropic/claude-sonnet-4.5': {
    promptPrice: 3.0,
    completionPrice: 15.0,
    contextWindow: 200000,
  },
  'anthropic/claude-3-opus': {
    promptPrice: 15.0,
    completionPrice: 75.0,
    contextWindow: 200000,
  },

  // OpenAI models
  'openai/gpt-4-turbo': {
    promptPrice: 10.0,
    completionPrice: 30.0,
    contextWindow: 128000,
  },
  'openai/gpt-4o': {
    promptPrice: 2.5,
    completionPrice: 10.0,
    contextWindow: 128000,
  },
  'openai/o1-preview': {
    promptPrice: 15.0,
    completionPrice: 60.0,
    contextWindow: 128000,
  },
  'openai/o1-mini': {
    promptPrice: 3.0,
    completionPrice: 12.0,
    contextWindow: 128000,
  },

  // Free models (OpenRouter free tier)
  'google/gemini-2.0-flash-exp:free': {
    promptPrice: 0,
    completionPrice: 0,
    contextWindow: 1000000,
  },
  'qwen/qwen3-coder:free': {
    promptPrice: 0,
    completionPrice: 0,
    contextWindow: 262000,
  },
  'deepseek/deepseek-chat-v3-0324:free': {
    promptPrice: 0,
    completionPrice: 0,
    contextWindow: 164000,
  },
  'meta-llama/llama-3.3-70b-instruct:free': {
    promptPrice: 0,
    completionPrice: 0,
    contextWindow: 66000,
  },

  // Paid but affordable models
  'google/gemini-2.0-flash-exp': {
    promptPrice: 0.075,
    completionPrice: 0.3,
    contextWindow: 1000000,
  },
  'deepseek/deepseek-chat-v3': {
    promptPrice: 0.27,
    completionPrice: 1.1,
    contextWindow: 164000,
  },
  'qwen/qwen3-coder': {
    promptPrice: 0.14,
    completionPrice: 0.14,
    contextWindow: 262000,
  },
};

/**
 * Get pricing info for a model
 * Returns undefined if model not found
 */
export function getModelPricing(modelId: string): ModelPricing | undefined {
  // Try exact match first
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId];
  }

  // Try without version suffix (e.g., "claude-3.5-sonnet-20240620" -> "claude-3.5-sonnet")
  const baseModelId = modelId.replace(/-\d{8}$/, '');
  if (MODEL_PRICING[baseModelId]) {
    return MODEL_PRICING[baseModelId];
  }

  // Try partial match (search for key in model ID)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelId.includes(key) || key.includes(modelId)) {
      return pricing;
    }
  }

  return undefined;
}

/**
 * Calculate cost for a given token usage
 */
export function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getModelPricing(modelId);

  if (!pricing) {
    // Unknown model - assume expensive pricing as safety measure
    console.warn(`Unknown model pricing for: ${modelId}, using conservative estimate`);
    return ((promptTokens * 3.0) + (completionTokens * 15.0)) / 1_000_000;
  }

  const promptCost = (promptTokens * pricing.promptPrice) / 1_000_000;
  const completionCost = (completionTokens * pricing.completionPrice) / 1_000_000;

  return promptCost + completionCost;
}

/**
 * Check if a model is expensive (>= $1 per 1M prompt tokens)
 */
export function isExpensiveModel(modelId: string): boolean {
  const pricing = getModelPricing(modelId);
  if (!pricing) return true; // Assume expensive if unknown
  return pricing.promptPrice >= 1.0;
}

/**
 * Check if a model is free
 */
export function isFreeModel(modelId: string): boolean {
  const pricing = getModelPricing(modelId);
  if (!pricing) return false;
  return pricing.promptPrice === 0 && pricing.completionPrice === 0;
}

/**
 * Estimate cost for a prompt before sending
 * Uses a rough estimate: 1 token ≈ 0.75 words
 */
export function estimatePromptCost(
  modelId: string,
  promptText: string,
  expectedCompletionTokens: number = 1000,
): number {
  // Rough token estimation: 1 token ≈ 0.75 words
  const words = promptText.split(/\s+/).length;
  const estimatedPromptTokens = Math.ceil(words / 0.75);

  return calculateCost(modelId, estimatedPromptTokens, expectedCompletionTokens);
}

/**
 * Get cost tier for display
 */
export function getCostTier(modelId: string): 'free' | 'cheap' | 'moderate' | 'expensive' | 'very-expensive' {
  const pricing = getModelPricing(modelId);

  if (!pricing) return 'expensive'; // Conservative default

  if (pricing.promptPrice === 0) return 'free';
  if (pricing.promptPrice < 0.5) return 'cheap';
  if (pricing.promptPrice < 2.0) return 'moderate';
  if (pricing.promptPrice < 10.0) return 'expensive';
  return 'very-expensive';
}

/**
 * Format cost in a human-readable way
 */
export function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.001) return '< $0.001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}
