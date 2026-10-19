/**
 * Agent Bridge Service
 *
 * Connects recoder-code CLI to the A2A workspace system on backend
 * via WebSocket. Enables local agents to:
 *   - Register as workspace members
 *   - Receive task assignments in real-time
 *   - Report task progress and results
 *   - Participate in channel conversations
 *
 * Uses existing RecoderAuthService for authentication tokens.
 * Auto-reconnects with exponential backoff (same pattern as PlatformSyncService).
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import os from 'node:os';

const DOCKER_BACKEND_URL = process.env['DOCKER_BACKEND_URL'] || 'https://docker.recoder.xyz';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskAssignment {
  taskId: string;
  prompt: string;
  context: Record<string, unknown>;
  worktreeBranch?: string;
}

export interface ChannelMessageEvent {
  channelId: string;
  from: string;
  content: string;
}

export interface WorkspaceAgent {
  agentId: string;
  status: string;
  isLocal: boolean;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AgentBridgeService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private agentId: string;
  private sessionId: string | null = null;
  private workspaceId: string | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30_000;
  private getToken: () => Promise<string | null>;

  constructor(
    getToken: () => Promise<string | null>,
    agentId?: string,
  ) {
    super();
    this.getToken = getToken;
    this.agentId = agentId || `recoder-code_${os.hostname()}_${process.pid}`;
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  async connect(workspaceId: string, capabilities: string[] = []): Promise<void> {
    this.workspaceId = workspaceId;

    const token = await this.getToken();
    if (!token) {
      console.error('Not authenticated. Please run `recoder auth login` first.');
      return;
    }

    return this.connectWebSocket(token, capabilities);
  }

  private connectWebSocket(
    token: string,
    capabilities: string[] = [],
  ): Promise<void> {
    return new Promise((resolve) => {
      const wsUrl = DOCKER_BACKEND_URL.replace(/^http/, 'ws');
      const url = new URL(`${wsUrl}/agent-bridge`);
      url.searchParams.set('token', token);
      url.searchParams.set('agentId', this.agentId);
      if (capabilities.length > 0) {
        url.searchParams.set('capabilities', capabilities.join(','));
      }
      if (this.workspaceId) {
        url.searchParams.set('workspaceIds', this.workspaceId);
      }

      try {
        this.ws = new WebSocket(url.toString());

        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            this.handleMessage(msg);
          } catch {
            // Ignore parse errors
          }
        });

        this.ws.on('close', (_code, _reason) => {
          this.connected = false;
          this.sessionId = null;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.scheduleReconnect(token, capabilities);
        });

        this.ws.on('error', (err) => {
          if (!this.connected) {
            resolve(); // Don't hang on initial connect failure
          }
          this.emit('error', err);
        });

        // Timeout initial connection attempt
        setTimeout(() => {
          if (!this.connected) {
            resolve();
          }
        }, 5000);
      } catch (error) {
        console.error('Failed to connect to agent bridge:', error);
        resolve();
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
    this.sessionId = null;
    this.workspaceId = null;
    this.reconnectAttempts = 0;
  }

  private scheduleReconnect(token: string, capabilities: string[]): void {
    if (this.reconnectTimeout || !this.workspaceId) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, ... up to maxReconnectDelay
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      void this.connectWebSocket(token, capabilities);
    }, delay);
  }

  // -----------------------------------------------------------------------
  // Heartbeat
  // -----------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // -----------------------------------------------------------------------
  // Outgoing messages
  // -----------------------------------------------------------------------

  private send(msg: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  joinWorkspace(workspaceId: string): void {
    this.workspaceId = workspaceId;
    this.send({ type: 'join_workspace', workspaceId });
  }

  leaveWorkspace(workspaceId: string): void {
    this.send({ type: 'leave_workspace', workspaceId });
    if (this.workspaceId === workspaceId) {
      this.workspaceId = null;
    }
  }

  sendProgress(taskId: string, progress: number, output: string): void {
    this.send({ type: 'task.progress', taskId, progress, output });
  }

  completeTask(taskId: string, result: unknown): void {
    this.send({ type: 'task.complete', taskId, result });
  }

  failTask(taskId: string, error: string): void {
    this.send({ type: 'task.failed', taskId, error });
  }

  sendChannelMessage(channelId: string, content: string): void {
    this.send({ type: 'channel.message', channelId, content });
  }

  // -----------------------------------------------------------------------
  // Incoming message handling
  // -----------------------------------------------------------------------

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'registered':
        this.sessionId = typeof msg.sessionId === 'string' ? msg.sessionId : this.sessionId;
        this.emit('registered', {
          agentId: msg.agentId,
          sessionId: msg.sessionId,
          workspaces: msg.workspaces,
        });
        break;

      case 'task.assigned': {
        const assignment: TaskAssignment = {
          taskId: msg.taskId as string,
          prompt: msg.prompt as string,
          context: (msg.context as Record<string, unknown>) || {},
          worktreeBranch: msg.worktreeBranch as string | undefined,
        };
        this.emit('task.assigned', assignment);
        break;
      }

      case 'task.cancelled':
        this.emit('task.cancelled', { taskId: msg.taskId });
        break;

      case 'channel.message': {
        const channelMsg: ChannelMessageEvent = {
          channelId: msg.channelId as string,
          from: msg.from as string,
          content: msg.content as string,
        };
        this.emit('channel.message', channelMsg);
        break;
      }

      case 'workspace.updated':
        this.emit('workspace.updated', {
          workspaceId: msg.workspaceId,
          changes: msg.changes,
        });
        break;

      case 'workspace.joined':
        this.emit('workspace.joined', { workspaceId: msg.workspaceId });
        break;

      case 'workspace.left':
        this.emit('workspace.left', { workspaceId: msg.workspaceId });
        break;

      case 'ping':
        // Server keepalive, no action needed
        break;

      default:
        // Emit unknown messages for extensibility
        this.emit('message', msg);
    }
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  isConnected(): boolean {
    return this.connected;
  }

  getAgentId(): string {
    return this.agentId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getWorkspaceId(): string | null {
    return this.workspaceId;
  }

  displayStatus(): void {
    if (!this.connected) {
      console.log('Agent Bridge: Disconnected');
      return;
    }
    console.log(`Agent Bridge: Connected`);
    console.log(`  Agent ID: ${this.agentId}`);
    console.log(`  Session ID: ${this.sessionId || 'Unknown'}`);
    console.log(`  Workspace: ${this.workspaceId || 'None'}`);
  }
}
