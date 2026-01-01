/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Recoder Code - OpenRouter Models
// Using models that support tool calling with OpenRouter
export const DEFAULT_RECODER_MODEL = 'google/gemini-2.0-flash-exp:free'; // Free and supports tools
export const DEFAULT_RECODER_FAST_MODEL = 'google/gemini-2.0-flash-exp:free';

// Legacy compatibility
export const DEFAULT_QWEN_MODEL = DEFAULT_RECODER_MODEL;
export const DEFAULT_QWEN_FLASH_MODEL = DEFAULT_RECODER_FAST_MODEL;

export const DEFAULT_GEMINI_MODEL = DEFAULT_RECODER_MODEL;
export const DEFAULT_GEMINI_FLASH_MODEL = DEFAULT_RECODER_FAST_MODEL;
export const DEFAULT_GEMINI_FLASH_LITE_MODEL = DEFAULT_RECODER_FAST_MODEL;

export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'text-embedding-3-small';
