/**
 * Groq Provider - Fast inference
 */

import type { ProviderModel } from './types.js';

const GROQ_MODELS: ProviderModel[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', contextLength: 128000 },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'groq', contextLength: 128000 },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', contextLength: 128000 },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', contextLength: 32768 },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq', contextLength: 8192 },
];

export class GroqProvider {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['GROQ_API_KEY'];
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getModels(): ProviderModel[] {
    return GROQ_MODELS;
  }

  getBaseUrl(): string {
    return 'https://api.groq.com/openai/v1';
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }
}

let instance: GroqProvider | null = null;

export function getGroqProvider(apiKey?: string): GroqProvider {
  if (!instance || apiKey) {
    instance = new GroqProvider(apiKey);
  }
  return instance;
}
