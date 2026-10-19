/**
 * @module terminal-registration
 *
 * Auto-registers this recoder-code CLI instance with the Recoder A2A
 * terminal registry so the platform knows how many Claude Code, Codex,
 * and other terminals are connected.
 *
 * Env vars used:
 *   RECODER_AGENT_ID     — agent type (e.g. "claude_code", "codex")
 *   RECODER_SESSION_ID   — unique session ID for this terminal instance
 *   RECODER_DOCKER_URL   — backend URL for registration endpoint
 *   DOCKER_BACKEND_URL   — fallback backend URL
 *   RECODER_CALLBACK_URL — optional callback URL for push notifications
 *
 * On startup: POST /api/a2a/terminals/register
 * Periodic heartbeat: POST /api/a2a/terminals/:sessionId/heartbeat
 * On shutdown: DELETE /api/a2a/terminals/:sessionId
 */

import * as os from 'node:os';

const HEARTBEAT_INTERVAL_MS = 30_000;

interface RegistrationState {
  sessionId: string;
  backendUrl: string;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  registered: boolean;
}

let _state: RegistrationState | null = null;

function getBackendUrl(): string {
  return process.env['RECODER_DOCKER_URL'] || process.env['DOCKER_BACKEND_URL'] || '';
}

function getAgentType(): string {
  return process.env['RECODER_AGENT_ID'] || '';
}

function getSessionId(): string {
  return process.env['RECODER_SESSION_ID'] || '';
}

/**
 * Register this terminal with the A2A terminal registry.
 * Called once on CLI startup. Safe to call multiple times (idempotent).
 */
export async function registerTerminal(opts?: {
  projectId?: string;
  workspaceDir?: string;
  capabilities?: string[];
  version?: string;
}): Promise<boolean> {
  const backendUrl = getBackendUrl();
  const agentType = getAgentType();
  const sessionId = getSessionId();

  if (!backendUrl || !agentType || !sessionId) {
    return false;
  }

  try {
    const res = await fetch(`${backendUrl}/api/a2a/terminals/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentType,
        sessionId,
        callbackUrl: process.env['RECODER_CALLBACK_URL'] || undefined,
        projectId: opts?.projectId,
        workspaceDir: opts?.workspaceDir || process.cwd(),
        capabilities: opts?.capabilities || ['chat', 'edit', 'shell', 'grep', 'glob'],
        version: opts?.version,
        hostname: os.hostname(),
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      return false;
    }

    _state = {
      sessionId,
      backendUrl,
      heartbeatTimer: null,
      registered: true,
    };

    // Start periodic heartbeat
    _state.heartbeatTimer = setInterval(() => {
      sendHeartbeat().catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    // Deregister on process exit
    const cleanup = () => { deregisterTerminal().catch(() => {}); };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });

    return true;
  } catch {
    return false;
  }
}

/**
 * Send a heartbeat to keep the terminal session alive.
 */
async function sendHeartbeat(): Promise<void> {
  if (!_state?.registered) return;

  try {
    await fetch(`${_state.backendUrl}/api/a2a/terminals/${_state.sessionId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: undefined,
        workspaceDir: process.cwd(),
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Silently ignore heartbeat failures
  }
}

/**
 * Deregister this terminal on shutdown.
 */
export async function deregisterTerminal(): Promise<void> {
  if (!_state?.registered) return;

  if (_state.heartbeatTimer) {
    clearInterval(_state.heartbeatTimer);
    _state.heartbeatTimer = null;
  }

  try {
    await fetch(`${_state.backendUrl}/api/a2a/terminals/${_state.sessionId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Best effort on shutdown
  }

  _state.registered = false;
}

/**
 * Check if this terminal is registered.
 */
export function isRegistered(): boolean {
  return _state?.registered ?? false;
}
