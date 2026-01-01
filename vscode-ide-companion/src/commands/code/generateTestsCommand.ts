/**
 * Generate Tests Command
 * Generates unit tests for selected code using AI
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export async function generateTestsCommand(
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
    vscode.window.showErrorMessage('Please select code to generate tests for');
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
        title: 'Generating tests...',
        cancellable: false,
      },
      async () => {
        const service = new OpenRouterService(apiKey);

        const prompt = `Generate comprehensive unit tests for the following ${language} code from ${fileName}:

\`\`\`${language}
${selectedText}
\`\`\`

Generate tests that:
1. Cover all functions and methods
2. Test edge cases and error conditions
3. Follow ${language} testing conventions
4. Use appropriate testing framework for ${language}
5. Include setup and teardown if needed

Return ONLY the test code, no additional explanation.`;

        const completion = await service.chat(selectedModel, [
          { role: 'user', content: prompt },
        ], { stream: false });

        if ('choices' in completion) {
          const testCode = completion.choices[0]?.message?.content || '';

          // Extract code from markdown if present
          let codeToShow = testCode;
          const codeBlockMatch = testCode.match(/```[\w]*\n([\s\S]*?)\n```/);
          if (codeBlockMatch) {
            codeToShow = codeBlockMatch[1];
          }

          // Show tests in output channel
          const outputChannel = vscode.window.createOutputChannel('Recoder Code Tests');
          outputChannel.clear();
          outputChannel.appendLine('='.repeat(80));
          outputChannel.appendLine(`Generated Tests for ${fileName}`);
          outputChannel.appendLine('='.repeat(80));
          outputChannel.appendLine('');
          outputChannel.appendLine(codeToShow);
          outputChannel.appendLine('');
          outputChannel.appendLine('='.repeat(80));
          outputChannel.show();

          // Ask if user wants to create test file
          const createFile = await vscode.window.showInformationMessage(
            'Tests generated! Create test file?',
            'Yes',
            'No'
          );

          if (createFile === 'Yes') {
            const testFileName = fileName?.replace(/\.(ts|js|py|go|java|rs)$/, '.test$1') || 'test.ts';
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
              const testFilePath = vscode.Uri.joinPath(workspaceFolder.uri, testFileName);
              const edit = new vscode.WorkspaceEdit();
              edit.createFile(testFilePath, { overwrite: false });
              edit.insert(testFilePath, new vscode.Position(0, 0), codeToShow);
              await vscode.workspace.applyEdit(edit);
              const doc = await vscode.workspace.openTextDocument(testFilePath);
              await vscode.window.showTextDocument(doc);
            }
          }
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
