'use strict';
/**
 * Recoder capability tools — the governed MCP interop bridge, shared verbatim by
 * every agent-facing stdio server (the main `mcp/recoder-a2a-server.js` and the
 * distributed npm/CLI copies). This is the SINGLE source of truth for the
 * capability tool set so the copies cannot drift.
 *
 * The conductor injects RECODER_INTERNAL_URL + INTERNAL_SERVICE_KEY into the
 * agent's launch env; these tools call the backend's gated MCP host
 * (/api/mcp/tools/:server/:tool/call) on the agent's behalf. Every call runs the
 * authorize -> risk -> execute -> audit gate server-side. No secret is written
 * anywhere; it lives only in env. When the key is absent (running outside a
 * Recoder workspace) each tool degrades to a truthful "not available" string.
 *
 * This file is vendored identically into each package dir. It is plain CJS and
 * self-contained (Node 18+ global `fetch`), so keeping the copies in sync is a
 * byte-for-byte diff.
 */

/** The capability tool definitions (JSON-Schema), spread into each server's TOOLS. */
const CAPABILITY_TOOLS = [
  {
    name: 'recoder_memory_search',
    description: "Search Recoder's durable, reviewed memory for facts learned in prior runs (project conventions, gotchas, decisions). Use this BEFORE asking the user things that may already be known. Returns accepted memory items matching the query.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to recall (keywords or a question)' },
        scope: { type: 'string', description: 'Optional scope filter: repo | user | org | space | path | agent | task-type' },
        limit: { type: 'number', description: 'Max results (default all matches)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'recoder_remember',
    description: "Propose a durable memory for Recoder to remember in future runs (a reusable fact/convention/gotcha). Requires evidence (a taskId + artifactId). The proposal is REVIEWED before it becomes durable — it is not written blindly. Use when you learn something worth persisting across sessions.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title of the fact' },
        body: { type: 'string', description: 'The fact/convention/gotcha to remember' },
        scope: { type: 'string', description: 'repo | user | org | space | path | agent | task-type (default repo)' },
        taskId: { type: 'string', description: 'Evidence: the task this was learned in' },
        artifactId: { type: 'string', description: 'Evidence: an artifact backing the fact' },
      },
      required: ['title', 'body', 'taskId', 'artifactId'],
    },
  },
  {
    name: 'recoder_issues_ready',
    description: "List the READY issues from Recoder's issue graph (beads/bd) — the unblocked work you can pick up. Use this to decide what to work on next.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'recoder_issue_create',
    description: 'Log a new issue in the Recoder issue graph (beads/bd) — e.g. discovered follow-up work. Returns the new issue id.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Issue title' },
        description: { type: 'string', description: 'Optional details' },
      },
      required: ['title'],
    },
  },
  {
    name: 'recoder_issue_claim',
    description: 'Atomically CLAIM an issue in the Recoder issue graph (beads/bd) before working on it — sets you as assignee + in_progress. Idempotent if already yours. Always claim before starting work.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Issue id (e.g. recoder-abcd)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'recoder_issue_note',
    description: 'Append a progress/evidence note to an issue in the Recoder issue graph (beads/bd) — your running memory on the work item. Use for findings, decisions, and gotchas as you go.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Issue id (e.g. recoder-abcd)' },
        text: { type: 'string', description: 'The note to append' },
      },
      required: ['id', 'text'],
    },
  },
  {
    name: 'recoder_issue_close',
    description: 'Close an issue in the Recoder issue graph (beads/bd) when its work is done.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Issue id (e.g. recoder-abcd)' },
        reason: { type: 'string', description: 'Why it is closed (e.g. "Completed")' },
      },
      required: ['id'],
    },
  },
  {
    name: 'recoder_github_pr_review',
    description: "Run Recoder's multi-persona swarm review over a GitHub pull request. Returns a compiled review bundle (a coordinator brief + 7 specialist reviewer lanes — correctness, security, tests, perf, etc. — parameterized for the target PR) that YOU then carry out as the review, OR a completed verdict when a review executor is configured. Truthful 'not configured' when GitHub auth (gh/GITHUB_TOKEN) is absent; never fabricates a review.",
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string', description: 'Full PR URL (https://github.com/owner/repo/pull/N)' },
        repo: { type: 'string', description: 'owner/repo (needed if prUrl is not given)' },
        prNumber: { type: 'number', description: 'PR number (with repo)' },
        mode: { type: 'string', description: "'swarm' (7 lanes, default) or 'solo' (single reviewer)" },
      },
    },
  },
  {
    name: 'recoder_repo_search',
    description: "Search code — the local project (git grep, gitignore-aware) OR any GitHub repository. Pass `github` (owner/name) to search a remote repo, or `githubOwner` to search across an owner's repos; otherwise it searches the current project. Returns file:line (local) or repo/path + fragments (GitHub).",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Pattern / code to search for' },
        repo: { type: 'string', description: 'Optional absolute LOCAL repo path (defaults to the current project)' },
        github: { type: 'string', description: 'Optional GitHub repo to search, as "owner/name" (uses gh code search)' },
        githubOwner: { type: 'string', description: "Optional GitHub owner/org to search across their repos" },
        language: { type: 'string', description: 'Optional language filter for GitHub search (e.g. typescript)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'recoder_repo_diff',
    description: "See the repository's working-tree diff (stat + patch). Optionally against a base ref, or in another absolute repo path.",
    inputSchema: {
      type: 'object',
      properties: {
        base: { type: 'string', description: 'Optional base ref to diff against' },
        repo: { type: 'string', description: 'Optional absolute repo path' },
      },
    },
  },
  {
    name: 'recoder_browser_open',
    description: 'Open a URL in a real browser (headless) so you can VERIFY your own work — e.g. a preview or deployed page. Reuses one page per turn.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The URL to open' } },
      required: ['url'],
    },
  },
  {
    name: 'recoder_browser_verify',
    description: "Assert that text is present on the currently-open page (open one first with recoder_browser_open). Returns whether the expected content rendered — use it to CHECK your UI changes actually work.",
    inputSchema: {
      type: 'object',
      properties: {
        contains: { type: 'string', description: 'The text you expect to see on the page' },
        selector: { type: 'string', description: 'Optional CSS selector to scope the check (default body)' },
      },
      required: ['contains'],
    },
  },
  {
    name: 'recoder_browser_snapshot',
    description: "Snapshot the currently-open page (open one first with recoder_browser_open): extracts the visible text (optionally scoped to a CSS selector) plus the current URL. Use it to READ what actually rendered before/after your changes.",
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector to scope the snapshot (default body)' },
      },
    },
  },
  {
    name: 'recoder_browser_navigate',
    description: "Navigate a headless browser to a URL and get back its status, final URL, and page title. Backed by the browser-use engine (puppeteer, or a browser-use service). Returns a truthful 'not configured' message when no browser driver is wired.",
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The URL to navigate to' } },
      required: ['url'],
    },
  },
  {
    name: 'recoder_browser_extract',
    description: "Extract the visible text of a web page via the browser-use engine — pass a `url` to fetch it (or omit to read the current page). Use it to READ what a page actually renders. Returns a truthful 'not configured' message when no browser driver is wired.",
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Optional URL to load before extracting (defaults to the current page)' } },
    },
  },
  {
    name: 'recoder_request_approval',
    description: 'Request human approval before a sensitive action (e.g. pushing, deleting, a risky command). Records a pending approval in the control plane that a reviewer resolves. Use this instead of proceeding on your own for high-risk steps.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task this approval is for' },
        reason: { type: 'string', description: 'What you want to do and why it needs approval' },
        requiredAt: { type: 'string', description: 'before_push | before_pr | before_write | before_sensitive_action (default)' },
      },
      required: ['taskId', 'reason'],
    },
  },
  {
    name: 'recoder_attach_artifact',
    description: "Attach an output artifact (a report, summary, log, or result) to the task's audit trail so it is reviewable in the cockpit and provenance-tracked. Use this to record what you produced.",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task to attach the artifact to' },
        content: { type: 'string', description: 'The artifact content (text)' },
        kind: { type: 'string', description: 'report | log | diff | summary | … (default report)' },
        mimeType: { type: 'string', description: 'Default text/plain' },
      },
      required: ['taskId', 'content'],
    },
  },
  {
    name: 'recoder_github_search_repos',
    description: 'Find GitHub repositories by query (name, topic, description). Returns fullName, description, url, stars. Complements recoder_repo_search (which searches CODE).',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Repo search query' } },
      required: ['query'],
    },
  },
  {
    name: 'recoder_github_pr_create',
    description: 'Open a GitHub pull request via gh (from the current repo/branch by default). APPROVAL-GATED — a PR is a customer-visible action; policy may require approval. Returns the PR url.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description' },
        repo: { type: 'string', description: 'owner/name (default: current repo)' },
        head: { type: 'string', description: 'Head branch (default: current)' },
        base: { type: 'string', description: 'Base branch' },
        draft: { type: 'boolean', description: 'Open as draft' },
      },
      required: ['title'],
    },
  },
  {
    name: 'recoder_preview_url',
    description: "Get the live preview URL for your workspace (the deployed/served page produced by your task), if one exists. The URL is owned by Recoder — it returns null truthfully when your task produced code, not a live page. Pass workspaceId, or it resolves from your current task.",
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string', description: 'Optional workspace id (defaults to your task’s workspace)' } },
    },
  },
  {
    name: 'recoder_preview_health',
    description: "Health-check your workspace's live preview — probes the preview URL and reports whether it responded healthy (2xx/3xx). Use this to CONFIRM your change actually serves before claiming done.",
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace id' },
        url: { type: 'string', description: 'Optional explicit URL to probe (defaults to the workspace preview URL)' },
      },
    },
  },
  {
    name: 'recoder_preview_check',
    description: 'Run the richer headless-browser check on your preview (render assert + console/page errors + screenshot evidence), attached to the task audit trail. Use it to verify the UI actually renders without errors, not just that a socket answered.',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string', description: 'Optional workspace id' } },
    },
  },
  {
    name: 'recoder_deploy_status',
    description: "Read your workspace's delivery/deploy status — the Recoder-owned workspace state, preview URL, and delivery summary. READ-ONLY (never triggers a deploy). Pass workspaceId, or it resolves from your current task.",
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string', description: 'Optional workspace id (defaults to your task’s workspace)' } },
    },
  },
  {
    name: 'recoder_billing_plan',
    description: "Read the authoritative plan + entitlements for the task/workspace owner (recoder.xyz is the plan authority). READ-ONLY. Pass userId, or it resolves from your current task/workspace owner. Reports a truthful message (not a fake plan) when the subject is unknown.",
    inputSchema: {
      type: 'object',
      properties: { userId: { type: 'string', description: 'Optional owner user id (defaults to the task/workspace owner)' } },
    },
  },
  {
    name: 'recoder_retrieval_search',
    description: "Semantic search over Recoder's retrieval corpus (RAG) — the documents ingested for this project. Embeds your query, does a vector search, and ColBERT-reranks the results into ranked passages. Use this to recall reference material, docs, or prior notes by meaning (not just keywords). Returns a truthful 'not configured' message when no embeddings/vector store is wired.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to find (a question or description — matched by meaning)' },
        topK: { type: 'number', description: 'Max passages to return (default 8)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'recoder_retrieval_ingest',
    description: "Ingest a document into Recoder's retrieval corpus (RAG) so it can be recalled later by recoder_retrieval_search. Chunks the text, embeds each chunk, and stores it in the vector store. Pass `text` (inline) or `path` (a file to read, incl. PDF). Returns a truthful 'not configured' status when no embeddings/vector store is wired — it never fabricates an ingest.",
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Inline document text to ingest (use this OR path)' },
        path: { type: 'string', description: 'Absolute path to a file to read + ingest (text/markdown/PDF)' },
        docId: { type: 'string', description: 'Optional logical document id (grouping key)' },
        source: { type: 'string', description: 'Optional human-readable source label (filename, URL, title)' },
      },
    },
  },
  {
    name: 'recoder_coordination_acquire_lock',
    description: "Claim an advisory work-lock on a shared resource so parallel agents don't collide on it. Returns a conflict (with the current holder) if it's already locked, or a truthful 'not configured' when no lock store is wired. Advisory only — pair with recoder_coordination_detect_conflict before risky writes.",
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'The resource to lock (e.g. a file path, workspace id, or logical key)' },
        holder: { type: 'string', description: 'Optional holder id (defaults to this agent)' },
        ttlMs: { type: 'number', description: 'Optional lock time-to-live in ms (expires automatically)' },
      },
      required: ['resource'],
    },
  },
  {
    name: 'recoder_coordination_detect_conflict',
    description: 'Check whether a shared resource is currently locked by another holder before you write to it. Returns whether there is a conflict and who holds it, or a truthful "not configured" when no lock store is wired.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'The resource to check' },
        holder: { type: 'string', description: 'Optional holder id to check against (defaults to this agent)' },
      },
      required: ['resource'],
    },
  },
  {
    name: 'recoder_workflow_verify',
    description: "Run a named verification workflow (default 'delivery' = verify → browser-check → memory) over a run and get a truthful verdict with per-check results. Returns 'not configured' when no verification runner is wired — it never fabricates a pass.",
    inputSchema: {
      type: 'object',
      properties: {
        workflow: { type: 'string', description: "Named workflow to run (default 'delivery')" },
        runId: { type: 'string', description: 'Optional run id to verify' },
        workspaceId: { type: 'string', description: 'Optional workspace id to verify' },
      },
    },
  },
  {
    name: 'recoder_workflow_capture_hook',
    description: 'Run a capture hook (e.g. a secret-scan) over some text or a file and return its findings as an audit artifact. Returns "not configured" when no hook runner is wired.',
    inputSchema: {
      type: 'object',
      properties: {
        hook: { type: 'string', description: "Hook to run (e.g. 'secret-scan')" },
        text: { type: 'string', description: 'Inline text to scan (use this OR path)' },
        path: { type: 'string', description: 'Absolute path to a file to scan' },
      },
    },
  },
  {
    name: 'recoder_pal_plan',
    description: 'Ask the planner (PAL) to decide runtime / substrate / tool-grants / risk / approval for a task before you act. Deny-biased on uncertainty (least privilege + approval required). Returns the planning decision, or a conservative default when planning inputs are missing.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'What the task is trying to accomplish' },
        scope: { type: 'string', description: 'Optional scope/constraints for the task' },
        runtimeHint: { type: 'string', description: 'Optional preferred runtime (advisory)' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'recoder_notify',
    description: "Send a human-facing notification to the configured Recoder channel (Slack/webhook) — e.g. tell a human a delivery is ready for review or that you need input. Returns a truthful 'not configured' when no webhook is set; it never fabricates a send.",
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The notification body' },
        title: { type: 'string', description: 'Optional short title / prefix' },
        level: { type: 'string', description: 'Optional severity: info | warn | error' },
      },
      required: ['message'],
    },
  },
  {
    name: 'recoder_logs_search',
    description: "Search the Recoder run-event log (the same log the cockpit streams and the audit trail reads) for events whose message matches a query. Use it to inspect what happened in a run — errors, prior agent notes, verification output. Optionally scope to one runId.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to find in event messages' },
        runId: { type: 'string', description: 'Optional run id to scope the search to' },
      },
      required: ['query'],
    },
  },
  {
    name: 'recoder_logs_stream',
    description: "Read the most recent run-event log entries for a run (the tail of the canonical event stream). Use it to see what a run — yours or a sibling agent's — actually did before acting on it.",
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: "The run id to read (e.g. 'run_<taskId>')" },
        limit: { type: 'number', description: 'Max events to return (default 50)' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'recoder_logs_append',
    description: "Append a note to a run's canonical event log — it shows up in the cockpit conversation and the audit trail. Use it to leave a truthful, timestamped record of what you did or found (never to claim unverified success).",
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: "The run id to annotate (e.g. 'run_<taskId>')" },
        message: { type: 'string', description: 'The log note to append' },
        taskId: { type: 'string', description: 'Optional task id the note belongs to' },
      },
      required: ['runId', 'message'],
    },
  },
];

