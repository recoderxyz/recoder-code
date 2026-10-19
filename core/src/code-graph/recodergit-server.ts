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
 * Default code-graph server resolver — makes recodergit's MCP code-graph tools
 * (impact / context / query / scope / explain / cypher / ...) available to the
 * recoder-code agent OUT OF THE BOX, local-first, over stdio.
 *
 * Doctrine (mirrors the Brain's engine-resolver):
 *  - LOCAL-FIRST: stdio transport, no port/server supervision. The agent spawns
 *    `recodergit mcp` and queries the repo it's running in.
 *  - ADDITIVE + FAIL-SAFE: this only ever ADDS a default server entry. If the
 *    engine binary can't be resolved (no vendored build, no env override, not on
 *    PATH), NO entry is added — never a broken server that would error at
 *    discovery time.
 *  - USER PRECEDENCE: a user-configured `recodergit` entry always wins and is
 *    never overwritten; a falsy entry (`"recodergit": false`) is an explicit
 *    opt-out; the `RECODER_CODE_GRAPH` env var can disable the default entirely.
 *
 * Pure + deterministic given injected `exists`, `env`, `isOnPath`, and
 * `startDir`, so it stays trivially testable with no real filesystem or process
 * environment.
 */

/** The key under which the default code-graph server is merged into mcpServers. */
export const DEFAULT_CODE_GRAPH_SERVER_NAME = 'recodergit';

/** Env var that opts the whole default code-graph server in/out. */
export const CODE_GRAPH_ENV_FLAG = 'RECODER_CODE_GRAPH';

/** Env var that pins an explicit recodergit binary path/name. */
export const RECODERGIT_BIN_ENV = 'RECODERGIT_BIN';

/** Vendored built recodergit CLI entry, relative to the recoder.xyz monorepo root. */
const RECODERGIT_VENDORED = [
  'ts',
  'recodergit',
  'recodergit',
  'dist',
  'cli',
  'index.js',
];

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

export interface ResolveCodeGraphOptions {
  /** Directory to start the upward vendored-build walk from (defaults to this module). */
  readonly startDir?: string;
  /** Environment source (defaults to process.env). */
  readonly env?: EnvLike;
  /** Filesystem existence probe (defaults to fs.existsSync). */
  readonly exists?: ExistsFn;
  /** PATH lookup probe (defaults to a PATH scan). */
  readonly isOnPath?: IsOnPathFn;
}

export interface DefaultCodeGraphOptions extends ResolveCodeGraphOptions {
  /** Explicit on/off. When omitted, the `RECODER_CODE_GRAPH` env var decides. */
  readonly enabled?: boolean;
  /** Server key to use (defaults to `recodergit`). */
  readonly name?: string;
}

/** A resolved stdio command: the executable + the full args (including `mcp`). */
interface ResolvedCommand {
  readonly command: string;
  readonly args: string[];
}

/**
 * Default PATH lookup: scan the directories on `PATH` for an executable named
 * `name`. Kept deliberately simple (no Windows extension probing) since the
 * local terminal agent targets unix-like shells; an env override or vendored
 * build covers every other case.
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
 * Walk up from `startDir` looking for the vendored, built recodergit CLI entry.
 * Resolving relative to this module (not `process.cwd()`) is what makes the
 * vendored engine discoverable no matter which repo the agent is launched in.
 * Returns the absolute entry path, or null when no vendored build exists.
 */
function findVendoredRecodergit(
  startDir: string,
  exists: ExistsFn,
): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, ...RECODERGIT_VENDORED);
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
 * Resolve how `recodergit mcp` will be spawned, or undefined when the engine
 * can't be reached. Precedence: vendored build (run via node) > env-pinned
 * binary (`RECODERGIT_BIN`) > a `recodergit` on PATH. When none resolve we
 * return undefined so the caller adds NO server entry (fail-safe).
 */
export function resolveRecodergitCommand(
  options: ResolveCodeGraphOptions = {},
): ResolvedCommand | undefined {
  const exists = options.exists ?? existsSync;
  const env = options.env ?? process.env;
  const isOnPath = options.isOnPath ?? defaultIsOnPath;
  const startDir = options.startDir ?? moduleDir();

  const vendored = findVendoredRecodergit(startDir, exists);
  if (vendored) {
    return { command: 'node', args: [vendored, 'mcp'] };
  }

  const envBin = env[RECODERGIT_BIN_ENV]?.trim();
  if (envBin) {
    return { command: envBin, args: ['mcp'] };
  }

  if (isOnPath('recodergit', env, exists)) {
    return { command: 'recodergit', args: ['mcp'] };
  }

  return undefined;
}

/**
 * Build the default code-graph MCPServerConfig, or undefined when the recodergit
 * engine can't be resolved. Stdio transport: `command` + `args` only.
 */
export function resolveCodeGraphServerConfig(
  options: ResolveCodeGraphOptions = {},
): MCPServerConfig | undefined {
  const resolved = resolveRecodergitCommand(options);
  if (!resolved) {
    return undefined;
  }
  // MCPServerConfig is a class with only public readonly fields, so it is
  // structurally satisfied by this literal (no `new` + positional args needed).
  return {
    command: resolved.command,
    args: resolved.args,
    description:
      'Recoder code-graph (recodergit): impact, context, query, scope, explain, cypher',
  };
}

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled']);

/** True when the `RECODER_CODE_GRAPH` env flag explicitly disables the default. */
function isDisabledByEnv(env: EnvLike): boolean {
  const raw = env[CODE_GRAPH_ENV_FLAG]?.trim().toLowerCase();
  if (!raw) {
    return false;
  }
  return DISABLED_VALUES.has(raw);
}

/**
 * Merge the default recodergit code-graph server into an assembled `mcpServers`
 * map, returning a NEW map (never mutating the input).
 *
 * Behavior:
 *  - User precedence: an existing truthy `recodergit` entry is kept untouched.
 *  - Explicit opt-out: a falsy `recodergit` entry (`"recodergit": false` in
 *    settings) disables the default and is stripped so it can't reach discovery.
 *  - Env opt-out: `RECODER_CODE_GRAPH=false|0|off|no|disabled` disables it.
 *  - `enabled: false` disables it.
 *  - Fail-safe: when the engine binary can't be resolved, nothing is added.
 */
export function withDefaultCodeGraphServer(
  mcpServers: Record<string, MCPServerConfig>,
  options: DefaultCodeGraphOptions = {},
): Record<string, MCPServerConfig> {
  const name = options.name ?? DEFAULT_CODE_GRAPH_SERVER_NAME;
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

  const config = resolveCodeGraphServerConfig({ ...options, env });
  if (!config) {
    // Engine unresolved — add NO entry (fail-safe, no broken server).
    return mcpServers;
  }

  return { ...mcpServers, [name]: config };
}
