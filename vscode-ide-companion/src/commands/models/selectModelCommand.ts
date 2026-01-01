/**
 * Select Model Command
 */

import * as vscode from 'vscode';
import type { ModelInfo } from '../../services/OpenRouterService.js';

export function registerSelectModelCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'recoder.models.select',
    async (modelId: string, modelInfo?: ModelInfo) => {
      await context.globalState.update('recoder.selectedModel', modelId);

      const message = modelInfo
        ? `Selected model: ${modelInfo.name || modelId}\nContext: ${modelInfo.context_length.toLocaleString()} tokens`
        : `Selected model: ${modelId}`;

      vscode.window.showInformationMessage(message);

      // Refresh the model browser to update the checkmark
      vscode.commands.executeCommand('recoder.models.refresh');
    }
  );
}
