/**
 * Refactor Code Command
 * Suggests refactoring for selected code using AI
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export async function refactorCommand(
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
    vscode.window.showErrorMessage('Please select code to refactor');
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
        title: 'Refactoring code...',
        cancellable: false,
      },
      async () => {
        const service = new OpenRouterService(apiKey);

        const prompt = `Refactor the following ${language} code from ${fileName}:

\`\`\`${language}
${selectedText}
\`\`\`

Suggest improvements for:
1. Code readability and maintainability
2. Performance optimizations
3. Best practices and design patterns
4. Type safety (if applicable)

Provide the refactored code with explanations for each change.`;

        const completion = await service.chat(selectedModel, [
          { role: 'user', content: prompt },
        ], { stream: false });

        if ('choices' in completion) {
          const refactoring = completion.choices[0]?.message?.content || 'No refactoring suggestions generated';

          // Show refactoring suggestions in output channel
          const outputChannel = vscode.window.createOutputChannel('Recoder Code Refactoring');
          outputChannel.clear();
          outputChannel.appendLine('='.repeat(80));
          outputChannel.appendLine(`Refactoring Suggestions for ${fileName}`);
          outputChannel.appendLine('='.repeat(80));
          outputChannel.appendLine('');
          outputChannel.appendLine(refactoring);
          outputChannel.appendLine('');
          outputChannel.appendLine('='.repeat(80));
          outputChannel.show();
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to refactor code: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
