/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { type Config } from 'recoder-code-core';

interface TipsProps {
  config: Config;
}

export const Tips: React.FC<TipsProps> = ({ config }) => {
  const geminiMdFileCount = config.getGeminiMdFileCount();
  return (
    <Box flexDirection="column">
      <Text color={Colors.Foreground}>Tips for getting started:</Text>
      <Text color={Colors.Foreground}>
        1. Ask questions, edit files, or run commands naturally.
      </Text>
      <Text color={Colors.Foreground}>
        2. Use <Text bold color={Colors.AccentPurple}>@file.txt</Text> to add files to context.
      </Text>
      {geminiMdFileCount === 0 && (
        <Text color={Colors.Foreground}>
          3. Create{' '}
          <Text bold color={Colors.AccentPurple}>
            RECODER.md
          </Text>{' '}
          files to customize your interactions with Recoder Code.
        </Text>
      )}
      <Text color={Colors.Foreground}>
        {geminiMdFileCount === 0 ? '4' : '3'}. Try{' '}
        <Text bold color={Colors.AccentPurple}>
          /help
        </Text>{' '}
        for commands,{' '}
        <Text bold color={Colors.AccentPurple}>
          /model
        </Text>{' '}
        to switch AI, or{' '}
        <Text bold color={Colors.AccentPurple}>
          /setup
        </Text>{' '}
        to configure.
      </Text>
    </Box>
  );
};
