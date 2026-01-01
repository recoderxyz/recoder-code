/**
 * Anthropic Provider - Claude models
 */

import type { ProviderModel } from './types.js';

const ANTHROPIC_MODELS: ProviderModel[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextLength: 200000 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextLength: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextLength: 200000 },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextLength: 200000 },
];

export class AnthropicProvider {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['ANTHROPIC_API_KEY'];
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getModels(): ProviderModel[] {
    return ANTHROPIC_MODELS;
  }

  getBaseUrl(): string {
    return 'https://api.anthropic.com';
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }
}

let instance: AnthropicProvider | null = null;

export function getAnthropicProvider(apiKey?: string): AnthropicProvider {
  if (!instance || apiKey) {
    instance = new AnthropicProvider(apiKey);
  }
  return instance;
}
