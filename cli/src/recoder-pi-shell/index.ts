/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recoder Code on pi — Stage A shell (opt-in behind `RECODER_PI_SHELL`).
 * See `docs/PI-CONSOLIDATION.md`.
 */

export {
  buildRecoderPiLaunchPlan,
  resolveRecoderConfigDir,
  RECODER_PI_AGENT_DIR_ENV,
  RECODER_PI_APP_NAME,
  RECODER_APP_NAME,
  RECODER_APP_TITLE,
  RECODER_CONFIG_DIR_NAME,
  RECODER_CONFIG_DIR_ENV,
  RECODER_PI_CONFIG_DIR_ENV,
  type BuildLaunchPlanOptions,
  type LaunchPlanResolverSeams,
  type RecoderPiLaunchPlan,
  type EnvLike,
  type ExistsFn,
  type IsOnPathFn,
} from './launch-plan.js';
export {
  createRecoderMcpBridgeFactory,
  type BridgedMcpConnection,
  type ConnectMcpServer,
  type DegradedToolGroup,
  type LoadedToolGroup,
  type McpBridgeOptions,
  type PiBridgedTool,
  type PiExtensionFactory,
  type PiToolRegistrar,
  type RecoderToolGroupSummary,
} from './mcp-bridge.js';
export {
  isPiShellEnabled,
  maybeRunRecoderPiShell,
  runRecoderPiShell,
  RECODER_PI_SHELL_ENV,
  RECODER_AUTH_LOGIN_HINT,
  type PiMainEntry,
  type RunPiShellDeps,
} from './launcher.js';
