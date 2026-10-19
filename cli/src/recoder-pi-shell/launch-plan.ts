/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recoder Code on pi — Stage A launch plan (opt-in behind `RECODER_PI_SHELL`).
 *
 * This module computes the *plan* for launching the Recoder-owned full pi coding
 * agent (`@recoder/pi-coding-agent`) as Recoder Code's interactive shell, without
 * touching the process or spawning anything. Keeping the plan pure makes the
 * launcher wiring (configDir + branding + MCP servers) trivially testable.
 *
 * See `docs/PI-CONSOLIDATION.md` (Stage A). This is additive, flag-gated, and
 * reversible — the legacy Ink path stays the default until parity (Stage C/D).
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MCPServerConfig } from 'recoder-code-core';
import * as recoderCodeCore from 'recoder-code-core';

/**
 * The recodergit/brain default-server resolvers live in `recoder-code-core`.
 * They are accessed via a typed namespace cast (rather than a named import)
 * because some installed builds of `recoder-code-core` predate these exports;
 * binding them this way keeps type-checking clean and lets the seeding stay
 * fail-safe (see `seedDefaultServers`) when an older core is linked.
 */
type WithDefaultServer = (
  servers: Record<string, MCPServerConfig>,
  options?: {
    env?: EnvLike;
    exists?: ExistsFn;
    isOnPath?: IsOnPathFn;
    startDir?: string;
  },
) => Record<string, MCPServerConfig>;

const coreResolvers = recoderCodeCore as unknown as {
  withDefaultCodeGraphServer?: WithDefaultServer;
  withDefaultBrainServer?: WithDefaultServer;
};

/**
 * Seam types for the recodergit/brain resolvers. Defined locally (rather than
 * imported) because they are trivial structural shapes and the resolver options
 * accept them structurally — keeping the launcher decoupled from core's internal
 * seam-type exports.
 */
export type ExistsFn = (path: string) => boolean;
export type EnvLike = Readonly<Record<string, string | undefined>>;
export type IsOnPathFn = (
  name: string,
  env: EnvLike,
  exists: ExistsFn,
) => boolean;

/** Recoder branding/app identity handed to the pi shell (plan metadata). */
export const RECODER_APP_NAME = 'recoder';
export const RECODER_APP_TITLE = 'Recoder';

/**
 * The `piConfig.name` set in the vendored `@recoder/pi-coding-agent`
 * package.json (Stage B branding). pi derives its runtime `APP_NAME`,
 * `APP_TITLE`, and — crucially — its env-var prefix from this value at module
 * load, so it MUST match `pi-coding-agent/package.json` `piConfig.name`. This is
 * the single source of truth pi reads to render "Recoder" in the TUI.
 */
export const RECODER_PI_APP_NAME = 'Recoder';

/** Default Recoder config dir name (matches pi's `piConfig.configDir`). */
export const RECODER_CONFIG_DIR_NAME = '.recoder';

/**
 * pi reads its agent/config dir from `<APP_NAME>_CODING_AGENT_DIR`. Stage B
 * rebrands pi's `APP_NAME` to `Recoder` (via `piConfig.name`), so the env var pi
 * actually honors is `RECODER_CODING_AGENT_DIR` — NOT the stock
 * `PI_CODING_AGENT_DIR`. Derived from `RECODER_PI_APP_NAME` exactly as pi derives
 * it, so the two stay in lockstep. Pointing it at the Recoder config dir is the
 * real configDir wiring — pi then writes settings/sessions under
 * `~/.recoder/agent`.
 */
export const RECODER_PI_AGENT_DIR_ENV = `${RECODER_PI_APP_NAME.toUpperCase()}_CODING_AGENT_DIR`;

/** Env overrides that opt-out / redirect the Recoder config dir. */
export const RECODER_CONFIG_DIR_ENV = 'RECODER_CONFIG_DIR';
export const RECODER_PI_CONFIG_DIR_ENV = 'RECODER_PI_CONFIG_DIR';

/** Seams for the recodergit/brain resolvers (defaulted to real fs/env). */
export interface LaunchPlanResolverSeams {
  readonly env?: EnvLike;
  readonly exists?: ExistsFn;
  readonly isOnPath?: IsOnPathFn;
  readonly startDir?: string;
}

