/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from 'recoder-code-core';
import type {
  SlashCommand,
  CommandContext,
  OpenDialogActionReturn,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  AVAILABLE_MODELS_RECODER,
  getOpenAIAvailableModels,
  type AvailableModel,
} from '../models/availableModels.js';

function getAvailableModelsForAuthType(authType: AuthType): AvailableModel[] {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return AVAILABLE_MODELS_RECODER;
    case AuthType.USE_OPENAI: {
      return getOpenAIAvailableModels();
    }
    default:
      // For other auth types, return empty array for now
      // This can be expanded later according to the design doc
      return [];
  }
}

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Switch the model for this session',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
  ): Promise<OpenDialogActionReturn | MessageActionReturn> => {
    const { services } = context;
    const { config } = services;

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (!contentGeneratorConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Content generator configuration not available.',
      };
    }

    const authType = contentGeneratorConfig.authType;
    if (!authType) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Authentication type not available.',
      };
    }

    const availableModels = getAvailableModelsForAuthType(authType);

    if (availableModels.length === 0) {
      const baseUrl = process.env['OPENAI_BASE_URL'] || '';
      const isOpenRouter = baseUrl.includes('openrouter');
      
      let errorMessage = `No models available for the current authentication type (${authType}).`;
      
      if (authType === AuthType.USE_OPENAI) {
        if (isOpenRouter) {
          errorMessage += '\n\nFor OpenRouter, set your model with:\n  export OPENAI_MODEL=<model-id>\n\nUse `recoder-code --openrouter-explore` to browse available models.';
        } else {
          errorMessage += '\n\nSet your OpenAI model with:\n  export OPENAI_MODEL=<model-name>';
        }
      }
      
      return {
        type: 'message',
        messageType: 'error',
        content: errorMessage,
      };
    }

    // Trigger model selection dialog
    return {
      type: 'dialog',
      dialog: 'model',
    };
  },
};
