/**
 * Workflow & utility CLI commands for Recoder Code
 *
 * Slash commands:
 *   /workflow list                - List workflows for current project
 *   /workflow run <id>            - Execute a workflow
 *   /workflow status <exec-id>    - Check execution status
 *   /analytics                    - Show agent analytics summary
 *   /cost                         - Show cost summary
 *   /whoami                       - Show current user info
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

const BACKEND_URL = process.env['RECODER_BACKEND_URL'] || process.env['DOCKER_BACKEND_URL'] || 'https://api.recoder.xyz';
const authService = new RecoderAuthService();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authenticatedGet(path: string): Promise<Response> {
  const token = await authService.getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Run /recoder-login first.');
  }
  return fetch(`${BACKEND_URL}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function authenticatedPost(path: string, body?: unknown): Promise<Response> {
  const token = await authService.getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Run /recoder-login first.');
  }
  return fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

// ---------------------------------------------------------------------------
// /workflow
// ---------------------------------------------------------------------------

export const workflowCommand: SlashCommand = {
  name: 'workflow',
  description: 'Manage and run workflows',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    // /workflow list
    {
      name: 'list',
      description: 'List workflows for an agent (e.g., /workflow list <agent-id>)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const agentId = args?.trim();
        if (!agentId) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Usage: /workflow list <agent-id>',
          };
        }

        try {
          const res = await authenticatedGet(`/api/workflows/agent/${encodeURIComponent(agentId)}`);
          if (!res.ok) {
            return { type: 'message', messageType: 'error', content: `Failed (${res.status}): ${await res.text()}` };
          }

          const workflows = await res.json();
          const list = Array.isArray(workflows) ? workflows : workflows.data || [];

          if (list.length === 0) {
            return { type: 'message', messageType: 'info', content: 'No workflows found for this agent.' };
          }

          const lines: string[] = [
            '┌──────────────────────────────────────────────────┐',
            '│  Workflows                                        │',
            '├──────────────────────────────────────────────────┤',
          ];

          for (const wf of list) {
            lines.push(`│  ${(wf.name || 'Untitled').padEnd(47)}│`);
            lines.push(`│    ID: ${String(wf.id).padEnd(41)}│`);
            lines.push(`│    Status: ${String(wf.status || 'draft').padEnd(37)}│`);
            lines.push('│                                                  │');
          }

          lines.push(`├──────────────────────────────────────────────────┤`);
          lines.push(`│  Total: ${String(list.length).padEnd(40)}│`);
          lines.push('│  Run with: /workflow run <id>                    │');
          lines.push('└──────────────────────────────────────────────────┘');

          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (err) {
          return { type: 'message', messageType: 'error', content: `Error listing workflows: ${errorMessage(err)}` };
        }
      },
    },

    // /workflow run <id>
    {
      name: 'run',
      description: 'Execute a workflow (e.g., /workflow run <workflow-id>)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const workflowId = args?.trim();
        if (!workflowId) {
          return { type: 'message', messageType: 'info', content: 'Usage: /workflow run <workflow-id>' };
        }

        try {
          const res = await authenticatedPost(`/api/workflows/${encodeURIComponent(workflowId)}/execute`);
          if (!res.ok) {
            return { type: 'message', messageType: 'error', content: `Failed (${res.status}): ${await res.text()}` };
          }

          const execution = await res.json();

          return {
            type: 'message',
            messageType: 'info',
            content: [
              '┌──────────────────────────────────────────────────┐',
              '│  Workflow Execution Started                       │',
              '├──────────────────────────────────────────────────┤',
              `│  Execution ID: ${String(execution.id || 'unknown').padEnd(33)}│`,
              `│  Status:       ${String(execution.status || 'pending').padEnd(33)}│`,
              '│                                                  │',
              '│  Check progress: /workflow status <exec-id>      │',
              '└──────────────────────────────────────────────────┘',
            ].join('\n'),
          };
        } catch (err) {
          return { type: 'message', messageType: 'error', content: `Error executing workflow: ${errorMessage(err)}` };
        }
      },
    },

    // /workflow status <execution-id>
    {
      name: 'status',
      description: 'Check execution status (e.g., /workflow status <execution-id>)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const executionId = args?.trim();
        if (!executionId) {
          return { type: 'message', messageType: 'info', content: 'Usage: /workflow status <execution-id>' };
        }

        try {
          const res = await authenticatedGet(`/api/workflows/executions/${encodeURIComponent(executionId)}`);
          if (!res.ok) {
            return { type: 'message', messageType: 'error', content: `Failed (${res.status}): ${await res.text()}` };
          }

          const exec = await res.json();
          const duration = exec.duration_seconds != null ? `${exec.duration_seconds}s` : 'n/a';
          const cost = exec.total_cost != null ? `$${Number(exec.total_cost).toFixed(4)}` : 'n/a';

          return {
            type: 'message',
            messageType: 'info',
            content: [
              '┌──────────────────────────────────────────────────┐',
              '│  Execution Status                                 │',
              '├──────────────────────────────────────────────────┤',
              `│  ID:       ${String(exec.id).padEnd(37)}│`,
              `│  Status:   ${String(exec.status).padEnd(37)}│`,
              `│  Duration: ${duration.padEnd(37)}│`,
              `│  Cost:     ${cost.padEnd(37)}│`,
              `│  Started:  ${String(exec.started_at || 'n/a').substring(0, 37).padEnd(37)}│`,
              '└──────────────────────────────────────────────────┘',
            ].join('\n'),
          };
        } catch (err) {
          return { type: 'message', messageType: 'error', content: `Error fetching status: ${errorMessage(err)}` };
        }
      },
    },
  ],

  // Default: show help
  action: async (): Promise<MessageActionReturn> => ({
    type: 'message',
    messageType: 'info',
    content: [
      'Workflow Commands',
      '',
      '  /workflow list <agent-id>         List workflows for an agent',
      '  /workflow run <workflow-id>        Execute a workflow',
      '  /workflow status <execution-id>   Check execution status',
    ].join('\n'),
  }),
};

// ---------------------------------------------------------------------------
// /analytics
// ---------------------------------------------------------------------------

export const analyticsCommand: SlashCommand = {
  name: 'analytics',
  description: 'Show agent analytics summary',
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<MessageActionReturn> => {
    try {
      const res = await authenticatedGet('/api/analytics/summary');
      if (!res.ok) {
        return { type: 'message', messageType: 'error', content: `Failed (${res.status}): ${await res.text()}` };
      }

      const data = await res.json();
      const summary = data.data || data;

      const lines: string[] = [
        '┌──────────────────────────────────────────────────┐',
        '│  Agent Analytics Summary                          │',
        '├──────────────────────────────────────────────────┤',
        `│  Total runs:       ${String(summary.total_runs ?? 'n/a').padEnd(29)}│`,
        `│  Successful:       ${String(summary.successful_runs ?? 'n/a').padEnd(29)}│`,
        `│  Failed:           ${String(summary.failed_runs ?? 'n/a').padEnd(29)}│`,
        `│  Avg duration:     ${String(summary.avg_duration ? `${summary.avg_duration}s` : 'n/a').padEnd(29)}│`,
        `│  Total cost:       ${String(summary.total_cost ? `$${Number(summary.total_cost).toFixed(4)}` : 'n/a').padEnd(29)}│`,
        `│  Active agents:    ${String(summary.active_agents ?? 'n/a').padEnd(29)}│`,
        '└──────────────────────────────────────────────────┘',
      ];

      return { type: 'message', messageType: 'info', content: lines.join('\n') };
    } catch (err) {
      return { type: 'message', messageType: 'error', content: `Error fetching analytics: ${errorMessage(err)}` };
    }
  },
};

// ---------------------------------------------------------------------------
// /cost
// ---------------------------------------------------------------------------

export const costCommand: SlashCommand = {
  name: 'cost',
  description: 'Show cost summary for the current billing period',
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<MessageActionReturn> => {
    try {
      const res = await authenticatedGet('/api/billing/usage');
      if (!res.ok) {
        return { type: 'message', messageType: 'error', content: `Failed (${res.status}): ${await res.text()}` };
      }

      const data = await res.json();
      const usage = data.data || data;

      const lines: string[] = [
        '┌──────────────────────────────────────────────────┐',
        '│  Cost Summary                                     │',
        '├──────────────────────────────────────────────────┤',
        `│  Period:           ${String(usage.period || 'current').padEnd(29)}│`,
        `│  Total spent:      ${String(usage.total_cost ? `$${Number(usage.total_cost).toFixed(4)}` : '$0.00').padEnd(29)}│`,
        `│  Budget limit:     ${String(usage.budget_limit ? `$${Number(usage.budget_limit).toFixed(2)}` : 'none').padEnd(29)}│`,
        `│  Budget remaining: ${String(usage.budget_remaining ? `$${Number(usage.budget_remaining).toFixed(2)}` : 'n/a').padEnd(29)}│`,
        `│  API calls:        ${String(usage.api_call_count ?? 'n/a').padEnd(29)}│`,
        `│  Tokens used:      ${String(usage.total_tokens ?? 'n/a').padEnd(29)}│`,
        '└──────────────────────────────────────────────────┘',
      ];

      return { type: 'message', messageType: 'info', content: lines.join('\n') };
    } catch (err) {
      return { type: 'message', messageType: 'error', content: `Error fetching cost data: ${errorMessage(err)}` };
    }
  },
};

// ---------------------------------------------------------------------------
// /whoami
// ---------------------------------------------------------------------------

export const whoamiCommand: SlashCommand = {
  name: 'whoami',
  description: 'Show current authenticated user info',
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<MessageActionReturn> => {
    try {
      const res = await authenticatedGet('/api/user/profile');
      if (!res.ok) {
        return { type: 'message', messageType: 'error', content: `Failed (${res.status}): ${await res.text()}` };
      }

      const data = await res.json();
      const user = data.data || data;

      const lines: string[] = [
        '┌──────────────────────────────────────────────────┐',
        '│  Current User                                     │',
        '├──────────────────────────────────────────────────┤',
        `│  Name:   ${String(user.name || user.display_name || 'n/a').padEnd(39)}│`,
        `│  Email:  ${String(user.email || 'n/a').padEnd(39)}│`,
        `│  Plan:   ${String(user.plan || user.tier || 'free').padEnd(39)}│`,
        `│  ID:     ${String(user.id || 'n/a').substring(0, 39).padEnd(39)}│`,
        '└──────────────────────────────────────────────────┘',
      ];

      return { type: 'message', messageType: 'info', content: lines.join('\n') };
    } catch (err) {
      return { type: 'message', messageType: 'error', content: `Error fetching user info: ${errorMessage(err)}` };
    }
  },
};
