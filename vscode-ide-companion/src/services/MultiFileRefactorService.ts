/**
 * Multi-File Refactor Service
 * Handles refactoring operations across multiple files in the workspace
 */

import * as vscode from 'vscode';
import { ProviderService } from './ProviderService.js';
import { RecoderAuthService } from './RecoderAuthService.js';

export interface FileChange {
  uri: vscode.Uri;
  originalContent: string;
  newContent: string;
  changes: TextChange[];
}

export interface TextChange {
  range: vscode.Range;
  oldText: string;
  newText: string;
  description?: string;
}

export interface RefactorResult {
  success: boolean;
  files: FileChange[];
  summary: string;
  error?: string;
}

export interface RefactorOptions {
  pattern: string; // What to refactor (symbol name, pattern, etc.)
  replacement?: string; // Optional replacement (for rename)
  type: 'rename' | 'extract' | 'inline' | 'move' | 'custom';
  scope: 'file' | 'folder' | 'workspace';
  includePattern?: string; // Glob pattern for files to include
  excludePattern?: string; // Glob pattern for files to exclude
  aiPrompt?: string; // Custom AI prompt for refactoring
}

export class MultiFileRefactorService {
  private pendingChanges: Map<string, FileChange> = new Map();

  constructor(
    private providerService: ProviderService,
    private authService: RecoderAuthService,
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Find all occurrences of a symbol across the workspace
   */
  async findSymbolOccurrences(
    symbol: string,
    options: Partial<RefactorOptions> = {}
  ): Promise<vscode.Location[]> {
    const locations: vscode.Location[] = [];

    // Get files to search
    const files = await this.getFilesToSearch(options);

    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();

        // Find all occurrences using regex
        const regex = new RegExp(`\\b${this.escapeRegex(symbol)}\\b`, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const position = document.positionAt(match.index);
          const range = new vscode.Range(
            position,
            position.translate(0, symbol.length)
          );
          locations.push(new vscode.Location(file, range));
        }
      } catch (error) {
        console.error(`Error searching file ${file.fsPath}:`, error);
      }
    }

