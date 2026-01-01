/**
 * Add Comments Command
 * Adds detailed comments to selected code using AI
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { OpenRouterService } from '../../services/OpenRouterService.js';

export async function addCommentsCommand(
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
    vscode.window.showErrorMessage('Please select code to add comments to');
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
        title: 'Adding comments...',
        cancellable: false,
      },
      async () => {
        const service = new OpenRouterService(apiKey);

        const prompt = `Add detailed, helpful comments to the following ${language} code from ${fileName}:

\`\`\`${language}
${selectedText}
\`\`\`

Add comments that:
1. Explain what each section does
2. Clarify complex logic
3. Document parameters and return values (if functions)
4. Follow ${language} comment style conventions

Return ONLY the code with comments added, no additional explanation.`;

        const completion = await service.chat(selectedModel, [
          { role: 'user', content: prompt },
        ], { stream: false });

        if ('choices' in completion) {
          const commentedCode = completion.choices[0]?.message?.content || '';

          // Extract code from markdown if present
          let codeToInsert = commentedCode;
          const codeBlockMatch = commentedCode.match(/```[\w]*\n([\s\S]*?)\n```/);
          if (codeBlockMatch) {
            codeToInsert = codeBlockMatch[1];
          }

          // Replace selected text with commented version
          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, codeToInsert);
          });

          vscode.window.showInformationMessage('Comments added successfully');
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to add comments: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
