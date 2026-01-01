/**
 * OpenRouter Activity Command - Show recent generation activity
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export function registerActivityCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.openrouter.activity', async () => {
    const apiKey = await authService.getOpenRouterApiKey();

    if (!apiKey) {
      vscode.window.showErrorMessage('No OpenRouter API key available.');
      return;
    }

    try {
      const service = new OpenRouterService(apiKey);
      const stats = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Fetching recent activity...',
          cancellable: false,
        },
        async () => {
          return await service.getGenerationStats();
        }
      );

      if (stats.length === 0) {
        vscode.window.showInformationMessage('No recent activity found.');
        return;
      }

      // Create a webview to show detailed activity
      const panel = vscode.window.createWebviewPanel(
        'recoderActivity',
        'OpenRouter Activity',
        vscode.ViewColumn.One,
        { enableScripts: false }
      );

      const rows = stats
        .map((stat, index) => {
          const date = new Date(stat.created_at * 1000).toLocaleString();
          const duration = (stat.generation_time / 1000).toFixed(2);
          const totalTokens = stat.tokens_prompt + stat.tokens_completion;
          const model = stat.model.split('/').pop() || stat.model;

          return `
          <tr>
            <td>${index + 1}</td>
            <td>${model}</td>
            <td>${date}</td>
            <td>${duration}s</td>
            <td>${stat.tokens_prompt.toLocaleString()}</td>
            <td>${stat.tokens_completion.toLocaleString()}</td>
            <td>${totalTokens.toLocaleString()}</td>
          </tr>
        `;
        })
        .join('');

      panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: var(--vscode-font-family);
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
              padding: 20px;
            }
            h1 {
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              text-align: left;
              padding: 12px;
              border-bottom: 1px solid var(--vscode-panel-border);
            }
            th {
              background-color: var(--vscode-editor-selectionBackground);
              font-weight: bold;
            }
            tr:hover {
              background-color: var(--vscode-list-hoverBackground);
            }
            .summary {
              background-color: var(--vscode-editor-selectionBackground);
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h1>📊 Recent OpenRouter Activity</h1>
          <div class="summary">
            <strong>Last ${stats.length} generations</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th>Date/Time</th>
                <th>Duration</th>
                <th>Prompt Tokens</th>
                <th>Completion Tokens</th>
                <th>Total Tokens</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
        </html>
      `;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to fetch activity: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
