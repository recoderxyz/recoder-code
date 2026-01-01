/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { AuthType } from 'recoder-code-core';
import { Box, Text } from 'ink';
import {
  setOpenAIApiKey,
  setOpenAIBaseUrl,
  setOpenAIModel,
  validateAuthMethod,
} from '../../config/auth.js';
import { type LoadedSettings, SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { OpenAIKeyPrompt } from './OpenAIKeyPrompt.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [showOpenAIKeyPrompt, setShowOpenAIKeyPrompt] = useState(false);
  const [isRecoderFreeUserFlow, setIsRecoderFreeUserFlow] = useState(false);
  const items = [
    { label: 'OpenRouter', value: AuthType.USE_OPENAI },
    { label: 'recoder.xyz auth', value: AuthType.RECODER_AUTH },
  ];

  const initialAuthIndex = Math.max(
    0,
    items.findIndex((item) => {
      if (settings.merged.security?.auth?.selectedType) {
        return item.value === settings.merged.security?.auth?.selectedType;
      }

      const defaultAuthType = parseDefaultAuthType(
        process.env['QWEN_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return item.value === defaultAuthType;
      }

      if (process.env['OPENAI_API_KEY']) {
        return item.value === AuthType.USE_OPENAI;
      }

      // Default to OpenRouter (first option)
      return item.value === AuthType.USE_OPENAI;
    }),
  );

  const handleAuthSelect = async (authMethod: AuthType) => {
    const error = validateAuthMethod(authMethod);

    if (authMethod === AuthType.RECODER_AUTH) {
      // Handle recoder.xyz authentication
      try {
        setErrorMessage('Starting recoder.xyz authentication...');
        const { RecoderAuthService } = await import('../../services/RecoderAuthService.js');
        const authService = new RecoderAuthService();

        // Use web-based OAuth flow
        const authData = await authService.loginWithWeb();

        // Check if free user needs to provide OpenRouter API key
        if (authData.user.subscription_plan === 'free' && !authData.user.has_own_api_key) {
          setErrorMessage('Free tier requires OpenRouter API key. Please enter your key.');
          setIsRecoderFreeUserFlow(true);
          setShowOpenAIKeyPrompt(true);
          return;
        }

        setErrorMessage(null);
        onSelect(authMethod, SettingScope.User);
      } catch (error: any) {
        setErrorMessage(error.message || 'Failed to authenticate with recoder.xyz');
      }
      return;
    }

    // For OpenRouter, always show the key prompt to allow users to enter/update their API key
    if (authMethod === AuthType.USE_OPENAI) {
      setShowOpenAIKeyPrompt(true);
      setErrorMessage(null);
      return;
    }

    if (error) {
      setErrorMessage(error);
    } else {
      setErrorMessage(null);
      onSelect(authMethod, SettingScope.User);
    }
  };

  const handleOpenAIKeySubmit = async (
    apiKey: string,
    baseUrl: string,
    model: string,
  ) => {
    // Validate the API key by making a test request
    const testBaseUrl = baseUrl || 'https://openrouter.ai/api/v1';
    const testModel = model || 'google/gemini-2.0-flash-exp:free';

    try {
      setErrorMessage('Validating API key...');

      const response = await fetch(`${testBaseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://recoder.xyz',
          'X-Title': 'Recoder Code',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid API key or unable to connect to OpenRouter');
      }

      // Remember if this is a recoder free user flow before any state changes
      const wasRecoderFreeUserFlow = isRecoderFreeUserFlow;

      // If this is a recoder free user flow, save the API key to recoder.xyz backend
      if (wasRecoderFreeUserFlow) {
        setErrorMessage('Saving API key to recoder.xyz...');
        const { RecoderAuthService } = await import('../../services/RecoderAuthService.js');
        const authService = new RecoderAuthService();
        await authService.setOpenRouterApiKey(apiKey);
      }

      // Save to environment
      setOpenAIApiKey(apiKey);
      setOpenAIBaseUrl(testBaseUrl);
      setOpenAIModel(testModel);

      // Save to .env file in user's home directory
      const os = await import('node:os');
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      const homeDir = os.homedir();
      const envPath = path.join(homeDir, '.recoder-code', '.env');

      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(envPath), { recursive: true });

      // Read existing .env file or create new one
      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf-8');
      } catch {
        // File doesn't exist, will create new one
      }

      // Update or add OPENAI_API_KEY
      const lines = envContent.split('\n');
      const keyIndex = lines.findIndex(line => line.startsWith('OPENAI_API_KEY='));
      const baseUrlIndex = lines.findIndex(line => line.startsWith('OPENAI_BASE_URL='));
      const modelIndex = lines.findIndex(line => line.startsWith('OPENAI_MODEL='));

      if (keyIndex !== -1) {
        lines[keyIndex] = `OPENAI_API_KEY=${apiKey}`;
      } else {
        lines.push(`OPENAI_API_KEY=${apiKey}`);
      }

      if (baseUrlIndex !== -1) {
        lines[baseUrlIndex] = `OPENAI_BASE_URL=${testBaseUrl}`;
      } else {
        lines.push(`OPENAI_BASE_URL=${testBaseUrl}`);
      }

      if (modelIndex !== -1) {
        lines[modelIndex] = `OPENAI_MODEL=${testModel}`;
      } else {
        lines.push(`OPENAI_MODEL=${testModel}`);
      }

      await fs.writeFile(envPath, lines.join('\n').trim() + '\n', { mode: 0o600 });

      // IMPORTANT: Reload environment to pick up the new API key
      const { loadEnvironment } = await import('../../config/settings.js');
      loadEnvironment();

      setShowOpenAIKeyPrompt(false);
      setErrorMessage(null);
      setIsRecoderFreeUserFlow(false);
      onSelect(wasRecoderFreeUserFlow ? AuthType.RECODER_AUTH : AuthType.USE_OPENAI, SettingScope.User);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to validate API key. Please try again.');
      setShowOpenAIKeyPrompt(false);
      setIsRecoderFreeUserFlow(false);
    }
  };

  const handleOpenAIKeyCancel = () => {
    setShowOpenAIKeyPrompt(false);
    setErrorMessage('OpenAI API key is required to use OpenAI authentication.');
  };

  useKeypress(
    (key) => {
      if (showOpenAIKeyPrompt) {
        return;
      }

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (errorMessage) {
          return;
        }
        if (settings.merged.security?.auth?.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          setErrorMessage(
            'You must select an auth method to proceed. Press Ctrl+C again to exit.',
          );
          return;
        }
        onSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  if (showOpenAIKeyPrompt) {
    return (
      <OpenAIKeyPrompt
        onSubmit={handleOpenAIKeySubmit}
        onCancel={handleOpenAIKeyCancel}
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Get started</Text>
      <Box marginTop={1}>
        <Text>How would you like to authenticate for this project?</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.AccentPurple}>(Use Enter to Set Auth)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Terms of Services and Privacy Notice for Recoder Code</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'https://recoder.xyz/terms'}
        </Text>
      </Box>
    </Box>
  );
}
