/**
 * @license
 * Copyright 2025 Recoder
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AvailableModel } from './availableModels.js';

const CUSTOM_MODELS_FILE = path.join(os.homedir(), '.recoder-code', 'custom-models.json');

/**
 * Storage structure for custom models
 */
interface CustomModelsStorage {
  version: string;
  models: AvailableModel[];
  lastUpdated: string;
}

/**
 * Ensure the custom models file directory exists
 */
function ensureCustomModelsDir(): void {
  const dir = path.dirname(CUSTOM_MODELS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load custom models from storage
 */
function loadCustomModelsStorage(): CustomModelsStorage {
  ensureCustomModelsDir();
  
  if (!fs.existsSync(CUSTOM_MODELS_FILE)) {
    return {
      version: '1.0.0',
      models: [],
      lastUpdated: new Date().toISOString(),
    };
  }
  
  try {
    const content = fs.readFileSync(CUSTOM_MODELS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load custom models:', error);
    return {
      version: '1.0.0',
      models: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save custom models to storage
 */
function saveCustomModelsStorage(storage: CustomModelsStorage): void {
  ensureCustomModelsDir();
  
  storage.lastUpdated = new Date().toISOString();
  
  try {
    fs.writeFileSync(
      CUSTOM_MODELS_FILE,
      JSON.stringify(storage, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Failed to save custom models:', error);
    throw new Error('Failed to save custom models to disk');
  }
}

/**
 * Get all custom models
 */
export function getCustomModels(): AvailableModel[] {
  const storage = loadCustomModelsStorage();
  return storage.models;
}

/**
 * List all custom models (alias for getCustomModels)
 */
export function listCustomModels(): AvailableModel[] {
  return getCustomModels();
}

/**
 * Add a custom model
 * @param modelId The OpenRouter model ID (e.g., "anthropic/claude-3-opus-20240229")
 * @param label Optional custom label (will auto-generate if not provided)
 * @param options Optional model options (context length, vision support, etc.)
 */
export function addCustomModel(
  modelId: string,
  label?: string,
  options?: {
    contextLength?: string;
    isVision?: boolean;
    isFree?: boolean;
  }
): AvailableModel {
  const storage = loadCustomModelsStorage();
  
  // Check if model already exists
  const existingIndex = storage.models.findIndex(m => m.id === modelId);
  
  // Generate label if not provided
  const modelLabel = label || generateModelLabel(modelId);
  
  const newModel: AvailableModel = {
    id: modelId,
    label: modelLabel,
    contextLength: options?.contextLength,
    isVision: options?.isVision,
    isFree: options?.isFree ?? false,
  };
  
  if (existingIndex >= 0) {
    // Update existing model
    storage.models[existingIndex] = newModel;
  } else {
    // Add new model
    storage.models.push(newModel);
  }
  
  saveCustomModelsStorage(storage);
  return newModel;
}

/**
 * Remove a custom model
 * @param modelId The model ID to remove
 * @returns true if removed, false if not found
 */
export function removeCustomModel(modelId: string): boolean {
  const storage = loadCustomModelsStorage();
  const initialLength = storage.models.length;
  
  storage.models = storage.models.filter(m => m.id !== modelId);
  
  if (storage.models.length < initialLength) {
    saveCustomModelsStorage(storage);
    return true;
  }
  
  return false;
}

/**
 * Clear all custom models
 */
export function clearCustomModels(): void {
  const storage = loadCustomModelsStorage();
  storage.models = [];
  saveCustomModelsStorage(storage);
}

/**
 * Check if a model is a custom model
 */
export function isCustomModel(modelId: string): boolean {
  const storage = loadCustomModelsStorage();
  return storage.models.some(m => m.id === modelId);
}

/**
 * Generate a human-readable label from a model ID
 * @param modelId The model ID (e.g., "anthropic/claude-3-opus-20240229")
 * @returns A formatted label
 */
function generateModelLabel(modelId: string): string {
  // Split by provider and model name
  const parts = modelId.split('/');
  if (parts.length !== 2) {
    return modelId;
  }
  
  const [provider, modelName] = parts;
  
  // Capitalize provider name
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  
  // Format model name (remove dates, underscores, etc.)
  let formattedName = modelName
    .replace(/-\d{8}$/, '') // Remove date suffix like -20240229
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .split(' ')
    .map(word => {
      // Capitalize known acronyms
      if (['gpt', 'api', 'ai', 'ml', 'llm'].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  return `${providerLabel} ${formattedName} 🔧`;
}

/**
 * Get the path to the custom models file (for debugging)
 */
export function getCustomModelsFilePath(): string {
  return CUSTOM_MODELS_FILE;
}

/**
 * Import models from a JSON file
 */
export function importCustomModels(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imported = JSON.parse(content) as AvailableModel[];
    
    if (!Array.isArray(imported)) {
      throw new Error('Invalid format: expected array of models');
    }
    
    const storage = loadCustomModelsStorage();
    let addedCount = 0;
    
    for (const model of imported) {
      if (model.id && model.label) {
        const exists = storage.models.some(m => m.id === model.id);
        if (!exists) {
          storage.models.push(model);
          addedCount++;
        }
      }
    }
    
    if (addedCount > 0) {
      saveCustomModelsStorage(storage);
    }
    
    return addedCount;
  } catch (error) {
    throw new Error(`Failed to import models: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Export custom models to a JSON file
 */
export function exportCustomModels(filePath: string): number {
  const models = getCustomModels();
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(models, null, 2), 'utf-8');
    return models.length;
  } catch (error) {
    throw new Error(`Failed to export models: ${error instanceof Error ? error.message : String(error)}`);
  }
}
