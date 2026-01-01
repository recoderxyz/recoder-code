import type OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DefaultOpenAICompatibleProvider } from './default.js';
import type { 
  ChatCompletionContentPartWithCache,
  ChatCompletionToolWithCache 
} from './types.js';
import type { OpenRouterAdvancedOptions } from '../../openrouter-features.js';

/**
 * Provider routing preferences
 */
export interface ProviderRouting {
  // Preferred order of providers
  order?: string[];
  
  // Only use these providers
  allow_fallbacks?: boolean;
  
  // Allow specific providers
  allow?: string[];
  
  // Deny specific providers
  deny?: string[];
  
  // Data collection preference
  data_collection?: 'deny' | 'allow';
  
  // Quantization preferences
  quantizations?: string[];
  
  // Require specific parameters
  require_parameters?: boolean;
}

/**
 * OpenRouter configuration options
 */
export interface OpenRouterConfig {
  // Model fallback chain for reliability (these are alternative models to try)
  modelFallbacks?: string[];
  
  // Message transforms for context window optimization
  messageTransforms?: ('middle-out' | string)[];
  
  // Provider preferences (order, allow, deny)
  providerPreferences?: ProviderRouting;
  
  // Route to best model automatically
  // 'fallback' = OpenRouter picks best available provider
  route?: 'fallback';
  
  // Enable request moderation
  moderation?: boolean;
  
  // Track generation lineage
  generationId?: string;
  
  // Enable automatic middle-out for long contexts
  autoMiddleOut?: boolean;

  // Advanced features
  advancedOptions?: OpenRouterAdvancedOptions;
}

