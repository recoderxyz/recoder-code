/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recoder Code on pi — Stage A launcher (opt-in behind `RECODER_PI_SHELL`).
 *
 * When the flag is truthy, the `recoder` CLI hands off to full pi's *interactive*
 * mode (`@recoder/pi-coding-agent` `main()`), configured with the Recoder config
 * dir, Recoder branding, and the default recodergit + brain MCP servers bridged
 * into pi's agent. When the flag is unset (the DEFAULT), this module is never
 * reached and the legacy Ink path runs unchanged.
 *
 * pi ships no `.d.ts` and is ESM-only with an exports map, so its `main` entry is
 * loaded via a dynamic import that survives the CLI's module output (mirrors
 * `recoder-code-core`'s existing `pi-runtime.ts` bridge). The entry is injectable
 * so tests assert the wiring without spawning a real TUI.
 */

import {
  buildRecoderPiLaunchPlan,
  type BuildLaunchPlanOptions,
  type EnvLike,
  type RecoderPiLaunchPlan,
} from './launch-plan.js';
import {
  createRecoderMcpBridgeFactory,
  type PiExtensionFactory,
  type RecoderToolGroupSummary,
} from './mcp-bridge.js';

/** The env flag that opts Recoder Code into the pi interactive shell. */
export const RECODER_PI_SHELL_ENV = 'RECODER_PI_SHELL';

/** The command we tell an unauthenticated user to run before launching. */
export const RECODER_AUTH_LOGIN_HINT = 'recoder auth login';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** True when `RECODER_PI_SHELL` is set to a truthy value. */
export function isPiShellEnabled(env: EnvLike = process.env): boolean {
  const raw = env[RECODER_PI_SHELL_ENV]?.trim().toLowerCase();
  return !!raw && TRUTHY.has(raw);
}

/**
 * pi's interactive entry point: `main(args, { extensionFactories })`.
 * Typed structurally — pi ships no declarations.
 */
export type PiMainEntry = (
  args: string[],
  options?: { extensionFactories?: PiExtensionFactory[] },
) => Promise<unknown> | unknown;

export interface RunPiShellDeps extends BuildLaunchPlanOptions {
  /** Mutable env to read flags from and apply config-dir overrides to. */
  readonly env?: Record<string, string | undefined>;
  /** Loads pi's interactive `main` (injected in tests; default dynamic import). */
  readonly loadPiMain?: () => Promise<PiMainEntry>;
  /** Builds the MCP bridge factory (injected in tests; default = real bridge). */
  readonly buildBridge?: (
    mcpServers: RecoderPiLaunchPlan['mcpServers'],
  ) => PiExtensionFactory;
  /** Applies env overrides (injected in tests; default mutates `env`). */
  readonly applyEnv?: (
    env: Record<string, string | undefined>,
    overrides: Record<string, string>,
  ) => void;
  /**
   * Pre-launch auth gate: resolves `true` when a valid Recoder session/token
   * exists. Default reuses recoder-code's existing `RecoderAuthService`
   * (device-flow loader) — it is NOT reimplemented here. Injected in tests so the
   * gate can be exercised both ways without touching the real auth file.
   */
  readonly ensureAuthenticated?: () => Promise<boolean>;
  /** Called when the auth gate fails, before exiting (default: prints the login hint). */
  readonly onUnauthenticated?: () => void;
  /** Exits the process when unauthenticated (injected in tests; default `process.exit`). */
  readonly exit?: (code: number) => void;
  /** Surfaces which Recoder MCP tool groups loaded/degraded (default: prints to stderr). */
  readonly reportToolGroups?: (summary: RecoderToolGroupSummary) => void;
}

/** Default pi `main` loader: dynamic import that survives CJS/ESM output. */
async function defaultLoadPiMain(): Promise<PiMainEntry> {
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier)',
  ) as (specifier: string) => Promise<{ main?: PiMainEntry }>;
  const pi = await dynamicImport('@recoder/pi-coding-agent');
  if (typeof pi.main !== 'function') {
    throw new Error(
      'pi interactive entry (@recoder/pi-coding-agent `main`) is not available.',
    );
  }
  return pi.main;
}

function defaultApplyEnv(
  env: Record<string, string | undefined>,
  overrides: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(overrides)) {
    env[key] = value;
  }
}

/**
 * Default pre-launch auth check: reuse recoder-code's existing
 * `RecoderAuthService` (the device-flow / token loader that persists under
 * `~/.recoder/auth.json`). Lazily imported so the auth module (and its `open`/
 * http deps) is only loaded on the flag-on path — never reimplemented here.
 */
