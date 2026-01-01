/**
 * Status Command - Show authentication status
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export function registerStatusCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.auth.status', async () => {
    const user = await authService.getUser();

    if (!user) {
      vscode.window.showInformationMessage(
        'Not authenticated. Please run "Recoder Code: Login" to authenticate.'
      );
      return;
    }

    const planEmoji = user.subscription_plan === 'pro' ? '⭐' :
                     user.subscription_plan === 'enterprise' ? '💼' : '🆓';

    try {
      const openRouterApiKey = await authService.getOpenRouterApiKey();

      let message = [
        '=== Recoder Code Authentication Status ===',
        '',
        `👤 User: ${user.name}`,
        `📧 Email: ${user.email}`,
        `${planEmoji} Plan: ${user.subscription_plan.toUpperCase()}`,
        '',
        `📊 Quota: ${user.quota.requests_remaining}/${user.quota.requests_limit} requests remaining`,
        `🔄 Resets: ${new Date(user.quota.reset_date).toLocaleDateString()}`,
      ];

      if (openRouterApiKey) {
        const openRouterService = new OpenRouterService(openRouterApiKey);
        const credits = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching OpenRouter info...',
            cancellable: false,
          },
          async () => {
            return await openRouterService.getCredits();
          }
        );

        const creditData = credits.data;
        const usagePercent = creditData.limit
          ? ((creditData.usage / creditData.limit) * 100).toFixed(1)
          : 'Unlimited';

        message.push('', '=== OpenRouter Credits ===', '');
        message.push(creditData.limit
          ? `💰 Usage: $${creditData.usage.toFixed(2)} / $${creditData.limit.toFixed(2)} (${usagePercent}%)`
          : `💰 Usage: $${creditData.usage.toFixed(2)}`);
        message.push(`⚡ Rate Limit: ${creditData.rate_limit.requests} requests per ${creditData.rate_limit.interval}`);
      }

      vscode.window.showInformationMessage(message.join('\n'), { modal: true });
    } catch (error) {
      vscode.window.showWarningMessage(
        `User: ${user.name} (${user.email})\n\nFailed to fetch additional details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
