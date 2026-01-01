/**
 * Provider Registry - Complete Multi-Provider Management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AIProvider, ProvidersConfig, ProviderModel, CustomProviderConfig } from './types.js';
import { BUILTIN_PROVIDERS, PROVIDER_ALIASES } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.recoder-code');
const PROVIDERS_FILE = path.join(CONFIG_DIR, 'providers.json');
const CUSTOM_PROVIDERS_DIR = path.join(CONFIG_DIR, 'custom_providers');

const DEFAULT_CONFIG: ProvidersConfig = {
  version: '1.0',
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',
  customProviders: [],
  lastUpdated: new Date().toISOString(),
};

export class ProviderRegistry {
  private config: ProvidersConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ProvidersConfig {
    try {
      if (fs.existsSync(PROVIDERS_FILE)) {
        return JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
      }
    } catch {
      // Use default
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      this.config.lastUpdated = new Date().toISOString();
      fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(this.config, null, 2));
    } catch {
      // Ignore
    }
  }

  /**
   * Load custom providers from JSON files
   */
  private loadCustomProviderFiles(): CustomProviderConfig[] {
    const providers: CustomProviderConfig[] = [];
    try {
      if (!fs.existsSync(CUSTOM_PROVIDERS_DIR)) return providers;
      
      for (const file of fs.readdirSync(CUSTOM_PROVIDERS_DIR)) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(CUSTOM_PROVIDERS_DIR, file), 'utf-8'));
          providers.push(data);
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Ignore
    }
    return providers;
  }

  /**
   * Resolve provider alias to actual ID
   */
  resolveAlias(idOrAlias: string): string {
    return PROVIDER_ALIASES[idOrAlias.toLowerCase()] || idOrAlias.toLowerCase();
  }

  /**
   * Get all providers (builtin + custom)
   */
  getAllProviders(): AIProvider[] {
    const customFromFiles = this.loadCustomProviderFiles();
    const customProviders: AIProvider[] = [
      ...this.config.customProviders,
      ...customFromFiles,
    ].map((p) => ({
      id: p.id,
      name: p.name,
      engine: p.engine,
      baseUrl: p.baseUrl,
      apiKeyEnv: p.apiKeyEnv,
      isLocal: p.isLocal ?? false,
      isEnabled: true,
      isBuiltin: false,
      models: p.models,
      headers: p.headers,
      supportsStreaming: p.supportsStreaming ?? true,
    }));

    return [...BUILTIN_PROVIDERS, ...customProviders];
  }

  /**
   * Get provider by ID (with alias support)
   */
  getProvider(idOrAlias: string): AIProvider | undefined {
    const id = this.resolveAlias(idOrAlias);
    return this.getAllProviders().find((p) => p.id === id);
  }

  /**
   * Add custom provider
   */
  addCustomProvider(provider: CustomProviderConfig): void {
    // Remove if exists
    this.config.customProviders = this.config.customProviders.filter((p) => p.id !== provider.id);
    this.config.customProviders.push(provider);
    this.saveConfig();
  }

  /**
   * Save custom provider to file (for shareable configs)
   */
  saveCustomProviderFile(provider: CustomProviderConfig): void {
    if (!fs.existsSync(CUSTOM_PROVIDERS_DIR)) {
      fs.mkdirSync(CUSTOM_PROVIDERS_DIR, { recursive: true });
    }
    const filePath = path.join(CUSTOM_PROVIDERS_DIR, `${provider.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(provider, null, 2));
  }

  /**
   * Remove custom provider
   */
  removeCustomProvider(id: string): boolean {
    const before = this.config.customProviders.length;
    this.config.customProviders = this.config.customProviders.filter((p) => p.id !== id);
    
    // Also try to remove file
    const filePath = path.join(CUSTOM_PROVIDERS_DIR, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Ignore
    }
    
    if (this.config.customProviders.length !== before) {
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Set default provider and model
   */
  setDefault(providerId: string, modelId: string): void {
    this.config.defaultProvider = providerId;
    this.config.defaultModel = modelId;
    this.saveConfig();
  }

  /**
   * Get default
   */
  getDefault(): { provider: string; model: string } {
    return {
      provider: this.config.defaultProvider,
      model: this.config.defaultModel,
    };
  }

  /**
   * Check if provider is available (has API key or is local)
   */
  async isProviderAvailable(idOrAlias: string): Promise<boolean> {
    const provider = this.getProvider(idOrAlias);
    if (!provider) return false;

    if (provider.isLocal) {
      return this.checkLocalProvider(provider);
    }

    // Check for API key
    if (provider.apiKeyEnv) {
      return !!process.env[provider.apiKeyEnv];
    }

    return true;
  }

  /**
   * Check if local provider is running
   */
  private async checkLocalProvider(provider: AIProvider): Promise<boolean> {
    try {
      const url = provider.engine === 'ollama' 
        ? `${provider.baseUrl}/api/tags`
        : `${provider.baseUrl}/models`;
      
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available providers (configured and accessible)
   */
  async getAvailableProviders(): Promise<AIProvider[]> {
    const all = this.getAllProviders();
    const available: AIProvider[] = [];

    for (const provider of all) {
      if (await this.isProviderAvailable(provider.id)) {
        available.push(provider);
      }
    }

    return available;
  }

  /**
   * Get models from a provider
   */
  async getModels(idOrAlias: string): Promise<ProviderModel[]> {
    const provider = this.getProvider(idOrAlias);
    if (!provider) return [];

    // If provider has predefined models, return those
    if (provider.models && provider.models.length > 0) {
      return provider.models;
    }

    // For Ollama, fetch from API
    if (provider.engine === 'ollama') {
      return this.fetchOllamaModels(provider);
    }

    // For OpenRouter, fetch from API
    if (provider.id === 'openrouter') {
      return this.fetchOpenRouterModels();
    }

    return [];
  }

  private async fetchOllamaModels(provider: AIProvider): Promise<ProviderModel[]> {
    try {
      const response = await fetch(`${provider.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      
      const data = (await response.json()) as { models: Array<{ name: string; details?: { parameter_size?: string } }> };
      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        provider: provider.id,
        size: m.details?.parameter_size,
      }));
    } catch {
      return [];
    }
  }

  private async fetchOpenRouterModels(): Promise<ProviderModel[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [];
      
      const data = (await response.json()) as { data: Array<{ id: string; name: string; context_length?: number }> };
      return data.data.slice(0, 100).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        provider: 'openrouter',
        contextLength: m.context_length,
      }));
    } catch {
      return [];
    }
  }
}

// Singleton
let instance: ProviderRegistry | null = null;
export function getProviderRegistry(): ProviderRegistry {
  if (!instance) instance = new ProviderRegistry();
  return instance;
}
