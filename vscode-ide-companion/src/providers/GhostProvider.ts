/**
 * Ghost Provider - Inline Code Suggestions (Copilot-like)
 * Shows AI-powered code completions as ghost text while typing
 */

import * as vscode from 'vscode';
import { ProviderService } from '../services/ProviderService.js';
import { RecoderAuthService } from '../services/RecoderAuthService.js';

interface CompletionCache {
  prefix: string;
  suffix: string;
  completion: string;
  timestamp: number;
}

interface PendingRequest {
  controller: AbortController;
  promise: Promise<string | null>;
}

export class GhostProvider implements vscode.InlineCompletionItemProvider {
  private cache: Map<string, CompletionCache> = new Map();
  private pendingRequest: PendingRequest | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private enabled: boolean = true;
  private debounceDelay: number = 300; // ms
  private maxContextLines: number = 50;
  private cacheExpiryMs: number = 30000; // 30 seconds

  // Status bar item for showing completion status
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private providerService: ProviderService,
    private authService: RecoderAuthService,
    private context: vscode.ExtensionContext
  ) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.text = '$(sparkle) Recoder';
    this.statusBarItem.tooltip = 'Recoder Code Suggestions';
    this.statusBarItem.command = 'recoder.ghost.toggle';
    context.subscriptions.push(this.statusBarItem);

    // Load settings
    this.loadSettings();

    // Watch for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('recoderCode.inlineSuggestions')) {
        this.loadSettings();
      }
    });

    // Show status bar if enabled
    if (this.enabled) {
      this.statusBarItem.show();
    }
  }

  private loadSettings(): void {
    const config = vscode.workspace.getConfiguration('recoderCode.inlineSuggestions');
    this.enabled = config.get('enabled', true);
    this.debounceDelay = config.get('debounceDelay', 300);
    this.maxContextLines = config.get('maxContextLines', 50);

    if (this.enabled) {
      this.statusBarItem.text = '$(sparkle) Recoder';
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = '$(circle-slash) Recoder';
      this.statusBarItem.hide();
    }
  }

  /**
   * Toggle inline suggestions on/off
   */
  toggle(): void {
    this.enabled = !this.enabled;
    const config = vscode.workspace.getConfiguration('recoderCode.inlineSuggestions');
    config.update('enabled', this.enabled, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
      `Recoder inline suggestions ${this.enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Main entry point - VS Code calls this when it wants inline completions
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    // Check if enabled
    if (!this.enabled) {
      return null;
    }

    // Skip if triggered by automatic (typing) and we're in certain contexts
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      // Skip comments and strings for auto-trigger
      const lineText = document.lineAt(position.line).text;
      const beforeCursor = lineText.substring(0, position.character);

      // Skip if line is too short
      if (beforeCursor.trim().length < 3) {
        return null;
      }
    }

    // Cancel any pending request
    this.cancelPendingRequest();

    // Check cache first
    const cached = this.getCachedCompletion(document, position);
    if (cached) {
      return [this.createCompletionItem(cached, position)];
    }

    // Debounce the request
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve(null);
          return;
        }

        try {
          const completion = await this.fetchCompletion(document, position, token);

          if (completion && !token.isCancellationRequested) {
            // Cache the result
            this.cacheCompletion(document, position, completion);
            resolve([this.createCompletionItem(completion, position)]);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('Ghost completion error:', error);
          resolve(null);
        }
      }, this.debounceDelay);
    });
  }

  /**
   * Fetch completion from AI provider
   */
  private async fetchCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    // Update status bar
    this.statusBarItem.text = '$(loading~spin) Recoder';

    try {
      // Get context
      const { prefix, suffix, language } = this.getContext(document, position);

      // Get AI configuration
      const aiConfig = this.providerService.getAIConfiguration();
      const provider = this.providerService.getProvider(aiConfig.defaultProvider || 'openrouter');

      if (!provider) {
        return null;
      }

      // Get API key
      let apiKey = this.providerService.getApiKey(provider);

      // If no API key and it's openrouter, try to get from auth
      if (!apiKey && provider.id === 'openrouter') {
        apiKey = await this.authService.getOpenRouterApiKey();
      }

      if (!apiKey && !provider.isLocal) {
        return null;
      }

      // Build the prompt
      const prompt = this.buildPrompt(prefix, suffix, language);

      // Create abort controller
      const controller = new AbortController();

      // Store pending request
      const requestPromise = this.makeCompletionRequest(
        provider,
        aiConfig.defaultModel || 'anthropic/claude-3.5-sonnet',
        prompt,
        apiKey,
        controller.signal
      );

      this.pendingRequest = {
        controller,
        promise: requestPromise,
      };

      // Handle cancellation
      token.onCancellationRequested(() => {
        controller.abort();
      });

      const result = await requestPromise;
      return result;
    } finally {
      this.statusBarItem.text = '$(sparkle) Recoder';
      this.pendingRequest = null;
    }
  }

  /**
   * Make the actual API request
   */
  private async makeCompletionRequest(
    provider: any,
    model: string,
    prompt: string,
    apiKey: string | null,
    signal: AbortSignal
  ): Promise<string | null> {
    try {
      const client = this.providerService.getClient(provider, apiKey || undefined);

      const response = await client.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a code completion assistant. Complete the code naturally and concisely. Only output the completion, no explanations. If you cannot complete, output nothing.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.2,
        stop: ['\n\n', '```'],
      }, { signal } as any);

      const completion = response.choices[0]?.message?.content?.trim();

      if (!completion || completion.length === 0) {
        return null;
      }

      // Clean up the completion
      return this.cleanCompletion(completion);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null;
      }
      console.error('Completion request failed:', error);
      return null;
    }
  }

  /**
   * Build prompt for fill-in-the-middle completion
   */
  private buildPrompt(prefix: string, suffix: string, language: string): string {
    // Use fill-in-the-middle format
    return `Complete the following ${language} code. The cursor is at <CURSOR>. Only output the code that should be inserted at the cursor position.

\`\`\`${language}
${prefix}<CURSOR>${suffix}
\`\`\`

Completion:`;
  }

  /**
   * Get context around cursor position
   */
  private getContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { prefix: string; suffix: string; language: string } {
    const startLine = Math.max(0, position.line - this.maxContextLines);
    const endLine = Math.min(document.lineCount - 1, position.line + this.maxContextLines);

    // Get prefix (text before cursor)
    const prefixRange = new vscode.Range(startLine, 0, position.line, position.character);
    const prefix = document.getText(prefixRange);

    // Get suffix (text after cursor)
    const suffixRange = new vscode.Range(
      position.line,
      position.character,
      endLine,
      document.lineAt(endLine).text.length
    );
    const suffix = document.getText(suffixRange);

    // Map language ID to common name
    const languageMap: Record<string, string> = {
      typescript: 'TypeScript',
      typescriptreact: 'TypeScript (React)',
      javascript: 'JavaScript',
      javascriptreact: 'JavaScript (React)',
      python: 'Python',
      java: 'Java',
      csharp: 'C#',
      cpp: 'C++',
      c: 'C',
      go: 'Go',
      rust: 'Rust',
      ruby: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
      scala: 'Scala',
    };

    const language = languageMap[document.languageId] || document.languageId;

    return { prefix, suffix, language };
  }

  /**
   * Clean up AI response
   */
  private cleanCompletion(completion: string): string {
    // Remove markdown code blocks if present
    let cleaned = completion
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim();

    // Remove leading/trailing newlines
    cleaned = cleaned.replace(/^\n+/, '').replace(/\n+$/, '');

    // Take only the first meaningful chunk (up to double newline)
    const parts = cleaned.split(/\n\n/);
    if (parts.length > 0) {
      cleaned = parts[0];
    }

    return cleaned;
  }

  /**
   * Create the inline completion item
   */
  private createCompletionItem(
    completion: string,
    position: vscode.Position
  ): vscode.InlineCompletionItem {
    return new vscode.InlineCompletionItem(
      completion,
      new vscode.Range(position, position)
    );
  }

  /**
   * Cache management
   */
  private getCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
    return `${document.uri.toString()}:${position.line}:${position.character}`;
  }

  private getCachedCompletion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | null {
    const key = this.getCacheKey(document, position);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheExpiryMs) {
      this.cache.delete(key);
      return null;
    }

    // Verify the context still matches
    const { prefix, suffix } = this.getContext(document, position);
    if (cached.prefix !== prefix || cached.suffix !== suffix) {
      this.cache.delete(key);
      return null;
    }

    return cached.completion;
  }

  private cacheCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    completion: string
  ): void {
    const key = this.getCacheKey(document, position);
    const { prefix, suffix } = this.getContext(document, position);

    this.cache.set(key, {
      prefix,
      suffix,
      completion,
      timestamp: Date.now(),
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Cancel pending request
   */
  private cancelPendingRequest(): void {
    if (this.pendingRequest) {
      this.pendingRequest.controller.abort();
      this.pendingRequest = null;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancelPendingRequest();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.cache.clear();
    this.statusBarItem.dispose();
  }
}

/**
 * Register ghost provider commands
 */
export function registerGhostCommands(
  context: vscode.ExtensionContext,
  ghostProvider: GhostProvider
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('recoder.ghost.toggle', () => {
      ghostProvider.toggle();
    }),
    vscode.commands.registerCommand('recoder.ghost.clearCache', () => {
      ghostProvider.clearCache();
      vscode.window.showInformationMessage('Recoder completion cache cleared');
    }),
  ];
}
