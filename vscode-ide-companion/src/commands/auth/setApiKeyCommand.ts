/**
 * Set API Key Command - For free users to set their OpenRouter API key
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';

export function registerSetApiKeyCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.auth.setApiKey', async () => {
    // Check if user is logged in
    const user = await authService.getUser();
    if (!user) {
      const login = await vscode.window.showErrorMessage(
        'You must be logged in to set an API key. Please login first.',
        'Login'
      );
      if (login === 'Login') {
        vscode.commands.executeCommand('recoder.auth.login');
      }
      return;
    }

    // Check if user is on free plan
    if (user.subscription_plan !== 'free') {
      vscode.window.showInformationMessage(
        `You are on the ${user.subscription_plan.toUpperCase()} plan and don't need to provide your own API key.`
      );
      return;
    }

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
        if (value.length < 20) {
          return 'API key seems too short';
        }
        return undefined;
      },
    });

    if (!apiKey) {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Saving API key...',
          cancellable: false,
        },
        async () => {
          await authService.setOpenRouterApiKey(apiKey);
        }
      );

      vscode.window.showInformationMessage(
        '✅ OpenRouter API key saved successfully! You can now use all AI features.'
      );

      // Refresh views
      vscode.commands.executeCommand('recoder.authStatus.refresh');
      vscode.commands.executeCommand('recoder.models.refresh');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save API key: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
