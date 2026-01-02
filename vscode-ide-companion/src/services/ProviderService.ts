/**
 * Provider Service - Multi-Provider AI System
 * Supports 12+ AI providers including local and cloud options
 */

import * as vscode from 'vscode';
import OpenAI from 'openai';

export type ProviderEngine = 'openai' | 'anthropic' | 'ollama' | 'google';

export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  isFree?: boolean;
  isVision?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  engine: ProviderEngine;
  baseUrl: string;
  apiKeyEnv?: string;
  isLocal: boolean;
  isEnabled: boolean;
  supportsStreaming?: boolean;
  description?: string;
  website?: string;
}

// All built-in providers
export const BUILTIN_PROVIDERS: AIProvider[] = [
  // Local providers (no API key needed)
  {
    id: 'ollama',
    name: 'Ollama',
    engine: 'ollama',
    baseUrl: 'http://localhost:11434',
    isLocal: true,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Run open-source models locally',
    website: 'https://ollama.ai',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    engine: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    isLocal: true,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Desktop app for local LLMs',
    website: 'https://lmstudio.ai',
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp',
    engine: 'openai',
    baseUrl: 'http://localhost:8080/v1',
    isLocal: true,
    isEnabled: true,
    supportsStreaming: true,
    description: 'High-performance C++ inference',
    website: 'https://github.com/ggerganov/llama.cpp',
  },
  // Cloud providers
  {
    id: 'openrouter',
    name: 'OpenRouter',
    engine: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Access 200+ models with one API key',
    website: 'https://openrouter.ai',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    engine: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'GPT-4, GPT-4o, o1 models',
    website: 'https://openai.com',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    engine: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Claude 3.5, Claude 4 models',
    website: 'https://anthropic.com',
  },
  {
    id: 'groq',
    name: 'Groq',
    engine: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Ultra-fast inference on LPU',
    website: 'https://groq.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    engine: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'DeepSeek V3, DeepSeek Coder',
    website: 'https://deepseek.com',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    engine: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Mistral, Mixtral, Codestral',
    website: 'https://mistral.ai',
  },
  {
    id: 'together',
    name: 'Together AI',
    engine: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Open-source models at scale',
    website: 'https://together.ai',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    engine: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiKeyEnv: 'FIREWORKS_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Fast inference platform',
    website: 'https://fireworks.ai',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    engine: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GOOGLE_API_KEY',
    isLocal: false,
    isEnabled: true,
    supportsStreaming: true,
    description: 'Gemini Pro, Gemini Flash',
    website: 'https://ai.google.dev',
  },
];

// Provider aliases for quick selection
export const PROVIDER_ALIASES: Record<string, string> = {
  ol: 'ollama',
  or: 'openrouter',
  oai: 'openai',
  ant: 'anthropic',
  claude: 'anthropic',
  gpt: 'openai',
  lms: 'lmstudio',
  llama: 'llamacpp',
  ds: 'deepseek',
  tg: 'together',
  fw: 'fireworks',
  mi: 'mistral',
  gem: 'google',
};

export class ProviderService {
  private context: vscode.ExtensionContext;
  private clients: Map<string, OpenAI> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get all available providers
   */
  getAllProviders(): AIProvider[] {
    return BUILTIN_PROVIDERS;
  }

  /**
   * Get local providers only
   */
  getLocalProviders(): AIProvider[] {
    return BUILTIN_PROVIDERS.filter(p => p.isLocal);
  }

  /**
   * Get cloud providers only
   */
  getCloudProviders(): AIProvider[] {
    return BUILTIN_PROVIDERS.filter(p => !p.isLocal);
  }

  /**
   * Get provider by ID or alias
   */
  getProvider(idOrAlias: string): AIProvider | undefined {
    const id = PROVIDER_ALIASES[idOrAlias.toLowerCase()] || idOrAlias.toLowerCase();
    return BUILTIN_PROVIDERS.find(p => p.id === id);
  }

  /**
   * Check if a local provider is running
   */
  async checkLocalProvider(provider: AIProvider): Promise<{ available: boolean; latency?: number; error?: string }> {
    if (!provider.isLocal) {
      return { available: false, error: 'Not a local provider' };
    }

    const start = Date.now();
    try {
      const url = provider.engine === 'ollama'
        ? `${provider.baseUrl}/api/tags`
        : `${provider.baseUrl}/models`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
      });

