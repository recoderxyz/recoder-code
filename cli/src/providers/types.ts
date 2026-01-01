/**
 * AI Provider Types - Complete Multi-Provider System
 */

// Provider engine types (API compatibility)
export type ProviderEngine = 'openai' | 'anthropic' | 'ollama' | 'google';

export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  outputLimit?: number;
  isVision?: boolean;
  isFree?: boolean;
  size?: string;
  options?: Record<string, unknown>;
}

export interface CustomProviderConfig {
  id: string;
  name: string;
  engine: ProviderEngine;
  baseUrl: string;
  apiKeyEnv?: string; // Environment variable name for API key
  models: ProviderModel[];
  headers?: Record<string, string>;
  supportsStreaming?: boolean;
  isLocal?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  engine: ProviderEngine;
  baseUrl: string;
  apiKeyEnv?: string;
  isLocal: boolean;
  isEnabled: boolean;
  isBuiltin: boolean;
  models?: ProviderModel[];
  headers?: Record<string, string>;
  supportsStreaming?: boolean;
}

export interface ProvidersConfig {
  version: string;
  defaultProvider: string;
  defaultModel: string;
  customProviders: CustomProviderConfig[];
  lastUpdated: string;
}

export interface AuthConfig {
  version: string;
  credentials: Record<string, string>; // provider-id -> encrypted key or env var reference
  lastUpdated: string;
}

// Ollama types
export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

// Built-in provider definitions
export const BUILTIN_PROVIDERS: AIProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    engine: 'ollama',
    baseUrl: 'http://localhost:11434',
    isLocal: true,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    engine: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    isLocal: true,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp (Local)',
    engine: 'openai',
    baseUrl: 'http://localhost:8080/v1',
    isLocal: true,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    engine: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    engine: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    engine: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    engine: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    engine: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GOOGLE_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    engine: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    engine: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    engine: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiKeyEnv: 'FIREWORKS_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    engine: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    isLocal: false,
    isEnabled: true,
    isBuiltin: true,
    supportsStreaming: true,
  },
];

// Provider aliases for convenience
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
