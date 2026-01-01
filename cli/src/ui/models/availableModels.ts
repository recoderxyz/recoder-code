/**
 * @license
 * Copyright 2025 Recoder
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCustomModels } from './customModels.js';

export type AvailableModel = {
  id: string;
  label: string;
  isVision?: boolean;
  isFree?: boolean;
  contextLength?: string;
};

export const MAINLINE_VLM = 'vision-model';
export const MAINLINE_CODER = 'coder-model';

export const AVAILABLE_MODELS_RECODER: AvailableModel[] = [
  { id: MAINLINE_CODER, label: MAINLINE_CODER },
  { id: MAINLINE_VLM, label: MAINLINE_VLM, isVision: true },
];

/**
 * Top free OpenRouter models with tool calling support
 */
export const AVAILABLE_MODELS_OPENROUTER_FREE: AvailableModel[] = [
  {
    id: 'qwen/qwen3-coder:free',
    label: 'Qwen3 Coder 480B (Free) - Best for Coding',
    contextLength: '262K',
    isFree: true,
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    label: 'GLM-4.5 Air (Free) - Agent Tasks',
    contextLength: '131K',
    isFree: true,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash (Free) - Vision',
    contextLength: '1M',
    isVision: true,
    isFree: true,
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    label: 'DeepSeek V3 (Free) - Reasoning',
    contextLength: '164K',
    isFree: true,
  },
  {
    id: 'qwen/qwen3-235b-a22b:free',
    label: 'Qwen3 235B (Free) - Multilingual',
    contextLength: '131K',
    isFree: true,
  },
  {
    id: 'alibaba/tongyi-deepresearch-30b-a3b:free',
    label: 'Tongyi DeepResearch (Free) - Research',
    contextLength: '131K',
    isFree: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B (Free) - General',
    contextLength: '66K',
    isFree: true,
  },
  {
    id: 'mistralai/mistral-small-3.2-24b:free',
    label: 'Mistral Small 3.2 (Free) - Vision',
    contextLength: '131K',
    isVision: true,
    isFree: true,
  },
];

/**
 * Get available Recoder models filtered by vision model preview setting
 */
export function getFilteredRecoderModels(
  visionModelPreviewEnabled: boolean,
): AvailableModel[] {
  if (visionModelPreviewEnabled) {
    return AVAILABLE_MODELS_RECODER;
  }
  return AVAILABLE_MODELS_RECODER.filter((model) => !model.isVision);
}

/**
 * Get available OpenRouter models
 * Returns the free models list PLUS custom models PLUS the current model from env if it's different
 */
export function getOpenRouterAvailableModels(): AvailableModel[] {
  const baseUrl = process.env['OPENAI_BASE_URL'] || '';
  const apiKey = process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY'];
  const currentModelId = process.env['OPENAI_MODEL']?.trim();

  // Check if OpenRouter is configured
  if (baseUrl.includes('openrouter') && apiKey) {
    const models = [...AVAILABLE_MODELS_OPENROUTER_FREE];

    // Add custom models from storage
    try {
      const customModels = getCustomModels();
      if (customModels && customModels.length > 0) {
        models.push(...customModels);
      }
    } catch (error) {
      // If custom models can't be loaded, continue without them
      console.warn('Failed to load custom models:', error);
    }

    // Add the current model if it's not in the list already
    if (currentModelId) {
      const isInList = models.some(m => m.id === currentModelId);
      if (!isInList) {
        models.unshift({
          id: currentModelId,
          label: `${currentModelId} (Custom)`,
          contextLength: 'N/A',
        });
      }
    }

    return models;
  }

  return [];
}

/**
 * Currently we use the single model of `OPENAI_MODEL` in the env.
 * In the future, after settings.json is updated, we will allow users to configure this themselves.
 */
export function getOpenAIAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['OPENAI_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

/**
 * Get all available OpenAI/OpenRouter models
 * This includes both the current model from env and the free OpenRouter models
 */
export function getOpenAIAvailableModels(): AvailableModel[] {
  const baseUrl = process.env['OPENAI_BASE_URL'] || '';
  
  // If OpenRouter is configured, return free models
  if (baseUrl.includes('openrouter')) {
    return getOpenRouterAvailableModels();
  }
  
  // Otherwise, return current model if configured
  const currentModel = getOpenAIAvailableModelFromEnv();
  return currentModel ? [currentModel] : [];
}

/**
/**
 * Hard code the default vision model as a string literal,
 * until our coding model supports multimodal.
 */
export function getDefaultVisionModel(): string {
  return MAINLINE_VLM;
}

export function isVisionModel(modelId: string): boolean {
  return AVAILABLE_MODELS_RECODER.some(
    (model) => model.id === modelId && model.isVision,
  );
}
