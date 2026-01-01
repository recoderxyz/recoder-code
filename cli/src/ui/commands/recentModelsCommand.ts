/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Recent model usage data
 */
interface ModelUsage {
  modelId: string;
  modelName?: string;
  lastUsed: number;
  useCount: number;
  totalTokens?: number;
  totalCost?: number;
}

/**
 * Get the path to recent models file
 */
function getRecentModelsPath(): string {
  const homeDir = os.homedir();
  const recoderDir = path.join(homeDir, '.recoder');
  
  // Ensure directory exists
  if (!fs.existsSync(recoderDir)) {
    fs.mkdirSync(recoderDir, { recursive: true });
  }
  
  return path.join(recoderDir, 'recent-models.json');
}

/**
 * Load recent models from disk
 */
function loadRecentModels(): ModelUsage[] {
  try {
    const filePath = getRecentModelsPath();
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error loading recent models:', error);
    return [];
  }
}

/**
 * Save recent models to disk
 */
function saveRecentModels(models: ModelUsage[]): void {
  try {
    const filePath = getRecentModelsPath();
    fs.writeFileSync(filePath, JSON.stringify(models, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving recent models:', error);
  }
}

/**
 * Record model usage
 */
export function recordModelUsage(
  modelId: string,
  modelName?: string,
  tokens?: number,
  cost?: number
): void {
  const recentModels = loadRecentModels();
  
  const existingIndex = recentModels.findIndex(m => m.modelId === modelId);
  
  if (existingIndex >= 0) {
    // Update existing entry
    const existing = recentModels[existingIndex];
    existing.lastUsed = Date.now();
    existing.useCount += 1;
    
    if (modelName) {
      existing.modelName = modelName;
    }
    
    if (tokens !== undefined) {
      existing.totalTokens = (existing.totalTokens || 0) + tokens;
    }
    
    if (cost !== undefined) {
      existing.totalCost = (existing.totalCost || 0) + cost;
    }
  } else {
    // Add new entry
    recentModels.push({
      modelId,
      modelName,
      lastUsed: Date.now(),
      useCount: 1,
      totalTokens: tokens,
      totalCost: cost,
    });
  }
  
  // Sort by last used (most recent first) and keep only top 20
  recentModels.sort((a, b) => b.lastUsed - a.lastUsed);
  const trimmed = recentModels.slice(0, 20);
  
  saveRecentModels(trimmed);
}

/**
 * Format time ago
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format cost
 */
function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Recent models command
 */
export const recentModelsCommand: SlashCommand = {
  name: 'recent',
  description: 'View and switch to recently used models',
  kind: CommandKind.BUILT_IN,

  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const args = context.invocation?.args?.trim() || '';
    
    const recentModels = loadRecentModels();
    
    if (recentModels.length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: `📋 No Recent Models

You haven't used any models yet. Start using models to see them here!

**To get started:**
  /browse-models free        → Browse free models
  /recommend coding          → Get coding recommendations
  /openrouter search claude  → Search for specific models

Models you use will appear here for quick access.`,
      };
    }

    // Handle specific model selection
    if (args) {
      const index = parseInt(args) - 1;
      
      if (isNaN(index) || index < 0 || index >= recentModels.length) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Invalid model number: ${args}\n\nUse /recent to see available models (1-${recentModels.length})`,
        };
      }
      
      const selectedModel = recentModels[index];
      
      // Set environment variable (this would typically integrate with your config system)
      process.env['OPENAI_MODEL'] = selectedModel.modelId;
      
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Switched to: ${selectedModel.modelName || selectedModel.modelId}

**Model Details:**
  • ID: ${selectedModel.modelId}
  • Used: ${selectedModel.useCount} time(s)
  • Last used: ${formatTimeAgo(selectedModel.lastUsed)}
${selectedModel.totalTokens ? `  • Total tokens: ${selectedModel.totalTokens.toLocaleString()}` : ''}
${selectedModel.totalCost !== undefined ? `  • Total cost: ${formatCost(selectedModel.totalCost)}` : ''}

Start chatting to use this model!`,
      };
    }

    // Display recent models list
    const currentModel = process.env['OPENAI_MODEL'];
    
    let content = `📋 Recently Used Models (${recentModels.length})\n\n`;
    
    recentModels.forEach((model, index) => {
      const isCurrent = model.modelId === currentModel;
      const indicator = isCurrent ? '→' : ' ';
      const number = index + 1;
      
      content += `${indicator} **${number}. ${model.modelName || model.modelId}**\n`;
      content += `     ${model.modelId}\n`;
      content += `     Used ${model.useCount}× · ${formatTimeAgo(model.lastUsed)}`;
      
      if (model.totalTokens) {
        content += ` · ${model.totalTokens.toLocaleString()} tokens`;
      }
      
      if (model.totalCost !== undefined) {
        content += ` · ${formatCost(model.totalCost)}`;
      }
      
      content += '\n\n';
    });
    
    content += '**Quick Actions:**\n';
    content += '  /recent <number>    → Switch to that model\n';
    content += '  /recent 1           → Switch to most recent\n';
    content += '  /model              → See all models\n\n';
    
    content += '**Filter & Search:**\n';
    content += '  /browse-models search <query>  → Search all models\n';
    content += '  /recommend <task>              → Get recommendations\n';
    content += '  /openrouter free               → Browse free models\n\n';
    
    content += '💡 Models are sorted by most recent usage';

    return {
      type: 'message',
      messageType: 'info',
      content,
    };
  },
};
