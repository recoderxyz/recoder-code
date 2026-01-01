/**
 * Compare Models Command - Compare multiple models side-by-side
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService, type ModelInfo } from '../../services/OpenRouterService.js';

export function registerCompareModelsCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.models.compare', async () => {
    const apiKey = await authService.getOpenRouterApiKey();

    if (!apiKey) {
      vscode.window.showErrorMessage('No OpenRouter API key available.');
      return;
    }

    try {
      const service = new OpenRouterService(apiKey);
      const allModels = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Loading models...',
          cancellable: false,
        },
        async () => {
          return await service.getModels();
        }
      );

      // Popular models to compare
      const popularModelIds = [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'google/gemini-pro-1.5',
        'meta-llama/llama-3.1-70b-instruct',
        'qwen/qwen-2.5-coder-32b-instruct',
      ];

      const modelsToCompare = allModels.filter((m) =>
        popularModelIds.some((id) => m.id.includes(id))
      );

      if (modelsToCompare.length === 0) {
        vscode.window.showErrorMessage('No models found to compare.');
        return;
      }

      // Create comparison webview
      const panel = vscode.window.createWebviewPanel(
        'recoderModelCompare',
        'Model Comparison',
        vscode.ViewColumn.One,
        { enableScripts: false }
      );

      const rows = modelsToCompare
        .map((model) => {
          const promptPrice = parseFloat(model.pricing.prompt);
          const completionPrice = parseFloat(model.pricing.completion);
          const isFree = promptPrice === 0 || model.id.includes(':free');

          return `
          <tr>
            <td><strong>${model.name || model.id}</strong></td>
            <td>${model.context_length.toLocaleString()}</td>
            <td>${model.top_provider?.max_completion_tokens?.toLocaleString() || 'N/A'}</td>
            <td>${isFree ? '🆓 Free' : `$${promptPrice.toFixed(6)}`}</td>
            <td>${isFree ? '🆓 Free' : `$${completionPrice.toFixed(6)}`}</td>
            <td>${model.description || 'No description'}</td>
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
              margin-bottom: 10px;
            }
            .subtitle {
              color: var(--vscode-descriptionForeground);
              margin-bottom: 30px;
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
              position: sticky;
              top: 0;
            }
            tr:hover {
              background-color: var(--vscode-list-hoverBackground);
            }
            .note {
              margin-top: 20px;
              padding: 10px;
              background-color: var(--vscode-textBlockQuote-background);
              border-left: 3px solid var(--vscode-textLink-foreground);
            }
          </style>
        </head>
        <body>
          <h1>🔍 Model Comparison</h1>
          <p class="subtitle">Comparing popular AI models on OpenRouter</p>

          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Context Length</th>
                <th>Max Completion</th>
                <th>Prompt Price (per 1M)</th>
                <th>Completion Price (per 1M)</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="note">
            <strong>💡 Tips:</strong><br>
            • Free models are great for testing and development<br>
            • Consider context length for long conversations<br>
            • Prices are per 1 million tokens<br>
            • Some models support prompt caching for cost savings
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to compare models: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
