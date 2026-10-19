/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recoder Code on pi — MCP → pi tool bridge (Stage A).
 *
 * Full pi (`@recoder/pi-coding-agent`) has no native `mcpServers` config; it
 * exposes tools to its agent through the *extension* system. This bridge is the
 * real seam that surfaces Recoder Code's default MCP servers (recodergit's
 * code-graph + the brain's shared memory) to pi's agent: it returns a pi
 * ExtensionFactory that, on load, connects each configured stdio MCP server and
 * registers its tools with pi via `pi.registerTool(...)`.
 *
 * Doctrine (mirrors the resolvers it bridges):
 *  - FAIL-SAFE: a server that can't be spawned/queried is skipped with a warning,
 *    never crashing the TUI. The shell still launches with the rest.
 *  - REAL WIRING: tool calls are proxied straight to the live MCP server over
 *    stdio. No stubs in product code.
 *
 * pi ships no `.d.ts` for `@recoder/pi-coding-agent`, so the `pi` ExtensionAPI is
 * typed structurally here (just the surface this bridge uses).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig } from 'recoder-code-core';

/** The slice of pi's ExtensionAPI this bridge needs. */
export interface PiToolRegistrar {
  registerTool(tool: PiBridgedTool): void;
}

/** A pi tool definition (loosely typed for the bridge). */
export interface PiBridgedTool {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text?: string }>; details: unknown }>;
}

/** A pi ExtensionFactory: `(pi) => void | Promise<void>`. */
export type PiExtensionFactory = (pi: PiToolRegistrar) => void | Promise<void>;

/** A connected MCP client surface (the subset the bridge uses). */
export interface BridgedMcpConnection {
  listTools(): Promise<{
    tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  }>;
  callTool(args: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ content?: unknown; isError?: boolean }>;
  close(): Promise<void>;
}

/** Connect to one configured stdio MCP server. Injectable for tests. */
export type ConnectMcpServer = (
  name: string,
  config: MCPServerConfig,
) => Promise<BridgedMcpConnection>;

/** A Recoder tool group that came up successfully. */
export interface LoadedToolGroup {
  /** Server/group name (e.g. `recodergit`, `brain`). */
  readonly name: string;
  /** Number of tools the group registered into pi. */
  readonly toolCount: number;
}

/** A Recoder tool group that failed to start (degraded; not fatal). */
export interface DegradedToolGroup {
  /** Server/group name (e.g. `recodergit`, `brain`). */
  readonly name: string;
  /** Why it could not be brought up. */
  readonly reason: string;
}

/**
 * Outcome of bridging the configured Recoder MCP servers into pi. Lets the
 * launcher surface which tool groups loaded and which degraded — the bridge
 * never throws, so this is how callers learn the real, partial result.
 */
export interface RecoderToolGroupSummary {
  readonly loaded: LoadedToolGroup[];
  readonly degraded: DegradedToolGroup[];
}

export interface McpBridgeOptions {
  /** Override the connector (tests inject a fake; default spawns over stdio). */
  readonly connect?: ConnectMcpServer;
  /** Sink for fail-safe warnings (defaults to console.error). */
  readonly onWarn?: (message: string) => void;
  /**
   * Called once after every configured server has been attempted, with the
   * loaded/degraded breakdown. Used to surface which Recoder tool groups are
   * available in the running pi agent. Optional; defaults to no-op in the bridge
   * (the launcher injects a reporter).
   */
  readonly onGroupsResolved?: (summary: RecoderToolGroupSummary) => void;
}

const EMPTY_OBJECT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: true,
} as const;

/** Real stdio connector backed by the MCP SDK. */
async function connectOverStdio(
  name: string,
  config: MCPServerConfig,
): Promise<BridgedMcpConnection> {
  if (!config.command) {
    throw new Error(`MCP server "${name}" has no command`);
  }
  const client = new Client(
    { name: `recoder-pi-shell:${name}`, version: '1.0.0' },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: {
      ...(process.env as Record<string, string>),
      ...((config.env as Record<string, string>) ?? {}),
    },
    cwd: config.cwd,
  });
  await client.connect(transport);
  return {
    listTools: () => client.listTools() as Promise<{ tools: never[] }>,
    callTool: (args) => client.callTool(args) as Promise<{ content?: unknown }>,
    close: () => client.close(),
  };
}

/** Flatten an MCP tool result's content into plain text for the model. */
function toText(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .filter(
      (part): part is { type: string; text: string } =>
        !!part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('\n');
}

/**
 * Build a pi ExtensionFactory that bridges the given MCP servers into pi's agent.
 * Each server is connected once at extension load; its tools are namespaced
 * `<server>__<tool>` and proxied to the live server.
 */
export function createRecoderMcpBridgeFactory(
  mcpServers: Record<string, MCPServerConfig>,
  options: McpBridgeOptions = {},
): PiExtensionFactory {
  const connect = options.connect ?? connectOverStdio;
  const onWarn =
    options.onWarn ??
    ((message: string) => {
      console.error(`[recoder-pi-shell] ${message}`);
    });

  return async (pi: PiToolRegistrar) => {
    const entries = Object.entries(mcpServers).filter(
      ([, config]) => !!config && !!config.command,
    );
    const loaded: LoadedToolGroup[] = [];
    const degraded: DegradedToolGroup[] = [];
    for (const [name, config] of entries) {
      try {
        const connection = await connect(name, config);
        const { tools } = await connection.listTools();
        for (const tool of tools) {
          pi.registerTool({
            name: `${name}__${tool.name}`,
            label: tool.name,
            description:
              tool.description ?? `${name} MCP tool (${tool.name})`,
            parameters: tool.inputSchema ?? EMPTY_OBJECT_SCHEMA,
            async execute(_toolCallId, params) {
              const result = await connection.callTool({
                name: tool.name,
                arguments: params ?? {},
              });
              return {
                content: [{ type: 'text', text: toText(result.content) }],
                details: result,
              };
            },
          });
        }
        loaded.push({ name, toolCount: tools.length });
      } catch (error: unknown) {
        // Fail-safe: a missing/broken MCP server must never break the shell.
        // The group is recorded as degraded so the launcher can surface it; the
        // rest of the groups (and the shell itself) still come up.
        const message = error instanceof Error ? error.message : String(error);
        degraded.push({ name, reason: message });
        onWarn(`MCP server "${name}" unavailable, skipping its tools: ${message}`);
      }
    }
    options.onGroupsResolved?.({ loaded, degraded });
  };
}
