/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from './shared/TextInput.js';
import { Colors } from '../colors.js';
import { setOpenAIApiKey, setOpenAIBaseUrl, setOpenAIModel } from '../../config/auth.js';
import { Storage } from 'recoder-code-core';

interface ApiKeySetupDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
}

type SetupStep = 'choose' | 'openrouter' | 'complete';
type AuthChoice = 'openrouter' | 'recoder';

export const ApiKeySetupDialog: React.FC<ApiKeySetupDialogProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<SetupStep>('choose');
  const [selectedChoice, setSelectedChoice] = useState<AuthChoice>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string>('');

  // Handle input for choice selection
  useInput((input, key) => {
    if (step === 'choose') {
      if (key.upArrow || key.downArrow) {
        setSelectedChoice(selectedChoice === 'openrouter' ? 'recoder' : 'openrouter');
      } else if (key.return) {
        if (selectedChoice === 'openrouter') {
          setStep('openrouter');
        } else if (selectedChoice === 'recoder') {
          setError('⚠️  Recoder.xyz authentication is coming soon!\nFor now, please use OpenRouter with your own API key.');
        }
      } else if (key.escape) {
        onClose();
      }
    } else if (step === 'complete') {
      onClose();
      if (onSuccess) onSuccess();
    } else if (step === 'openrouter' && key.escape) {
      setStep('choose');
      setError('');
      setApiKey('');
    }
  });

  const handleSave = () => {
    setError('');
    
    if (!apiKey.trim()) {
      setError('❌ API key is required');
      return;
    }

    try {
      // Save API key
      setOpenAIApiKey(apiKey.trim());
      
      // Save OpenRouter base URL and default free model
      setOpenAIBaseUrl('https://openrouter.ai/api/v1');
      setOpenAIModel('google/gemini-2.0-flash-exp:free');

      setStep('complete');
    } catch (err) {
      setError(`❌ Failed to save: ${err}`);
    }
  };

  if (step === 'choose') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Text bold color="cyan">🔑 Configure API Access</Text>
        <Text> </Text>
        <Text>Choose how you want to authenticate:</Text>
        <Text> </Text>
        
        <Box>
          <Text color={selectedChoice === 'openrouter' ? 'cyan' : undefined}>
            {selectedChoice === 'openrouter' ? '› ' : '  '}
            OpenRouter (Recommended)
          </Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>Access 30+ AI models, many free with tool calling</Text>
        </Box>
        <Text> </Text>
        
        <Box>
          <Text color={selectedChoice === 'recoder' ? 'cyan' : undefined}>
            {selectedChoice === 'recoder' ? '› ' : '  '}
            Recoder.xyz (Coming Soon)
          </Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>Premium plans with included AI access</Text>
        </Box>
        
        {error && (
          <>
            <Text> </Text>
            <Text color="yellow">{error}</Text>
          </>
        )}
        
        <Text> </Text>
        <Text dimColor>↑↓: Navigate  Enter: Select  Esc: Cancel</Text>
      </Box>
    );
  }

  if (step === 'openrouter') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Text bold color="cyan">🔑 OpenRouter Setup</Text>
        <Text> </Text>
        <Text>Get your free API key from: <Text color="cyan">https://openrouter.ai/keys</Text></Text>
        <Text> </Text>
        
        <Box flexDirection="column">
          <Text>API Key:</Text>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk-or-v1-..."
            isActive={true}
            onSubmit={handleSave}
          />
        </Box>
        
        <Text> </Text>
        <Box flexDirection="column">
          <Text dimColor>Base URL (auto-configured): https://openrouter.ai/api/v1</Text>
          <Text dimColor>Model (auto-configured): google/gemini-2.0-flash-exp:free</Text>
        </Box>
        
        {error && (
          <>
            <Text> </Text>
            <Text color="red">{error}</Text>
          </>
        )}
        
        <Text> </Text>
        <Box flexDirection="column">
          <Text dimColor>💡 100% Free models with tool calling:</Text>
          <Text dimColor>   • google/gemini-2.0-flash-exp:free (1M context)</Text>
          <Text dimColor>   • qwen/qwen3-coder:free (262K context, best for code)</Text>
          <Text dimColor>   • z-ai/glm-4.5-air:free (131K context, thinking mode)</Text>
        </Box>
        
        <Text> </Text>
        <Text dimColor>Enter: Save  Esc: Back</Text>
      </Box>
    );
  }

  if (step === 'complete') {
    const configDir = Storage.getGlobalGeminiDir();
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
        <Text bold color="green">✅ Setup Complete</Text>
        <Text> </Text>
        <Text>API configuration saved successfully!</Text>
        <Text> </Text>
        <Text dimColor>Saved to: {configDir}/.env</Text>
        <Text> </Text>
        <Text dimColor>Configuration:</Text>
        <Text dimColor>  Base URL: https://openrouter.ai/api/v1</Text>
        <Text dimColor>  Model: google/gemini-2.0-flash-exp:free</Text>
        <Text> </Text>
        <Text>You can now start using AI features!</Text>
        <Text> </Text>
        <Text dimColor>Press any key to continue...</Text>
      </Box>
    );
  }

  return null;
};