async function defaultEnsureAuthenticated(): Promise<boolean> {
  const { RecoderAuthService } = await import(
    '../services/RecoderAuthService.js'
  );
  const auth = new RecoderAuthService();
  return auth.isAuthenticated();
}

/** Default unauthenticated handler: tell the user how to sign in (existing pattern). */
function defaultOnUnauthenticated(): void {
  console.error('❌ Not authenticated with recoder.xyz');
  console.error(`💡 Run: ${RECODER_AUTH_LOGIN_HINT}`);
}

/** Default exit: terminate the process so pi never launches unauthenticated. */
function defaultExit(code: number): void {
  process.exit(code);
}

/** Default tool-group reporter: surface loaded/degraded Recoder groups on stderr. */
function defaultReportToolGroups(summary: RecoderToolGroupSummary): void {
  if (summary.loaded.length > 0) {
    const loaded = summary.loaded
      .map((g) => `${g.name} (${g.toolCount} tool${g.toolCount === 1 ? '' : 's'})`)
      .join(', ');
    console.error(`[recoder-pi-shell] Recoder tool groups loaded: ${loaded}`);
  }
  for (const group of summary.degraded) {
    console.error(
      `[recoder-pi-shell] Recoder tool group degraded (unavailable): ${group.name} — ${group.reason}`,
    );
  }
  if (summary.loaded.length === 0 && summary.degraded.length === 0) {
    console.error('[recoder-pi-shell] No Recoder tool groups configured.');
  }
}

/**
 * Launch full pi's interactive mode as the Recoder Code shell.
 *
 * Real wiring performed here:
 *  1. Build the launch plan (Recoder config dir + branding + default MCP servers).
 *  2. PRE-LAUNCH AUTH GATE: ensure a valid Recoder session exists; otherwise
 *     prompt `recoder auth login` and exit WITHOUT launching pi.
 *  3. Apply the env overrides so pi writes its config under the Recoder config dir.
 *  4. Bridge the recodergit + brain MCP servers into pi via an extension factory,
 *     surfacing which tool groups loaded/degraded.
 *  5. Invoke pi's interactive `main(piArgs, { extensionFactories })`.
 *
 * Returns the plan it executed (so callers/tests can assert the wiring). When the
 * auth gate fails it returns the plan WITHOUT launching pi (under the default
 * `exit` the process has already terminated by then).
 */
export async function runRecoderPiShell(
  deps: RunPiShellDeps = {},
): Promise<RecoderPiLaunchPlan> {
  const env = deps.env ?? process.env;

  const plan = buildRecoderPiLaunchPlan({
    env,
    argv: deps.argv,
    exists: deps.exists,
    isOnPath: deps.isOnPath,
    startDir: deps.startDir,
  });

  // PRE-LAUNCH AUTH GATE — the pi agent must run authenticated. Reuses the
  // existing recoder-code auth flow; on failure we surface the login hint and
  // exit before any env mutation or pi launch.
  const ensureAuthenticated =
    deps.ensureAuthenticated ?? defaultEnsureAuthenticated;
  const authenticated = await ensureAuthenticated();
  if (!authenticated) {
    (deps.onUnauthenticated ?? defaultOnUnauthenticated)();
    (deps.exit ?? defaultExit)(1);
    // Reached only when a non-terminating `exit` is injected (tests): never
    // launch pi for an unauthenticated user.
    return plan;
  }

  const applyEnv = deps.applyEnv ?? defaultApplyEnv;
  applyEnv(env, plan.envOverrides);

  const reportToolGroups = deps.reportToolGroups ?? defaultReportToolGroups;
  const buildBridge =
    deps.buildBridge ??
    ((mcpServers) =>
      createRecoderMcpBridgeFactory(mcpServers, {
        onGroupsResolved: reportToolGroups,
      }));
  const bridge = buildBridge(plan.mcpServers);

  const loadPiMain = deps.loadPiMain ?? defaultLoadPiMain;
  const piMain = await loadPiMain();

  await piMain(plan.piArgs, { extensionFactories: [bridge] });

  return plan;
}

/**
 * Gate used by the CLI entry: when the flag is enabled, launch the pi shell and
 * return `true` (caller should return without running the legacy path).
 * Otherwise return `false` (no side effects), so the default Ink path runs.
 */
export async function maybeRunRecoderPiShell(
  deps: RunPiShellDeps = {},
): Promise<boolean> {
  const env = deps.env ?? process.env;
  if (!isPiShellEnabled(env)) {
    return false;
  }
  await runRecoderPiShell(deps);
  return true;
}
