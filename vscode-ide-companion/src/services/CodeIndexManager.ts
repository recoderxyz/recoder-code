/**
 * Code Index Manager
 * Provides workspace-wide code analysis, symbol indexing, and semantic search
 */

import * as vscode from 'vscode';

export interface IndexedSymbol {
  name: string;
  kind: vscode.SymbolKind;
  uri: vscode.Uri;
  range: vscode.Range;
  containerName?: string;
  detail?: string;
  language: string;
}

export interface IndexedFile {
  uri: vscode.Uri;
  language: string;
  symbols: IndexedSymbol[];
  lineCount: number;
  lastModified: number;
  imports: string[];
  exports: string[];
}

export interface ProjectInsights {
  totalFiles: number;
  totalLines: number;
  languageBreakdown: Record<string, number>;
  topSymbols: { name: string; count: number; kind: string }[];
  filesByLanguage: Record<string, number>;
  largestFiles: { path: string; lines: number }[];
  recentlyModified: { path: string; modified: Date }[];
  dependencies: string[];
}

export interface SearchResult {
  symbol: IndexedSymbol;
  score: number;
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy';
}

export class CodeIndexManager {
  private index: Map<string, IndexedFile> = new Map();
  private symbolIndex: Map<string, IndexedSymbol[]> = new Map();
  private isIndexing = false;
  private indexProgress: number = 0;
  private lastFullIndex: number = 0;
  private fileWatcher: vscode.FileSystemWatcher | null = null;

  // Status bar item for showing indexing progress
  private statusBarItem: vscode.StatusBarItem;

  constructor(private context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50
    );
    this.statusBarItem.command = 'recoder.codeIndex.showInsights';
    context.subscriptions.push(this.statusBarItem);

    // Set up file watcher
    this.setupFileWatcher();

