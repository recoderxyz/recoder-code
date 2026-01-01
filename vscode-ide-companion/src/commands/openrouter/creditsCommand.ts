/**
 * OpenRouter Credits Command - Show current credits and usage
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export function registerCreditsCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.openrouter.credits', async () => {
    const apiKey = await authService.getOpenRouterApiKey();

    if (!apiKey) {
      const setKey = await vscode.window.showErrorMessage(
        'No OpenRouter API key available. Please set your API key first.',
        'Set API Key',
        'Login'
      );
      if (setKey === 'Set API Key') {
        vscode.commands.executeCommand('recoder.auth.setApiKey');
      } else if (setKey === 'Login') {
        vscode.commands.executeCommand('recoder.auth.login');
      }
      return;
    }

    try {
      const service = new OpenRouterService(apiKey);
      const credits = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Fetching OpenRouter credits...',
          cancellable: false,
        },
        async () => {
          return await service.getCredits();
        }
      );

      const creditData = credits.data;
      const usagePercent = creditData.limit
        ? ((creditData.usage / creditData.limit) * 100).toFixed(1)
        : null;

      const freeTierBadge = creditData.is_free_tier ? '🆓 Free Tier' : '💳 Paid Account';

      const message = [
        '=== OpenRouter Credits ===',
        '',
        `${freeTierBadge}`,
        `Plan: ${creditData.label}`,
        '',
        creditData.limit
          ? `💰 Usage: $${creditData.usage.toFixed(4)} / $${creditData.limit.toFixed(2)}`
          : `💰 Usage: $${creditData.usage.toFixed(4)} (Unlimited)`,
        usagePercent ? `📊 ${usagePercent}% used` : '',
        '',
        `⚡ Rate Limit: ${creditData.rate_limit.requests} requests per ${creditData.rate_limit.interval}`,
      ]
        .filter(Boolean)
        .join('\n');

      vscode.window.showInformationMessage(message, { modal: true });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to fetch credits: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
