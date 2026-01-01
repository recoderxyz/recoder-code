/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageGenerationModel,
} from './types.js';
import { IMAGE_GENERATION_MODELS } from './types.js';

/**
 * OpenRouter Image Generator
 * Supports multiple image generation models through OpenRouter API
 */
export class OpenRouterImageGenerator {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: ImageGenerationModel;

  constructor(
    apiKey?: string,
    baseUrl?: string,
    defaultModel?: ImageGenerationModel,
  ) {
    this.apiKey =
      apiKey ||
      process.env['OPENROUTER_API_KEY'] ||
      process.env['OPENAI_API_KEY'] ||
      '';
    this.baseUrl =
      baseUrl ||
      process.env['OPENROUTER_IMAGE_BASE_URL'] ||
      'https://openrouter.ai/api/v1';
    this.defaultModel =
      defaultModel ||
      (process.env['OPENROUTER_IMAGE_MODEL'] as ImageGenerationModel) ||
      'dall-e-3';

    if (!this.apiKey) {
      throw new Error(
        'API key is required. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.',
      );
    }
  }

  /**
   * Generate images using OpenRouter API
   */
  async generate(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const model = options.model || this.defaultModel;
    const modelInfo = IMAGE_GENERATION_MODELS[model as ImageGenerationModel];

    if (!modelInfo) {
      throw new Error(
        `Unsupported model: ${model}. Supported models: ${Object.keys(IMAGE_GENERATION_MODELS).join(', ')}`,
      );
    }

    // Validate options against model capabilities
    this.validateOptions(options, modelInfo);

    // Use chat API for modern image models, legacy API for others
    if ('useChatAPI' in modelInfo && modelInfo.useChatAPI) {
      return this.generateWithChatAPI(options, model, modelInfo);
    } else {
      return this.generateWithImageAPI(options, model, modelInfo);
    }
  }