    // Initial index after short delay
    setTimeout(() => this.indexWorkspace(), 2000);
  }

  /**
   * Set up file watcher for incremental updates
   */
  private setupFileWatcher(): void {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{ts,tsx,js,jsx,py,java,go,rs,rb,php,c,cpp,cs,swift,kt,scala}'
    );

    this.fileWatcher.onDidCreate((uri) => this.indexFile(uri));
    this.fileWatcher.onDidChange((uri) => this.indexFile(uri));
    this.fileWatcher.onDidDelete((uri) => this.removeFile(uri));

    this.context.subscriptions.push(this.fileWatcher);
  }

  /**
   * Index the entire workspace
   */
  async indexWorkspace(): Promise<void> {
    if (this.isIndexing) {
      return;
    }

    this.isIndexing = true;
    this.statusBarItem.text = '$(sync~spin) Indexing...';
    this.statusBarItem.show();

    try {
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,tsx,js,jsx,py,java,go,rs,rb,php,c,cpp,cs,swift,kt,scala}',
        '**/node_modules/**',
        5000 // Max files
      );

      const total = files.length;
      let processed = 0;

      for (const file of files) {
        await this.indexFile(file);
        processed++;
        this.indexProgress = (processed / total) * 100;

        if (processed % 50 === 0) {
          this.statusBarItem.text = `$(sync~spin) Indexing ${Math.round(this.indexProgress)}%`;
        }
      }

      this.lastFullIndex = Date.now();
      this.updateStatusBar();
    } catch (error) {
      console.error('Workspace indexing failed:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index a single file
   */
  async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const symbols = await this.extractSymbols(document);
      const imports = this.extractImports(document);
      const exports = this.extractExports(document);

      const indexedFile: IndexedFile = {
        uri,
        language: document.languageId,
        symbols,
        lineCount: document.lineCount,
        lastModified: Date.now(),
        imports,
        exports,
      };

      this.index.set(uri.toString(), indexedFile);

      // Update symbol index
      for (const symbol of symbols) {
        const key = symbol.name.toLowerCase();
        if (!this.symbolIndex.has(key)) {
          this.symbolIndex.set(key, []);
        }
        this.symbolIndex.get(key)!.push(symbol);
      }
    } catch (error) {
      // Silently ignore files that can't be indexed
    }
  }

  /**
   * Remove a file from the index
   */
  removeFile(uri: vscode.Uri): void {
    const key = uri.toString();
    const file = this.index.get(key);

    if (file) {
      // Remove symbols from symbol index
      for (const symbol of file.symbols) {
        const symbolKey = symbol.name.toLowerCase();
        const symbols = this.symbolIndex.get(symbolKey);
        if (symbols) {
          const filtered = symbols.filter(s => s.uri.toString() !== key);
          if (filtered.length > 0) {
            this.symbolIndex.set(symbolKey, filtered);
          } else {
            this.symbolIndex.delete(symbolKey);
          }
        }
      }

      this.index.delete(key);
    }
  }

  /**
   * Extract symbols from a document using VS Code's built-in symbol provider
   */
  private async extractSymbols(document: vscode.TextDocument): Promise<IndexedSymbol[]> {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      if (!symbols) {
        return this.extractSymbolsManually(document);
      }

      return this.flattenSymbols(symbols, document.uri, document.languageId);
    } catch {
      return this.extractSymbolsManually(document);
    }
  }

  /**
   * Flatten nested document symbols
   */
  private flattenSymbols(
    symbols: vscode.DocumentSymbol[],
    uri: vscode.Uri,
    language: string,
    containerName?: string
  ): IndexedSymbol[] {
    const result: IndexedSymbol[] = [];

    for (const symbol of symbols) {
      result.push({
        name: symbol.name,
        kind: symbol.kind,
        uri,
        range: symbol.range,
        containerName,
        detail: symbol.detail,
        language,
      });

      // Recursively process children
      if (symbol.children && symbol.children.length > 0) {
        result.push(...this.flattenSymbols(symbol.children, uri, language, symbol.name));
      }
    }

    return result;
  }

  /**
   * Manual symbol extraction for languages without symbol providers
   */
  private extractSymbolsManually(document: vscode.TextDocument): IndexedSymbol[] {
    const symbols: IndexedSymbol[] = [];
    const text = document.getText();
    const language = document.languageId;

    // Language-specific patterns
    const patterns = this.getLanguagePatterns(language);

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const position = document.positionAt(match.index);
        const name = match[pattern.nameGroup];

        if (name) {
          symbols.push({
            name,
            kind: pattern.kind,
            uri: document.uri,
            range: new vscode.Range(position, position.translate(0, name.length)),
            language,
          });
        }
      }
    }

    return symbols;
  }

  /**
   * Get regex patterns for symbol extraction
   */
  private getLanguagePatterns(language: string): { regex: RegExp; kind: vscode.SymbolKind; nameGroup: number }[] {
    const patterns: Record<string, { regex: RegExp; kind: vscode.SymbolKind; nameGroup: number }[]> = {
      typescript: [
        { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, kind: vscode.SymbolKind.Function, nameGroup: 1 },
        { regex: /(?:export\s+)?class\s+(\w+)/g, kind: vscode.SymbolKind.Class, nameGroup: 1 },
        { regex: /(?:export\s+)?interface\s+(\w+)/g, kind: vscode.SymbolKind.Interface, nameGroup: 1 },
        { regex: /(?:export\s+)?type\s+(\w+)/g, kind: vscode.SymbolKind.TypeParameter, nameGroup: 1 },
        { regex: /(?:export\s+)?const\s+(\w+)\s*=/g, kind: vscode.SymbolKind.Variable, nameGroup: 1 },
      ],
      python: [
        { regex: /def\s+(\w+)/g, kind: vscode.SymbolKind.Function, nameGroup: 1 },
        { regex: /class\s+(\w+)/g, kind: vscode.SymbolKind.Class, nameGroup: 1 },
      ],
      java: [
        { regex: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)?(\w+)\s*\(/g, kind: vscode.SymbolKind.Method, nameGroup: 1 },
        { regex: /class\s+(\w+)/g, kind: vscode.SymbolKind.Class, nameGroup: 1 },
        { regex: /interface\s+(\w+)/g, kind: vscode.SymbolKind.Interface, nameGroup: 1 },
      ],
      go: [
        { regex: /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g, kind: vscode.SymbolKind.Function, nameGroup: 1 },
        { regex: /type\s+(\w+)\s+struct/g, kind: vscode.SymbolKind.Struct, nameGroup: 1 },
        { regex: /type\s+(\w+)\s+interface/g, kind: vscode.SymbolKind.Interface, nameGroup: 1 },
      ],
      rust: [
        { regex: /fn\s+(\w+)/g, kind: vscode.SymbolKind.Function, nameGroup: 1 },
        { regex: /struct\s+(\w+)/g, kind: vscode.SymbolKind.Struct, nameGroup: 1 },
        { regex: /impl\s+(\w+)/g, kind: vscode.SymbolKind.Class, nameGroup: 1 },
        { regex: /trait\s+(\w+)/g, kind: vscode.SymbolKind.Interface, nameGroup: 1 },
      ],
    };

    // TypeScript and JavaScript share patterns
    patterns.typescriptreact = patterns.typescript;
    patterns.javascript = patterns.typescript;
    patterns.javascriptreact = patterns.typescript;

    return patterns[language] || [];
  }

  /**
   * Extract import statements from a document
   */
  private extractImports(document: vscode.TextDocument): string[] {
    const text = document.getText();
    const imports: string[] = [];
    const language = document.languageId;

    const patterns: Record<string, RegExp> = {
      typescript: /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      javascript: /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      python: /(?:from\s+(\S+)\s+import|import\s+(\S+))/g,
      java: /import\s+([\w.]+)/g,
      go: /import\s+(?:\(\s*)?["']([^"']+)["']/g,
    };

    const pattern = patterns[language];
    if (pattern) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const importPath = match[1] || match[2];
        if (importPath) {
          imports.push(importPath);
        }
      }
    }

    return imports;
  }

  /**
   * Extract export statements from a document
   */
  private extractExports(document: vscode.TextDocument): string[] {
    const text = document.getText();
    const exports: string[] = [];
    const language = document.languageId;

    if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(language)) {
      const pattern = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        exports.push(match[1]);
      }
    }

    return exports;
  }

  /**
   * Search for symbols by name
   */
  searchSymbols(query: string, limit: number = 50): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [name, symbols] of this.symbolIndex) {
      let score = 0;
      let matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy' = 'fuzzy';

      if (name === queryLower) {
        score = 100;
        matchType = 'exact';
      } else if (name.startsWith(queryLower)) {
        score = 80 - (name.length - queryLower.length);
        matchType = 'prefix';
      } else if (name.includes(queryLower)) {
        score = 60 - name.indexOf(queryLower);
        matchType = 'contains';
      } else if (this.fuzzyMatch(name, queryLower)) {
        score = 40;
        matchType = 'fuzzy';
      }

      if (score > 0) {
        for (const symbol of symbols) {
          results.push({ symbol, score, matchType });
        }
      }
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(str: string, query: string): boolean {
    let queryIndex = 0;
    for (let i = 0; i < str.length && queryIndex < query.length; i++) {
      if (str[i] === query[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === query.length;
  }

  /**
   * Get symbols by kind
   */
  getSymbolsByKind(kind: vscode.SymbolKind): IndexedSymbol[] {
    const results: IndexedSymbol[] = [];

    for (const file of this.index.values()) {
      for (const symbol of file.symbols) {
        if (symbol.kind === kind) {
          results.push(symbol);
        }
      }
    }

    return results;
  }

  /**
   * Get file by URI
   */
  getFile(uri: vscode.Uri): IndexedFile | undefined {
    return this.index.get(uri.toString());
  }

  /**
   * Get project insights
   */
  getProjectInsights(): ProjectInsights {
    const languageBreakdown: Record<string, number> = {};
    const filesByLanguage: Record<string, number> = {};
    const symbolCounts: Record<string, { count: number; kind: string }> = {};
    const dependencies = new Set<string>();
    const files: { path: string; lines: number; modified: number }[] = [];

    let totalLines = 0;

    for (const file of this.index.values()) {
      // Language stats
      languageBreakdown[file.language] = (languageBreakdown[file.language] || 0) + file.lineCount;
      filesByLanguage[file.language] = (filesByLanguage[file.language] || 0) + 1;

      totalLines += file.lineCount;

      // Symbol counts
      for (const symbol of file.symbols) {
        const key = symbol.name;
        if (!symbolCounts[key]) {
          symbolCounts[key] = { count: 0, kind: vscode.SymbolKind[symbol.kind] };
        }
        symbolCounts[key].count++;
      }

      // Dependencies
      for (const imp of file.imports) {
        if (!imp.startsWith('.') && !imp.startsWith('/')) {
          const pkg = imp.split('/')[0];
          dependencies.add(pkg);
        }
      }

      files.push({
        path: file.uri.fsPath,
        lines: file.lineCount,
        modified: file.lastModified,
      });
    }

    // Top symbols
    const topSymbols = Object.entries(symbolCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Largest files
    const largestFiles = files
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10)
      .map(f => ({ path: f.path, lines: f.lines }));

    // Recently modified
    const recentlyModified = files
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 10)
      .map(f => ({ path: f.path, modified: new Date(f.modified) }));

    return {
      totalFiles: this.index.size,
      totalLines,
      languageBreakdown,
      topSymbols,
      filesByLanguage,
      largestFiles,
      recentlyModified,
      dependencies: Array.from(dependencies).sort(),
    };
  }

  /**
   * Find all usages of a symbol
   */
  async findUsages(symbolName: string): Promise<vscode.Location[]> {
    const locations: vscode.Location[] = [];
    const pattern = new RegExp(`\\b${symbolName}\\b`, 'g');

    for (const file of this.index.values()) {
      try {
        const document = await vscode.workspace.openTextDocument(file.uri);
        const text = document.getText();
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(text)) !== null) {
          const position = document.positionAt(match.index);
          locations.push(new vscode.Location(
            file.uri,
            new vscode.Range(position, position.translate(0, symbolName.length))
          ));
        }
      } catch {
        // Skip files that can't be opened
      }
    }

    return locations;
  }

  /**
   * Get related files (files that import or are imported by a given file)
   */
  getRelatedFiles(uri: vscode.Uri): { imports: vscode.Uri[]; importedBy: vscode.Uri[] } {
    const file = this.index.get(uri.toString());
    const imports: vscode.Uri[] = [];
    const importedBy: vscode.Uri[] = [];

    if (!file) {
      return { imports, importedBy };
    }

    const fileName = uri.fsPath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';

    for (const [, otherFile] of this.index) {
      // Check if this file imports the target
      for (const imp of otherFile.imports) {
        if (imp.includes(fileName)) {
          importedBy.push(otherFile.uri);
          break;
        }
      }

      // Check if target imports this file
      const otherFileName = otherFile.uri.fsPath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
      for (const imp of file.imports) {
        if (imp.includes(otherFileName)) {
          imports.push(otherFile.uri);
          break;
        }
      }
    }

    return { imports, importedBy };
  }

  /**
   * Update status bar with index stats
   */
  private updateStatusBar(): void {
    const insights = this.getProjectInsights();
    this.statusBarItem.text = `$(database) ${insights.totalFiles} files indexed`;
    this.statusBarItem.tooltip = `${insights.totalLines.toLocaleString()} lines of code\nClick for insights`;
    this.statusBarItem.show();
  }

  /**
   * Force re-index
   */
  async reindex(): Promise<void> {
    this.index.clear();
    this.symbolIndex.clear();
    await this.indexWorkspace();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    this.statusBarItem.dispose();
    this.index.clear();
    this.symbolIndex.clear();
  }
}

