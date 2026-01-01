/**
 * OpenRouter Provider - Access to 350+ AI models
 */

import type { ProviderModel } from './types.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

export class OpenRouterProvider {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['OPENROUTER_API_KEY'];
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<ProviderModel[]> {
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { data: OpenRouterModel[] };
      return data.data.map((m) => ({
        id: m.id,
        name: m.name,
        provider: 'openrouter',
        contextLength: m.context_length,
        isFree: m.pricing.prompt === '0' && m.pricing.completion === '0',
      }));
    } catch {
      return [];
    }
  }

  getBaseUrl(): string {
    return OPENROUTER_API_URL;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }
}

let instance: OpenRouterProvider | null = null;

export function getOpenRouterProvider(apiKey?: string): OpenRouterProvider {
  if (!instance || apiKey) {
    instance = new OpenRouterProvider(apiKey);
  }
  return instance;
}
