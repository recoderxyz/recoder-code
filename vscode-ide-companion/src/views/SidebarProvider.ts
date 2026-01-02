/**
 * Sidebar Panel - Main Provider
 * Comprehensive sidebar with providers, models, chat history, and quick actions
 */

import * as vscode from 'vscode';
import { ProviderService, AIProvider } from '../services/ProviderService.js';
import { RecoderAuthService } from '../services/RecoderAuthService.js';
import { ChatHistorySyncService, ChatSession } from '../services/ChatHistorySyncService.js';

// ─────────────────────────────────────────────────────────────
// AUTH STATUS VIEW
// ─────────────────────────────────────────────────────────────

export class AuthStatusViewProvider implements vscode.TreeDataProvider<AuthStatusItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AuthStatusItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private authService: RecoderAuthService,
    private context: vscode.ExtensionContext
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: AuthStatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<AuthStatusItem[]> {
    const items: AuthStatusItem[] = [];
    
    try {
      const isAuth = await this.authService.isAuthenticated();
      
      if (isAuth) {
        const authData = await this.authService.getAuthData();
        if (authData) {
          items.push(new AuthStatusItem(
            `✅ ${authData.user.name}`,
            authData.user.email,
            'authenticated',
            vscode.TreeItemCollapsibleState.None
          ));
          
          items.push(new AuthStatusItem(
            `📊 ${authData.user.subscription_plan.toUpperCase()} Plan`,
            `${authData.user.quota.requests_remaining}/${authData.user.quota.requests_limit} requests`,
            'quota',
            vscode.TreeItemCollapsibleState.None
          ));
        }
      } else {
        items.push(new AuthStatusItem(
          '🔐 Not logged in',
          'Click to login',
          'login',
          vscode.TreeItemCollapsibleState.None,
          { command: 'recoder.auth.login', title: 'Login' }
        ));
      }
    } catch {
      items.push(new AuthStatusItem(
        '⚠️ Auth Error',
        'Click to retry',
        'error',
        vscode.TreeItemCollapsibleState.None,
        { command: 'recoder.authStatus.refresh', title: 'Refresh' }
      ));
    }

    return items;
  }
}

class AuthStatusItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly type: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${label}: ${description}`;
    this.contextValue = type;
  }
}

// ─────────────────────────────────────────────────────────────
// MODEL SELECTOR VIEW
// ─────────────────────────────────────────────────────────────

export class ModelSelectorViewProvider implements vscode.TreeDataProvider<ModelItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ModelItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private providerService: ProviderService,
    private context: vscode.ExtensionContext
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ModelItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ModelItem): Promise<ModelItem[]> {
    const items: ModelItem[] = [];
    const config = this.providerService.getAIConfiguration();

    if (!element) {
      // Root level - show current model
      const currentModel = config.defaultModel || 'Not selected';
      items.push(new ModelItem(
        `🤖 ${currentModel}`,
        'Current Model',
        'current',
        vscode.TreeItemCollapsibleState.None,
        { command: 'recoder.models.select', title: 'Change Model' }
      ));

      // Quick switch section
      items.push(new ModelItem(
        '⚡ Quick Switch',
        'Popular models',
        'section',
        vscode.TreeItemCollapsibleState.Expanded
      ));
    } else if (element.type === 'section') {
      // Popular models for quick switch
      const popularModels = [
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Best for coding' },
        { id: 'openai/gpt-4o', name: 'GPT-4o', desc: 'OpenAI flagship' },
        { id: 'meta-llama/llama-3.1-70b', name: 'Llama 3.1 70B', desc: 'Open source' },
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', desc: 'Google AI' },
        { id: 'ollama/llama3.2', name: 'Llama 3.2 (Local)', desc: 'Ollama' }
      ];

      for (const model of popularModels) {
        items.push(new ModelItem(
          model.name,
          model.desc,
          'model',
          vscode.TreeItemCollapsibleState.None,
          { 
            command: 'recoder.sidebar.setModel', 
            title: 'Select Model',
            arguments: [model.id]
          }
        ));
      }
    }

    return items;
  }
}

class ModelItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly type: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${label}: ${description}`;
    this.contextValue = type;
    
    if (type === 'model') {
      this.iconPath = new vscode.ThemeIcon('symbol-method');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// PROVIDERS VIEW
// ─────────────────────────────────────────────────────────────

export class ProvidersViewProvider implements vscode.TreeDataProvider<ProviderItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProviderItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private providerService: ProviderService,
    private context: vscode.ExtensionContext
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ProviderItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProviderItem): Promise<ProviderItem[]> {
    const items: ProviderItem[] = [];

    if (!element) {
      // Local providers section
      items.push(new ProviderItem(
        '🏠 Local AI',
        '',
        'section',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        true
      ));

      // Cloud providers section
      items.push(new ProviderItem(
        '☁️ Cloud Providers',
        '',
        'section',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        false
      ));
    } else if (element.type === 'section') {
      const providers = element.isLocal 
        ? this.providerService.getLocalProviders()
        : this.providerService.getCloudProviders();

      for (const provider of providers) {
        const status = element.isLocal
          ? await this.checkLocalProviderStatus(provider)
          : this.providerService.hasApiKey(provider);

        const statusIcon = status ? '✅' : '⚙️';
        const statusText = status 
          ? (element.isLocal ? 'Running' : 'Configured')
          : (element.isLocal ? 'Not detected' : 'Configure');

        items.push(new ProviderItem(
          `${statusIcon} ${provider.name}`,
          statusText,
          'provider',
          vscode.TreeItemCollapsibleState.None,
          {
            command: status ? 'recoder.sidebar.useProvider' : 'recoder.settings.open',
            title: status ? 'Use Provider' : 'Configure',
            arguments: [provider.id]
          },
          element.isLocal,
          provider
        ));
      }
    }

    return items;
  }

  private async checkLocalProviderStatus(provider: AIProvider): Promise<boolean> {
    try {
      const result = await this.providerService.checkLocalProvider(provider);
      return result.available;
    } catch {
      return false;
    }
  }
}

class ProviderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly type: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly isLocal?: boolean,
    public readonly provider?: AIProvider
  ) {
    super(label, collapsibleState);
    this.tooltip = provider?.description || `${label}: ${description}`;
    this.contextValue = type;
    
    if (type === 'provider') {
      this.iconPath = isLocal 
        ? new vscode.ThemeIcon('server-environment')
        : new vscode.ThemeIcon('cloud');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CHAT HISTORY VIEW (with cloud sync)
// ─────────────────────────────────────────────────────────────

export class ChatHistoryViewProvider implements vscode.TreeDataProvider<ChatHistoryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ChatHistoryItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private syncService: ChatHistorySyncService;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: RecoderAuthService
  ) {
    this.syncService = new ChatHistorySyncService(context, authService);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getSyncService(): ChatHistorySyncService {
    return this.syncService;
  }

  getTreeItem(element: ChatHistoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ChatHistoryItem[]> {
    const items: ChatHistoryItem[] = [];

    try {
      // Get chat history (cloud-synced if authenticated)
      const history = await this.syncService.getChatHistory();
      const syncStatus = await this.syncService.getSyncStatus();

      // Show sync status indicator
      if (syncStatus.syncEnabled) {
        if (syncStatus.pendingChanges > 0) {
          items.push(new ChatHistoryItem(
            `☁️ ${syncStatus.pendingChanges} pending sync`,
            'Click to sync now',
            'sync-pending',
            vscode.TreeItemCollapsibleState.None,
            { command: 'recoder.chatHistory.syncNow', title: 'Sync Now' }
          ));
        } else {
          items.push(new ChatHistoryItem(
            '☁️ Synced with recoder.xyz',
            syncStatus.lastSyncAt ? `Last: ${getTimeAgo(new Date(syncStatus.lastSyncAt))}` : '',
            'sync-status',
            vscode.TreeItemCollapsibleState.None
          ));
        }
      }

      if (history.length === 0) {
        items.push(new ChatHistoryItem(
          '💬 No conversations yet',
          'Start a new chat',
          'empty',
          vscode.TreeItemCollapsibleState.None,
          { command: 'recoder.chat.open', title: 'Open Chat' }
        ));
      } else {
        // Show recent chats (max 15)
        const recentChats = history.slice(0, 15);

        for (const chat of recentChats) {
          const timeAgo = getTimeAgo(new Date(chat.timestamp));
          const sourceIcon = chat.source === 'web' ? '🌐' : chat.source === 'cli' ? '⌨️' : '💻';
          items.push(new ChatHistoryItem(
            chat.title,
            `${sourceIcon} ${timeAgo}`,
            'chat',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'recoder.sidebar.resumeChat',
              title: 'Resume Chat',
              arguments: [chat.urlId]
            }
          ));
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      items.push(new ChatHistoryItem(
        '⚠️ Failed to load history',
        'Click to retry',
        'error',
        vscode.TreeItemCollapsibleState.None,
        { command: 'recoder.chatHistory.refresh', title: 'Retry' }
      ));
    }

    // Add "New Chat" button
    items.push(new ChatHistoryItem(
      '➕ New Chat',
      '',
      'action',
      vscode.TreeItemCollapsibleState.None,
      { command: 'recoder.chat.open', title: 'New Chat' }
    ));

    return items;
  }
}

class ChatHistoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly type: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${label} - ${description}`;
    this.contextValue = type;
    
    if (type === 'chat') {
      this.iconPath = new vscode.ThemeIcon('comment-discussion');
    } else if (type === 'action') {
      this.iconPath = new vscode.ThemeIcon('add');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS VIEW
// ─────────────────────────────────────────────────────────────

export class QuickActionsViewProvider implements vscode.TreeDataProvider<QuickActionItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<QuickActionItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: QuickActionItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<QuickActionItem[]> {
    return [
      new QuickActionItem(
        '💬 Open Chat',
        'Start AI conversation',
        { command: 'recoder.chat.open', title: 'Open Chat' },
        'comment-discussion'
      ),
      new QuickActionItem(
        '⚙️ Settings',
        'Configure providers & preferences',
        { command: 'recoder.settings.open', title: 'Settings' },
        'settings-gear'
      ),
      new QuickActionItem(
        '🔍 Select Model',
        'Choose AI model',
        { command: 'recoder.models.select', title: 'Select Model' },
        'symbol-method'
      ),
      new QuickActionItem(
        '📡 Detect Local AI',
        'Find Ollama, LM Studio',
        { command: 'recoder.providers.detectLocal', title: 'Detect' },
        'search'
      ),
      new QuickActionItem(
        '📖 Documentation',
        'Open help & docs',
        { command: 'recoder.openWebsite', title: 'Docs' },
        'book'
      ),
      new QuickActionItem(
        '⭐ Star on GitHub',
        'Support the project',
        { command: 'recoder.openGitHub', title: 'GitHub' },
        'github'
      )
    ];
  }
}

class QuickActionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly command: vscode.Command,
    iconId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR COMMANDS
// ─────────────────────────────────────────────────────────────

export function registerSidebarCommands(
  context: vscode.ExtensionContext,
  providerService: ProviderService
): vscode.Disposable[] {
  return [
    // Set model from sidebar
    vscode.commands.registerCommand('recoder.sidebar.setModel', async (modelId: string) => {
      await providerService.setDefaultModel(modelId);
      vscode.window.showInformationMessage(`Switched to model: ${modelId}`);
    }),

    // Use provider from sidebar
    vscode.commands.registerCommand('recoder.sidebar.useProvider', async (providerId: string) => {
      await providerService.setDefaultProvider(providerId);
      vscode.window.showInformationMessage(`Switched to provider: ${providerId}`);
    }),

    // Resume chat from history
    vscode.commands.registerCommand('recoder.sidebar.resumeChat', async (chatId: string) => {
      // Open chat panel with specific conversation
      await vscode.commands.executeCommand('recoder.chat.open', { chatId });
    }),

    // Refresh all sidebar views
    vscode.commands.registerCommand('recoder.sidebar.refresh', () => {
      vscode.commands.executeCommand('recoder.authStatus.refresh');
      vscode.commands.executeCommand('recoder.models.refresh');
      vscode.commands.executeCommand('recoder.providers.refresh');
    })
  ];
}
