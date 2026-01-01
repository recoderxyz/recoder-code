/**
 * Auth Status Tree Provider
 * Shows authentication status and account info in the sidebar
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../services/RecoderAuthService.js';
import { OpenRouterService } from '../services/OpenRouterService.js';

class AuthTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.iconPath = iconPath;
  }
}

export class AuthStatusProvider implements vscode.TreeDataProvider<AuthTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AuthTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private authService: RecoderAuthService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AuthTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<AuthTreeItem[]> {
    const user = await this.authService.getUser();

    if (!user) {
      return [
        new AuthTreeItem(
          '❌ Not Authenticated',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.red'))
        ),
        new AuthTreeItem(
          'Click to login →',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('sign-in')
        ),
      ];
    }

    const planEmoji = user.subscription_plan === 'pro' ? '⭐' :
                     user.subscription_plan === 'enterprise' ? '💼' : '🆓';

    const items: AuthTreeItem[] = [
      new AuthTreeItem(
        '✅ Authenticated',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
      ),
      new AuthTreeItem(
        `User: ${user.name}`,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('person')
      ),
      new AuthTreeItem(
        `${planEmoji} ${user.subscription_plan.toUpperCase()}`,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('package')
      ),
      new AuthTreeItem(
        `Quota: ${user.quota.requests_remaining}/${user.quota.requests_limit}`,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('graph')
      ),
    ];

    // Try to get OpenRouter credits if available
    try {
      const apiKey = await this.authService.getOpenRouterApiKey();
      if (apiKey) {
        const service = new OpenRouterService(apiKey);
        const credits = await service.getCredits();
        const creditData = credits.data;

        if (creditData.limit) {
          const usagePercent = ((creditData.usage / creditData.limit) * 100).toFixed(1);
          items.push(
            new AuthTreeItem(
              `Usage: $${creditData.usage.toFixed(2)} / $${creditData.limit.toFixed(2)}`,
              vscode.TreeItemCollapsibleState.None,
              new vscode.ThemeIcon('credit-card')
            ),
            new AuthTreeItem(
              `${usagePercent}% used`,
              vscode.TreeItemCollapsibleState.None,
              new vscode.ThemeIcon('dashboard')
            )
          );
        } else {
          items.push(
            new AuthTreeItem(
              `Usage: $${creditData.usage.toFixed(2)}`,
              vscode.TreeItemCollapsibleState.None,
              new vscode.ThemeIcon('credit-card')
            )
          );
        }
      } else if (!user.has_own_api_key && user.subscription_plan === 'free') {
        items.push(
          new AuthTreeItem(
            '⚠️ API key required',
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
          )
        );
      }
    } catch (error) {
      // Silently ignore OpenRouter API errors
    }

    return items;
  }
}