    return locations;
  }

  /**
   * Rename a symbol across all files
   */
  async renameSymbol(
    oldName: string,
    newName: string,
    options: Partial<RefactorOptions> = {}
  ): Promise<RefactorResult> {
    const locations = await this.findSymbolOccurrences(oldName, options);

    if (locations.length === 0) {
      return {
        success: false,
        files: [],
        summary: `No occurrences of "${oldName}" found`,
        error: 'Symbol not found',
      };
    }

    // Group locations by file
    const fileMap = new Map<string, vscode.Location[]>();
    for (const location of locations) {
      const key = location.uri.toString();
      if (!fileMap.has(key)) {
        fileMap.set(key, []);
      }
      fileMap.get(key)!.push(location);
    }

    const fileChanges: FileChange[] = [];

    for (const [uriString, fileLocations] of fileMap) {
      const uri = vscode.Uri.parse(uriString);
      const document = await vscode.workspace.openTextDocument(uri);
      const originalContent = document.getText();

      // Sort locations in reverse order (to apply from end to start)
      const sortedLocations = fileLocations.sort((a, b) =>
        b.range.start.compareTo(a.range.start)
      );

      let newContent = originalContent;
      const changes: TextChange[] = [];

      for (const location of sortedLocations) {
        const startOffset = document.offsetAt(location.range.start);
        const endOffset = document.offsetAt(location.range.end);

        newContent =
          newContent.substring(0, startOffset) +
          newName +
          newContent.substring(endOffset);

        changes.push({
          range: location.range,
          oldText: oldName,
          newText: newName,
          description: `Rename "${oldName}" to "${newName}"`,
        });
      }

      fileChanges.push({
        uri,
        originalContent,
        newContent,
        changes: changes.reverse(), // Reverse back to normal order
      });
    }

    // Store pending changes
    for (const change of fileChanges) {
      this.pendingChanges.set(change.uri.toString(), change);
    }

    return {
      success: true,
      files: fileChanges,
      summary: `Found ${locations.length} occurrences in ${fileChanges.length} files`,
    };
  }

  /**
   * AI-powered refactoring across multiple files
   */
  async aiRefactor(
    prompt: string,
    options: Partial<RefactorOptions> = {}
  ): Promise<RefactorResult> {
    const files = await this.getFilesToSearch(options);

    if (files.length === 0) {
      return {
        success: false,
        files: [],
        summary: 'No files found matching the criteria',
        error: 'No files to refactor',
      };
    }

    // Limit to reasonable number of files
    const maxFiles = 10;
    const filesToProcess = files.slice(0, maxFiles);

    if (files.length > maxFiles) {
      vscode.window.showWarningMessage(
        `Found ${files.length} files. Processing first ${maxFiles} to avoid timeout.`
      );
    }

    const fileChanges: FileChange[] = [];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI Refactoring',
        cancellable: true,
      },
      async (progress, token) => {
        for (let i = 0; i < filesToProcess.length; i++) {
          if (token.isCancellationRequested) {
            break;
          }

          const file = filesToProcess[i];
          progress.report({
            message: `Processing ${file.fsPath.split('/').pop()} (${i + 1}/${filesToProcess.length})`,
            increment: (100 / filesToProcess.length),
          });

          try {
            const document = await vscode.workspace.openTextDocument(file);
            const originalContent = document.getText();

            // Get AI refactoring suggestion
            const newContent = await this.getAIRefactoring(
              originalContent,
              document.languageId,
              prompt
            );

            if (newContent && newContent !== originalContent) {
              const changes = this.computeChanges(document, originalContent, newContent);

              fileChanges.push({
                uri: file,
                originalContent,
                newContent,
                changes,
              });
            }
          } catch (error) {
            console.error(`Error processing ${file.fsPath}:`, error);
          }
        }
      }
    );

    // Store pending changes
    for (const change of fileChanges) {
      this.pendingChanges.set(change.uri.toString(), change);
    }

    return {
      success: fileChanges.length > 0,
      files: fileChanges,
      summary: `Modified ${fileChanges.length} of ${filesToProcess.length} files`,
    };
  }

  /**
   * Get AI refactoring suggestion for a file
   */
  private async getAIRefactoring(
    content: string,
    language: string,
    prompt: string
  ): Promise<string | null> {
    try {
      const aiConfig = this.providerService.getAIConfiguration();
      const provider = this.providerService.getProvider(aiConfig.defaultProvider || 'openrouter');

      if (!provider) {
        return null;
      }

      let apiKey = this.providerService.getApiKey(provider);
      if (!apiKey && provider.id === 'openrouter') {
        apiKey = await this.authService.getOpenRouterApiKey();
      }

      if (!apiKey && !provider.isLocal) {
        return null;
      }

      const client = this.providerService.getClient(provider, apiKey || undefined);

      const response = await client.chat.completions.create({
        model: aiConfig.defaultModel || 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: `You are a code refactoring assistant. Apply the requested refactoring to the code. Output ONLY the refactored code, no explanations or markdown. If no changes are needed, output the original code unchanged.`,
          },
          {
            role: 'user',
            content: `Refactor the following ${language} code according to this instruction: "${prompt}"\n\nCode:\n\`\`\`${language}\n${content}\n\`\`\`\n\nRefactored code:`,
          },
        ],
        max_tokens: 4096,
        temperature: 0.2,
      });

      let result = response.choices[0]?.message?.content?.trim();

      if (!result) {
        return null;
      }

      // Clean up markdown code blocks if present
      result = result
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/```$/gm, '')
        .trim();

      return result;
    } catch (error) {
      console.error('AI refactoring failed:', error);
      return null;
    }
  }

  /**
   * Compute text changes between original and new content
   */
  private computeChanges(
    document: vscode.TextDocument,
    original: string,
    modified: string
  ): TextChange[] {
    const changes: TextChange[] = [];
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    let lineNum = 0;
    let i = 0;
    let j = 0;

    while (i < originalLines.length || j < modifiedLines.length) {
      if (i >= originalLines.length) {
        // Added lines
        changes.push({
          range: new vscode.Range(lineNum, 0, lineNum, 0),
          oldText: '',
          newText: modifiedLines[j] + '\n',
          description: 'Added line',
        });
        j++;
        lineNum++;
      } else if (j >= modifiedLines.length) {
        // Deleted lines
        changes.push({
          range: new vscode.Range(lineNum, 0, lineNum + 1, 0),
          oldText: originalLines[i] + '\n',
          newText: '',
          description: 'Deleted line',
        });
        i++;
      } else if (originalLines[i] !== modifiedLines[j]) {
        // Modified line
        changes.push({
          range: new vscode.Range(lineNum, 0, lineNum, originalLines[i].length),
          oldText: originalLines[i],
          newText: modifiedLines[j],
          description: 'Modified line',
        });
        i++;
        j++;
        lineNum++;
      } else {
        // Unchanged
        i++;
        j++;
        lineNum++;
      }
    }

    return changes;
  }

  /**
   * Apply all pending changes
   */
  async applyAllChanges(): Promise<void> {
    const edit = new vscode.WorkspaceEdit();

    for (const [, change] of this.pendingChanges) {
      const fullRange = new vscode.Range(
        0, 0,
        change.originalContent.split('\n').length,
        0
      );
      edit.replace(change.uri, fullRange, change.newContent);
    }

    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      vscode.window.showInformationMessage(
        `Applied changes to ${this.pendingChanges.size} files`
      );
      this.pendingChanges.clear();
    } else {
      vscode.window.showErrorMessage('Failed to apply some changes');
    }
  }

  /**
   * Apply changes to a single file
   */
  async applyFileChanges(uri: vscode.Uri): Promise<boolean> {
    const change = this.pendingChanges.get(uri.toString());

    if (!change) {
      return false;
    }

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      0, 0,
      change.originalContent.split('\n').length,
      0
    );
    edit.replace(uri, fullRange, change.newContent);

    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      this.pendingChanges.delete(uri.toString());
    }

    return success;
  }

  /**
   * Reject all pending changes
   */
  rejectAllChanges(): void {
    this.pendingChanges.clear();
    vscode.window.showInformationMessage('All pending changes discarded');
  }

  /**
   * Reject changes for a single file
   */
  rejectFileChanges(uri: vscode.Uri): void {
    this.pendingChanges.delete(uri.toString());
  }

  /**
   * Get pending changes
   */
  getPendingChanges(): Map<string, FileChange> {
    return new Map(this.pendingChanges);
  }

  /**
   * Show diff for a file change
   */
  async showDiff(uri: vscode.Uri): Promise<void> {
    const change = this.pendingChanges.get(uri.toString());

    if (!change) {
      return;
    }

    // Create temporary URIs for diff
    const originalUri = uri.with({ scheme: 'recoder-refactor-original' });
    const modifiedUri = uri.with({ scheme: 'recoder-refactor-modified' });

    // Register content provider if not already
    this.registerDiffContentProvider(change);

    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      modifiedUri,
      `Refactor: ${uri.fsPath.split('/').pop()}`
    );
  }

  /**
   * Register temporary content provider for diff
   */
  private diffContentProviderRegistered = false;
  private currentDiffChange: FileChange | null = null;

  private registerDiffContentProvider(change: FileChange): void {
    this.currentDiffChange = change;

    if (this.diffContentProviderRegistered) {
      return;
    }

    const provider: vscode.TextDocumentContentProvider = {
      provideTextDocumentContent: (uri: vscode.Uri): string => {
        if (!this.currentDiffChange) {
          return '';
        }

        if (uri.scheme === 'recoder-refactor-original') {
          return this.currentDiffChange.originalContent;
        } else if (uri.scheme === 'recoder-refactor-modified') {
          return this.currentDiffChange.newContent;
        }

        return '';
      },
    };

    this.context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('recoder-refactor-original', provider),
      vscode.workspace.registerTextDocumentContentProvider('recoder-refactor-modified', provider)
    );

    this.diffContentProviderRegistered = true;
  }

  /**
   * Get files to search based on options
   */
  private async getFilesToSearch(options: Partial<RefactorOptions>): Promise<vscode.Uri[]> {
    const includePattern = options.includePattern || '**/*.{ts,tsx,js,jsx,py,java,go,rs,rb,php}';
    const excludePattern = options.excludePattern || '**/node_modules/**';

    const files = await vscode.workspace.findFiles(includePattern, excludePattern, 1000);

    // Filter by scope if needed
    if (options.scope === 'file') {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        return files.filter(f => f.toString() === activeEditor.document.uri.toString());
      }
    } else if (options.scope === 'folder') {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (folder) {
          return files.filter(f => f.fsPath.startsWith(folder.uri.fsPath));
        }
      }
    }

    return files;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
