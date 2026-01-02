/**
 * Chat History Sync Service
 * Syncs chat history between VS Code extension and recoder.xyz cloud
 */

import * as vscode from 'vscode';
import { RecoderAuthService } from './RecoderAuthService.js';

const RECODER_WEB_URL = process.env['RECODER_WEB_URL'] || 'https://web.recoder.xyz';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  urlId: string;
  title: string;
  description?: string;
  timestamp: string;
  createdAt: string;
  messageCount: number;
  messages: ChatMessage[];
  metadata?: Record<string, any>;
  source?: 'web' | 'cli' | 'vscode';
}

export interface SyncStatus {
  lastSyncAt: string | null;
  pendingChanges: number;
  syncEnabled: boolean;
}

export class ChatHistorySyncService {
  private static readonly LOCAL_HISTORY_KEY = 'recoder.chatHistory';
  private static readonly SYNC_STATUS_KEY = 'recoder.chatSyncStatus';
  private static readonly PENDING_SYNC_KEY = 'recoder.pendingSyncChats';

  private syncInProgress = false;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: RecoderAuthService
  ) {}

  /**
   * Get chat history - from cloud if authenticated, otherwise local
   */
  async getChatHistory(): Promise<ChatSession[]> {
    const isAuth = await this.authService.isAuthenticated();

    if (isAuth) {
      try {
        // Try to fetch from cloud
        const cloudHistory = await this.fetchCloudHistory();
        // Merge with any pending local changes
        return this.mergeWithPendingChanges(cloudHistory);
      } catch (error) {
        console.error('Failed to fetch cloud history, using local:', error);
        // Fall back to local
        return this.getLocalHistory();
      }
    }

    return this.getLocalHistory();
  }

  /**
   * Save chat session - to cloud if authenticated, always to local
   */
  async saveChat(session: Omit<ChatSession, 'id'> & { id?: string }): Promise<ChatSession> {
    const urlId = session.urlId || this.generateUrlId();
    const now = new Date().toISOString();

    const fullSession: ChatSession = {
      id: session.id || urlId,
      urlId,
      title: session.title || this.generateTitle(session.messages),
      description: session.description,
      timestamp: now,
      createdAt: session.createdAt || now,
      messageCount: session.messages.length,
      messages: session.messages,
      metadata: {
        ...session.metadata,
        source: 'vscode',
        lastUpdated: now,
      },
      source: 'vscode',
    };

    // Always save locally first
    await this.saveLocalChat(fullSession);

    // Try to sync to cloud if authenticated
    const isAuth = await this.authService.isAuthenticated();
    if (isAuth) {
      try {
        await this.syncChatToCloud(fullSession);
      } catch (error) {
        console.error('Failed to sync to cloud, queued for later:', error);
        await this.addToPendingSync(fullSession.urlId);
      }
    } else {
      // Queue for sync when user logs in
      await this.addToPendingSync(fullSession.urlId);
    }

    return fullSession;
  }

  /**
   * Delete chat session
   */
  async deleteChat(sessionId: string): Promise<void> {
    // Delete locally
    const history = await this.getLocalHistory();
    const filtered = history.filter(s => s.id !== sessionId && s.urlId !== sessionId);
    await this.context.globalState.update(ChatHistorySyncService.LOCAL_HISTORY_KEY, filtered);

    // Delete from cloud if authenticated
    const isAuth = await this.authService.isAuthenticated();
    if (isAuth) {
      try {
        await this.deleteFromCloud(sessionId);
      } catch (error) {
        console.error('Failed to delete from cloud:', error);
      }
    }
  }

  /**
   * Force sync all local chats to cloud
   */
  async syncAll(): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress) {
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      const isAuth = await this.authService.isAuthenticated();
      if (!isAuth) {
        return { synced: 0, failed: 0 };
      }

      const localHistory = await this.getLocalHistory();
      const pendingIds = await this.getPendingSyncIds();

      for (const session of localHistory) {
        if (pendingIds.includes(session.urlId)) {
          try {
            await this.syncChatToCloud(session);
            await this.removeFromPendingSync(session.urlId);
            synced++;
          } catch {
            failed++;
          }
        }
      }

      // Update sync status
      await this.updateSyncStatus();
    } finally {
      this.syncInProgress = false;
    }

    return { synced, failed };
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const status = this.context.globalState.get<SyncStatus>(ChatHistorySyncService.SYNC_STATUS_KEY);
    const pendingIds = await this.getPendingSyncIds();

    return {
      lastSyncAt: status?.lastSyncAt || null,
      pendingChanges: pendingIds.length,
      syncEnabled: await this.authService.isAuthenticated(),
    };
  }

  // Private methods

  private async fetchCloudHistory(): Promise<ChatSession[]> {
    const user = await this.authService.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${RECODER_WEB_URL}/api/chat-history?userId=${user.id}&limit=50`);

    if (!response.ok) {
      throw new Error(`Failed to fetch chat history: ${response.status}`);
    }

    const data = await response.json() as { success: boolean; data: any[] };

    if (!data.success || !data.data) {
      return [];
    }

    // Transform to our format
    return data.data.map(session => ({
      id: session.id,
      urlId: session.urlId,
      title: session.title || session.description || 'Untitled Chat',
      description: session.description,
      timestamp: session.timestamp || session.updatedAt,
      createdAt: session.createdAt,
      messageCount: session.messageCount || session.totalMessages || 0,
      messages: [], // Messages are lazy-loaded
      metadata: session.metadata,
      source: session.metadata?.source || 'web',
    }));
  }

  private async syncChatToCloud(session: ChatSession): Promise<void> {
    const user = await this.authService.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${RECODER_WEB_URL}/api/chat-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        urlId: session.urlId,
        title: session.title,
        description: session.description,
        messages: session.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        source: 'vscode',
        cliVersion: vscode.extensions.getExtension('recoder.recoder-code')?.packageJSON?.version,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error || `Sync failed: ${response.status}`);
    }
  }

  private async deleteFromCloud(sessionId: string): Promise<void> {
    const response = await fetch(`${RECODER_WEB_URL}/api/chat-history`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }
  }

  private async getLocalHistory(): Promise<ChatSession[]> {
    return this.context.globalState.get<ChatSession[]>(ChatHistorySyncService.LOCAL_HISTORY_KEY, []);
  }

  private async saveLocalChat(session: ChatSession): Promise<void> {
    const history = await this.getLocalHistory();
    const existingIndex = history.findIndex(s => s.urlId === session.urlId);

    if (existingIndex >= 0) {
      history[existingIndex] = session;
    } else {
      history.unshift(session); // Add to beginning
    }

    // Keep only last 100 sessions locally
    const trimmed = history.slice(0, 100);
    await this.context.globalState.update(ChatHistorySyncService.LOCAL_HISTORY_KEY, trimmed);
  }

  private async mergeWithPendingChanges(cloudHistory: ChatSession[]): Promise<ChatSession[]> {
    const localHistory = await this.getLocalHistory();
    const pendingIds = await this.getPendingSyncIds();

    // Merge: cloud history + pending local changes not yet synced
    const merged = [...cloudHistory];

    for (const local of localHistory) {
      if (pendingIds.includes(local.urlId)) {
        const cloudIndex = merged.findIndex(c => c.urlId === local.urlId);
        if (cloudIndex >= 0) {
          // Local is newer (pending sync), replace cloud version
          merged[cloudIndex] = local;
        } else {
          // Not in cloud yet, add it
          merged.push(local);
        }
      }
    }

    // Sort by timestamp descending
    return merged.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private async getPendingSyncIds(): Promise<string[]> {
    return this.context.globalState.get<string[]>(ChatHistorySyncService.PENDING_SYNC_KEY, []);
  }

  private async addToPendingSync(urlId: string): Promise<void> {
    const pending = await this.getPendingSyncIds();
    if (!pending.includes(urlId)) {
      pending.push(urlId);
      await this.context.globalState.update(ChatHistorySyncService.PENDING_SYNC_KEY, pending);
    }
  }

  private async removeFromPendingSync(urlId: string): Promise<void> {
    const pending = await this.getPendingSyncIds();
    const filtered = pending.filter(id => id !== urlId);
    await this.context.globalState.update(ChatHistorySyncService.PENDING_SYNC_KEY, filtered);
  }

  private async updateSyncStatus(): Promise<void> {
    const status: SyncStatus = {
      lastSyncAt: new Date().toISOString(),
      pendingChanges: (await this.getPendingSyncIds()).length,
      syncEnabled: await this.authService.isAuthenticated(),
    };
    await this.context.globalState.update(ChatHistorySyncService.SYNC_STATUS_KEY, status);
  }

  private generateUrlId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateTitle(messages: ChatMessage[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content;
      return content.length > 50 ? content.substring(0, 47) + '...' : content;
    }
    return 'New Chat';
  }
}