export class OpenRouterOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
  private openRouterConfig: OpenRouterConfig;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
    openRouterConfig?: OpenRouterConfig,
  ) {
    super(contentGeneratorConfig, cliConfig);
    
    // Initialize openRouterConfig with minimal required fields first
    this.openRouterConfig = {
      autoMiddleOut: openRouterConfig?.autoMiddleOut ?? true,
      moderation: openRouterConfig?.moderation ?? false,
      generationId: openRouterConfig?.generationId,
      ...openRouterConfig,
    };
    
    // Now populate fields that depend on methods accessing this.openRouterConfig
    this.openRouterConfig.modelFallbacks = openRouterConfig?.modelFallbacks || this.getDefaultFallbacks();
    this.openRouterConfig.messageTransforms = openRouterConfig?.messageTransforms || this.getDefaultTransforms();
    this.openRouterConfig.providerPreferences = openRouterConfig?.providerPreferences || this.getProviderPreferences();
  }

  static isOpenRouterProvider(
    contentGeneratorConfig: ContentGeneratorConfig,
  ): boolean {
    const baseURL = contentGeneratorConfig.baseUrl || '';
    return baseURL.includes('openrouter.ai');
  }

  /**
   * Get default fallback models based on current model
   * Provides automatic failover for reliability
   */
  private getDefaultFallbacks(): string[] | undefined {
    const model = this.contentGeneratorConfig.model;
    
    // Don't set fallbacks for free models (they're already fallback tier)
    if (model.includes(':free')) {
      return undefined;
    }
    
    // Anthropic Claude fallbacks
    if (model.includes('claude-3.5-sonnet')) {
      return ['anthropic/claude-3-haiku', 'anthropic/claude-3-haiku:free'];
    }
    if (model.includes('claude-3-opus')) {
      return ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku'];
    }
    
    // OpenAI fallbacks
    if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
      return ['openai/gpt-4', 'openai/gpt-3.5-turbo'];
    }
    if (model.includes('o1-preview')) {
      return ['openai/o1-mini', 'openai/gpt-4-turbo'];
    }
    
    // Google Gemini fallbacks
    if (model.includes('gemini-pro-1.5')) {
      return ['google/gemini-2.0-flash-exp', 'google/gemini-2.0-flash-exp:free'];
    }
    
    // No specific fallbacks for this model
    return undefined;
  }

  /**
   * Get provider preferences from environment or config
   * Allows users to control which providers to use and how OpenRouter routes requests
   */
  private getProviderPreferences(): ProviderRouting | undefined {
    const orderEnv = process.env['OPENROUTER_PROVIDER_ORDER'];
    const allowEnv = process.env['OPENROUTER_PROVIDER_ALLOW'];
    const denyEnv = process.env['OPENROUTER_PROVIDER_DENY'];
    const dataCollectionEnv = process.env['OPENROUTER_DATA_COLLECTION'];
    const allowFallbacksEnv = process.env['OPENROUTER_ALLOW_FALLBACKS'];
    const quantizationsEnv = process.env['OPENROUTER_QUANTIZATIONS'];
    const requireParamsEnv = process.env['OPENROUTER_REQUIRE_PARAMETERS'];
    
    const preferences: ProviderRouting = {};
    
    // Provider order preference
    if (orderEnv) {
      preferences.order = orderEnv.split(',').map(p => p.trim());
    }
    
    // Allow fallbacks (default: true for reliability)
    if (allowFallbacksEnv !== undefined) {
      preferences.allow_fallbacks = allowFallbacksEnv.toLowerCase() === 'true';
    }
    
    // Allow specific providers
    if (allowEnv) {
      preferences.allow = allowEnv.split(',').map(p => p.trim());
    }
    
    // Deny specific providers
    if (denyEnv) {
      preferences.deny = denyEnv.split(',').map(p => p.trim());
    }
    
    // Data collection preference (privacy)
    if (dataCollectionEnv) {
      const value = dataCollectionEnv.toLowerCase();
      if (value === 'deny' || value === 'allow') {
        preferences.data_collection = value;
      }
    }
    
    // Quantization preferences (e.g., for smaller models)
    if (quantizationsEnv) {
      preferences.quantizations = quantizationsEnv.split(',').map(q => q.trim());
    }
    
    // Require parameters (stricter matching)
    if (requireParamsEnv !== undefined) {
      preferences.require_parameters = requireParamsEnv.toLowerCase() === 'true';
    }
    
    // Return undefined if no preferences set
    return Object.keys(preferences).length > 0 ? preferences : undefined;
  }

  /**
   * Get default message transforms based on model and configuration
   * Middle-out compression is enabled by default for better UX
   */
  private getDefaultTransforms(): ('middle-out' | string)[] | undefined {
    // Check environment variable
    const transformsEnv = process.env['OPENROUTER_TRANSFORMS'];
    if (transformsEnv) {
      if (transformsEnv === 'none' || transformsEnv === '[]') {
        return []; // Explicitly disable transforms
      }
      return transformsEnv.split(',').map(t => t.trim());
    }
    
    // Default: Enable middle-out for all models
    // This prevents context window errors and improves reliability
    // OpenRouter automatically applies it intelligently
    if (this.openRouterConfig.autoMiddleOut !== false) {
      return ['middle-out'];
    }
    
    return undefined;
  }

  /**
   * Check if model has small context window (≤8K)
   * These models automatically get middle-out by OpenRouter
   */
  private hasSmallContextWindow(): boolean {
    const model = this.contentGeneratorConfig.model.toLowerCase();
    
    // Known small context models
    const smallContextModels = [
      'gpt-3.5-turbo', 
      'claude-instant',
      'llama-2-7b',
      'llama-2-13b',
    ];
    
    return smallContextModels.some(m => model.includes(m));
  }

  /**
   * Determine if we should use automatic routing (fallback mode)
   * This lets OpenRouter pick the best available provider
   */
  private shouldUseAutoRouting(): boolean {
    // Check environment variable
    const autoRouteEnv = process.env['OPENROUTER_AUTO_ROUTE'];
    if (autoRouteEnv !== undefined) {
      return autoRouteEnv.toLowerCase() === 'true';
    }
    
    // Check if explicitly configured
    if (this.openRouterConfig.route === 'fallback') {
      return true;
    }
    
    // Default: Use auto-routing for reliability
    // OpenRouter will pick the best available provider automatically
    // This is especially useful during outages or rate limiting
    return true;
  }

  /**
   * Check if the current model supports prompt caching
   * Anthropic Claude models on OpenRouter support prompt caching
   */
  private supportsPromptCaching(): boolean {
    const model = this.contentGeneratorConfig.model.toLowerCase();
    return model.includes('claude') && model.includes('anthropic');
  }

  override buildHeaders(): Record<string, string | undefined> {
    // Get base headers from parent class
    const baseHeaders = super.buildHeaders();

    // Add OpenRouter-specific headers
    const headers: Record<string, string | undefined> = {
      ...baseHeaders,
      'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
      'X-Title': 'Qwen Code',
    };

    // Enable prompt caching for compatible models
    if (this.supportsPromptCaching()) {
      headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
    }

    return headers;
  }

  override buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    // Get base request from parent
    const baseRequest = super.buildRequest(request, userPromptId);

    // Build enhanced request with OpenRouter features
    let enhancedRequest: any = { ...baseRequest };

    // Add message transforms (middle-out compression for long contexts)
    if (this.openRouterConfig.messageTransforms && this.openRouterConfig.messageTransforms.length > 0) {
      enhancedRequest.transforms = this.openRouterConfig.messageTransforms;
    }

    // Add model fallbacks for reliability
    // Note: This uses the 'models' parameter (array) for fallback models
    if (this.openRouterConfig.modelFallbacks && this.openRouterConfig.modelFallbacks.length > 0) {
      // Include primary model + fallbacks
      enhancedRequest.models = [
        this.contentGeneratorConfig.model,
        ...this.openRouterConfig.modelFallbacks
      ];
      // Remove single 'model' parameter when using 'models' array
      delete enhancedRequest.model;
    }

    // Add provider routing preferences
    if (this.openRouterConfig.providerPreferences) {
      enhancedRequest.provider = this.openRouterConfig.providerPreferences;
    }

    // Add automatic routing (let OpenRouter pick best provider)
    // This is enabled by default for maximum reliability
    if (this.shouldUseAutoRouting()) {
      enhancedRequest.route = 'fallback';
    }

    // Add moderation if enabled
    if (this.openRouterConfig.moderation) {
      enhancedRequest.moderation = true;
    }

    // Add generation ID for tracking request lineage
    if (this.openRouterConfig.generationId) {
      enhancedRequest.generationId = this.openRouterConfig.generationId;
    }

    // Apply prompt caching if supported
    if (this.supportsPromptCaching()) {
      enhancedRequest = this.applyPromptCaching(enhancedRequest);
    }

    // Apply advanced features if configured
    if (this.openRouterConfig.advancedOptions) {
      enhancedRequest = this.applyAdvancedFeatures(enhancedRequest);
    }

    return enhancedRequest;
  }

  /**
   * Apply advanced OpenRouter features to the request
   */
  private applyAdvancedFeatures(
    request: OpenAI.Chat.ChatCompletionCreateParams,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    const options = this.openRouterConfig.advancedOptions;
    if (!options) return request;

    const enhancedRequest: any = { ...request };

    // Zero Data Retention (ZDR)
    if (options.zeroDataRetention) {
      enhancedRequest['x-openrouter-config'] = {
        ...enhancedRequest['x-openrouter-config'],
        zero_data_retention: true,
      };
    }

    // Structured Outputs
    if (options.structuredOutput) {
      enhancedRequest.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: options.structuredOutput,
        },
      };
    }

    // Web Search
    if (options.webSearch?.enabled) {
      enhancedRequest['x-openrouter-config'] = {
        ...enhancedRequest['x-openrouter-config'],
        web_search: {
          enabled: true,
          max_results: options.webSearch.max_results || 5,
          ...(options.webSearch.time_range && { time_range: options.webSearch.time_range }),
        },
      };
    }

    // Zero Completion Insurance
    if (options.zeroCompletionInsurance) {
      enhancedRequest['x-openrouter-config'] = {
        ...enhancedRequest['x-openrouter-config'],
        zero_completion_insurance: true,
      };
    }

    // User tracking
    if (options.userId) {
      enhancedRequest['x-openrouter-user-id'] = options.userId;
    }

    // Parent generation tracking
    if (options.parentGenerationId) {
      enhancedRequest.parent_generation_id = options.parentGenerationId;
    }

    return enhancedRequest;
  }

  /**
   * Apply prompt caching to the request
   * Caches system messages, early context, and tools for cost optimization
   */
  private applyPromptCaching(
    request: OpenAI.Chat.ChatCompletionCreateParams,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    const messages = [...request.messages];
    const tools = request.tools ? [...request.tools] : undefined;

    // Cache system message if present (highest priority)
    if (messages.length > 0 && messages[0].role === 'system') {
      const systemMessage = messages[0];
      if (typeof systemMessage.content === 'string') {
        // Simple string content - convert to array with cache_control
        const contentWithCache: any = [
          {
            type: 'text',
            text: systemMessage.content,
            cache_control: { type: 'ephemeral' },
          },
        ];
        messages[0] = {
          ...systemMessage,
          content: contentWithCache,
        };
      } else if (Array.isArray(systemMessage.content)) {
        // Array content - mark last text part for caching
        const content: any[] = [...systemMessage.content];
        const lastIndex = content.length - 1;
        if (lastIndex >= 0 && content[lastIndex].type === 'text') {
          content[lastIndex] = {
            ...content[lastIndex],
            cache_control: { type: 'ephemeral' },
          };
        }
        messages[0] = {
          ...systemMessage,
          content,
        };
      }
    }

    // Cache early context messages (first 3 user/assistant messages)
    // This helps with long conversations where early context is reused
    let contextMessageCount = 0;
    const maxContextMessages = 3;
    for (let i = 1; i < messages.length && contextMessageCount < maxContextMessages; i++) {
      const message = messages[i];
      if (message.role === 'user' || message.role === 'assistant') {
        contextMessageCount++;
        
        if (typeof message.content === 'string') {
          const contentWithCache: any = [
            {
              type: 'text',
              text: message.content,
              cache_control: { type: 'ephemeral' },
            },
          ];
          messages[i] = {
            ...message,
            content: contentWithCache,
          };
        } else if (Array.isArray(message.content)) {
          const content: any[] = [...message.content];
          const lastIndex = content.length - 1;
          if (lastIndex >= 0 && content[lastIndex].type === 'text') {
            content[lastIndex] = {
              ...content[lastIndex],
              cache_control: { type: 'ephemeral' },
            };
          }
          messages[i] = {
            ...message,
            content,
          };
        }
      }
    }

    // Cache tools if present (very cost-effective for repeated tool usage)
    let cachedTools: any[] | undefined;
    if (tools && tools.length > 0) {
      cachedTools = tools.map((tool, index) => {
        // Cache the last tool definition (most likely to be reused)
        if (index === tools.length - 1) {
          return {
            ...tool,
            cache_control: { type: 'ephemeral' },
          };
        }
        return tool;
      });
    }

    return {
      ...request,
      messages: messages as any,
      ...(cachedTools && { tools: cachedTools }),
    };
  }
}

