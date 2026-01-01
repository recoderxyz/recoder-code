/**
 * OpenRouter Client
 * Adapts OpenRouter API to work with the Qwen Code architecture
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getOpenRouterConfig, validateOpenRouterConfig } from '../config/openrouter.js';

export class OpenRouterClient {
  private client: OpenAI;
  private config: ReturnType<typeof getOpenRouterConfig>;

  constructor() {
    this.config = getOpenRouterConfig();
    
    if (!validateOpenRouterConfig(this.config)) {
      throw new Error('Invalid OpenRouter configuration');
    }

    this.client = new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      defaultHeaders: {
        'HTTP-Referer': this.config.siteURL || '',
        'X-Title': this.config.siteName || '',
      },
    });
  }

  /**
   * Generate content using OpenRouter API
   * This mimics the Gemini client interface
   */
  async generateContent(params: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
  }) {
    const model = params.model || this.config.model || 'deepseek/deepseek-chat-v3.1:free';
    
    const messages: ChatCompletionMessageParam[] = params.messages.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : (msg.role as 'user' | 'system' | 'assistant'),
      content: msg.content,
    }));

    if (params.stream) {
      return this.streamContent(model, messages, params);
    }

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
    });

    return {
      response: {
        text: () => response.choices[0]?.message?.content || '',
        candidates: [{
          content: {
            parts: [{
              text: response.choices[0]?.message?.content || '',
            }],
          },
        }],
      },
    };
  }

  /**
   * Stream content from OpenRouter
   */
  async *streamContent(
    model: string,
    messages: ChatCompletionMessageParam[],
    params: any
  ) {
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4000,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield {
          text: () => content,
          candidates: [{
            content: {
              parts: [{ text: content }],
            },
          }],
        };
      }
    }
  }

  /**
   * List available models from OpenRouter with optional filters
   */
  async listModels(filters?: {
    category?: string;
    supported_parameters?: string;
    use_rss?: boolean;
    use_rss_chat_links?: boolean;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.supported_parameters) params.append('supported_parameters', filters.supported_parameters);
      if (filters?.use_rss !== undefined) params.append('use_rss', String(filters.use_rss));
      if (filters?.use_rss_chat_links !== undefined) params.append('use_rss_chat_links', String(filters.use_rss_chat_links));
      
      const url = `https://openrouter.ai/api/v1/models${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [];
    }
  }

  /**
   * List endpoints for a specific model
   * @param modelId Full model ID in format "author/slug" (e.g., "anthropic/claude-3.5-sonnet")
   */
  async listModelEndpoints(modelId: string) {
    try {
      // Parse model ID into author and slug
      const parts = modelId.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid model ID format: ${modelId}. Expected format: "author/slug"`);
      }
      
      const [author, slug] = parts;
      const url = `https://openrouter.ai/api/v1/models/${author}/${slug}/endpoints`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch endpoints: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching model endpoints:', error);
      throw error;
    }
  }

  /**
   * Get models that support specific features (e.g., tool calling)
   */
  async getModelsWithFeature(feature: 'tools' | 'vision' | 'streaming') {
    const paramMap: Record<string, string> = {
      'tools': 'tools',
      'vision': 'image',
      'streaming': 'stream',
    };
    
    const param = paramMap[feature];
    if (!param) {
      throw new Error(`Unknown feature: ${feature}`);
    }
    
    return this.listModels({ supported_parameters: param });
  }

  /**
   * Get model information
   */
  getModel(modelName?: string) {
    return {
      model: modelName || this.config.model,
      displayName: modelName || this.config.model,
    };
  }
}

// Singleton instance
let openRouterClientInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!openRouterClientInstance) {
    openRouterClientInstance = new OpenRouterClient();
  }
  return openRouterClientInstance;
}