  /**
   * Generate images using chat completions API (for modern models)
   */
  private async generateWithChatAPI(
    options: ImageGenerationOptions,
    model: string,
    modelInfo: any,
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    
    // Build the prompt for image generation
    let prompt = `Generate an image: ${options.prompt}`;
    
    // Add size specification if provided
    if (options.size) {
      prompt += `\n\nImage size: ${options.size}`;
    }
    
    // Add style if provided
    if (options.style) {
      prompt += `\n\nStyle: ${options.style}`;
    }
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Image generation failed: ${response.status} ${response.statusText}. ${errorData.error?.message || JSON.stringify(errorData)}`,
        );
      }

      const result = await response.json();
      const endTime = Date.now();

      // Extract generation ID and cost from headers if available
      const generationId = response.headers.get('x-openrouter-generation-id');
      const cost = response.headers.get('x-openrouter-cost');

      // Parse the response to extract image data
      const images: any[] = [];
      
      // Check if the response contains image URLs or base64 data
      if (result.choices && result.choices.length > 0) {
        const message = result.choices[0].message;
        const content = message?.content;
        
        // Check if content has image data (some models return structured content)
        if (Array.isArray(content)) {
          // Handle structured content array
          for (const item of content) {
            if (item.type === 'image_url' && item.image_url) {
              images.push({
                url: typeof item.image_url === 'string' ? item.image_url : item.image_url.url,
                revised_prompt: options.prompt,
              });
            } else if (item.type === 'image' && item.source) {
              // Handle base64 image data
              images.push({
                b64_json: item.source.data,
                revised_prompt: options.prompt,
              });
            }
          }
        } else if (typeof content === 'string') {
          // Try to extract URLs from text content
          const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/gi;
          const urls = content.match(urlRegex);
          
          if (urls && urls.length > 0) {
            urls.forEach(url => {
              images.push({
                url: url,
                revised_prompt: options.prompt,
              });
            });
          } else {
            // No image data found in response
            console.warn('No image URLs found in response. Response content:', content);
            images.push({
              url: undefined,
              b64_json: undefined,
              revised_prompt: content,
              error: 'No image generated - model returned text only',
            });
          }
        }
      }
      
      // If no images were extracted, throw an error
      if (images.length === 0 || !images[0].url) {
        throw new Error(
          `Image generation returned no image data. The model may not support image generation via the chat API. ` +
          `Response: ${JSON.stringify(result.choices?.[0]?.message?.content || 'No content').substring(0, 200)}`
        );
      }

      return {
        data: images,
        model: model,
        metadata: {
          id: generationId || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          time: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Image generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate images using legacy image API (for DALL-E, etc.)
   */
  private async generateWithImageAPI(
    options: ImageGenerationOptions,
    model: string,
    modelInfo: any,
  ): Promise<ImageGenerationResult> {
    // Build request body
    const requestBody = this.buildRequestBody(options, model);

    // Make API request
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Image generation failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const result = await response.json();
      const endTime = Date.now();

      // Extract generation ID and cost from headers if available
      const generationId = response.headers.get('x-openrouter-generation-id');
      const cost = response.headers.get('x-openrouter-cost');

      return {
        data: result.data || [],
        model: model,
        metadata: {
          id: generationId || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          time: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Image generation failed: ${String(error)}`);
    }
  }

  /**
   * Validate options against model capabilities
   */
  private validateOptions(
    options: ImageGenerationOptions,
    modelInfo: any,
  ): void {
    // Validate size
    if (options.size && modelInfo.sizes && !(modelInfo.sizes as readonly string[]).includes(options.size)) {
      throw new Error(
        `Size ${options.size} not supported by ${modelInfo.name}. Supported sizes: ${(modelInfo.sizes as readonly string[]).join(', ')}`,
      );
    }

    // Validate quality
    if (options.quality && !('qualities' in modelInfo)) {
      console.warn(
        `Quality setting not supported by ${modelInfo.name}, ignoring.`,
      );
    }

    // Validate n (number of images)
    if (options.n && 'maxN' in modelInfo && options.n > (modelInfo.maxN as number)) {
      throw new Error(
        `Maximum ${modelInfo.maxN} images supported by ${modelInfo.name}, requested ${options.n}`,
      );
    }

    // Validate style
    if (options.style && !('supportsStyle' in modelInfo)) {
      console.warn(
        `Style setting not supported by ${modelInfo.name}, ignoring.`,
      );
    }

    // Validate negative prompt
    if (options.negativePrompt && !('supportsNegativePrompt' in modelInfo)) {
      console.warn(
        `Negative prompt not supported by ${modelInfo.name}, ignoring.`,
      );
    }

    // Validate seed
    if (options.seed !== undefined && !('supportsSeed' in modelInfo)) {
      console.warn(`Seed not supported by ${modelInfo.name}, ignoring.`);
    }

    // Validate steps
    if (options.steps && !('supportsSteps' in modelInfo)) {
      console.warn(`Steps not supported by ${modelInfo.name}, ignoring.`);
    }

    // Validate guidance scale
    if (options.guidanceScale && !('supportsGuidanceScale' in modelInfo)) {
      console.warn(
        `Guidance scale not supported by ${modelInfo.name}, ignoring.`,
      );
    }
  }

  /**
   * Build API request body
   */
  private buildRequestBody(
    options: ImageGenerationOptions,
    model: string,
  ): Record<string, any> {
    const body: Record<string, any> = {
      model: model,
      prompt: options.prompt,
    };

    // Add optional parameters
    if (options.size) {
      body.size = options.size;
    }

    if (options.quality) {
      body.quality = options.quality;
    }

    if (options.n) {
      body.n = options.n;
    }

    if (options.style) {
      body.style = options.style;
    }

    if (options.negativePrompt) {
      body.negative_prompt = options.negativePrompt;
    }

    if (options.seed !== undefined) {
      body.seed = options.seed;
    }

    if (options.steps) {
      body.steps = options.steps;
    }

    if (options.guidanceScale) {
      body.guidance_scale = options.guidanceScale;
    }

    // Request both URL and base64 for flexibility
    body.response_format = 'url'; // Can be 'url' or 'b64_json'

    return body;
  }

  /**
   * List available image generation models
   */
  static listModels(): Array<{
    id: ImageGenerationModel;
    name: string;
    provider: string;
    capabilities: string[];
  }> {
    return Object.entries(IMAGE_GENERATION_MODELS).map(([id, info]: [string, any]) => {
      const capabilities: string[] = [];
      
      if ('qualities' in info) capabilities.push('quality settings');
      if ('supportsStyle' in info) capabilities.push('style presets');
      if ('supportsNegativePrompt' in info) capabilities.push('negative prompts');
      if ('supportsSeed' in info) capabilities.push('reproducible seeds');
      if ('supportsSteps' in info) capabilities.push('inference steps control');
      if ('supportsGuidanceScale' in info) capabilities.push('guidance scale');
      if ('supportsRevision' in info) capabilities.push('prompt revision');

      return {
        id: id as ImageGenerationModel,
        name: info.name,
        provider: info.provider,
        capabilities,
      };
    });
  }

  /**
   * Get model information
   */
  static getModelInfo(modelId: ImageGenerationModel) {
    return IMAGE_GENERATION_MODELS[modelId];
  }
}
