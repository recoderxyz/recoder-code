/**
 * Unified AI Service
 * Respects Settings UI configuration and supports multiple providers
 */

import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ProviderService } from './ProviderService.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  model?: string;
}

export class AIService {
  private providerService: ProviderService;

  constructor(providerService: ProviderService) {
    this.providerService = providerService;
  }

  /**
   * Get the current AI configuration from settings
   */
  private getConfiguration() {
    return this.providerService.getAIConfiguration();
  }

  /**
   * Create OpenAI client for the current provider
   */
  private createClient(providerOverride?: string): OpenAI {
    const config = this.getConfiguration();
    const providerId = providerOverride || config.defaultProvider;
    
    const providers = this.providerService.getAllProviders();
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`);
    }

    const apiKey = this.providerService.getApiKey(provider);
    
    if (!provider.isLocal && !apiKey) {
      throw new Error(`API key required for provider "${providerId}"`);
    }

    return new OpenAI({
      baseURL: provider.baseUrl,
      apiKey: apiKey || 'local',
      defaultHeaders: {
        'HTTP-Referer': 'https://recoder.xyz',
        'X-Title': 'Recoder Code VSCode Extension',
      },
    });
  }

  /**
   * Chat completion with automatic provider selection
   */
  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const config = this.getConfiguration();
    const client = this.createClient(options.model?.split('/')[0]);
    
    const modelId = options.model || config.defaultModel || this.getDefaultModelForProvider(config.defaultProvider);
    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens ?? config.maxTokens;

    try {
      const completion = await client.chat.completions.create({
        model: modelId,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
        stream: options.stream || false,
      });

      return completion as OpenAI.Chat.Completions.ChatCompletion;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI Service Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Streaming chat completion
   */
  async chatStream(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const config = this.getConfiguration();
    const client = this.createClient(options.model?.split('/')[0]);
    
    const modelId = options.model || config.defaultModel || this.getDefaultModelForProvider(config.defaultProvider);
    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens ?? config.maxTokens;

    try {
      return await client.chat.completions.create({
        model: modelId,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI Service Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get available models for current provider
   */
  async getAvailableModels(): Promise<string[]> {
    const config = this.getConfiguration();
    const providerId = config.defaultProvider;
    
    try {
      // For local providers, try to get models dynamically
      if (providerId === 'ollama') {
        return await this.providerService.getOllamaModels().then(models => 
          models.map(m => m.id)
        );
      } else if (providerId === 'lmstudio') {
        return await this.providerService.getLMStudioModels().then(models => 
          models.map(m => m.id)
        );
      }
      
      // For cloud providers, return common models
      return this.getCommonModelsForProvider(providerId);
    } catch (error) {
      console.error('Failed to get models:', error);
      return this.getCommonModelsForProvider(providerId);
    }
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModelForProvider(providerId: string): string {
    switch (providerId) {
      case 'openai': return 'gpt-4o';
      case 'anthropic': return 'claude-3-5-sonnet-20241022';
      case 'openrouter': return 'anthropic/claude-3.5-sonnet';
      case 'groq': return 'llama-3.1-8b-instant';
      case 'ollama': return 'llama3.2';
      case 'deepseek': return 'deepseek-chat';
      case 'mistral': return 'mistral-large-latest';
      case 'google': return 'gemini-1.5-pro';
      case 'lmstudio': return 'local-model';
      default: return 'anthropic/claude-3.5-sonnet';
    }
  }

  /**
   * Get common models for a provider
   */
  private getCommonModelsForProvider(providerId: string): string[] {
    switch (providerId) {
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      
      case 'anthropic':
        return [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229'
        ];
      
      case 'openrouter':
        return [
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'meta-llama/llama-3.1-405b-instruct',
          'google/gemini-pro-1.5',
          'qwen/qwen-2.5-72b-instruct'
        ];
      
      case 'groq':
        return [
          'llama-3.1-8b-instant',
          'llama-3.1-70b-versatile',
          'mixtral-8x7b-32768',
          'gemma-7b-it'
        ];
      
      case 'deepseek':
        return ['deepseek-chat', 'deepseek-coder'];
      
      case 'mistral':
        return [
          'mistral-large-latest',
          'mistral-medium-latest',
          'mistral-small-latest'
        ];
      
      case 'google':
        return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];
      
      case 'ollama':
        return ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'gemma'];
      
      case 'lmstudio':
        return ['local-model'];
      
      default:
        return ['anthropic/claude-3.5-sonnet'];
    }
  }

  /**
   * Test the current AI configuration
   */
  async testConfiguration(): Promise<{ success: boolean; message: string; latency?: number }> {
    const config = this.getConfiguration();
    
    try {
      const start = Date.now();
      
      const response = await this.chat([
        { role: 'user', content: 'Hello! Please respond with just "OK" to confirm the connection.' }
      ], { maxTokens: 10 });
      
      const latency = Date.now() - start;
      
      if ('choices' in response && response.choices[0]?.message?.content) {
        return { 
          success: true, 
          message: 'Connection successful!', 
          latency 
        };
      } else {
        return { 
          success: false, 
          message: 'Invalid response format' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Estimate cost for a request (OpenRouter only)
   */
  async estimateCost(messages: ChatMessage[], modelId?: string): Promise<number> {
    const config = this.getConfiguration();
    
    if (config.defaultProvider !== 'openrouter') {
      return 0; // Free for local providers or providers without cost estimation
    }

    // Simple token estimation (rough)
    const totalText = messages.map(m => m.content).join(' ');
    const estimatedTokens = Math.ceil(totalText.length / 4); // Rough estimation: 1 token ≈ 4 chars
    
    // OpenRouter average cost estimation (very rough)
    const avgCostPerToken = 0.000002; // $0.000002 per token (varies by model)
    
    return estimatedTokens * avgCostPerToken;
  }
}
