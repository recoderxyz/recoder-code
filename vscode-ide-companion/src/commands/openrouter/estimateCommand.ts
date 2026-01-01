/**
 * OpenRouter Estimate Cost Command - Estimate cost for a given input/output
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export function registerEstimateCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.openrouter.estimate', async () => {
    const apiKey = await authService.getOpenRouterApiKey();

    if (!apiKey) {
      vscode.window.showErrorMessage('No OpenRouter API key available.');
      return;
    }

    // Get selected model
    const selectedModelId = context.globalState.get<string>('recoder.selectedModel');
    if (!selectedModelId) {
      vscode.window.showWarningMessage('Please select a model first.');
      return;
    }

    // Ask for prompt tokens
    const promptTokensStr = await vscode.window.showInputBox({
      prompt: 'Estimated prompt tokens (e.g., 1000)',
      placeHolder: '1000',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number';
        }
        return undefined;
      },
    });

    if (!promptTokensStr) return;

    // Ask for completion tokens
    const completionTokensStr = await vscode.window.showInputBox({
      prompt: 'Estimated completion tokens (e.g., 500)',
      placeHolder: '500',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number';
        }
        return undefined;
      },
    });

    if (!completionTokensStr) return;

    const promptTokens = parseInt(promptTokensStr);
    const completionTokens = parseInt(completionTokensStr);

    try {
      const service = new OpenRouterService(apiKey);

      // Fetch model info
      const models = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Calculating cost estimate...',
          cancellable: false,
        },
        async () => {
          return await service.getModels();
        }
      );

      const model = models.find((m) => m.id === selectedModelId);
      if (!model) {
        vscode.window.showErrorMessage('Selected model not found.');
        return;
      }

      const estimatedCost = service.estimateCost(model, promptTokens, completionTokens);

      const message = [
        '=== Cost Estimate ===',
        '',
        `Model: ${model.name || selectedModelId}`,
        `Context: ${model.context_length.toLocaleString()} tokens`,
        '',
        `📝 Prompt tokens: ${promptTokens.toLocaleString()}`,
        `💬 Completion tokens: ${completionTokens.toLocaleString()}`,
        `📊 Total tokens: ${(promptTokens + completionTokens).toLocaleString()}`,
        '',
        `💰 Estimated cost: $${estimatedCost.toFixed(6)}`,
        '',
        '📌 Pricing:',
        `  Prompt: $${model.pricing.prompt}/1M tokens`,
        `  Completion: $${model.pricing.completion}/1M tokens`,
      ].join('\n');

      vscode.window.showInformationMessage(message, { modal: true });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to estimate cost: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
