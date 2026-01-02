/**
 * Explain Code Command
 * Explains selected code using AI with Settings UI configuration
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { ProviderService } from '../../services/ProviderService.js';
import { AIService } from '../../services/AIService.js';

export async function explainCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showErrorMessage('Please select code to explain');
    return;
  }

  // Create AI service with Settings UI configuration
  const providerService = new ProviderService(context);
  const aiService = new AIService(providerService);

  // Check if current provider needs authentication
  const config = providerService.getAIConfiguration();
  const providers = providerService.getAllProviders();
  const currentProvider = providers.find(p => p.id === config.defaultProvider);
  
  if (currentProvider && !currentProvider.isLocal && !providerService.hasApiKey(currentProvider)) {
    vscode.window.showErrorMessage(`Please configure API key for ${currentProvider.name} in Settings`);
    await vscode.commands.executeCommand('recoder.settings.open');
    return;
  }

  const language = editor.document.languageId;
  const fileName = editor.document.fileName.split('/').pop();

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Explaining code using ${currentProvider?.name || config.defaultProvider}...`,
        cancellable: false,
      },
      async () => {
        const prompt = `Explain the following ${language} code from ${fileName}:

\`\`\`${language}
${selectedText}
\`\`\`

Provide a clear, concise explanation covering:
1. What the code does
2. How it works
3. Any important details or patterns used`;

        const completion = await aiService.chat([
          { role: 'user', content: prompt },
        ]);

        const explanation = completion.choices[0]?.message?.content || 'No explanation generated';

        // Show explanation in output channel
        const outputChannel = vscode.window.createOutputChannel('Recoder Code Explanation');
        outputChannel.clear();
        outputChannel.appendLine('='.repeat(80));
        outputChannel.appendLine(`Explanation for ${fileName} (via ${currentProvider?.name || config.defaultProvider})`);
        outputChannel.appendLine('='.repeat(80));
        outputChannel.appendLine('');
        outputChannel.appendLine(explanation);
        outputChannel.appendLine('');
        outputChannel.appendLine('='.repeat(80));
        outputChannel.show();
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to explain code: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
