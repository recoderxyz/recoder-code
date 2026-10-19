/**
 * Best-effort lifecycle reporting for a Recoder Code process managed by Loom.
 * The CLI must remain usable when Loom is absent or its socket is unavailable.
 */
import { createConnection } from 'node:net';
import process from 'node:process';

export type LoomAgentState = 'idle' | 'working' | 'blocked';

type LoomEnvironment = NodeJS.ProcessEnv;

interface LoomReportConfig {
  paneId: string;
  socketPath: string;
}

let lastSequence = 0;

export function loomReportConfig(
  environment: LoomEnvironment = process.env
): LoomReportConfig | undefined {
  const { LOOM_AGENT, LOOM_ENV, LOOM_PANE_ID, LOOM_SOCKET_PATH } = environment;
  if (
    LOOM_ENV !== '1' ||
    LOOM_AGENT !== 'recoder_code' ||
    !LOOM_PANE_ID ||
    !LOOM_SOCKET_PATH
  ) {
    return undefined;
  }
  return { paneId: LOOM_PANE_ID, socketPath: LOOM_SOCKET_PATH };
}

function nextSequence() {
  lastSequence = Math.max(Date.now(), lastSequence + 1);
  return lastSequence;
}

export function loomAgentStateRequest(
  state: LoomAgentState,
  config: LoomReportConfig
) {
  const sequence = nextSequence();
  return {
    id: `loom:recoder_code:${sequence}`,
    method: 'pane.report_agent',
    params: {
      pane_id: config.paneId,
      source: 'loom:recoder_code',
      agent: 'recoder_code',
      state,
      seq: sequence,
    },
  };
}

export function lifecycleStateForLoom({
  streamingState,
  hasConfirmation,
  hasShellConfirmation,
  hasExecutingTool,
}: {
  streamingState: 'idle' | 'responding' | 'waiting_for_confirmation';
  hasConfirmation: boolean;
  hasShellConfirmation: boolean;
  hasExecutingTool: boolean;
}): LoomAgentState {
  if (
    streamingState === 'waiting_for_confirmation' ||
    hasConfirmation ||
    hasShellConfirmation
  ) {
    return 'blocked';
  }
  if (streamingState === 'responding' || hasExecutingTool) {
    return 'working';
  }
  return 'idle';
}

export function reportLoomAgentState(
  state: LoomAgentState,
  environment: LoomEnvironment = process.env
) {
  const config = loomReportConfig(environment);
  if (!config) return;

  try {
    const socket = createConnection({ path: config.socketPath });
    const close = () => socket.destroy();
    socket.unref();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.end(`${JSON.stringify(loomAgentStateRequest(state, config))}\n`);
    });
    socket.once('error', close);
    socket.once('timeout', close);
  } catch {
    // Reporting must never interrupt the interactive CLI.
  }
}
