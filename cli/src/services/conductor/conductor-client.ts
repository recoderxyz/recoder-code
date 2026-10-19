/**
 * Conductor API client — typed end-to-end client for `/api/conductor/*`.
 *
 * The conductor is the parallel-agent control plane: workspaces (isolated git
 * worktree + branch + tmux session) and raw tmux sessions. This client mirrors
 * the backend route contract in backend/src/conductor/conductor.routes.ts
 * exactly, including the `{ success, data, error }` response envelope.
 *
 * Auth + base URL are resolved via `conductor-config` (env-first, then the
 * device-flow token store). Degrade-safe: every method surfaces a typed result
 * and never throws raw transport errors at the command layer.
 *
 * Ported into recoder-code from the legacy packages/cli conductor command set.
 * Uses the global `fetch` (Node 18+) rather than axios to match recoder-code
 * HTTP conventions (e.g. RecoderAuthService).
 */

import { resolveBackendUrl, resolveCredential } from './conductor-config.js';

/** Mirror of the agent-os Workspace domain (subset the CLI renders). */
export interface ConductorWorkspace {
  workspaceId: string;
  spaceId: string;
  projectId: string;
  taskId: string;
  runId?: string;
  runtimeId: string;
  substrate: string;
  branch: string;
  baseRef: string;
  worktreePath?: string;
  sessionName?: string;
  state: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateWorkspaceInput {
  spaceId: string;
  projectId: string;
  taskId: string;
  repoPath: string;
  createdBy: string;
  /** One of command|prompt is required. */
  command?: string;
  prompt?: string;
  /** Optional — when omitted the backend planner (@recoder/pal) defaults it. */
  runtimeId?: string;
  substrate?: string;
  model?: string;
  branch?: string;
  baseRef?: string;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceDiff {
  files?: Array<{ path: string; additions?: number; deletions?: number; status?: string }>;
  patch?: string;
  [k: string]: unknown;
}

export interface MergeResult {
  state?: string;
  merged?: boolean;
  [k: string]: unknown;
}

export interface PrResult {
  url?: string;
  number?: number;
  state?: string;
  [k: string]: unknown;
}

export interface ConductorSession {
  sessionId: string;
  [k: string]: unknown;
}

export interface ConductorHealth {
  available?: boolean;
  reason?: string;
  [k: string]: unknown;
}

/**
 * Typed result so callers can branch on `ok` without try/catch noise.
 *
 * On success `data` is set and `error` is undefined; on failure `data` is
 * undefined and `error` is set.
 */
export interface ClientResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  needsAuth?: boolean;
}

export interface ConductorClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export class ConductorClient {
  readonly baseUrl: string;
  private readonly apiBase: string;
  private readonly timeoutMs: number;

  constructor(options: ConductorClientOptions = {}) {
    this.baseUrl = resolveBackendUrl(options.baseUrl);
    this.apiBase = `${this.baseUrl}/api/conductor`;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  /** True when a credential is resolvable (env or device-flow store). */
  hasCredential(): boolean {
    return resolveCredential() !== null;
  }

  // --- Health + sessions ---------------------------------------------------

  async health(): Promise<ClientResult<ConductorHealth>> {
    return this.request<ConductorHealth>('GET', '/health');
  }

  async listSessions(): Promise<ClientResult<ConductorSession[]>> {
    return this.request<ConductorSession[]>('GET', '/sessions');
  }

  // --- Workspaces ----------------------------------------------------------

  async listWorkspaces(): Promise<ClientResult<ConductorWorkspace[]>> {
    return this.request<ConductorWorkspace[]>('GET', '/workspaces');
  }

  async getWorkspace(workspaceId: string): Promise<ClientResult<ConductorWorkspace>> {
    return this.request<ConductorWorkspace>('GET', `/workspaces/${encodeURIComponent(workspaceId)}`);
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<ClientResult<ConductorWorkspace>> {
    return this.request<ConductorWorkspace>('POST', '/workspaces', input);
  }

  async diffWorkspace(workspaceId: string): Promise<ClientResult<WorkspaceDiff>> {
    return this.request<WorkspaceDiff>('GET', `/workspaces/${encodeURIComponent(workspaceId)}/diff`);
  }

  async mergeWorkspace(
    workspaceId: string,
    options: { strategy?: string; deleteBranch?: boolean } = {},
  ): Promise<ClientResult<MergeResult>> {
    return this.request<MergeResult>(
      'POST',
      `/workspaces/${encodeURIComponent(workspaceId)}/merge`,
      options,
    );
  }

  async openPr(
    workspaceId: string,
    options: { title?: string; body?: string; base?: string; draft?: boolean; remote?: string } = {},
  ): Promise<ClientResult<PrResult>> {
    return this.request<PrResult>(
      'POST',
      `/workspaces/${encodeURIComponent(workspaceId)}/pr`,
      options,
    );
  }

  async archiveWorkspace(workspaceId: string): Promise<ClientResult<ConductorWorkspace>> {
    return this.request<ConductorWorkspace>(
      'POST',
      `/workspaces/${encodeURIComponent(workspaceId)}/archive`,
    );
  }

  // --- Transport -----------------------------------------------------------

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    pathSuffix: string,
    body?: unknown,
  ): Promise<ClientResult<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'recoder-code-conductor/1.0.0',
    };
    const cred = resolveCredential();
    if (cred) {
      headers[cred.header] = cred.value;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiBase}${pathSuffix}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const status = response.status;
      let payload: { success?: boolean; data?: T; error?: string } | undefined;
      try {
        payload = (await response.json()) as { success?: boolean; data?: T; error?: string };
      } catch {
        payload = undefined;
      }

      if (status >= 200 && status < 300 && payload?.success !== false) {
        return { ok: true, data: (payload?.data ?? (payload as unknown)) as T };
      }

      const error = payload?.error || `request failed with status ${status}`;
      const needsAuth = status === 401 || status === 403;
      return { ok: false, error, status, needsAuth };
    } catch (err) {
      return { ok: false, error: transportError(err, this.baseUrl) };
    } finally {
      clearTimeout(timer);
    }
  }
}

function transportError(err: unknown, baseUrl: string): string {
  const e = err as { name?: string; cause?: { code?: string }; message?: string };
  if (e?.name === 'AbortError') {
    return `request to ${baseUrl} timed out`;
  }
  const code = e?.cause?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return `cannot reach backend at ${baseUrl} (${code})`;
  }
  return e?.message || 'request failed';
}

export function createConductorClient(options?: ConductorClientOptions): ConductorClient {
  return new ConductorClient(options);
}
