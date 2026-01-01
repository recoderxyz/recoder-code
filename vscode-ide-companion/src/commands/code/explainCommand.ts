/**
 * Explain Code Command
 * Explains selected code using AI
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

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

  const isAuth = await authService.isAuthenticated();
  if (!isAuth) {
    vscode.window.showErrorMessage('Please login first');
    await vscode.commands.executeCommand('recoder.auth.login');
    return;
  }

  const apiKey = await authService.getOpenRouterApiKey();
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set your OpenRouter API key');
    await vscode.commands.executeCommand('recoder.auth.setApiKey');
    return;
  }

  const selectedModel =
    context.globalState.get<string>('recoder.selectedModel') ||
    'anthropic/claude-3.5-sonnet';

  const language = editor.document.languageId;
  const fileName = editor.document.fileName.split('/').pop();

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Explaining code...',
        cancellable: false,
      },
      async () => {
        const service = new OpenRouterService(apiKey);

        const prompt = `Explain the following ${language} code from ${fileName}:

\`\`\`${language}
${selectedText}
\`\`\`

Provide a clear, concise explanation covering:
1. What the code does
2. How it works
3. Any important details or patterns used`;

        const completion = await service.chat(selectedModel, [
          { role: 'user', content: prompt },
        ], { stream: false });

        if ('choices' in completion) {
          const explanation = completion.choices[0]?.message?.content || 'No explanation generated';

          // Show explanation in output channel
          const outputChannel = vscode.window.createOutputChannel('Recoder Code Explanation');
          outputChannel.clear();
          outputChannel.appendLine('='.repeat(80));
          outputChannel.appendLine(`Explanation for ${fileName}`);
          outputChannel.appendLine('='.repeat(80));
          outputChannel.appendLine('');
          outputChannel.appendLine(explanation);
          outputChannel.appendLine('');
          outputChannel.appendLine('='.repeat(80));
          outputChannel.show();
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to explain code: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
