/**
 * @license
 * Copyright 2025 Recoder
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { RadioButtonSelect } from '../../shared/RadioButtonSelect.js';
import { Colors } from '../../../colors.js';
import { getOpenAIAvailableModels } from '../../../models/availableModels.js';

interface ModelOption {
  id: string;
  label: string;
  value: string;
}

interface ModelSelectorProps {
  selectedModel?: string;
  onSelect: (model: string) => void;
}

/**
 * Model selection for agent creation.
 * Users can choose:
 * 1. "auto" - Use whatever model the user is currently using
 * 2. Specific model ID - Agent will always use that model
 */
export function ModelSelector({
  selectedModel = 'auto',
  onSelect,
}: ModelSelectorProps) {
  const [currentModel, setCurrentModel] = useState<string>(selectedModel);

  // Update selected model when prop changes
  useEffect(() => {
    setCurrentModel(selectedModel);
  }, [selectedModel]);

  // Get current user's model from environment
  const currentUserModel = process.env['OPENAI_MODEL']?.trim() || 'default';

  // Build model options: auto + available models
  const availableModels = getOpenAIAvailableModels();
  const modelOptions: ModelOption[] = [
    {
      id: 'auto',
      label: `Auto (use current: ${currentUserModel})`,
      value: 'auto',
    },
    ...availableModels.map((model) => ({
      id: model.id,
      label: model.label,
      value: model.id,
    })),
  ];

  const handleSelect = (selectedValue: string) => {
    onSelect(selectedValue);
  };

  const handleHighlight = (selectedValue: string) => {
    setCurrentModel(selectedValue);
  };

  const currentOption =
    modelOptions.find((option) => option.value === currentModel) ||
    modelOptions[0];

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text color={Colors.Gray}>
          Choose which model this agent will use:
        </Text>
        <Text color={Colors.Gray} dimColor>
          • Auto: Agent uses whatever model you're currently using
        </Text>
        <Text color={Colors.Gray} dimColor>
          • Static: Agent always uses the specified model
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <RadioButtonSelect
          items={modelOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          initialIndex={modelOptions.findIndex(
            (opt) => opt.value === currentOption.value,
          )}
          onSelect={handleSelect}
          onHighlight={handleHighlight}
          isFocused={true}
        />
      </Box>

      <Box flexDirection="row" marginTop={1}>
        <Text color={Colors.Gray}>Selected:</Text>
        <Box marginLeft={2}>
          <Text color={Colors.AccentPurple}>
            {currentModel === 'auto'
              ? `Auto (${currentUserModel})`
              : currentModel}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