const CAPABILITY_TOOL_NAMES = new Set(CAPABILITY_TOOLS.map((t) => t.name));

/**
 * Build the capability bridge bound to an agent identity + interop-host URL.
 * Returns the tool defs plus `handleCapabilityTool(name, args)`, which returns a
 * result string for a capability tool or `null` if `name` is not one of ours
 * (so the caller can fall through to its own switch).
 */
function createCapabilityTools(options = {}) {
  const agentId = options.agentId || process.env.RECODER_AGENT_ID || 'claude_code';
  const internalUrl =
    options.internalUrl ||
    process.env.RECODER_INTERNAL_URL ||
    options.dockerUrl ||
    process.env.RECODER_DOCKER_URL ||
    'http://localhost:3001';
  const serviceKey = process.env.INTERNAL_SERVICE_KEY || '';
  const paneId = process.env.LOOM_PANE_ID || '';
  const paneToken = process.env.RECODER_PANE_TOKEN || '';
  const hasInteropAuth = () => Boolean(serviceKey);

  async function callInteropTool(serverId, toolName, args) {
    if (!hasInteropAuth()) {
      throw new Error('Recoder capability host not configured (no INTERNAL_SERVICE_KEY in this run).');
    }
    const actor = { agentId, permissions: { toolRules: [] } };
    const res = await fetch(
      `${internalUrl.replace(/\/+$/, '')}/api/mcp/tools/${encodeURIComponent(serverId)}/${encodeURIComponent(toolName)}/call`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-service-key': serviceKey,
          ...(paneId && paneToken
            ? { 'x-recoder-pane-id': paneId, 'x-recoder-pane-token': paneToken }
            : {}),
        },
        body: JSON.stringify({ actor, args }),
      },
    );
    const body = await res.json().catch(() => ({}));
    const data = (body && body.data) || {};
    if (data.status === 'denied') {
      throw new Error(`capability denied by policy: ${data.reason || 'not allowed'}`);
    }
    if (data.status === 'needs_approval') {
      throw new Error(`capability needs approval before it can run: ${data.reason || ''}`.trim());
    }
    if (!res.ok || data.status !== 'completed') {
      throw new Error(data.error || (body && body.error) || `capability call failed (HTTP ${res.status})`);
    }
    return (data.result && data.result.content) ?? data.result ?? data;
  }

  const unavailable = (what) =>
    `Recoder ${what} is not available in this run (no INTERNAL_SERVICE_KEY). It works inside a Recoder workspace.`;
  const errMsg = (err) => (err instanceof Error ? err.message : String(err));
  /** One canonical RunEvent -> a compact, truthful log line. */
  const formatRunEvent = (e) =>
    `• [${e.type || 'event'}] ${e.createdAt || '?'}${e.agentId ? ` (${e.agentId})` : ''} ${(e.message || '').slice(0, 300)}`;

  async function handleCapabilityTool(name, args = {}) {
    if (!CAPABILITY_TOOL_NAMES.has(name)) return null;

    switch (name) {
      case 'recoder_memory_search': {
        if (!hasInteropAuth()) return unavailable('memory');
        try {
          const content = await callInteropTool('recoder.memory', 'memory.search', {
            query: String(args.query || ''),
            scope: args.scope,
            limit: typeof args.limit === 'number' ? args.limit : undefined,
          });
          const items = Array.isArray(content) ? content : [];
          if (!items.length) return `No durable memory found for "${args.query}".`;
          return items
            .map((m) => `• [${m.scope || '?'}] ${m.title || '(untitled)'}\n  ${(m.body || '').slice(0, 400)}`)
            .join('\n');
        } catch (err) {
          return `memory search: ${errMsg(err)}`;
        }
      }

      case 'recoder_remember': {
        if (!hasInteropAuth()) return unavailable('memory');
        try {
          const candidate = await callInteropTool('recoder.memory', 'memory.candidate.create', {
            title: String(args.title || ''),
            body: String(args.body || ''),
            scope: args.scope || 'repo',
            evidence: { taskId: String(args.taskId || ''), artifactId: String(args.artifactId || '') },
          });
          const id = (candidate && (candidate.candidateId || candidate.id)) || '(pending)';
          return `Proposed memory "${args.title}" (candidate ${id}). It will become durable after review — not written blindly.`;
        } catch (err) {
          return `remember: ${errMsg(err)}`;
        }
      }

      case 'recoder_issues_ready': {
        if (!hasInteropAuth()) return unavailable('issue graph');
        try {
          const content = await callInteropTool('recoder.beads', 'beads.ready', {});
          const items = Array.isArray(content) ? content : [];
          if (!items.length) return 'No ready issues.';
          return items.map((i) => `• ${i.id || '?'} [${i.priority ?? '?'}] ${i.title || '(untitled)'}`).join('\n');
        } catch (err) {
          return `issues: ${errMsg(err)}`;
        }
      }

      case 'recoder_issue_create': {
        if (!hasInteropAuth()) return unavailable('issue graph');
        try {
          const content = await callInteropTool('recoder.beads', 'beads.create', {
            title: String(args.title || ''),
            description: args.description,
          });
          const id = (content && (content.id || content.issueId)) || '(created)';
          return `Created issue ${id}: ${args.title}`;
        } catch (err) {
          return `issue create: ${errMsg(err)}`;
        }
      }

      case 'recoder_issue_claim': {
        if (!hasInteropAuth()) return unavailable('issue graph');
        try {
          await callInteropTool('recoder.beads', 'beads.claim', { id: String(args.id || '') });
          return `Claimed issue ${args.id} (assignee=you, in_progress).`;
        } catch (err) {
          return `issue claim: ${errMsg(err)}`;
        }
      }

      case 'recoder_issue_note': {
        if (!hasInteropAuth()) return unavailable('issue graph');
        try {
          await callInteropTool('recoder.beads', 'beads.note', {
            id: String(args.id || ''),
            text: String(args.text || ''),
          });
          return `Noted on ${args.id}.`;
        } catch (err) {
          return `issue note: ${errMsg(err)}`;
        }
      }

      case 'recoder_issue_close': {
        if (!hasInteropAuth()) return unavailable('issue graph');
        try {
          await callInteropTool('recoder.beads', 'beads.close', {
            id: String(args.id || ''),
            reason: args.reason,
          });
          return `Closed issue ${args.id}.`;
        } catch (err) {
          return `issue close: ${errMsg(err)}`;
        }
      }

      case 'recoder_github_pr_review': {
        if (!hasInteropAuth()) return unavailable('github pr review');
        try {
          const content = await callInteropTool('recoder.github', 'github.pr_review', {
            prUrl: args.prUrl,
            repo: args.repo,
            prNumber: args.prNumber,
            mode: args.mode,
          });
          if (!content || typeof content !== 'object') return 'pr review: no result.';
          if (content.status === 'invalid_input') return `pr review: ${content.reason}`;
          if (content.status === 'not_configured') return `pr review not configured: ${content.reason}`;
          if (content.status === 'unavailable') {
            const instr = content.bundle && content.bundle.instructions;
            return instr
              ? `Review executor not wired — here is the compiled swarm-review to carry out yourself:\n\n${instr}`
              : `pr review unavailable: ${content.reason}`;
          }
          if (content.status === 'completed') {
            const c = content.classifications || {};
            return `Review complete (${content.bundle && content.bundle.mode}). Verdict: ${c.verdict || '?'}${c.mergeState ? ` · merge: ${c.mergeState}` : ''}\n\n${content.raw || ''}`;
          }
          return JSON.stringify(content);
        } catch (err) {
          return `github pr review: ${errMsg(err)}`;
        }
      }

      case 'recoder_repo_search': {
        if (!hasInteropAuth()) return unavailable('repo search');
        try {
          const content = await callInteropTool('recoder.repo', 'repo.search', {
            query: String(args.query || ''),
            repo: args.repo,
            github: args.github,
            githubOwner: args.githubOwner,
            language: args.language,
          });
          const matches = (content && content.matches) || [];
          if (!matches.length) return `No matches for "${args.query}".`;
          if (content && content.source === 'github') {
            return matches
              .map((m) => `• ${m.repo}/${m.path}${m.fragments && m.fragments.length ? `\n  ${m.fragments.join('\n  ')}` : ''}`)
              .join('\n');
          }
          return matches.join('\n');
        } catch (err) {
          return `repo search: ${errMsg(err)}`;
        }
      }

      case 'recoder_repo_diff': {
        if (!hasInteropAuth()) return unavailable('repo diff');
        try {
          const content = await callInteropTool('recoder.repo', 'repo.diff', {
            base: args.base,
            repo: args.repo,
          });
          const stat = (content && content.stat) || '(no changes)';
          const patch = (content && content.patch) || '';
          return `${stat}\n\n${patch}`.trim();
        } catch (err) {
          return `repo diff: ${errMsg(err)}`;
        }
      }

      case 'recoder_request_approval': {
        if (!hasInteropAuth()) return unavailable('approvals');
        try {
          const content = await callInteropTool('recoder.approvals', 'approvals.request', {
            taskId: String(args.taskId || ''),
            reason: String(args.reason || ''),
            requiredAt: args.requiredAt,
          });
          const id = (content && content.approvalId) || '(pending)';
          return `Requested approval ${id} (status: ${(content && content.status) || 'pending'}). A reviewer must resolve it before the action proceeds.`;
        } catch (err) {
          return `request approval: ${errMsg(err)}`;
        }
      }

      case 'recoder_attach_artifact': {
        if (!hasInteropAuth()) return unavailable('artifacts');
        try {
          const content = await callInteropTool('recoder.artifacts', 'artifacts.create', {
            taskId: String(args.taskId || ''),
            content: String(args.content || ''),
            kind: args.kind,
            mimeType: args.mimeType,
          });
          const id = (content && content.artifactId) || '(created)';
          return `Attached artifact ${id} to task ${args.taskId}.`;
        } catch (err) {
          return `attach artifact: ${errMsg(err)}`;
        }
      }

      case 'recoder_github_search_repos': {
        if (!hasInteropAuth()) return unavailable('GitHub');
        try {
          const content = await callInteropTool('recoder.github', 'github.search', {
            query: String(args.query || ''),
          });
          const repos = Array.isArray(content) ? content : [];
          if (!repos.length) return `No repositories found for "${args.query}".`;
          return repos
            .map((r) => `• ${r.fullName} ★${r.stargazersCount ?? '?'} — ${(r.description || '').slice(0, 100)}\n  ${r.url || ''}`)
            .join('\n');
        } catch (err) {
          return `github search: ${errMsg(err)}`;
        }
      }

      case 'recoder_github_pr_create': {
        if (!hasInteropAuth()) return unavailable('GitHub');
        try {
          const content = await callInteropTool('recoder.github', 'github.pr.create', {
            title: String(args.title || ''),
            body: args.body,
            repo: args.repo,
            head: args.head,
            base: args.base,
            draft: args.draft === true,
          });
          return `Opened PR: ${(content && content.url) || '(created)'}`;
        } catch (err) {
          return `github pr create: ${errMsg(err)}`;
        }
      }

      case 'recoder_browser_open': {
        if (!hasInteropAuth()) return unavailable('browser');
        try {
          const content = await callInteropTool('recoder.browser', 'browser.open', {
            url: String(args.url || ''),
          });
          return `Opened ${(content && content.url) || args.url}. Use recoder_browser_verify to check the page content.`;
        } catch (err) {
          return `browser open: ${errMsg(err)}`;
        }
      }

      case 'recoder_browser_verify': {
        if (!hasInteropAuth()) return unavailable('browser');
        try {
          const content = await callInteropTool('recoder.browser', 'browser.verify', {
            contains: String(args.contains || ''),
            selector: args.selector,
          });
          return content && content.present
            ? `✓ Present: the page contains "${args.contains}".`
            : `✗ Not found: the page does NOT contain "${args.contains}".`;
        } catch (err) {
          return `browser verify: ${errMsg(err)}`;
        }
      }

      case 'recoder_browser_snapshot': {
        if (!hasInteropAuth()) return unavailable('browser');
        try {
          const content = await callInteropTool('recoder.browser', 'browser.snapshot', {
            selector: args.selector,
          });
          if (!content) return 'browser snapshot: no content returned.';
          const header = `Snapshot of ${content.currentUrl || '(unknown url)'} [${content.selector || 'body'}]${content.truncated ? ' (truncated)' : ''}:`;
          return `${header}\n${content.text || '(empty)'}`;
        } catch (err) {
          return `browser snapshot: ${errMsg(err)}`;
        }
      }

      case 'recoder_browser_navigate': {
        if (!hasInteropAuth()) return unavailable('browser');
        try {
          const content = await callInteropTool('recoder.browser-use', 'browser.navigate', {
            url: String(args.url || ''),
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Browser is not configured (no puppeteer / BROWSER_USE_URL).';
          }
          if (content && content.status === 'error') {
            return `browser navigate: ${content.reason || 'navigation failed'}`;
          }
          const title = content && content.title ? ` — "${content.title}"` : '';
          return `Navigated to ${(content && content.url) || args.url}${title}.`;
        } catch (err) {
          return `browser navigate: ${errMsg(err)}`;
        }
      }

      case 'recoder_browser_extract': {
        if (!hasInteropAuth()) return unavailable('browser');
        try {
          const content = await callInteropTool('recoder.browser-use', 'browser.extract', {
            url: args.url ? String(args.url) : undefined,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Browser is not configured (no puppeteer / BROWSER_USE_URL).';
          }
          if (content && content.status === 'error') {
            return `browser extract: ${content.reason || 'extraction failed'}`;
          }
          const text = (content && content.text) || '';
          return text ? text.slice(0, 20000) : 'The page had no extractable text.';
        } catch (err) {
          return `browser extract: ${errMsg(err)}`;
        }
      }

      case 'recoder_preview_url': {
        if (!hasInteropAuth()) return unavailable('preview');
        try {
          const content = await callInteropTool('recoder.preview', 'preview.issue_url', {
            workspaceId: args.workspaceId,
          });
          if (!content || content.url == null) {
            return (content && content.message) || 'This workspace has no preview URL (it produced code, not a live page).';
          }
          return `Preview URL: ${content.url}`;
        } catch (err) {
          return `preview url: ${errMsg(err)}`;
        }
      }

      case 'recoder_preview_health': {
        if (!hasInteropAuth()) return unavailable('preview');
        try {
          const content = await callInteropTool('recoder.preview', 'preview.health', {
            workspaceId: args.workspaceId,
            url: args.url,
          });
          return content && content.healthy
            ? `✓ Preview healthy (HTTP ${content.status}): ${content.url}`
            : `✗ Preview unhealthy: ${(content && content.message) || 'no response'}`;
        } catch (err) {
          return `preview health: ${errMsg(err)}`;
        }
      }

      case 'recoder_preview_check': {
        if (!hasInteropAuth()) return unavailable('preview');
        try {
          const content = await callInteropTool('recoder.preview', 'preview.browser_check', {
            workspaceId: args.workspaceId,
          });
          const outcome = (content && content.outcome) || content;
          return `Preview browser-check: ${JSON.stringify(outcome).slice(0, 800)}`;
        } catch (err) {
          return `preview check: ${errMsg(err)}`;
        }
      }

      case 'recoder_deploy_status': {
        if (!hasInteropAuth()) return unavailable('deploy');
        try {
          const content = await callInteropTool('recoder.deploy', 'deploy.status', {
            workspaceId: args.workspaceId,
          });
          if (!content) return 'No deploy status available.';
          const parts = [`Workspace ${content.workspaceId || '?'}: state=${content.state ?? 'unknown'}`];
          if (content.previewUrl) parts.push(`preview=${content.previewUrl}`);
          parts.push(`deployBackend=${content.deployBackendConfigured ? 'configured' : 'none'}`);
          if (content.message) parts.push(content.message);
          return parts.join('\n');
        } catch (err) {
          return `deploy status: ${errMsg(err)}`;
        }
      }

      case 'recoder_billing_plan': {
        if (!hasInteropAuth()) return unavailable('billing');
        try {
          const content = await callInteropTool('recoder.billing', 'billing.plan.read', {
            userId: args.userId,
          });
          if (!content) return 'No plan available.';
          const grants = Array.isArray(content.entitlements) ? content.entitlements : [];
          const grantLine = grants.length
            ? `\nEntitlements: ${grants.map((g) => `${g.kind}:${g.key}${g.granted ? '' : '(revoked)'}`).join(', ')}`
            : '';
          const planLine = content.plan == null
            ? (content.message || 'Plan could not be resolved for this user.')
            : `Plan: ${content.plan}`;
          return `${planLine}${grantLine}`;
        } catch (err) {
          return `billing plan: ${errMsg(err)}`;
        }
      }

      case 'recoder_retrieval_search': {
        if (!hasInteropAuth()) return unavailable('retrieval');
        try {
          const content = await callInteropTool('recoder.retrieval', 'retrieval.search', {
            query: String(args.query || ''),
            topK: typeof args.topK === 'number' ? args.topK : undefined,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Retrieval is not configured (no embeddings/vector store).';
          }
          const passages = (content && content.passages) || [];
          if (!passages.length) return `No passages found for "${args.query}".`;
          return passages
            .map((p) => `• ${p.source || p.docId || p.id}${typeof p.score === 'number' ? ` (${p.score.toFixed(3)})` : ''}\n  ${(p.text || '').slice(0, 400)}`)
            .join('\n');
        } catch (err) {
          return `retrieval search: ${errMsg(err)}`;
        }
      }

      case 'recoder_retrieval_ingest': {
        if (!hasInteropAuth()) return unavailable('retrieval');
        try {
          const content = await callInteropTool('recoder.retrieval', 'retrieval.ingest', {
            text: args.text,
            path: args.path,
            docId: args.docId,
            source: args.source,
          });
          if (!content) return 'Ingest returned no result.';
          if (content.status === 'not_configured') {
            return content.reason || 'Retrieval is not configured (no embeddings/vector store).';
          }
          if (content.status === 'empty') {
            return 'Nothing to ingest — the document produced no chunks.';
          }
          return `Ingested ${content.upserted ?? 0}/${content.chunks ?? 0} chunks of "${content.docId || args.docId || 'document'}" into ${content.collection || 'the retrieval corpus'}.`;
        } catch (err) {
          return `retrieval ingest: ${errMsg(err)}`;
        }
      }

      case 'recoder_coordination_acquire_lock': {
        if (!hasInteropAuth()) return unavailable('coordination');
        try {
          const content = await callInteropTool('recoder.coordination', 'coordination.acquire_lock', {
            resource: String(args.resource || ''),
            holder: args.holder ? String(args.holder) : undefined,
            ttlMs: args.ttlMs,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Coordination is not configured (no lock store).';
          }
          if (content && content.status === 'conflict') {
            return `Lock on "${args.resource}" is held by ${(content.lock && content.lock.holder) || 'another agent'}.`;
          }
          const lockId = content && content.lock && content.lock.lockId;
          return `Acquired lock on "${args.resource}"${lockId ? ` (id ${lockId})` : ''}.`;
        } catch (err) {
          return `coordination acquire_lock: ${errMsg(err)}`;
        }
      }

      case 'recoder_coordination_detect_conflict': {
        if (!hasInteropAuth()) return unavailable('coordination');
        try {
          const content = await callInteropTool('recoder.coordination', 'coordination.detect_conflict', {
            resource: String(args.resource || ''),
            holder: args.holder ? String(args.holder) : undefined,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Coordination is not configured (no lock store).';
          }
          return content && content.conflict
            ? `Conflict: "${args.resource}" is held by ${content.holder || 'another agent'}.`
            : `No conflict — "${args.resource}" is free to claim.`;
        } catch (err) {
          return `coordination detect_conflict: ${errMsg(err)}`;
        }
      }

      case 'recoder_workflow_verify': {
        if (!hasInteropAuth()) return unavailable('workflow');
        try {
          const content = await callInteropTool('recoder.workflow', 'workflow.verify', {
            workflow: args.workflow ? String(args.workflow) : undefined,
            runId: args.runId,
            workspaceId: args.workspaceId,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Workflow verification is not configured (no runner).';
          }
          const checks = (content && content.checks) || [];
          const verdict = content && content.passed ? '✓ passed' : '✗ failed';
          return `Verification ${verdict} (${checks.length} checks): ${JSON.stringify(checks).slice(0, 800)}`;
        } catch (err) {
          return `workflow verify: ${errMsg(err)}`;
        }
      }

      case 'recoder_workflow_capture_hook': {
        if (!hasInteropAuth()) return unavailable('workflow');
        try {
          const content = await callInteropTool('recoder.workflow', 'workflow.capture_hook', {
            hook: args.hook ? String(args.hook) : undefined,
            text: args.text,
            path: args.path,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Hook capture is not configured (no runner).';
          }
          const findings = (content && content.findings) || [];
          return findings.length
            ? `Hook captured ${findings.length} finding(s): ${JSON.stringify(findings).slice(0, 800)}`
            : 'Hook captured — no findings.';
        } catch (err) {
          return `workflow capture_hook: ${errMsg(err)}`;
        }
      }

      case 'recoder_pal_plan': {
        if (!hasInteropAuth()) return unavailable('pal');
        try {
          const content = await callInteropTool('recoder.pal-plan', 'pal.plan', {
            goal: args.goal,
            scope: args.scope,
            runtimeHint: args.runtimeHint,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Planning is not configured.';
          }
          const d = (content && content.decision) || content;
          return `Plan: runtime=${d.runtimeId || '?'} substrate=${d.substrate || '?'} risk=${d.risk || '?'} approval=${d.approvalRequired ? 'REQUIRED' : 'not required'} grants=${JSON.stringify(d.toolGrants || []).slice(0, 400)}`;
        } catch (err) {
          return `pal plan: ${errMsg(err)}`;
        }
      }

      case 'recoder_notify': {
        if (!hasInteropAuth()) return unavailable('notify');
        try {
          const content = await callInteropTool('recoder.notify', 'notify.send', {
            message: String(args.message || ''),
            title: args.title ? String(args.title) : undefined,
            level: args.level ? String(args.level) : undefined,
          });
          if (content && content.status === 'not_configured') {
            return content.reason || 'Notify is not configured (no RECODER_NOTIFY_URL / SLACK_WEBHOOK_URL).';
          }
          if (content && content.status === 'error') {
            return `notify: ${content.reason || 'send failed'}`;
          }
          return `Notification sent${content && content.target ? ` to ${content.target}` : ''}.`;
        } catch (err) {
          return `notify: ${errMsg(err)}`;
        }
      }

      case 'recoder_logs_search': {
        if (!hasInteropAuth()) return unavailable('run logs');
        try {
          const content = await callInteropTool('recoder.logs', 'logs.search', {
            query: String(args.query || ''),
            runId: args.runId ? String(args.runId) : undefined,
          });
          const events = Array.isArray(content) ? content : [];
          if (!events.length) return `No log events matched "${args.query}".`;
          return events.map(formatRunEvent).join('\n');
        } catch (err) {
          return `logs search: ${errMsg(err)}`;
        }
      }

      case 'recoder_logs_stream': {
        if (!hasInteropAuth()) return unavailable('run logs');
        try {
          const content = await callInteropTool('recoder.logs', 'logs.stream', {
            runId: String(args.runId || ''),
            limit: typeof args.limit === 'number' ? args.limit : undefined,
          });
          const events = Array.isArray(content) ? content : [];
          if (!events.length) return `No log events yet for run ${args.runId}.`;
          return events.map(formatRunEvent).join('\n');
        } catch (err) {
          return `logs stream: ${errMsg(err)}`;
        }
      }

      case 'recoder_logs_append': {
        if (!hasInteropAuth()) return unavailable('run logs');
        try {
          const content = await callInteropTool('recoder.logs', 'logs.append', {
            runId: String(args.runId || ''),
            message: String(args.message || ''),
            taskId: args.taskId ? String(args.taskId) : undefined,
          });
          const id = (content && content.eventId) || '(appended)';
          return `Appended log event ${id} to run ${args.runId}.`;
        } catch (err) {
          return `logs append: ${errMsg(err)}`;
        }
      }

      default:
        return null;
    }
  }

  return { tools: CAPABILITY_TOOLS, hasInteropAuth, callInteropTool, handleCapabilityTool };
}

module.exports = { CAPABILITY_TOOLS, CAPABILITY_TOOL_NAMES, createCapabilityTools };
