/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MCPServerConfig } from '../config/config.js';

/**
 * Default Brain server resolver — makes @recoder/brain's shared-memory MCP tools
 * (brain_assemble / brain_recall / brain_record) available to the recoder-code
 * agent OUT OF THE BOX, local-first, over stdio.
 *
 * The Brain assembles the fused repo/activity/memory/docs/task context ONCE per
 * repo+task so the whole agent team reads it once and reuses it, instead of every
 * agent re-reading the repo. assemble/recall are read-only; record only ever
 * emits a reviewable memory CANDIDATE (never a durable write).
 *
 * Doctrine (mirrors the code-graph resolver, {@link withDefaultCodeGraphServer}):
 *  - LOCAL-FIRST: stdio transport, no port/server supervision. The agent spawns
 *    the vendored Brain MCP entry and queries the repo it's running in.
 *  - ADDITIVE + FAIL-SAFE: this only ever ADDS a default server entry. If the
 *    Brain entry can't be resolved (no vendored build, no env override, not on
 *    PATH), NO entry is added — never a broken server that errors at discovery.
 *  - USER PRECEDENCE: a user-configured `brain` entry always wins and is never
 *    overwritten; a falsy entry (`"brain": false`) is an explicit opt-out; the
 *    `RECODER_BRAIN` env var can disable the default entirely.
 *
 * Pure + deterministic given injected `exists`, `env`, `isOnPath`, and `startDir`,
 * so it stays trivially testable with no real filesystem or process environment.
 */

/** The key under which the default Brain server is merged into mcpServers. */
export const DEFAULT_BRAIN_SERVER_NAME = 'brain';

/** Env var that opts the whole default Brain server in/out. */
export const BRAIN_ENV_FLAG = 'RECODER_BRAIN';

/** Env var that pins an explicit Brain MCP binary path/name. */
export const RECODER_BRAIN_BIN_ENV = 'RECODER_BRAIN_BIN';

/**
 * Vendored built Brain MCP stdio entry, relative to the recoder.xyz monorepo
 * root. This IS the stdio server (its shebang boots runBrainMcpStdio), so it is
 * spawned directly via node with no extra subcommand.
 */
const BRAIN_VENDORED = ['packages', 'brain', 'dist', 'seams', 'mcp-stdio.js'];

/** Filesystem existence probe (the seam tests fake). */
export type ExistsFn = (path: string) => boolean;

/** Read-only environment view (the seam tests fake). */
export type EnvLike = Readonly<Record<string, string | undefined>>;

/** PATH lookup probe (the seam tests fake). */
export type IsOnPathFn = (
  name: string,
  env: EnvLike,
  exists: ExistsFn,
) => boolean;

export interface ResolveBrainOptions {
  /** Directory to start the upward vendored-build walk from (defaults to this module). */
  readonly startDir?: string;
  /** Environment source (defaults to process.env). */
  readonly env?: EnvLike;
  /** Filesystem existence probe (defaults to fs.existsSync). */
  readonly exists?: ExistsFn;
  /** PATH lookup probe (defaults to a PATH scan). */
  readonly isOnPath?: IsOnPathFn;
}

export interface DefaultBrainOptions extends ResolveBrainOptions {
  /** Explicit on/off. When omitted, the `RECODER_BRAIN` env var decides. */
  readonly enabled?: boolean;
  /** Server key to use (defaults to `brain`). */
  readonly name?: string;
}

/** A resolved stdio command: the executable + the full args. */
interface ResolvedCommand {
  readonly command: string;
  readonly args: string[];
}

/**
 * Default PATH lookup: scan the directories on `PATH` for an executable named
 * `name`. Kept deliberately simple (no Windows extension probing) since the local
 * terminal agent targets unix-like shells; an env override or vendored build
 * covers every other case.
 */
function defaultIsOnPath(
  name: string,
  env: EnvLike,
  exists: ExistsFn,
): boolean {
  const rawPath = env['PATH'];
  if (!rawPath) {
    return false;
  }
  return rawPath
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => exists(join(dir, name)));
}