/**
 * Register code index commands
 */
export function registerCodeIndexCommands(
  context: vscode.ExtensionContext,
  codeIndex: CodeIndexManager
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('recoder.codeIndex.reindex', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Re-indexing workspace...',
          cancellable: false,
        },
        async () => {
          await codeIndex.reindex();
        }
      );
      vscode.window.showInformationMessage('Workspace re-indexed successfully');
    }),

    vscode.commands.registerCommand('recoder.codeIndex.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search for symbol',
        placeHolder: 'e.g., UserService, handleClick, fetchData',
      });

      if (!query) {
        return;
      }

      const results = codeIndex.searchSymbols(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`No symbols found matching "${query}"`);
        return;
      }

      const items = results.map(r => ({
        label: `$(symbol-${getSymbolIconName(r.symbol.kind)}) ${r.symbol.name}`,
        description: r.symbol.containerName || '',
        detail: `${r.symbol.uri.fsPath.split('/').pop()} (${r.matchType})`,
        symbol: r.symbol,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select symbol to navigate to',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        const doc = await vscode.workspace.openTextDocument(selected.symbol.uri);
        const editor = await vscode.window.showTextDocument(doc);
        editor.selection = new vscode.Selection(
          selected.symbol.range.start,
          selected.symbol.range.end
        );
        editor.revealRange(selected.symbol.range, vscode.TextEditorRevealType.InCenter);
      }
    }),

    vscode.commands.registerCommand('recoder.codeIndex.showInsights', async () => {
      const insights = codeIndex.getProjectInsights();

      // Create a markdown document with insights
      const content = generateInsightsMarkdown(insights);

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown',
      });

      await vscode.window.showTextDocument(doc, { preview: true });
    }),

    vscode.commands.registerCommand('recoder.codeIndex.findUsages', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
      const word = wordRange ? editor.document.getText(wordRange) : '';

      const symbolName = await vscode.window.showInputBox({
        prompt: 'Find usages of symbol',
        value: word,
      });

      if (!symbolName) {
        return;
      }

      const locations = await codeIndex.findUsages(symbolName);

      if (locations.length === 0) {
        vscode.window.showInformationMessage(`No usages found for "${symbolName}"`);
        return;
      }

      await vscode.commands.executeCommand(
        'editor.action.showReferences',
        editor.document.uri,
        editor.selection.active,
        locations
      );
    }),
  ];
}

