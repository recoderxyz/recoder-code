/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './src/index.js';
export { Storage } from './src/config/storage.js';
export {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
} from './src/config/models.js';
export { logIdeConnection } from './src/telemetry/loggers.js';
export {
  IdeConnectionEvent,
  IdeConnectionType,
} from './src/telemetry/types.js';
// export { makeFakeConfig } from './src/test-utils/config.js'; // Test utility - excluded from build
export * from './src/utils/pathReader.js';
export * from './src/utils/request-tokenizer/supportedImageFormats.js';

// OpenRouter exports
export { OpenRouterClient, getOpenRouterClient } from './src/core/openrouter-client.js';
export * from './src/config/openrouter.js';

// Cost tracking exports
export { getCostTracker, resetCostTracker, CostTracker } from './src/utils/costTracker.js';
export type { UsageRecord, SessionStats, CostBudget } from './src/utils/costTracker.js';
export * from './src/utils/modelPricing.js';
