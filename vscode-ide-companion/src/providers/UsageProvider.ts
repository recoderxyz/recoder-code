/**
 * Usage & Credits Tree Provider
 * Shows OpenRouter usage and credits in the sidebar
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../services/RecoderAuthService.js';
import { OpenRouterService } from '../services/OpenRouterService.js';

class UsageTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    iconPath?: vscode.ThemeIcon,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.iconPath = iconPath;
    this.command = command;
  }
}

export class UsageProvider implements vscode.TreeDataProvider<UsageTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<UsageTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private authService: RecoderAuthService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: UsageTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<UsageTreeItem[]> {
    const apiKey = await this.authService.getOpenRouterApiKey();

    if (!apiKey) {
      return [
        new UsageTreeItem(
          '⚠️ No API key',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
        ),
        new UsageTreeItem(
          'Set API key to view usage',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('key'),
          {
            command: 'recoder.auth.setApiKey',
            title: 'Set API Key',
          }
        ),
      ];
    }

    try {
      const service = new OpenRouterService(apiKey);
      const [credits, stats] = await Promise.all([
        service.getCredits(),
        service.getGenerationStats().catch(() => []),
      ]);

      const creditData = credits.data;
      const items: UsageTreeItem[] = [];

      // Credits section
      items.push(
        new UsageTreeItem(
          '💳 Credits',
          vscode.TreeItemCollapsibleState.Expanded,
          new vscode.ThemeIcon('credit-card')
        )
      );

      if (creditData.limit) {
        const usagePercent = ((creditData.usage / creditData.limit) * 100).toFixed(1);
        const remaining = creditData.limit - creditData.usage;

        items.push(
          new UsageTreeItem(
            `  Used: $${creditData.usage.toFixed(4)}`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('graph-line')
          ),
          new UsageTreeItem(
            `  Remaining: $${remaining.toFixed(4)}`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('dashboard')
          ),
          new UsageTreeItem(
            `  ${usagePercent}% used`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('pie-chart')
          )
        );
      } else {
        items.push(
          new UsageTreeItem(
            `  Total: $${creditData.usage.toFixed(4)}`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('graph-line')
          ),
          new UsageTreeItem(
            `  Unlimited plan`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('check')
          )
        );
      }

      // Rate limit section
      items.push(
        new UsageTreeItem(
          '⚡ Rate Limit',
          vscode.TreeItemCollapsibleState.Expanded,
          new vscode.ThemeIcon('pulse')
        ),
        new UsageTreeItem(
          `  ${creditData.rate_limit.requests} requests`,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('pulse')
        ),
        new UsageTreeItem(
          `  per ${creditData.rate_limit.interval}`,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('clock')
        )
      );

      // Recent activity
      if (stats.length > 0) {
        items.push(
          new UsageTreeItem(
            `📊 Recent Activity (${stats.length})`,
            vscode.TreeItemCollapsibleState.Expanded,
            new vscode.ThemeIcon('graph'),
            {
              command: 'recoder.openrouter.activity',
              title: 'View Activity',
            }
          )
        );

        let totalTokens = 0;
        for (const stat of stats) {
          totalTokens += stat.tokens_prompt + stat.tokens_completion;
        }
        const avgTokens = Math.round(totalTokens / stats.length);

        items.push(
          new UsageTreeItem(
            `  ${totalTokens.toLocaleString()} total tokens`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('symbol-number')
          ),
          new UsageTreeItem(
            `  ${avgTokens.toLocaleString()} avg per request`,
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('symbol-number')
          )
        );
      }

      // Quick actions
      items.push(
        new UsageTreeItem(
          '🔧 Actions',
          vscode.TreeItemCollapsibleState.Expanded,
          new vscode.ThemeIcon('tools')
        ),
        new UsageTreeItem(
          '  View detailed credits',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('eye'),
          {
            command: 'recoder.openrouter.credits',
            title: 'View Credits',
          }
        ),
        new UsageTreeItem(
          '  Estimate cost',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('calculator'),
          {
            command: 'recoder.openrouter.estimate',
            title: 'Estimate Cost',
          }
        ),
        new UsageTreeItem(
          '  View activity',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('history'),
          {
            command: 'recoder.openrouter.activity',
            title: 'View Activity',
          }
        )
      );

      return items;
    } catch (error) {
      return [
        new UsageTreeItem(
          '⚠️ Error loading usage',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
        ),
        new UsageTreeItem(
          `${error instanceof Error ? error.message : String(error)}`,
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }
  }
}
