/**
 * Model ID Parser - Parse provider/model format
 */

import { getProviderRegistry } from './registry.js';
import { PROVIDER_ALIASES } from './types.js';

export interface ParsedModel {
  provider: string;
  model: string;
  fullId: string;
}

/**
 * Parse model ID in format: provider/model or just model
 * Examples:
 *   ollama/llama3.1:8b -> { provider: 'ollama', model: 'llama3.1:8b' }
 *   openrouter/anthropic/claude-3.5-sonnet -> { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' }
 *   claude-sonnet-4-20250514 -> { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
 */
export function parseModelId(modelId: string): ParsedModel {
  const registry = getProviderRegistry();

  // Check if starts with known provider or alias
  const parts = modelId.split('/');
  const firstPart = parts[0].toLowerCase();

  // Check aliases first
  const resolvedProvider = PROVIDER_ALIASES[firstPart] || firstPart;

  // Check if it's a known provider
  const provider = registry.getProvider(resolvedProvider);

  if (provider && parts.length > 1) {
    // Format: provider/model (or provider/org/model for openrouter)
    return {
      provider: provider.id,
      model: parts.slice(1).join('/'),
      fullId: `${provider.id}/${parts.slice(1).join('/')}`,
    };
  }

  // No provider prefix - try to infer from model name
  const inferredProvider = inferProvider(modelId);

  return {
    provider: inferredProvider,
    model: modelId,
    fullId: `${inferredProvider}/${modelId}`,
  };
}

/**
 * Infer provider from model name patterns
 */
function inferProvider(model: string): string {
  const m = model.toLowerCase();

  // Claude models -> Anthropic
  if (m.includes('claude')) return 'anthropic';

  // GPT models -> OpenAI
  if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) return 'openai';

  // Gemini models -> Google
  if (m.includes('gemini')) return 'google';

  // Llama, Qwen, etc. with size suffix -> likely Ollama
  if (m.includes(':') && (m.includes('llama') || m.includes('qwen') || m.includes('mistral') || m.includes('phi'))) {
    return 'ollama';
  }

  // DeepSeek
  if (m.includes('deepseek')) return 'deepseek';

  // Default to anthropic (most capable)
  return 'anthropic';
}

/**
 * Get the base URL and headers for a model
 */
export function getModelConfig(modelId: string): {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  engine: string;
} {
  const parsed = parseModelId(modelId);
  const registry = getProviderRegistry();
  const provider = registry.getProvider(parsed.provider);

  if (!provider) {
    throw new Error(`Unknown provider: ${parsed.provider}`);
  }

  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined;

  return {
    provider: provider.id,
    model: parsed.model,
    baseUrl: provider.baseUrl,
    apiKey,
    headers: provider.headers,
    engine: provider.engine,
  };
}

/**
 * Format model ID for display
 */
export function formatModelId(provider: string, model: string): string {
  return `${provider}/${model}`;
}

/**
 * Validate model ID format
 */
export function isValidModelId(modelId: string): boolean {
  try {
    const parsed = parseModelId(modelId);
    return !!parsed.provider && !!parsed.model;
  } catch {
    return false;
  }
}
