/**
 * OpenAI Provider - GPT models
 */

import type { ProviderModel } from './types.js';

const OPENAI_MODELS: ProviderModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextLength: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextLength: 128000 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextLength: 128000 },
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', contextLength: 8192 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextLength: 16385 },
  { id: 'o1-preview', name: 'o1 Preview', provider: 'openai', contextLength: 128000 },
  { id: 'o1-mini', name: 'o1 Mini', provider: 'openai', contextLength: 128000 },
];

export class OpenAIProvider {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env['OPENAI_API_KEY'];
    this.baseUrl = baseUrl || process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getModels(): ProviderModel[] {
    return OPENAI_MODELS;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }
}

let instance: OpenAIProvider | null = null;

export function getOpenAIProvider(apiKey?: string, baseUrl?: string): OpenAIProvider {
  if (!instance || apiKey || baseUrl) {
    instance = new OpenAIProvider(apiKey, baseUrl);
  }
  return instance;
}
