/**
 * Recoder.xyz Login Dialog
 * Handles authentication with recoder.xyz in interactive mode
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { Colors } from '../colors.js';

interface RecoderLoginDialogProps {
  onClose: () => void;
  onSuccess: (userEmail: string, plan: string) => void;
}

type LoginMethod = 'web' | 'device' | 'api-key';
type DialogState = 'method-selection' | 'authenticating' | 'api-key-input' | 'success' | 'error';

export const RecoderLoginDialog: React.FC<RecoderLoginDialogProps> = ({
  onClose,
  onSuccess,
}) => {
  const [state, setState] = useState<DialogState>('method-selection');
  const [selectedMethod, setSelectedMethod] = useState<LoginMethod | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  const authService = new RecoderAuthService();

  // Method selection options
  const methodOptions = [
    { value: 'web', label: 'Web Browser (Recommended)' },
    { value: 'device', label: 'Device Flow (For SSH/Remote)' },
    { value: 'api-key', label: 'API Key' },
  ];

  const handleMethodSelect = async (method: string) => {
    setSelectedMethod(method as LoginMethod);
    
    if (method === 'api-key') {
      setState('api-key-input');
      setMessage('Enter your API key (from recoder.xyz/settings/api-keys):');
      return;
    }

    setState('authenticating');
    await performLogin(method as LoginMethod);
  };

  const performLogin = async (method: LoginMethod, apiKey?: string) => {
    try {
      let authData;

      if (method === 'web') {
        setMessage('Opening browser for authentication...');
        authData = await authService.loginWithWeb();
      } else if (method === 'device') {
        setMessage('Initiating device flow...');
        authData = await authService.loginWithDeviceFlow();
      } else if (method === 'api-key' && apiKey) {
        setMessage('Validating API key...');
        authData = await authService.loginWithApiKey(apiKey);
      }

      if (authData) {
        setState('success');
        setMessage(`Successfully logged in as ${authData.user.email}!`);
        
        // Check if user needs to set API key
        if (authData.user.subscription_plan === 'free' && !authData.user.has_own_api_key) {
          setMessage(
            `Logged in as ${authData.user.email} (${authData.user.subscription_plan.toUpperCase()})\n\n` +
            '⚠️  Free tier requires your own OpenRouter API key\n' +
            '💡 Run: /set-api-key to configure it'
          );
        }

        setTimeout(() => {
          onSuccess(authData.user.email, authData.user.subscription_plan);
          onClose();
        }, 3000);
      }
    } catch (error: any) {
      setState('error');
      setErrorMessage(error.message || 'Authentication failed');
    }
  };

  // Method selection screen
  if (state === 'method-selection') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
        <Box marginBottom={1}>
          <Text bold color="cyan">🔐 Login to Recoder</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Choose your authentication method:</Text>
        </Box>
        <RadioButtonSelect
          items={methodOptions}
          onSelect={handleMethodSelect}
        />
        <Box marginTop={1}>
          <Text dimColor>Press Enter to select</Text>
        </Box>
      </Box>
    );
  }

  // API key input screen
  if (state === 'api-key-input') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
        <Box marginBottom={1}>
          <Text bold color="cyan">API Key Authentication</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>{message}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Get your API key at: https://recoder.xyz/settings/api-keys</Text>
        </Box>
        <Box>
          <Text color="yellow">Note: Type your API key and press Enter</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  // Authenticating screen
  if (state === 'authenticating') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            <Spinner type="dots" />
            {' '}Authenticating...
          </Text>
        </Box>
        <Box>
          <Text>{message}</Text>
        </Box>
        {selectedMethod === 'web' && (
          <Box marginTop={1}>
            <Text dimColor>Check your browser to complete authentication</Text>
          </Box>
        )}
        {selectedMethod === 'device' && (
          <Box marginTop={1}>
            <Text dimColor>Follow the instructions in your terminal</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Success screen
  if (state === 'success') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
        <Box marginBottom={1}>
          <Text bold color="green">✅ Authentication Successful!</Text>
        </Box>
        <Box>
          <Text>{message}</Text>
        </Box>
      </Box>
    );
  }

  // Error screen
  if (state === 'error') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
        <Box marginBottom={1}>
          <Text bold color="red">❌ Authentication Failed</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="red">{errorMessage}</Text>
        </Box>
        <Box>
          <Text dimColor>Press any key to try again or Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  return null;
};