export interface BuildLaunchPlanOptions extends LaunchPlanResolverSeams {
  /** Args forwarded to pi's interactive entry (defaults to process argv tail). */
  readonly argv?: string[];
}

/**
 * A fully-resolved, side-effect-free description of how to launch the pi shell.
 */
export interface RecoderPiLaunchPlan {
  /** Recoder config root, e.g. `~/.recoder`. */
  readonly configDir: string;
  /** pi agent dir under the config root, e.g. `~/.recoder/agent`. */
  readonly piAgentDir: string;
  /** Recoder branding/app name passed through for identity. */
  readonly appName: string;
  /** Recoder branding/app title passed through for identity. */
  readonly appTitle: string;
  /**
   * Default MCP servers seeded for pi's agent: recodergit (code-graph) + brain
   * (shared memory). Keyed by server name. May be empty when neither resolves.
   */
  readonly mcpServers: Record<string, MCPServerConfig>;
  /** Process env mutations to apply before invoking pi (real configDir wiring). */
  readonly envOverrides: Record<string, string>;
  /** Args forwarded to pi's interactive entry. */
  readonly piArgs: string[];
}

/** Resolve the Recoder config dir, honoring explicit env overrides. */
export function resolveRecoderConfigDir(env: EnvLike): string {
  const override =
    env[RECODER_CONFIG_DIR_ENV]?.trim() ||
    env[RECODER_PI_CONFIG_DIR_ENV]?.trim();
  if (override) {
    return override;
  }
  const home = env['HOME']?.trim() || env['USERPROFILE']?.trim() || homedir();
  return join(home, RECODER_CONFIG_DIR_NAME);
}

/**
 * Apply one default-server resolver, fail-safe. When the resolver is missing
 * (an older `recoder-code-core` is linked), the servers map is returned
 * unchanged so the shell still launches — it simply won't seed that default.
 */
function seedDefaultServers(
  resolver: WithDefaultServer | undefined,
  servers: Record<string, MCPServerConfig>,
  seams: {
    env: EnvLike;
    exists?: ExistsFn;
    isOnPath?: IsOnPathFn;
    startDir?: string;
  },
): Record<string, MCPServerConfig> {
  if (typeof resolver !== 'function') {
    return servers;
  }
  return resolver(servers, seams);
}

/**
 * Build the launch plan: compute the Recoder config dir, seed the default MCP
 * servers via the existing `withDefaultCodeGraphServer`/`withDefaultBrainServer`
 * resolvers, and assemble the env overrides that point pi at the Recoder config
 * dir. Pure given the injected resolver seams.
 */
export function buildRecoderPiLaunchPlan(
  options: BuildLaunchPlanOptions = {},
): RecoderPiLaunchPlan {
  const env = options.env ?? process.env;
  const resolverSeams = {
    env,
    exists: options.exists,
    isOnPath: options.isOnPath,
    startDir: options.startDir,
  };

  // Seed recodergit (code-graph) + brain (shared memory) exactly as the legacy
  // path does, so pi's agent gets the same default tools out of the box.
  // Additive + fail-safe: an unresolved engine adds nothing (never a broken
  // server), a `RECODER_CODE_GRAPH`/`RECODER_BRAIN=false` opts out.
  let mcpServers: Record<string, MCPServerConfig> = {};
  mcpServers = seedDefaultServers(
    coreResolvers.withDefaultCodeGraphServer,
    mcpServers,
    resolverSeams,
  );
  mcpServers = seedDefaultServers(
    coreResolvers.withDefaultBrainServer,
    mcpServers,
    resolverSeams,
  );

  const configDir = resolveRecoderConfigDir(env);
  const piAgentDir = join(configDir, 'agent');

  const envOverrides: Record<string, string> = {
    [RECODER_PI_AGENT_DIR_ENV]: piAgentDir,
  };

  return {
    configDir,
    piAgentDir,
    appName: RECODER_APP_NAME,
    appTitle: RECODER_APP_TITLE,
    mcpServers,
    envOverrides,
    piArgs: options.argv ?? process.argv.slice(2),
  };
}
