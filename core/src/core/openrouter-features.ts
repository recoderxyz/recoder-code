/**
 * OpenRouter Advanced Features
 * Additional OpenRouter-specific features beyond basic chat completion
 * @license Apache-2.0
 */

import { getOpenRouterConfig } from '../config/openrouter.js';

export interface OpenRouterCredits {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  label: string | null;
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string;
  };
}

export interface OpenRouterActivity {
  id: string;
  created_at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  status: 'completed' | 'failed' | 'cancelled';
  latency_ms: number;
}

export interface StructuredOutputSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface WebSearchConfig {
  enabled: boolean;
  max_results?: number;
  time_range?: 'day' | 'week' | 'month' | 'year';
}

export interface OpenRouterAdvancedOptions {
  // Zero Data Retention - prevents OpenRouter from logging requests
  zeroDataRetention?: boolean;

  // Structured outputs - JSON schema validation
  structuredOutput?: StructuredOutputSchema;

  // Web search integration
  webSearch?: WebSearchConfig;

  // Zero completion insurance - handle empty completions
  zeroCompletionInsurance?: boolean;

  // User tracking for per-user rate limiting
  userId?: string;

  // Generation tracking
  parentGenerationId?: string;
}

export class OpenRouterFeaturesClient {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    const config = getOpenRouterConfig();
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
  }

  /**
   * Get remaining credits for the API key
   * Useful for cost tracking and preventing unexpected charges
   */
  async getCredits(): Promise<OpenRouterCredits> {
    try {
      const response = await fetch(`${this.baseURL}/auth/key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credits: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        total_credits: data.data.limit || 0,
        used_credits: data.data.usage || 0,
        remaining_credits: (data.data.limit || 0) - (data.data.usage || 0),
        label: data.data.label,
        is_free_tier: data.data.is_free_tier || false,
        rate_limit: data.data.rate_limit || {
          requests: 0,
          interval: 'minute',
        },
      };
    } catch (error) {
      console.error('Error fetching OpenRouter credits:', error);
      throw error;
    }
  }

  /**
   * Get activity/usage history
   * Returns recent API calls with costs and token usage
   */
  async getActivity(options?: {
    limit?: number;
    offset?: number;
  }): Promise<OpenRouterActivity[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));

      const url = `${this.baseURL}/activity${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch activity: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching OpenRouter activity:', error);
      throw error;
    }
  }

  /**
   * Get generation details by ID
   * Track request lineage and debugging
   */
  async getGeneration(generationId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/generation?id=${generationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch generation: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching generation:', error);
      throw error;
    }
  }

  /**
   * Build advanced request parameters for OpenRouter
   * Combines multiple features into a single request config
   */
  buildAdvancedRequestParams(options: OpenRouterAdvancedOptions): Record<string, any> {
    const params: Record<string, any> = {};

    // Zero Data Retention (ZDR)
    if (options.zeroDataRetention) {
      params['x-openrouter-config'] = {
        ...params['x-openrouter-config'],
        zero_data_retention: true,
      };
    }

    // Structured Outputs
    if (options.structuredOutput) {
      params.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: options.structuredOutput,
        },
      };
    }

    // Web Search
    if (options.webSearch?.enabled) {
      params['x-openrouter-config'] = {
        ...params['x-openrouter-config'],
        web_search: {
          enabled: true,
          max_results: options.webSearch.max_results || 5,
          ...(options.webSearch.time_range && { time_range: options.webSearch.time_range }),
        },
      };
    }

    // Zero Completion Insurance
    if (options.zeroCompletionInsurance) {
      params['x-openrouter-config'] = {
        ...params['x-openrouter-config'],
        zero_completion_insurance: true,
      };
    }

    // User tracking
    if (options.userId) {
      params['x-openrouter-user-id'] = options.userId;
    }

    // Generation tracking
    if (options.parentGenerationId) {
      params.parent_generation_id = options.parentGenerationId;
    }

    return params;
  }

  /**
   * Calculate estimated cost for a request
   * Based on model pricing and token counts
   */
  async estimateCost(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<{ cost: number; currency: string }> {
    try {
      // Fetch model pricing
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch model pricing');
      }

      const data = await response.json();
      const model = data.data.find((m: any) => m.id === params.model);

      if (!model || !model.pricing) {
        throw new Error(`Pricing not available for model: ${params.model}`);
      }

      const promptCost = (params.inputTokens / 1_000_000) * parseFloat(model.pricing.prompt);
      const completionCost = (params.outputTokens / 1_000_000) * parseFloat(model.pricing.completion);

      return {
        cost: promptCost + completionCost,
        currency: 'USD',
      };
    } catch (error) {
      console.error('Error estimating cost:', error);
      throw error;
    }
  }
}

// Singleton instance
let openRouterFeaturesClientInstance: OpenRouterFeaturesClient | null = null;

export function getOpenRouterFeaturesClient(): OpenRouterFeaturesClient {
  if (!openRouterFeaturesClientInstance) {
    openRouterFeaturesClientInstance = new OpenRouterFeaturesClient();
  }
  return openRouterFeaturesClientInstance;
}
