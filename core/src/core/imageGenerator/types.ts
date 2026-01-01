/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  /** The text prompt to generate the image from */
  prompt: string;
  
  /** Model to use for generation */
  model?: string;
  
  /** Size of the generated image */
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | '1440x1440' | '768x1024' | '1024x768';
  
  /** Quality of the generated image (for supported models) */
  quality?: 'standard' | 'hd';
  
  /** Number of images to generate */
  n?: number;
  
  /** Style preset (for supported models) */
  style?: 'vivid' | 'natural';
  
  /** Negative prompt (for supported models) */
  negativePrompt?: string;
  
  /** Seed for reproducibility (for supported models) */
  seed?: number;
  
  /** Number of inference steps (for supported models) */
  steps?: number;
  
  /** Guidance scale/CFG scale (for supported models) */
  guidanceScale?: number;
}

/**
 * Single generated image
 */
export interface GeneratedImage {
  /** URL to the generated image (if available) */
  url?: string;
  
  /** Base64-encoded image data (if available) */
  b64_json?: string;
  
  /** Revised prompt used (if available) */
  revised_prompt?: string;
  
  /** Seed used for generation (if available) */
  seed?: number;
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  /** Generated images */
  data: GeneratedImage[];
  
  /** Model used for generation */
  model?: string;
  
  /** Generation metadata */
  metadata?: {
    /** Generation ID for tracking */
    id?: string;
    
    /** Total cost */
    cost?: number;
    
    /** Generation time in seconds */
    time?: number;
  };
}

/**
 * Supported image generation models
 */
export const IMAGE_GENERATION_MODELS = {
  // OpenAI Image Models (via OpenRouter chat completions)
  'openai/gpt-5-image-mini': {
    name: 'GPT-5 Image Mini',
    provider: 'OpenAI',
    sizes: ['1024x1024', '1792x1024', '1024x1792'],
    maxN: 1,
    useChatAPI: true,
  },
  'openai/gpt-5-image': {
    name: 'GPT-5 Image',
    provider: 'OpenAI',
    sizes: ['1024x1024', '1792x1024', '1024x1792'],
    maxN: 1,
    useChatAPI: true,
  },
  
  // Google Image Models (via OpenRouter chat completions)
  'google/gemini-2.5-flash-image': {
    name: 'Gemini 2.5 Flash Image (Nano Banana)',
    provider: 'Google',
    sizes: ['1024x1024', '1440x1440'],
    maxN: 1,
    useChatAPI: true,
  },
  'google/gemini-2.5-flash-image-preview': {
    name: 'Gemini 2.5 Flash Image Preview',
    provider: 'Google',
    sizes: ['1024x1024', '1440x1440'],
    maxN: 1,
    useChatAPI: true,
  },
  
  // Legacy OpenAI models (direct image API)
  'dall-e-3': {
    name: 'DALL-E 3',
    provider: 'OpenAI',
    sizes: ['1024x1024', '1792x1024', '1024x1792'],
    qualities: ['standard', 'hd'],
    maxN: 1,
    supportsRevision: true,
    supportsStyle: true,
    useChatAPI: false,
  },
  'dall-e-2': {
    name: 'DALL-E 2',
    provider: 'OpenAI',
    sizes: ['256x256', '512x512', '1024x1024'],
    maxN: 10,
    supportsRevision: false,
    useChatAPI: false,
  },
} as const;

export type ImageGenerationModel = keyof typeof IMAGE_GENERATION_MODELS;
