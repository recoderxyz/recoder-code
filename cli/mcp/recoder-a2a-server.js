#!/usr/bin/env node
/**
 * Recoder A2A MCP Server for Claude Code
 *
 * Provides 6 tools to interact with the Recoder platform:
 * - recoder_list_agents: List connected A2A agents
 * - recoder_list_tasks: View A2A task queue
 * - recoder_send_task: Send task to another agent via A2A
 * - recoder_create_thread: Create agent thread with Daytona sandbox
 * - recoder_sandbox_exec: Execute code in isolated sandbox
 * - recoder_get_thread: Get thread messages (including AI responses)
 */

const DOCKER_URL = process.env.RECODER_DOCKER_URL || 'https://docker.recoder.xyz';
const API_URL = process.env.RECODER_API_URL || 'https://api.recoder.xyz';
const A2A_URL = process.env.RECODER_A2A_URL || `${DOCKER_URL.replace('https:', 'wss:').replace('http:', 'ws:')}/agent-bridge`;
const DAYTONA_URL = process.env.RECODER_DAYTONA_URL || 'http://localhost:3900/api';
const DAYTONA_KEY = process.env.DAYTONA_API_KEY || '';
const RAW_AUTH_TOKEN = process.env.RECODER_API_TOKEN || '';
const AGENT_ID = process.env.RECODER_AGENT_ID || 'claude_code';