      const latency = Date.now() - start;
      return { available: response.ok, latency };
    } catch (error: any) {
      return {
        available: false,
        error: error.code === 'ECONNREFUSED' ? 'Not running' : error.message,
      };
    }
  }

  /**
   * Check if cloud provider has API key configured
   */
  hasApiKey(provider: AIProvider): boolean {
    if (provider.isLocal) return true;
    if (!provider.apiKeyEnv) return false;

    // Check environment variable
    if (process.env[provider.apiKeyEnv]) return true;

    // Check VS Code settings
    const config = vscode.workspace.getConfiguration('recoderCode');
    const keys = config.get<Record<string, string>>('apiKeys') || {};
    return !!keys[provider.id];
  }

  /**
   * Get API key for provider
   */
  getApiKey(provider: AIProvider): string | undefined {
    if (provider.isLocal) return undefined;
    if (!provider.apiKeyEnv) return undefined;

    // Check environment variable first
    const envKey = process.env[provider.apiKeyEnv];
    if (envKey) return envKey;

    // Check VS Code settings
    const config = vscode.workspace.getConfiguration('recoderCode');
    const keys = config.get<Record<string, string>>('apiKeys') || {};
    return keys[provider.id];
  }

  /**
   * Set API key for provider
   */
  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('recoderCode');
    const keys = config.get<Record<string, string>>('apiKeys') || {};
    keys[providerId] = apiKey;
    await config.update('apiKeys', keys, vscode.ConfigurationTarget.Global);
  }

  /**
   * Get OpenAI-compatible client for provider
   */
  getClient(provider: AIProvider, apiKey?: string): OpenAI {
    const key = apiKey || this.getApiKey(provider) || '';
    const cacheKey = `${provider.id}:${key.slice(0, 8)}`;

    if (!this.clients.has(cacheKey)) {
      this.clients.set(cacheKey, new OpenAI({
        baseURL: provider.baseUrl,
        apiKey: key || 'not-needed',
        defaultHeaders: {
          'HTTP-Referer': 'https://recoder.xyz',
          'X-Title': 'Recoder Code',
        },
      }));
    }

    return this.clients.get(cacheKey)!;
  }

  /**
   * Get models from Ollama
   */
  async getOllamaModels(): Promise<ProviderModel[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { models: Array<{ name: string; size: number }> };
      return data.models.map(m => ({
        id: `ollama/${m.name}`,
        name: m.name,
        provider: 'ollama',
        isFree: true,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get models from LM Studio
   */
  async getLMStudioModels(): Promise<ProviderModel[]> {
    try {
      const response = await fetch('http://localhost:1234/v1/models', {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { data: Array<{ id: string }> };
      return data.data.map(m => ({
        id: `lmstudio/${m.id}`,
        name: m.id,
        provider: 'lmstudio',
        isFree: true,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Detect all running local providers
   */
  async detectLocalProviders(): Promise<{ provider: AIProvider; available: boolean; models?: ProviderModel[] }[]> {
    const results = await Promise.all(
      this.getLocalProviders().map(async (provider) => {
        const status = await this.checkLocalProvider(provider);
        let models: ProviderModel[] | undefined;

        if (status.available) {
          if (provider.id === 'ollama') {
            models = await this.getOllamaModels();
          } else if (provider.id === 'lmstudio') {
            models = await this.getLMStudioModels();
          }
        }

        return { provider, available: status.available, models };
      })
    );

    return results;
  }

  /**
   * Get provider status summary
   */
  async getProviderStatus(): Promise<{
    local: { provider: AIProvider; available: boolean }[];
    cloud: { provider: AIProvider; configured: boolean }[];
  }> {
    const localStatus = await Promise.all(
      this.getLocalProviders().map(async (provider) => {
        const status = await this.checkLocalProvider(provider);
        return { provider, available: status.available };
      })
    );

    const cloudStatus = this.getCloudProviders().map(provider => ({
      provider,
      configured: this.hasApiKey(provider),
    }));

    return { local: localStatus, cloud: cloudStatus };
  }

  /**
   * Get the default provider from VS Code settings
   */
  getDefaultProvider(): string {
    const config = vscode.workspace.getConfiguration('recoderCode');
    return config.get('defaultProvider', 'openrouter');
  }

  /**
   * Set the default provider in VS Code settings
   */
  async setDefaultProvider(providerId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('recoderCode');
    await config.update('defaultProvider', providerId, vscode.ConfigurationTarget.Global);
  }

  /**
   * Get the default model from VS Code settings
   */
  getDefaultModel(): string {
    const config = vscode.workspace.getConfiguration('recoderCode');
    return config.get('defaultModel', '');
  }

  /**
   * Set the default model in VS Code settings
   */
  async setDefaultModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('recoderCode');
    await config.update('defaultModel', model, vscode.ConfigurationTarget.Global);
  }

  /**
   * Get all configuration settings needed for AI functionality
   */
  getAIConfiguration(): {
    defaultProvider: string;
    defaultModel: string;
    maxTokens: number;
    temperature: number;
    enableInlineSuggestions: boolean;
    enableCodeLens: boolean;
    enableAutoCompletion: boolean;
  } {
    const config = vscode.workspace.getConfiguration('recoderCode');
    return {
      defaultProvider: config.get('defaultProvider', 'openrouter'),
      defaultModel: config.get('defaultModel', ''),
      maxTokens: config.get('maxTokens', 4096),
      temperature: config.get('temperature', 0.7),
      enableInlineSuggestions: config.get('enableInlineSuggestions', false),
      enableCodeLens: config.get('enableCodeLens', true),
      enableAutoCompletion: config.get('enableAutoCompletion', true)
    };
  }
}
