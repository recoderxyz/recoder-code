/**
 * OpenRouter API Service
 * Handles interactions with OpenRouter API
 */

import OpenAI from 'openai';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens: number;
  };
}

export interface CreditInfo {
  data: {
    label: string;
    usage: number;
    limit: number | null;
    is_free_tier: boolean;
    rate_limit: {
      requests: number;
      interval: string;
    };
  };
}

export interface GenerationStats {
  id: string;
  model: string;
  created_at: number;
  generation_time: number;
  tokens_prompt: number;
  tokens_completion: number;
  native_tokens_prompt?: number;
  native_tokens_completion?: number;
  num_media_generations?: number;
}

export class OpenRouterService {
  private client: OpenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://recoder.xyz',
        'X-Title': 'Recoder Code VSCode Extension',
      },
    });
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<ModelInfo[]> {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = (await response.json()) as { data: ModelInfo[] };
    return data.data;
  }

  /**
   * Get credit information
   */
  async getCredits(): Promise<CreditInfo> {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch credits');
    }

    return (await response.json()) as CreditInfo;
  }

  /**
   * Get generation stats
   */
  async getGenerationStats(): Promise<GenerationStats[]> {
    const response = await fetch('https://openrouter.ai/api/v1/generation?limit=10', {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch generation stats');
    }

    const data = (await response.json()) as { data: GenerationStats[] };
    return data.data;
  }

  /**
   * Send chat completion request
   */
  async chat(
    model: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ) {
    return await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: options?.stream ?? false,
    });
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(
    model: ModelInfo,
    promptTokens: number,
    completionTokens: number
  ): number {
    const promptCost = parseFloat(model.pricing.prompt) * (promptTokens / 1_000_000);
    const completionCost = parseFloat(model.pricing.completion) * (completionTokens / 1_000_000);
    return promptCost + completionCost;
  }

  /**
   * Count tokens (rough estimate)
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