/**
 * Get icon name for symbol kind
 */
function getSymbolIconName(kind: vscode.SymbolKind): string {
  const iconMap: Record<number, string> = {
    [vscode.SymbolKind.File]: 'file',
    [vscode.SymbolKind.Module]: 'module',
    [vscode.SymbolKind.Namespace]: 'namespace',
    [vscode.SymbolKind.Package]: 'package',
    [vscode.SymbolKind.Class]: 'class',
    [vscode.SymbolKind.Method]: 'method',
    [vscode.SymbolKind.Property]: 'property',
    [vscode.SymbolKind.Field]: 'field',
    [vscode.SymbolKind.Constructor]: 'constructor',
    [vscode.SymbolKind.Enum]: 'enum',
    [vscode.SymbolKind.Interface]: 'interface',
    [vscode.SymbolKind.Function]: 'function',
    [vscode.SymbolKind.Variable]: 'variable',
    [vscode.SymbolKind.Constant]: 'constant',
    [vscode.SymbolKind.String]: 'string',
    [vscode.SymbolKind.Number]: 'number',
    [vscode.SymbolKind.Boolean]: 'boolean',
    [vscode.SymbolKind.Array]: 'array',
    [vscode.SymbolKind.Object]: 'object',
    [vscode.SymbolKind.Key]: 'key',
    [vscode.SymbolKind.Null]: 'null',
    [vscode.SymbolKind.EnumMember]: 'enum-member',
    [vscode.SymbolKind.Struct]: 'struct',
    [vscode.SymbolKind.Event]: 'event',
    [vscode.SymbolKind.Operator]: 'operator',
    [vscode.SymbolKind.TypeParameter]: 'type-parameter',
  };

  return iconMap[kind] || 'symbol-misc';
}