/**
 * Walk up from `startDir` looking for the vendored, built Brain MCP entry.
 * Resolving relative to this module (not `process.cwd()`) is what makes the
 * vendored Brain discoverable no matter which repo the agent is launched in.
 * Returns the absolute entry path, or null when no vendored build exists.
 */
function findVendoredBrain(startDir: string, exists: ExistsFn): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, ...BRAIN_VENDORED);
    if (exists(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function moduleDir(): string {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}

/**
 * Resolve how the Brain MCP server will be spawned, or undefined when it can't be
 * reached. Precedence: vendored build (run via node) > env-pinned binary
 * (`RECODER_BRAIN_BIN`) > a `recoder-brain` on PATH. When none resolve we return
 * undefined so the caller adds NO server entry (fail-safe).
 */
export function resolveBrainCommand(
  options: ResolveBrainOptions = {},
): ResolvedCommand | undefined {
  const exists = options.exists ?? existsSync;
  const env = options.env ?? process.env;
  const isOnPath = options.isOnPath ?? defaultIsOnPath;
  const startDir = options.startDir ?? moduleDir();

  const vendored = findVendoredBrain(startDir, exists);
  if (vendored) {
    return { command: 'node', args: [vendored] };
  }

  const envBin = env[RECODER_BRAIN_BIN_ENV]?.trim();
  if (envBin) {
    return { command: envBin, args: [] };
  }

  if (isOnPath('recoder-brain', env, exists)) {
    return { command: 'recoder-brain', args: [] };
  }

  return undefined;
}

/**
 * Build the default Brain MCPServerConfig, or undefined when the Brain entry
 * can't be resolved. Stdio transport: `command` + `args` only.
 */
export function resolveBrainServerConfig(
  options: ResolveBrainOptions = {},
): MCPServerConfig | undefined {
  const resolved = resolveBrainCommand(options);
  if (!resolved) {
    return undefined;
  }
  // MCPServerConfig is a class with only public readonly fields, so it is
  // structurally satisfied by this literal (no `new` + positional args needed).
  return {
    command: resolved.command,
    args: resolved.args,
    description:
      'Recoder Brain (shared memory): brain_assemble, brain_recall, brain_record',
  };
}

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled']);

/** True when the `RECODER_BRAIN` env flag explicitly disables the default. */
function isDisabledByEnv(env: EnvLike): boolean {
  const raw = env[BRAIN_ENV_FLAG]?.trim().toLowerCase();
  if (!raw) {
    return false;
  }
  return DISABLED_VALUES.has(raw);
}

/**
 * Merge the default Brain server into an assembled `mcpServers` map, returning a
 * NEW map (never mutating the input).
 *
 * Behavior:
 *  - User precedence: an existing truthy `brain` entry is kept untouched.
 *  - Explicit opt-out: a falsy `brain` entry (`"brain": false` in settings)
 *    disables the default and is stripped so it can't reach discovery.
 *  - Env opt-out: `RECODER_BRAIN=false|0|off|no|disabled` disables it.
 *  - `enabled: false` disables it.
 *  - Fail-safe: when the Brain entry can't be resolved, nothing is added.
 */
export function withDefaultBrainServer(
  mcpServers: Record<string, MCPServerConfig>,
  options: DefaultBrainOptions = {},
): Record<string, MCPServerConfig> {
  const name = options.name ?? DEFAULT_BRAIN_SERVER_NAME;
  const env = options.env ?? process.env;

  if (Object.prototype.hasOwnProperty.call(mcpServers, name)) {
    const existing = mcpServers[name];
    if (existing) {
      // User-configured override wins — never clobber it.
      return mcpServers;
    }
    // Falsy entry = explicit disable; strip it so it never reaches discovery.
    return Object.fromEntries(
      Object.entries(mcpServers).filter(([key]) => key !== name),
    );
  }

  if (options.enabled === false || isDisabledByEnv(env)) {
    return mcpServers;
  }

  const config = resolveBrainServerConfig({ ...options, env });
  if (!config) {
    // Brain entry unresolved — add NO entry (fail-safe, no broken server).
    return mcpServers;
  }

  return { ...mcpServers, [name]: config };
}
