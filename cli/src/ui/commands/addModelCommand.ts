/**
 * @license
 * Copyright 2025 Recoder
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { addCustomModel, listCustomModels, removeCustomModel, clearCustomModels } from '../models/customModels.js';

/**
 * Command to add custom models from OpenRouter to the available models list.
 * 
 * Usage:
 *   /add-model <model-id>                 - Add a model
 *   /add-model <model-id> <label>         - Add a model with custom label
 *   /add-model list                       - List custom models
 *   /add-model remove <model-id>          - Remove a custom model
 *   /add-model clear                      - Clear all custom models
 * 
 * Examples:
 *   /add-model anthropic/claude-3-opus-20240229
 *   /add-model meta-llama/llama-4-405b "Llama 4 405B"
 *   /add-model openai/o1-preview "O1 Preview"
 */
export const addModelCommand: SlashCommand = {
  name: 'add-model',
  description: 'Add custom models from OpenRouter',
  kind: CommandKind.BUILT_IN,

  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const args = context.invocation?.args?.trim() || '';
    
    // Handle subcommands
    if (args === 'list') {
      return handleListCustomModels();
    }
    
    if (args === 'clear') {
      return handleClearCustomModels();
    }
    
    if (args.startsWith('remove ')) {
      const modelId = args.substring(7).trim();
      return handleRemoveCustomModel(modelId);
    }
    
    // Handle add model
    if (!args) {
      return {
        type: 'message',
        messageType: 'info',
        content: `📋 Add Model Command

Usage:
  /add-model <model-id>                  Add a model from OpenRouter
  /add-model <model-id> <label>          Add with custom label
  /add-model list                        List your custom models
  /add-model remove <model-id>           Remove a custom model
  /add-model clear                       Clear all custom models

Examples:
  /add-model anthropic/claude-3-opus-20240229
  /add-model meta-llama/llama-4-405b "Llama 4 405B"
  /add-model openai/o1-preview "O1 Preview"
  /add-model deepseek/deepseek-v3
  
💡 Tip: Browse available models at https://openrouter.ai/models
     or use the /openrouter command for model exploration.`,
      };
    }
    
    // Parse model ID and optional label
    const { modelId, label } = parseModelArgs(args);
    
    if (!modelId) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Invalid model ID. Please provide a valid OpenRouter model ID.\n\nExample: /add-model anthropic/claude-3-opus-20240229',
      };
    }
    
    return handleAddCustomModel(modelId, label);
  },
};

/**
 * Parse model ID and optional label from arguments
 */
function parseModelArgs(args: string): { modelId: string; label?: string } {
  // Check for quoted label: model-id "Label Text"
  const quotedMatch = args.match(/^(\S+)\s+"([^"]+)"$/);
  if (quotedMatch) {
    return {
      modelId: quotedMatch[1],
      label: quotedMatch[2],
    };
  }
  
  // Check for label with single quotes: model-id 'Label Text'
  const singleQuotedMatch = args.match(/^(\S+)\s+'([^']+)'$/);
  if (singleQuotedMatch) {
    return {
      modelId: singleQuotedMatch[1],
      label: singleQuotedMatch[2],
    };
  }
  
  // Check for multi-word label without quotes: model-id Label Text
  const parts = args.split(/\s+/);
  if (parts.length > 1) {
    return {
      modelId: parts[0],
      label: parts.slice(1).join(' '),
    };
  }
  
  // Just model ID
  return { modelId: args };
}

/**
 * Add a custom model to the available models list
 */
function handleAddCustomModel(modelId: string, label?: string): MessageActionReturn {
  try {
    // Validate model ID format (should be provider/model-name)
    if (!modelId.includes('/')) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Invalid model ID format: "${modelId}"

Model IDs must be in the format: provider/model-name

Examples:
  • anthropic/claude-3-opus-20240229
  • openai/gpt-4-turbo-preview
  • meta-llama/llama-4-405b-instruct
  • deepseek/deepseek-v3
  
Browse models at: https://openrouter.ai/models`,
      };
    }
    
    const addedModel = addCustomModel(modelId, label);
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ Model added successfully!

Model ID: ${addedModel.id}
Label: ${addedModel.label}
${addedModel.contextLength ? `Context: ${addedModel.contextLength}` : ''}

The model is now available in your model list. Use /model to switch to it.

💡 Tip: Use /add-model list to see all your custom models.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ Failed to add model: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * List all custom models
 */
function handleListCustomModels(): MessageActionReturn {
  const customModels = listCustomModels();
  
  if (customModels.length === 0) {
    return {
      type: 'message',
      messageType: 'info',
      content: `📋 Custom Models

You haven't added any custom models yet.

To add a model:
  /add-model <model-id>

Example:
  /add-model anthropic/claude-3-opus-20240229

Browse available models at https://openrouter.ai/models`,
    };
  }
  
  const modelsList = customModels
    .map((model, index) => {
      const contextInfo = model.contextLength ? ` (${model.contextLength})` : '';
      const visionBadge = model.isVision ? ' 👁️' : '';
      return `  ${index + 1}. ${model.label}${visionBadge}${contextInfo}\n     ID: ${model.id}`;
    })
    .join('\n\n');
  
  return {
    type: 'message',
    messageType: 'info',
    content: `📋 Your Custom Models (${customModels.length})

${modelsList}

Commands:
  /add-model <model-id>           Add a new model
  /add-model remove <model-id>    Remove a model
  /add-model clear                Clear all custom models
  /model                          Switch to a model`,
  };
}

/**
 * Remove a custom model
 */
function handleRemoveCustomModel(modelId: string): MessageActionReturn {
  if (!modelId) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Please specify a model ID to remove.\n\nExample: /add-model remove anthropic/claude-3-opus-20240229',
    };
  }
  
  try {
    const removed = removeCustomModel(modelId);
    
    if (removed) {
      return {
        type: 'message',
        messageType: 'info',
        content: `✅ Model removed: ${modelId}

Use /add-model list to see remaining custom models.`,
      };
    } else {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ Model not found: ${modelId}

Use /add-model list to see your custom models.`,
      };
    }
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ Failed to remove model: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Clear all custom models
 */
function handleClearCustomModels(): MessageActionReturn {
  try {
    clearCustomModels();
    
    return {
      type: 'message',
      messageType: 'info',
      content: `✅ All custom models cleared!

You can add models again with:
  /add-model <model-id>

Browse available models at https://openrouter.ai/models`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `❌ Failed to clear models: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