/**
 * Generate markdown content for insights
 */
function generateInsightsMarkdown(insights: ProjectInsights): string {
  return `# 📊 Project Insights

## Overview
- **Total Files:** ${insights.totalFiles.toLocaleString()}
- **Total Lines:** ${insights.totalLines.toLocaleString()}
- **Dependencies:** ${insights.dependencies.length}

## Language Breakdown

| Language | Files | Lines |
|----------|-------|-------|
${Object.entries(insights.filesByLanguage)
  .sort((a, b) => b[1] - a[1])
  .map(([lang, count]) => `| ${lang} | ${count} | ${insights.languageBreakdown[lang]?.toLocaleString() || 0} |`)
  .join('\n')}

## Top Symbols

| Symbol | Count | Kind |
|--------|-------|------|
${insights.topSymbols.slice(0, 15).map(s => `| ${s.name} | ${s.count} | ${s.kind} |`).join('\n')}

## Largest Files

| File | Lines |
|------|-------|
${insights.largestFiles.map(f => `| ${f.path.split('/').pop()} | ${f.lines.toLocaleString()} |`).join('\n')}

## Dependencies (External)
${insights.dependencies.slice(0, 20).map(d => `- ${d}`).join('\n')}
${insights.dependencies.length > 20 ? `\n*... and ${insights.dependencies.length - 20} more*` : ''}
`;
}
