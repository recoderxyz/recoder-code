/**
 * Ollama Provider - Local AI model support
 */

import type { OllamaModel, OllamaTagsResponse, ProviderModel } from './types.js';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export class OllamaProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['OLLAMA_BASE_URL'] || DEFAULT_OLLAMA_URL;
  }

  /**
   * Check if Ollama is running
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of installed models
   */
  async getModels(): Promise<ProviderModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = (await response.json()) as OllamaTagsResponse;
      return data.models.map((m: OllamaModel) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama',
        size: m.details?.parameter_size,
        contextLength: this.estimateContextLength(m.details?.parameter_size),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok || !response.body) return false;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (onProgress && json.status) {
              onProgress(json.status);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  isConfigured(): boolean {
    return true; // Always configured, just may not be running
  }

  private estimateContextLength(paramSize?: string): number {
    if (!paramSize) return 4096;
    const size = parseFloat(paramSize);
    if (size >= 30) return 32768;
    if (size >= 13) return 16384;
    if (size >= 7) return 8192;
    return 4096;
  }
}

// Singleton for easy access
let ollamaInstance: OllamaProvider | null = null;

export function getOllamaProvider(baseUrl?: string): OllamaProvider {
  if (!ollamaInstance || baseUrl) {
    ollamaInstance = new OllamaProvider(baseUrl);
  }
  return ollamaInstance;
}