// ── Recoder capability tools (governed MCP interop host) ──
// The conductor injects RECODER_INTERNAL_URL + INTERNAL_SERVICE_KEY into the
// agent's launch env; the shared bridge calls the backend's gated MCP host on
// the agent’s behalf (authorize→risk→execute→audit). Single source of truth:
// recoder-capability-tools.cjs (vendored identically across copies).
const { createCapabilityTools } = require('./recoder-capability-tools.cjs');
const capabilities = createCapabilityTools({ agentId: AGENT_ID, dockerUrl: DOCKER_URL });
const SESSION_ID = process.env.RECODER_SESSION_ID || `${AGENT_ID}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function isRecoderApiKeyPair(value) {
  if (!value || typeof value !== 'string' || !value.includes(':')) return false;
  const [publicKey, secretKey] = value.split(':', 2);
  return publicKey.startsWith('pk_') && secretKey.startsWith('sk_');
}

const PYTHON_API_KEY = isRecoderApiKeyPair(RAW_AUTH_TOKEN) ? RAW_AUTH_TOKEN : '';
const _rawSessionToken = process.env.RECODER_SESSION_TOKEN || (PYTHON_API_KEY ? '' : RAW_AUTH_TOKEN);
const PLATFORM_TOKEN = (() => {
  try { return decodeURIComponent(_rawSessionToken); } catch { return _rawSessionToken; }
})();

function buildPlatformHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (PLATFORM_TOKEN) headers.Authorization = `Bearer ${PLATFORM_TOKEN}`;
  return headers;
}

function buildPythonApiHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (PYTHON_API_KEY) headers['x-api-key'] = PYTHON_API_KEY;
  else if (PLATFORM_TOKEN) headers.Authorization = `Bearer ${PLATFORM_TOKEN}`;
  return headers;
}

// ── WebSocket A2A Bridge Connection ──

let ws = null;
let wsConnected = false;
let wsReconnectTimer = null;
let wsHeartbeatInterval = null;
let wsRetries = 0;
// Set when the bridge REJECTED the upgrade for auth (401/403): retrying cannot
// succeed until the operator provides a token, so reconnects are disabled.
let wsAuthRejected = false;
const WS_MAX_RETRIES = 9999; // effectively unlimited — reconnect until process exits

// Inbound task queue — tasks assigned to this agent by the bridge
const inboundTasks = [];    // { taskId, prompt, context, from, receivedAt, status: 'pending'|'accepted'|'completed'|'failed' }
const MAX_INBOUND_TASKS = 50;
let mcpReady = false; // set to true after notifications/initialized

function pushNotification(level, data) {
  if (!mcpReady) return;
  try {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: { level, logger: 'recoder-a2a', data },
    }) + '\n');
  } catch {}
}

function handleBridgeMessage(msg) {
  switch (msg.type) {
    case 'registered':
      process.stderr.write(`[recoder-a2a] Registered on bridge: ${msg.agentId} session:${msg.sessionId || SESSION_ID} workspaces: ${JSON.stringify(msg.workspaces || [])}\n`);
      break;

    case 'task.assigned': {
      const task = {
        taskId: msg.taskId,
        prompt: msg.prompt || msg.task || '',
        context: msg.context || {},
        from: msg.from || msg.context?.source || 'unknown',
        worktreeBranch: msg.worktreeBranch || null,
        receivedAt: new Date().toISOString(),
        status: 'pending',
      };
      inboundTasks.unshift(task);
      if (inboundTasks.length > MAX_INBOUND_TASKS) inboundTasks.pop();
      process.stderr.write(`[recoder-a2a] Task assigned: ${task.taskId} from ${task.from}\n`);
      // Auto-acknowledge receipt
      wsSend({ type: 'task.progress', taskId: task.taskId, progress: 0, output: `Task received by ${AGENT_ID}` });
      // Push MCP notification so Claude Code sees the task immediately without polling
      const preview = task.prompt.slice(0, 120);
      pushNotification('info', `📨 New task [${task.taskId}] from ${task.from}: ${preview}${task.prompt.length > 120 ? '...' : ''} — run recoder_inbox to view`);
      break;
    }

    case 'task.cancelled': {
      const idx = inboundTasks.findIndex(t => t.taskId === msg.taskId);
      if (idx >= 0) inboundTasks[idx].status = 'cancelled';
      process.stderr.write(`[recoder-a2a] Task cancelled: ${msg.taskId}\n`);
      break;
    }

    case 'channel.message':
      process.stderr.write(`[recoder-a2a] Channel ${msg.channelId} from ${msg.from}: ${(msg.content || '').slice(0, 100)}\n`);
      break;

    case 'workspace.updated':
      process.stderr.write(`[recoder-a2a] Workspace updated: ${msg.workspaceId}\n`);
      break;

    case 'ping':
      wsSend({ type: 'heartbeat' });
      break;

    default:
      break;
  }
}

function wsSend(obj) {
  if (ws && wsConnected) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }
}

function connectBridge() {
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  if (wsHeartbeatInterval) { clearInterval(wsHeartbeatInterval); wsHeartbeatInterval = null; }
  try {
    const WebSocket = require('ws');
    if (ws) { try { ws.removeAllListeners(); ws.terminate(); } catch {} ws = null; }
    const bridgeUrl = PLATFORM_TOKEN
      ? `${A2A_URL}?token=${encodeURIComponent(PLATFORM_TOKEN)}&agentId=${AGENT_ID}&sessionId=${encodeURIComponent(SESSION_ID)}&capabilities=execute,plan,edit`
      : `${A2A_URL}?agentId=${AGENT_ID}&sessionId=${encodeURIComponent(SESSION_ID)}`;
    ws = new WebSocket(bridgeUrl, {
      headers: { 'x-agent-id': AGENT_ID, 'x-capabilities': JSON.stringify(['execute', 'plan', 'edit']) },
      handshakeTimeout: 10000,
    });
    ws.on('open', () => {
      wsConnected = true;
      wsRetries = 0;
      process.stderr.write(`[recoder-a2a] Connected to A2A bridge as ${AGENT_ID}\n`);
      // Heartbeat every 25s (server expects within 60s)
      wsHeartbeatInterval = setInterval(() => wsSend({ type: 'heartbeat' }), 25000);
    });
    ws.on('message', (data) => {
      try { handleBridgeMessage(JSON.parse(data.toString())); } catch {}
    });
    // An auth-rejected upgrade (401/403) will not fix itself by retrying —
    // surface the fix (set a token) once and disable the bridge quietly.
    ws.on('unexpected-response', (_req, res) => {
      wsConnected = false;
      if (res && (res.statusCode === 401 || res.statusCode === 403)) {
        wsAuthRejected = true;
        process.stderr.write(
          `[recoder-a2a] A2A bridge rejected the connection (${res.statusCode}) — set RECODER_SESSION_TOKEN/PLATFORM_TOKEN to enable the bridge. Not retrying.\n`,
        );
      }
      try { ws.terminate(); } catch {}
    });
    ws.on('close', () => {
      wsConnected = false;
      if (wsHeartbeatInterval) { clearInterval(wsHeartbeatInterval); wsHeartbeatInterval = null; }
      if (!wsAuthRejected && wsRetries < WS_MAX_RETRIES) {
        wsRetries++;
        const delay = Math.min(5000 * wsRetries, 30000);
        wsReconnectTimer = setTimeout(connectBridge, delay);
      }
    });
    ws.on('error', () => { wsConnected = false; });
  } catch {
    process.stderr.write('[recoder-a2a] ws module not found — A2A bridge disabled\n');
  }
}

// Connect in background (don't block MCP startup)
setTimeout(connectBridge, 500);

// ── MCP Protocol (JSON-RPC over stdio) ──

let buffer = '';
process.stdin.setEncoding('utf8');
// When the MCP host (the parent process) goes away, stdin ends. Exit instead
// of lingering as an orphan that keeps a bridge socket + timers alive forever.
process.stdin.on('end', () => process.exit(0));
process.stdin.on('close', () => process.exit(0));
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);
    if (line) {
      try { handleMessage(JSON.parse(line)); } catch {}
    }
  }
});

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function respond(id, result) { send({ jsonrpc: '2.0', id, result }); }
function respondError(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

// ── Tool Definitions ──

const TOOLS = [
  {
    name: 'recoder_list_agents',
    description: 'List all agents registered on the Recoder A2A platform. Shows agent IDs, platforms, and health status.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'recoder_list_tasks',
    description: 'List recent A2A tasks. Shows task IDs, states, and assignments.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'recoder_send_task',
    description: 'Send a task to another agent via the A2A protocol. The target agent will receive and process it.',
    inputSchema: {
      type: 'object',
      properties: {
        target_agent: { type: 'string', description: 'Target agent ID (codex, claude_code, recoder_app, recoder_agency, recoder_pm, recoder_backend)' },
        task: { type: 'string', description: 'Task description' },
        intent: { type: 'string', enum: ['execute', 'plan', 'handoff', 'tool_call'], default: 'execute' },
      },
      required: ['target_agent', 'task'],
    },
  },
  {
    name: 'recoder_create_thread',
    description: 'Create an AI agent thread on Recoder. Provisions a Daytona sandbox and starts an AI agent that can write code, browse the web, and execute commands.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The task/prompt for the AI agent' },
        agent_id: { type: 'string', description: 'Agent ID (default: Recoder assistant)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'recoder_get_thread',
    description: 'Get messages from an existing thread, including AI responses.',
    inputSchema: {
      type: 'object',
      properties: {
        thread_id: { type: 'string', description: 'Thread ID to fetch messages from' },
      },
      required: ['thread_id'],
    },
  },
  {
    name: 'recoder_sandbox_exec',
    description: 'Execute a command in an isolated Daytona sandbox with Python 3.11, Node.js 22, and internet access.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        sandbox_id: { type: 'string', description: 'Existing sandbox ID (creates new if omitted)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'recoder_inbox',
    description: 'Check inbound tasks assigned to this agent via the A2A bridge. Shows pending tasks from other agents (Codex, recoder_app, etc).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'recoder_task_respond',
    description: 'Respond to an inbound task — complete it with a result or mark it as failed.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID from recoder_inbox' },
        result: { type: 'string', description: 'Result/response to send back' },
        status: { type: 'string', enum: ['complete', 'failed'], default: 'complete', description: 'Mark as complete or failed' },
      },
      required: ['task_id', 'result'],
    },
  },
  ...capabilities.tools,
];

// ── Helpers ──

async function apiFetch(url, options = {}) {
  const headers = buildPlatformHeaders(options.headers);
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Tool Implementations ──

async function handleToolCall(name, args) {
  // Governed capability tools are handled by the shared bridge; it returns
  // null for names it does not own so we fall through to the switch below.
  const cap = await capabilities.handleCapabilityTool(name, args);
  if (cap !== null) return cap;
  switch (name) {
    case 'recoder_list_agents': {
      const lines = [];
      lines.push(`This session: ${AGENT_ID}:${SESSION_ID}`);
      lines.push(`A2A bridge: ${wsConnected ? 'connected' : 'disconnected'}`);

      // Live bridge sessions (shows unique session IDs per terminal)
      try {
        const bridgeData = await apiFetch(`${DOCKER_URL}/api/a2a/bridge/agents`);
        const sessions = bridgeData.data?.sessions || [];
        if (sessions.length) {
          lines.push(`\n── Live Bridge Sessions (${sessions.length}) ──`);
          for (const s of sessions) {
            const isMe = s.sessionId === SESSION_ID;
            lines.push(`• ${s.agentId} session:${s.sessionId}${isMe ? ' [this terminal]' : ''} status:${s.status} since:${s.connectedAt?.slice(0, 16)}`);
          }
        } else {
          lines.push('\n── No live bridge sessions ──');
        }
      } catch {
        lines.push('\n── Bridge sessions unavailable ──');
      }

      // Registered agents from agent registry (platform-wide, may include offline)
      try {
        const data = await apiFetch(`${DOCKER_URL}/api/a2a/agents`);
        const agents = data.agents || [];
        if (agents.length) {
          lines.push(`\n── Registered Agents (${agents.length}) ──`);
          for (const a of agents) {
            lines.push(`• ${a.agent_id} (${a.platform}) health:${a.health}`);
          }
        }
      } catch {}

      return lines.join('\n');
    }

    case 'recoder_list_tasks': {
      const data = await apiFetch(`${DOCKER_URL}/api/a2a/tasks`);
      const tasks = data.data?.tasks || [];
      if (!tasks.length) return 'No tasks in queue.';
      return tasks.map(t => `• ${t.id?.slice(0,12)} state:${t.state} from:${t.requester?.agent_id} to:${t.assignee?.agent_id}`).join('\n');
    }

    case 'recoder_send_task': {
      // Try WebSocket first (real-time)
      if (wsConnected && ws) {
        ws.send(JSON.stringify({
          type: 'intent',
          intent: args.intent || 'execute',
          target: args.target_agent,
          task: args.task,
          from: AGENT_ID,
        }));
        return `Task sent to ${args.target_agent} via A2A bridge (real-time).\nIntent: ${args.intent || 'execute'}\nTask: ${args.task}`;
      }

      // Fallback to REST API
      const data = await apiFetch(`${DOCKER_URL}/api/a2a/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: 'ws_default',
          thread_id: `thread_${Date.now()}`,
          requester: { agent_id: AGENT_ID, platform: AGENT_ID },
          assignee: { agent_id: args.target_agent, platform: args.target_agent },
          connector: { type: 'bridge', protocol: 'websocket', connector_id: 'mcp-bridge', platform: 'recoder' },
          payload: { intent: args.intent || 'execute', task: args.task },
        }),
      });
      return `Task created: ${data.data?.id || 'unknown'}\nState: ${data.data?.state || 'submitted'}\nTarget: ${args.target_agent}`;
    }

    case 'recoder_create_thread': {
      const authHeaders = buildPythonApiHeaders();
      const agentId = args.agent_id || '7e91f872-2407-42ac-bfcb-ea69a496e85c';

      const threadRes = await fetch(`${API_URL}/v1/threads`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const threadData = await threadRes.json();
      if (!threadData.thread_id) return `Error: ${JSON.stringify(threadData)}`;

      if (args.prompt) {
        const form = new URLSearchParams();
        form.append('prompt', args.prompt);
        form.append('thread_id', threadData.thread_id);
        form.append('agent_id', agentId);
        const startRes = await fetch(`${API_URL}/v1/agent/start`, {
          method: 'POST',
          headers: buildPythonApiHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
          body: form.toString(),
        });
        const startData = await startRes.json();
        return `Thread: ${threadData.thread_id}\nStatus: ${startData.status || 'created'}\nRun: ${startData.agent_run_id || 'none'}\nView: https://agents.recoder.xyz/thread/${threadData.thread_id}`;
      }
      return `Thread: ${threadData.thread_id}\nView: https://agents.recoder.xyz/thread/${threadData.thread_id}`;
    }

    case 'recoder_get_thread': {
      const authHeaders = buildPythonApiHeaders();
      const res = await fetch(`${API_URL}/v1/threads/${args.thread_id}/messages`, { headers: authHeaders });
      const messages = await res.json();
      const msgs = Array.isArray(messages) ? messages : messages.messages || messages.items || [];
      if (!msgs.length) return 'No messages in this thread yet.';
      return msgs.map(m => {
        const role = m.role || m.type || '?';
        const content = typeof m.content === 'string' ? m.content : m.content?.content || JSON.stringify(m.content)?.slice(0, 200);
        return `[${role}] ${content}`;
      }).join('\n\n');
    }

    case 'recoder_sandbox_exec': {
      if (!DAYTONA_KEY) return `Error: DAYTONA_API_KEY not configured. DAYTONA_URL=${DAYTONA_URL}`;
      const dHeaders = { 'Authorization': `Bearer ${DAYTONA_KEY}`, 'Content-Type': 'application/json' };
      const baseUrl = DAYTONA_URL.replace(/\/api\/?$/, '');

      let sandboxId = args.sandbox_id;
      let createdNew = false;

      if (!sandboxId) {
        const createUrl = `${DAYTONA_URL}/sandbox`;
        let createRes;
        try {
          createRes = await fetch(createUrl, {
            method: 'POST', headers: dHeaders,
            body: JSON.stringify({ image: 'daytonaio/sandbox:0.5.0-slim', public: true, auto_stop_interval: 10 }),
          });
        } catch (fetchErr) {
          return `Sandbox fetch error: ${fetchErr.message}\nURL: ${createUrl}\nDAYTONA_URL: ${DAYTONA_URL}`;
        }
        const createText = await createRes.text();
        if (!createRes.ok) {
          return `Error creating sandbox (HTTP ${createRes.status}): ${createText.slice(0, 300)}\nURL: ${createUrl}`;
        }
        let sb;
        try { sb = JSON.parse(createText); } catch { return `Sandbox response not JSON (HTTP ${createRes.status}):\n${createText.slice(0, 500)}\nURL: ${createUrl}\nDAYTONA_URL: ${DAYTONA_URL}`; }
        if (!sb.id) return `Error creating sandbox: ${JSON.stringify(sb)}`;
        sandboxId = sb.id;
        createdNew = true;
        await new Promise(r => setTimeout(r, 5000));
      }

      let execRes;
      const execUrl = `${baseUrl}/api/toolbox/${sandboxId}/toolbox/process/execute`;
      const shellCommand = `sh -c ${JSON.stringify(args.command)}`;
      try {
        execRes = await fetch(execUrl, {
          method: 'POST', headers: dHeaders,
          body: JSON.stringify({ command: shellCommand }),
        });
      } catch (fetchErr) {
        return `Sandbox exec fetch error: ${fetchErr.message}\nURL: ${execUrl}`;
      }
      const execText = await execRes.text();
      let result;
      try { result = JSON.parse(execText); } catch { return `Exec response not JSON (HTTP ${execRes.status}):\n${execText.slice(0, 500)}\nURL: ${execUrl}`; }

      // Auto-cleanup if we created it
      if (createdNew) {
        fetch(`${DAYTONA_URL}/sandbox/${sandboxId}`, { method: 'DELETE', headers: dHeaders }).catch(() => {});
      }

      const output = result.result || result.output || result.stdout || JSON.stringify(result);
      return `Sandbox: ${sandboxId}${createdNew ? ' (auto-created)' : ''}\nExit: ${result.exitCode ?? result.exit_code ?? '?'}\n\n${output}`;
    }

    case 'recoder_inbox': {
      const pending = inboundTasks.filter(t => t.status === 'pending');
      const recent = inboundTasks.filter(t => t.status !== 'pending').slice(0, 5);

      // Also fetch unclaimed REST tasks assigned to this agent (works when bridge is disconnected)
      let restPending = [];
      try {
        const restData = await apiFetch(`${DOCKER_URL}/api/a2a/tasks?assignee_agent_id=${encodeURIComponent(AGENT_ID)}&state=submitted&limit=20`);
        const allRest = restData.data?.tasks || [];
        restPending = allRest.filter(t => {
          const claim = t.metadata?.claimedBy;
          return !claim || claim.sessionId === SESSION_ID;
        });
      } catch {}

      if (!pending.length && !recent.length && !restPending.length) {
        return `No inbound tasks.\nSession: ${SESSION_ID}\nBridge: ${wsConnected ? 'connected' : 'disconnected'}`;
      }

      const lines = [`Session: ${SESSION_ID}`];
      if (pending.length) {
        lines.push(`\n── Bridge Tasks (${pending.length}) ──`);
        for (const t of pending) {
          lines.push(`• [${t.taskId}] from:${t.from} at:${t.receivedAt}`);
          lines.push(`  ${t.prompt.slice(0, 200)}`);
          if (t.worktreeBranch) lines.push(`  branch: ${t.worktreeBranch}`);
        }
      }
      if (restPending.length) {
        lines.push(`\n── REST Tasks (${restPending.length}) ──`);
        for (const t of restPending) {
          const claimedByMe = t.metadata?.claimedBy?.sessionId === SESSION_ID;
          const payload = t.payload;
          const prompt = (typeof payload === 'object' && payload !== null)
            ? (payload.text || payload.prompt || payload.task || JSON.stringify(payload)).slice(0, 150)
            : String(payload || '').slice(0, 150);
          lines.push(`• [${t.id}] from:${t.requester?.agent_id} state:${t.state}${claimedByMe ? ' [claimed:mine]' : ''}`);
          lines.push(`  ${prompt}`);
        }
      }
      if (recent.length) {
        lines.push(`\n── Recent (${recent.length}) ──`);
        for (const t of recent) {
          lines.push(`• [${t.taskId}] ${t.status} from:${t.from}`);
        }
      }
      lines.push(`\nBridge: ${wsConnected ? 'connected' : 'disconnected'}`);
      return lines.join('\n');
    }

    case 'recoder_task_respond': {
      const wsTask = inboundTasks.find(t => t.taskId === args.task_id);
      if (wsTask) {
        const isComplete = (args.status || 'complete') === 'complete';
        if (isComplete) {
          wsSend({ type: 'task.complete', taskId: args.task_id, result: args.result });
          wsTask.status = 'completed';
        } else {
          wsSend({ type: 'task.failed', taskId: args.task_id, error: args.result });
          wsTask.status = 'failed';
        }
        return `Task ${args.task_id} marked as ${wsTask.status}. Response sent via bridge.`;
      }
      // REST task: claim, then working, then completed/failed
      // State machine: submitted → working → completed|failed
      const isComplete = (args.status || 'complete') === 'complete';
      const targetState = isComplete ? 'completed' : 'failed';
      try {
        await apiFetch(`${DOCKER_URL}/api/a2a/tasks/${args.task_id}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: SESSION_ID, agent_id: AGENT_ID }),
        });
      } catch (claimErr) {
        if ((claimErr.message || '').includes('409')) return `Task ${args.task_id} is claimed by another session.`;
      }

      // First transition: submitted → working (required by state machine)
      // Ignore errors here — if task is already 'working', the next transition still succeeds
      try {
        await apiFetch(`${DOCKER_URL}/api/a2a/tasks/${args.task_id}/transition`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_state: 'working',
            triggered_by: `${AGENT_ID}:${SESSION_ID}`,
            reason: 'Task claimed and started',
          }),
        });
      } catch (workingErr) {
        // If already working or past it, continue — only fail if it's a real error
        if (!(workingErr.message || '').includes('422')) throw workingErr;
      }

      // Second transition: working → completed|failed
      const transData = await apiFetch(`${DOCKER_URL}/api/a2a/tasks/${args.task_id}/transition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_state: targetState,
          triggered_by: `${AGENT_ID}:${SESSION_ID}`,
          ...(isComplete
            ? { result: { output: args.result }, reason: 'Task completed' }
            : { error: { message: args.result, code: 'agent_error' }, reason: 'Task failed' }),
        }),
      });
      return `Task ${args.task_id} → ${targetState}.\nState: ${transData.data?.state || transData.state}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP Message Handler ──

async function handleMessage(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      respond(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'recoder-a2a', version: '2.5.0' },
      });
      break;
    case 'notifications/initialized':
      mcpReady = true;
      process.stderr.write(`[recoder-a2a] Ready. ${TOOLS.length} tools | bridge: ${A2A_URL}\n`);
      break;
    case 'tools/list':
      respond(id, { tools: TOOLS });
      break;
    case 'tools/call':
      try {
        const text = await handleToolCall(params.name, params.arguments || {});
        respond(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        respond(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
      }
      break;
    default:
      if (id) respondError(id, -32601, `Method not found: ${method}`);
      break;
  }
}

// Prevent uncaught errors from killing the MCP server
process.on('uncaughtException', (err) => { process.stderr.write(`[recoder-a2a] uncaught: ${err.message}\n`); });
process.on('unhandledRejection', (err) => { process.stderr.write(`[recoder-a2a] unhandled rejection: ${err}\n`); });

process.stderr.write('[recoder-a2a] Recoder A2A MCP Server v2.5.0\n');
process.stderr.write(`[recoder-a2a] API: ${API_URL} | A2A: ${A2A_URL}\n`);
if (DAYTONA_KEY) process.stderr.write('[recoder-a2a] Daytona sandbox enabled\n');
if (PLATFORM_TOKEN || PYTHON_API_KEY) process.stderr.write('[recoder-a2a] API auth configured\n');
