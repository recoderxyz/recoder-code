/**
 * Recoder.xyz Login Command
 * Handles authentication with recoder.xyz
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { SlashCommand, OpenDialogActionReturn, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface LoginDialogProps {
  onClose: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ onClose }) => {
  const [status, setStatus] = useState<'choosing' | 'authenticating' | 'success' | 'error'>('choosing');
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState<'web' | 'device' | null>(null);

  useEffect(() => {
    if (method) {
      handleLogin();
    }
  }, [method]);

  const handleLogin = async () => {
    const authService = new RecoderAuthService();
    setStatus('authenticating');

    try {
      if (method === 'web') {
        await authService.loginWithWeb();
      } else if (method === 'device') {
        await authService.loginWithDeviceFlow();
      }
      setStatus('success');
      setMessage('Successfully logged in!');
      setTimeout(onClose, 2000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Authentication failed');
    }
  };

  if (status === 'choosing') {
    // Auto-start web login
    setMethod('web');
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          {' '}Opening browser for authentication...
        </Text>
        <Text dimColor>A browser window will open. Please sign in with GitHub or Google.</Text>
      </Box>
    );
  }

  if (status === 'authenticating') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          {' '}Authenticating...
        </Text>
        {message && <Text dimColor>{message}</Text>}
      </Box>
    );
  }

  if (status === 'success') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">✅ {message}</Text>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ {message}</Text>
        <Text dimColor>Press any key to close...</Text>
      </Box>
    );
  }

  return null;
};

export const recoderLoginCommand: SlashCommand = {
  name: 'login',
  description: 'Login to recoder.xyz',
  kind: CommandKind.BUILT_IN,
  action: (_context, _args): OpenDialogActionReturn => ({
    type: 'dialog',
    dialog: 'recoder-login',
  }),
};

export const recoderLogoutCommand: SlashCommand = {
  name: 'logout',
  description: 'Logout from recoder.xyz',
  kind: CommandKind.BUILT_IN,
  action: async (_context, _args): Promise<MessageActionReturn> => {
    const authService = new RecoderAuthService();
    await authService.logout();
    return {
      type: 'message',
      messageType: 'info',
      content: 'Logged out successfully',
    };
  },
};

export const recoderStatusCommand: SlashCommand = {
  name: 'status',
  description: 'Check recoder.xyz authentication status',
  kind: CommandKind.BUILT_IN,
  action: async (_context, _args): Promise<MessageActionReturn> => {
    const authService = new RecoderAuthService();
    const isAuth = await authService.isAuthenticated();
    
    if (!isAuth) {
      return {
        type: 'message',
        messageType: 'error',
        content: '❌ Not authenticated. Run /login to authenticate.',
      };
    }

    const user = await authService.getUser();
    const quota = await authService.getQuota();

    let message = `✅ Authenticated as ${user?.email}\n`;
    message += `📋 Plan: ${user?.subscription_plan.toUpperCase()}\n`;
    
    if (quota) {
      message += `📊 Quota: ${quota.requests_remaining}/${quota.requests_limit} requests remaining\n`;
      message += `🔄 Resets: ${new Date(quota.reset_date).toLocaleDateString()}`;
    }

    if (user?.subscription_plan === 'free' && !user.has_own_api_key) {
      message += '\n\n⚠️  You need to set your OpenRouter API key';
      message += '\n💡 Run: /set-api-key';
    }

    return {
      type: 'message',
      messageType: 'info',
      content: message,
    };
  },
};

export const recoderSetApiKeyCommand: SlashCommand = {
  name: 'set-api-key',
  description: 'Set your OpenRouter API key (for free tier)',
  kind: CommandKind.BUILT_IN,
  action: async (_context, args): Promise<MessageActionReturn> => {
    const authService = new RecoderAuthService();
    const isAuth = await authService.isAuthenticated();

    if (!isAuth) {
      return {
        type: 'message',
        messageType: 'error',
        content: '❌ Not authenticated. Run /login first.',
      };
    }

    const apiKey = args.trim();
    
    if (!apiKey) {
      return {
        type: 'message',
        messageType: 'error',
        content: '❌ Please provide your OpenRouter API key\nUsage: /set-api-key sk-or-v1-...',
      };
    }

    try {
      await authService.setOpenRouterApiKey(apiKey);
      return {
        type: 'message',
        messageType: 'info',
        content: '✅ API key saved successfully!',
      };
    } catch (error: any) {
      return {
        type: 'message',
        messageType: 'error',
        content: `❌ ${error.message}`,
      };
    }
  },
};
