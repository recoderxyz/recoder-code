/**
 * Custom Provider Manager - Load and manage user-defined providers
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { CustomProviderConfig, AIProvider } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.recoder-code', 'providers');
const CUSTOM_PROVIDERS_DIR = path.join(CONFIG_DIR, 'custom_providers');

export class CustomProviderManager {
  private customProviders: Map<string, AIProvider> = new Map();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized) return;
    this.ensureDirectories();
    this.loadCustomProviders();
    this.initialized = true;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(CUSTOM_PROVIDERS_DIR)) {
      fs.mkdirSync(CUSTOM_PROVIDERS_DIR, { recursive: true });
    }
  }

  private loadCustomProviders(): void {
    try {
      const files = fs.readdirSync(CUSTOM_PROVIDERS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(CUSTOM_PROVIDERS_DIR, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const config: CustomProviderConfig = JSON.parse(content);
          
          const provider: AIProvider = {
            id: config.id,
            name: config.name,
            engine: config.engine,
            baseUrl: config.baseUrl,
            apiKeyEnv: config.apiKeyEnv,
            isLocal: config.isLocal ?? false,
            isEnabled: true,
            isBuiltin: false,
            models: config.models,
            headers: config.headers,
            supportsStreaming: config.supportsStreaming ?? true,
          };

          this.customProviders.set(config.id, provider);
        } catch (err) {
          console.warn(`Failed to load provider from ${file}:`, err);
        }
      }
    } catch (err) {
      // Directory doesn't exist yet, that's ok
    }
  }

  async addProvider(config: CustomProviderConfig): Promise<void> {
    const filePath = path.join(CUSTOM_PROVIDERS_DIR, `${config.id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
    
    const provider: AIProvider = {
      id: config.id,
      name: config.name,
      engine: config.engine,
      baseUrl: config.baseUrl,
      apiKeyEnv: config.apiKeyEnv,
      isLocal: config.isLocal ?? false,
      isEnabled: true,
      isBuiltin: false,
      models: config.models,
      headers: config.headers,
      supportsStreaming: config.supportsStreaming ?? true,
    };

    this.customProviders.set(config.id, provider);
  }

  async removeProvider(id: string): Promise<void> {
    const filePath = path.join(CUSTOM_PROVIDERS_DIR, `${id}.json`);
    await fs.promises.unlink(filePath);
    this.customProviders.delete(id);
  }

  getAll(): AIProvider[] {
    return Array.from(this.customProviders.values());
  }

  get(id: string): AIProvider | undefined {
    return this.customProviders.get(id);
  }

  async testConnection(provider: AIProvider): Promise<boolean> {
    try {
      const response = await fetch(`${provider.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...provider.headers,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const customProviderManager = new CustomProviderManager();
