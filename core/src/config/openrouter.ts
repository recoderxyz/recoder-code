/**
 * OpenRouter API Configuration for Recoder Code
 * Adapts the Gemini/Qwen architecture to use OpenRouter
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter model mappings
export const OPENROUTER_MODELS = {
  // Free models
  'deepseek-chat': 'deepseek/deepseek-chat',
  'deepseek-chat-v3': 'deepseek/deepseek-chat-v3.1:free',
  'qwen-coder': 'qwen/qwen-2.5-coder-32b-instruct',
  'llama-70b': 'meta-llama/llama-3.1-70b-instruct:free',
  'mistral-7b': 'mistralai/mistral-7b-instruct:free',
  
  // Premium models
  'gpt-4': 'openai/gpt-4-turbo',
  'gpt-4o': 'openai/gpt-4o',
  'claude-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-opus': 'anthropic/claude-3-opus',
  'gemini-pro': 'google/gemini-pro-1.5',
};

// Default model for Recoder Code
export const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-chat-v3.1:free';

export interface OpenRouterConfig {
  apiKey: string;
  baseURL?: string;
  siteName?: string;
  siteURL?: string;
  model?: string;
}

// Model listing filters
export interface ModelListFilters {
  category?: string;
  supported_parameters?: string[];
  use_rss?: boolean;
  use_rss_chat_links?: boolean;
}

// Model endpoint information
export interface ModelEndpoint {
  name: string;
  context_length: number;
  pricing: {
    request: string;
    image: string;
    prompt: string;
    completion: string;
  };
  provider_name: string;
  quantization: string | null;
  max_completion_tokens: number | null;
  max_prompt_tokens: number | null;
  supported_parameters: string[];
  status: string;
  uptime_last_30m: number | null;
}

export interface ModelEndpointsResponse {
  data: {
    id: string;
    name: string;
    created: number;
    description: string;
    architecture: {
      tokenizer: string | null;
      instruct_type: string | null;
      input_modalities: string[];
      output_modalities: string[];
    };
    endpoints: ModelEndpoint[];
  };
}

export function getOpenRouterConfig(): OpenRouterConfig {
  return {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
    siteName: process.env.OPENROUTER_SITE_NAME || 'Recoder-Code',
    siteURL: process.env.OPENROUTER_SITE_URL || 'https://github.com/recoder-code',
    model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
  };
}

export function validateOpenRouterConfig(config: OpenRouterConfig): boolean {
  if (!config.apiKey) {
    console.error('OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable.');
    return false;
  }
  return true;
}
