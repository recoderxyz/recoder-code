/**
 * Login Command - Authenticate with Recoder.xyz
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';

export function registerLoginCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.auth.login', async () => {
    const options = [
      {
        label: '$(globe) Web OAuth',
        description: 'Recommended - Opens browser for authentication',
        method: 'web',
      },
      {
        label: '$(device-mobile) Device Flow',
        description: 'For SSH/headless environments',
        method: 'device',
      },
      {
        label: '$(key) API Key (BYOK)',
        description: 'Use your own OpenRouter API key (Free tier)',
        method: 'apikey',
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Choose authentication method',
      ignoreFocusOut: true,
    });

    if (!selected) {
      return;
    }

    try {
      let authData;

      if (selected.method === 'web') {
        authData = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Authenticating with Recoder.xyz...',
            cancellable: false,
          },
          async () => {
            return await authService.loginWithWeb();
          }
        );
      } else if (selected.method === 'device') {
        authData = await authService.loginWithDeviceFlow();
      } else if (selected.method === 'apikey') {
        const apiKey = await vscode.window.showInputBox({
          prompt: 'Enter your OpenRouter API Key',
          password: true,
          placeHolder: 'sk-or-v1-...',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value) {
              return 'API key is required';
            }
            if (!value.startsWith('sk-or-')) {
              return 'API key must start with "sk-or-"';
            }
            return undefined;
          },
        });

        if (!apiKey) {
          return;
        }

        authData = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Validating API key with Recoder backend...',
            cancellable: false,
          },
          async () => {
            return await authService.loginWithApiKey(apiKey);
          }
        );
      }

      if (authData) {
        const planEmoji = authData.user.subscription_plan === 'pro' ? '⭐' :
                         authData.user.subscription_plan === 'enterprise' ? '💼' : '🆓';

        vscode.window.showInformationMessage(
          `✅ Successfully authenticated!\n` +
          `👤 ${authData.user.name} (${authData.user.email})\n` +
          `${planEmoji} ${authData.user.subscription_plan.toUpperCase()} plan`
        );

        // Check if user needs to provide API key
        if (authData.user.subscription_plan === 'free' && !authData.user.has_own_api_key) {
          const setKey = await vscode.window.showWarningMessage(
            '⚠️ Free tier requires your own OpenRouter API key. Would you like to set it now?',
            'Set API Key',
            'Later'
          );

          if (setKey === 'Set API Key') {
            vscode.commands.executeCommand('recoder.auth.setApiKey');
          }
        }

        // Refresh the auth status view
        vscode.commands.executeCommand('recoder.authStatus.refresh');
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
