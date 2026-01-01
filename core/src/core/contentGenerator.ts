/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import type { Config } from '../config/config.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_QWEN_MODEL } from '../config/models.js';

import type { UserTierId } from '../code_assist/types.js';
import { InstallationManager } from '../utils/installationManager.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai',
  QWEN_OAUTH = 'qwen-oauth',
  RECODER_AUTH = 'recoder-auth',
  USE_OLLAMA = 'ollama',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  enableOpenAILogging?: boolean;
  // Timeout configuration in milliseconds
  timeout?: number;
  // Maximum retries for failed requests
  maxRetries?: number;
  // Disable cache control for DashScope providers
  disableCacheControl?: boolean;
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  proxy?: string | undefined;
  userAgent?: string;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env['GEMINI_API_KEY'] || undefined;
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;

  // OpenRouter - PRIMARY default
  const openrouterApiKey = process.env['OPENROUTER_API_KEY'] || undefined;
  const openrouterBaseUrl = 'https://openrouter.ai/api/v1';
  const openrouterModel = process.env['OPENROUTER_MODEL'] || 'anthropic/claude-sonnet-4';

  // OpenAI auth (fallback)
  const openaiApiKey = process.env['OPENAI_API_KEY'] || undefined;
  const openaiBaseUrl = process.env['OPENAI_BASE_URL'] || undefined;
  const openaiModel = process.env['OPENAI_MODEL'] || undefined;

  // Ollama detection
  const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';

  // Use runtime model from config if available
  const effectiveModel = config.getModel() || (openrouterApiKey ? openrouterModel : DEFAULT_GEMINI_MODEL);

  // Auto-detect provider from model ID (e.g., ollama/llama3.1:8b)
  if (effectiveModel.startsWith('ollama/')) {
    authType = AuthType.USE_OLLAMA;
  } else if (effectiveModel.startsWith('openrouter/') || openrouterApiKey) {
    authType = AuthType.USE_OPENAI;
  }

  // OpenRouter is PRIMARY - auto-configure if key exists
  if (openrouterApiKey && !openaiApiKey) {
    // Set OpenRouter as the OpenAI-compatible endpoint
    process.env['OPENAI_API_KEY'] = openrouterApiKey;
    process.env['OPENAI_BASE_URL'] = openrouterBaseUrl;
  }

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
    enableOpenAILogging: config.getEnableOpenAILogging(),
    timeout: config.getContentGeneratorTimeout(),
    maxRetries: config.getContentGeneratorMaxRetries(),
    disableCacheControl: config.getContentGeneratorDisableCacheControl(),
    samplingParams: config.getContentGeneratorSamplingParams(),
  };

  // Ollama - local AI
  if (authType === AuthType.USE_OLLAMA) {
    contentGeneratorConfig.baseUrl = ollamaBaseUrl;
    return contentGeneratorConfig;
  }

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_OPENAI) {
    // OpenRouter takes priority, then OpenAI
    const apiKey = openrouterApiKey || openaiApiKey;
    const baseUrl = openrouterApiKey ? openrouterBaseUrl : openaiBaseUrl;
    const model = openrouterApiKey ? openrouterModel : (openaiModel || effectiveModel);

    if (apiKey) {
      contentGeneratorConfig.apiKey = apiKey;
      contentGeneratorConfig.baseUrl = baseUrl;
      contentGeneratorConfig.model = model;
      return contentGeneratorConfig;
    }
  }

  if (authType === AuthType.QWEN_OAUTH || authType === AuthType.RECODER_AUTH) {
    // For OAuth-based auth, check if we have API key set
    // This handles the case where Recoder auth has set OPENAI_API_KEY
    if (openaiApiKey && openaiBaseUrl) {
      contentGeneratorConfig.apiKey = openaiApiKey;
      contentGeneratorConfig.baseUrl = openaiBaseUrl;
      contentGeneratorConfig.model = openaiModel || effectiveModel || DEFAULT_QWEN_MODEL;
      return contentGeneratorConfig;
    }
    
    // Otherwise use the OAuth dynamic token approach
    contentGeneratorConfig.apiKey = 'OAUTH_DYNAMIC_TOKEN';
    contentGeneratorConfig.model =
      process.env['QWEN_MODEL'] || process.env['RECODER_MODEL'] || DEFAULT_QWEN_MODEL;

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  if (config.authType === AuthType.USE_OLLAMA) {
    // Import OllamaContentGenerator dynamically
    const { createOllamaContentGenerator } = await import('./ollamaContentGenerator.js');
    return new LoggingContentGenerator(createOllamaContentGenerator(config), gcConfig);
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationManager = new InstallationManager();
      const installationId = installationManager.getInstallationId();
      headers = {
        ...headers,
        'x-gemini-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }

  if (config.authType === AuthType.USE_OPENAI) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );

    // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
    return createOpenAIContentGenerator(config, gcConfig);
  }

  if (config.authType === AuthType.QWEN_OAUTH || config.authType === AuthType.RECODER_AUTH) {
    // Check if we have API key and baseUrl set (Recoder auth flow)
    if (config.apiKey && config.apiKey !== 'OAUTH_DYNAMIC_TOKEN' && config.baseUrl) {
      // Use OpenAI generator with Recoder/OpenRouter API
      const { createOpenAIContentGenerator } = await import(
        './openaiContentGenerator/index.js'
      );
      return createOpenAIContentGenerator(config, gcConfig);
    }
    
    // Otherwise use the OAuth flow for Qwen
    // Import required classes dynamically
    const { getQwenOAuthClient: getQwenOauthClient } = await import(
      '../qwen/qwenOAuth2.js'
    );
    const { QwenContentGenerator } = await import(
      '../qwen/qwenContentGenerator.js'
    );

    try {
      // Get the OAuth client (now includes integrated token management)
      const qwenClient = await getQwenOauthClient(gcConfig);

      // Create the content generator with dynamic token management
      return new QwenContentGenerator(qwenClient, config, gcConfig);
    } catch (error) {
      throw new Error(
        `Failed to initialize authentication: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
