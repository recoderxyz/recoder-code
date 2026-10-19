/**
 * Multi-File Refactor Commands
 * Commands for workspace-wide refactoring operations
 */

import * as vscode from 'vscode';
import { MultiFileRefactorService, RefactorOptions } from '../../services/MultiFileRefactorService.js';
import { ProviderService } from '../../services/ProviderService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

/**
 * Register all multi-file refactor commands
 */
export function registerMultiFileRefactorCommands(
  context: vscode.ExtensionContext,
  providerService: ProviderService,
  authService: RecoderAuthService
): vscode.Disposable[] {
  const refactorService = new MultiFileRefactorService(providerService, authService, context);

  return [
    // Rename symbol across workspace
    vscode.commands.registerCommand('recoder.refactor.renameSymbol', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // Get word at cursor
      const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
      const currentWord = wordRange ? editor.document.getText(wordRange) : '';

      const oldName = await vscode.window.showInputBox({
        prompt: 'Symbol to rename',
        value: currentWord,
        placeHolder: 'e.g., myFunction, MyClass, myVariable',
      });

      if (!oldName) {
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: `Rename "${oldName}" to`,
        placeHolder: 'New name',
      });

      if (!newName) {
        return;
      }

      // Ask for scope
      const scope = await vscode.window.showQuickPick(
        [
          { label: 'Workspace', description: 'Search all files in workspace', value: 'workspace' as const },
          { label: 'Current Folder', description: 'Search files in current folder', value: 'folder' as const },
          { label: 'Current File', description: 'Search only current file', value: 'file' as const },
        ],
        { placeHolder: 'Select search scope' }
      );

      if (!scope) {
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Renaming "${oldName}" to "${newName}"`,
          cancellable: false,
        },
        async () => {
          return refactorService.renameSymbol(oldName, newName, { scope: scope.value });
        }
      );

      if (!result.success) {
        vscode.window.showWarningMessage(result.error || 'Rename failed');
        return;
      }

      // Show preview and ask for confirmation
      const action = await showRefactorPreview(result.files, result.summary, refactorService);

      if (action === 'apply') {
        await refactorService.applyAllChanges();
      } else {
        refactorService.rejectAllChanges();
      }
    }),

    // AI-powered refactoring
    vscode.commands.registerCommand('recoder.refactor.aiRefactor', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the refactoring you want to apply',
        placeHolder: 'e.g., Convert all class components to functional components with hooks',
      });

      if (!prompt) {
        return;
      }

      // Ask for file pattern
      const pattern = await vscode.window.showInputBox({
        prompt: 'File pattern to include (glob)',
        value: '**/*.{ts,tsx,js,jsx}',
        placeHolder: 'e.g., **/*.tsx, src/**/*.ts',
      });

      if (!pattern) {
        return;
      }

      const result = await refactorService.aiRefactor(prompt, {
        includePattern: pattern,
        type: 'custom',
        scope: 'workspace',
        aiPrompt: prompt,
      });

      if (!result.success) {
        vscode.window.showWarningMessage(result.error || 'AI refactoring failed');
        return;
      }

      // Show preview
      const action = await showRefactorPreview(result.files, result.summary, refactorService);

      if (action === 'apply') {
        await refactorService.applyAllChanges();
      } else {
        refactorService.rejectAllChanges();
      }
    }),

    // Find all references
    vscode.commands.registerCommand('recoder.refactor.findReferences', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
      const currentWord = wordRange ? editor.document.getText(wordRange) : '';

      const symbol = await vscode.window.showInputBox({
        prompt: 'Symbol to find',
        value: currentWord,
        placeHolder: 'e.g., myFunction, MyClass',
      });

      if (!symbol) {
        return;
      }

      const locations = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Finding references to "${symbol}"`,
          cancellable: false,
        },
        async () => {
          return refactorService.findSymbolOccurrences(symbol, { scope: 'workspace' });
        }
      );

      if (locations.length === 0) {
        vscode.window.showInformationMessage(`No references found for "${symbol}"`);
        return;
      }

      // Show in references panel
      await vscode.commands.executeCommand(
        'editor.action.showReferences',
        editor.document.uri,
        editor.selection.active,
        locations
      );
    }),

    // Apply pending changes
    vscode.commands.registerCommand('recoder.refactor.applyAll', async () => {
      const pendingChanges = refactorService.getPendingChanges();
      if (pendingChanges.size === 0) {
        vscode.window.showInformationMessage('No pending changes to apply');
        return;
      }

      await refactorService.applyAllChanges();
    }),

    // Reject pending changes
    vscode.commands.registerCommand('recoder.refactor.rejectAll', () => {
      const pendingChanges = refactorService.getPendingChanges();
      if (pendingChanges.size === 0) {
        vscode.window.showInformationMessage('No pending changes to reject');
        return;
      }

      refactorService.rejectAllChanges();
    }),

    // Show diff for a specific file
    vscode.commands.registerCommand('recoder.refactor.showDiff', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showWarningMessage('No file selected');
        return;
      }

      await refactorService.showDiff(targetUri);
    }),
  ];
}

/**
 * Show refactoring preview with file changes
 */
async function showRefactorPreview(
  files: { uri: vscode.Uri; changes: { oldText: string; newText: string; description?: string }[] }[],
  summary: string,
  refactorService: MultiFileRefactorService
): Promise<'apply' | 'reject'> {
  // Create quick pick items for each file
  const items: (vscode.QuickPickItem & { uri?: vscode.Uri })[] = [
    {
      label: '$(check) Apply All Changes',
      description: summary,
      alwaysShow: true,
    },
    {
      label: '$(x) Reject All Changes',
      description: 'Discard all pending changes',
      alwaysShow: true,
    },
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    ...files.map(file => ({
      label: `$(file) ${file.uri.fsPath.split('/').pop()}`,
      description: `${file.changes.length} change(s)`,
      detail: file.uri.fsPath,
      uri: file.uri,
    })),
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `${summary} - Select to view diff or apply/reject`,
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) {
    return 'reject';
  }

  if (selected.label.includes('Apply All')) {
    return 'apply';
  }

  if (selected.label.includes('Reject All')) {
    return 'reject';
  }

  // Show diff for selected file
  if (selected.uri) {
    await refactorService.showDiff(selected.uri);
    // Recursively show preview again
    return showRefactorPreview(files, summary, refactorService);
  }

  return 'reject';
}
