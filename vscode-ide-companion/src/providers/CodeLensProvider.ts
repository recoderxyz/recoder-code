/**
 * Code Lens Provider
 * Shows AI actions above functions, classes, and methods
 */

import * as vscode from 'vscode';

interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface';
  range: vscode.Range;
  document: vscode.TextDocument;
}

export class RecoderCodeLensProvider implements vscode.CodeLensProvider {
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  private enabled: boolean = true;

  constructor() {
    // Watch for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('recoderCode.enableCodeLens')) {
        this.enabled = vscode.workspace.getConfiguration('recoderCode').get('enableCodeLens', true);
        this.onDidChangeCodeLensesEmitter.fire();
      }
    });

    this.enabled = vscode.workspace.getConfiguration('recoderCode').get('enableCodeLens', true);
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (!this.enabled) {
      return [];
    }

    const symbols = await this.detectSymbols(document);
    const codeLenses: vscode.CodeLens[] = [];

    for (const symbol of symbols) {
      if (token.isCancellationRequested) break;

      const range = new vscode.Range(symbol.range.start.line, 0, symbol.range.start.line, 0);

      // 🤖 Explain
      codeLenses.push(new vscode.CodeLens(range, {
        title: '🤖 Explain',
        command: 'recoder.codelens.explain',
        arguments: [document.uri, symbol.range, symbol.name]
      }));

      // ⚡ Refactor
      codeLenses.push(new vscode.CodeLens(range, {
        title: '⚡ Refactor',
        command: 'recoder.codelens.refactor',
        arguments: [document.uri, symbol.range, symbol.name]
      }));

      // 🧪 Generate Tests (only for functions/methods)
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        codeLenses.push(new vscode.CodeLens(range, {
          title: '🧪 Tests',
          command: 'recoder.codelens.generateTests',
          arguments: [document.uri, symbol.range, symbol.name]
        }));
      }

      // 📝 Add Comments
      codeLenses.push(new vscode.CodeLens(range, {
        title: '📝 Comments',
        command: 'recoder.codelens.addComments',
        arguments: [document.uri, symbol.range, symbol.name]
      }));

      // 💬 Ask AI
      codeLenses.push(new vscode.CodeLens(range, {
        title: '💬 Ask',
        command: 'recoder.codelens.askAI',
        arguments: [document.uri, symbol.range, symbol.name]
      }));
    }

    return codeLenses;
  }

  /**
   * Detect functions, classes, and methods in the document
   */
  private async detectSymbols(document: vscode.TextDocument): Promise<SymbolInfo[]> {
    const languageId = document.languageId;
    const text = document.getText();
    const symbols: SymbolInfo[] = [];

    // Try VS Code's built-in symbol provider first
    try {
      const vscodeSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      if (vscodeSymbols && vscodeSymbols.length > 0) {
        this.extractSymbols(vscodeSymbols, document, symbols);
        return symbols;
      }
    } catch {
      // Fall back to regex-based detection
    }

    // Language-specific regex patterns
    const patterns = this.getLanguagePatterns(languageId);
    
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        
        symbols.push({
          name: match[1] || 'anonymous',
          kind: pattern.kind,
          range: new vscode.Range(startPos, endPos),
          document
        });
      }
    }

    return symbols;
  }

  /**
   * Extract symbols from VS Code's DocumentSymbol
   */
  private extractSymbols(
    vscodeSymbols: vscode.DocumentSymbol[],
    document: vscode.TextDocument,
    symbols: SymbolInfo[]
  ): void {
    for (const sym of vscodeSymbols) {
      let kind: SymbolInfo['kind'] | null = null;

      switch (sym.kind) {
        case vscode.SymbolKind.Function:
          kind = 'function';
          break;
        case vscode.SymbolKind.Class:
          kind = 'class';
          break;
        case vscode.SymbolKind.Method:
          kind = 'method';
          break;
        case vscode.SymbolKind.Interface:
          kind = 'interface';
          break;
      }

      if (kind) {
        symbols.push({
          name: sym.name,
          kind,
          range: sym.range,
          document
        });
      }

      // Recursively extract nested symbols
      if (sym.children && sym.children.length > 0) {
        this.extractSymbols(sym.children, document, symbols);
      }
    }
  }

  /**
   * Get language-specific regex patterns for symbol detection
   */
  private getLanguagePatterns(languageId: string): Array<{ regex: RegExp; kind: SymbolInfo['kind'] }> {
    switch (languageId) {
      case 'typescript':
      case 'typescriptreact':
      case 'javascript':
      case 'javascriptreact':
        return [
          // Functions: function name(), async function name()
          { regex: /(?:async\s+)?function\s+(\w+)\s*\(/g, kind: 'function' },
          // Arrow functions: const name = () => or const name = async () =>
          { regex: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g, kind: 'function' },
          // Classes: class Name
          { regex: /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g, kind: 'class' },
          // Methods: name() { or async name() {
          { regex: /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm, kind: 'method' },
          // Interface: interface Name
          { regex: /interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/g, kind: 'interface' },
        ];

      case 'python':
        return [
          // Functions: def name() or async def name()
          { regex: /(?:async\s+)?def\s+(\w+)\s*\(/g, kind: 'function' },
          // Classes: class Name
          { regex: /class\s+(\w+)(?:\s*\([^)]*\))?\s*:/g, kind: 'class' },
        ];

      case 'java':
      case 'csharp':
        return [
          // Methods: public void name(), private int name(), etc.
          { regex: /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g, kind: 'method' },
          // Classes: class Name
          { regex: /(?:public|private|abstract|final|\s)*class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g, kind: 'class' },
          // Interfaces: interface Name
          { regex: /(?:public|private|\s)*interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/g, kind: 'interface' },
        ];

      case 'go':
        return [
          // Functions: func name() or func (r Receiver) name()
          { regex: /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/g, kind: 'function' },
          // Structs: type Name struct
          { regex: /type\s+(\w+)\s+struct\s*\{/g, kind: 'class' },
          // Interfaces: type Name interface
          { regex: /type\s+(\w+)\s+interface\s*\{/g, kind: 'interface' },
        ];

      case 'rust':
        return [
          // Functions: fn name() or pub fn name()
          { regex: /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g, kind: 'function' },
          // Structs: struct Name
          { regex: /(?:pub\s+)?struct\s+(\w+)(?:\s*<[^>]*>)?\s*[\{;]/g, kind: 'class' },
          // Impl blocks: impl Name
          { regex: /impl(?:\s*<[^>]*>)?\s+(\w+)(?:\s*<[^>]*>)?\s*(?:for\s+\w+(?:\s*<[^>]*>)?)?\s*\{/g, kind: 'class' },
          // Traits: trait Name
          { regex: /(?:pub\s+)?trait\s+(\w+)(?:\s*<[^>]*>)?\s*\{/g, kind: 'interface' },
        ];

      case 'ruby':
        return [
          // Methods: def name
          { regex: /def\s+(\w+)(?:\s*\([^)]*\))?\s*$/gm, kind: 'method' },
          // Classes: class Name
          { regex: /class\s+(\w+)(?:\s*<\s*\w+)?\s*$/gm, kind: 'class' },
          // Modules: module Name
          { regex: /module\s+(\w+)\s*$/gm, kind: 'class' },
        ];

      case 'php':
        return [
          // Functions: function name()
          { regex: /function\s+(\w+)\s*\(/g, kind: 'function' },
          // Methods: public function name()
          { regex: /(?:public|private|protected|static|\s)+function\s+(\w+)\s*\(/g, kind: 'method' },
          // Classes: class Name
          { regex: /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g, kind: 'class' },
          // Interfaces: interface Name
          { regex: /interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/g, kind: 'interface' },
        ];

      default:
        // Generic patterns that work for many C-style languages
        return [
          { regex: /(?:function|func|fn|def)\s+(\w+)\s*\(/g, kind: 'function' },
          { regex: /class\s+(\w+)/g, kind: 'class' },
        ];
    }
  }

  /**
   * Refresh code lenses
   */
  refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire();
  }

  /**
   * Enable or disable code lenses
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.onDidChangeCodeLensesEmitter.fire();
  }
}
