/**
 * /workspace slash command - Manage Recoder Space connections
 *
 * Subcommands:
 *   /workspace list    - List available workspaces
 *   /workspace join <id> - Connect to a workspace via AgentBridgeService
 *   /workspace run start <task-id> - Start backend task execution
 *   /workspace run logs <task-id> - Show run status and logs
 *   /workspace approvals - List pending approvals in the current Recoder Space
 *   /workspace approve <approval-id> - Grant a pending approval
 *   /workspace reject <approval-id> - Reject a pending approval
 *   /workspace artifact <task-id> <file-path> - Attach a local artifact to a task
 *   /workspace artifacts <task-id> - List task artifacts
 *   /workspace create <prompt> - Create a task in the current Recoder Space
 *   /workspace timeline <task-id> - Show the canonical task timeline
 *   /workspace leave   - Disconnect from current workspace
 *   /workspace status  - Show connection status and online agents
 *   /workspace context - Show the Recoder Space context package
 */

import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';
import { AgentBridgeService } from '../../services/AgentBridgeService.js';
import { installRecoderSpaceAutoWorker } from '../../services/RecoderSpaceAutoWorker.js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import mime from 'mime-types';

const DOCKER_BACKEND_URL = process.env['DOCKER_BACKEND_URL'] || 'http://localhost:3100';

// Singleton instances
const authService = new RecoderAuthService();
let bridgeInstance: AgentBridgeService | null = null;

function getBridge(): AgentBridgeService {
  if (!bridgeInstance) {
    bridgeInstance = new AgentBridgeService(() => authService.getAccessToken());
    installRecoderSpaceAutoWorker(bridgeInstance, () => authService.getAccessToken());
  }
  return bridgeInstance;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  description?: string;
  agentCount?: number;
  channelCount?: number;
  createdAt?: string;
}

interface WorkspaceAgentInfo {
  agentId: string;
  status: string;
  isLocal: boolean;
  capabilities: string[];
}

interface WorkspaceContextPackage {
  contextVersion: string;
  workspace: {
    workspaceId: string;
    name: string;
    projectId: string;
  };
  summary?: {
    totalAgents?: number;
    onlineAgents?: number;
    totalTasks?: number;
    activeTasks?: number;
    pendingApprovals?: number;
    activeHandoffs?: number;
  };
  recentTasks?: Array<{
    prompt?: string;
    state?: string;
    assignee_agent_id?: string;
  }>;
  pendingApprovals?: Array<{
    action?: string;
    requester?: string;
    target?: string;
  }>;
}

interface WorkspaceTaskRow {
  id: string;
  prompt?: string;
  state?: string;
  assignee_agent_id?: string;
  createdAt?: string;
  updatedAt?: string;
  approval?: {
    status?: string;
  } | null;
  handoff?: {
    status?: string;
  } | null;
  review?: {
    merge?: {
      status?: string | null;
      branchName?: string | null;
    } | null;
    worktree?: {
      branchName?: string | null;
    } | null;
  } | null;
}

interface TaskContextLogEntry {
  label?: string;
  excerpt?: string | null;
}

interface TaskContextTimelineEntry {
  at?: string | null;
  type?: string | null;
  title?: string | null;
  detail?: string | null;
}

interface TaskContextResponse {
  task: {
    id: string;
    state: string;
  };
  run?: {
    taskId?: string;
    state?: string;
    startedAt?: string | null;
    completedAt?: string | null;
    exitCode?: number | null;
    assigneeAgentId?: string;
    branch?: string | null;
    reviewReady?: boolean;
    mergeRequested?: boolean;
    artifactCount?: number;
    previewCount?: number;
    logCount?: number;
    evidenceCount?: number;
  };
  runtime?: {
    logCount?: number;
    logs?: TaskContextLogEntry[];
    artifacts?: Array<{
      key?: string;
      artifact_type?: string;
      path?: string;
    }>;
  };
  timeline?: TaskContextTimelineEntry[];
}

interface WorkspaceApprovalRow {
  approvalId: string;
  requestingAgentId?: string;
  targetAgentId?: string;
  action?: string;
  status?: string;
  createdAt?: string;
}

interface ArtifactInputRow {
  key: string;
  artifact_type: 'patch' | 'file' | 'plan' | 'report' | 'log' | 'custom';
  mime_type: string;
  content: string;
  path?: string;
}

export const workspaceCommand: SlashCommand = {
  name: 'workspace',
  description: 'Manage Recoder Space connections',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    // -----------------------------------------------------------------------
    // /workspace list
    // -----------------------------------------------------------------------
    {
      name: 'list',
      description: 'List available workspaces',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        try {
          const response = await fetch(`${DOCKER_BACKEND_URL}/api/spaces`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch workspaces (${response.status}): ${errText}`,
            };
          }

          const data = await response.json();
          const workspaces: WorkspaceInfo[] = data.workspaces || data.data || data || [];

          if (!Array.isArray(workspaces) || workspaces.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: [
                '┌────────────────────────────────────────────────┐',
                '│  Recoder Spaces                                │',
                '├────────────────────────────────────────────────┤',
                '│  No workspaces found.                          │',
                '│                                                │',
                '│  Create one from the recoder.xyz dashboard     │',
                '│  or via the backend API.                       │',
                '└────────────────────────────────────────────────┘',
              ].join('\n'),
            };
          }

          const lines: string[] = [
            '┌────────────────────────────────────────────────┐',
            '│  Recoder Spaces                                │',
            '├────────────────────────────────────────────────┤',
          ];

          for (const ws of workspaces) {
            const agents = ws.agentCount !== undefined ? `${ws.agentCount} agents` : '';
            const channels = ws.channelCount !== undefined ? `${ws.channelCount} channels` : '';
            const meta = [agents, channels].filter(Boolean).join(', ');

            lines.push(`│  ${ws.name.padEnd(45)}│`);
            lines.push(`│    ID: ${ws.id.padEnd(39)}│`);
            if (ws.description) {
              lines.push(`│    ${ws.description.substring(0, 43).padEnd(45)}│`);
            }
            if (meta) {
              lines.push(`│    ${meta.padEnd(45)}│`);
            }
            lines.push('│                                                │');
          }

          lines.push('├────────────────────────────────────────────────┤');
          lines.push(`│  Total: ${String(workspaces.length).padEnd(38)}│`);
          lines.push('│  Join with: /workspace join <id>               │');
          lines.push('└────────────────────────────────────────────────┘');

          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to list workspaces: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace join <id>
    // -----------------------------------------------------------------------
    {
      name: 'join',
      description: 'Connect to a workspace (e.g., /workspace join <workspace-id>)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'info',
            content: [
              'Join Workspace',
              '',
              'Usage: /workspace join <workspace-id>',
              '',
              'Run /workspace list to see available workspace IDs.',
            ].join('\n'),
          };
        }

        const workspaceId = args.trim();
        const bridge = getBridge();

        if (bridge.isConnected() && bridge.getWorkspaceId() === workspaceId) {
          return {
            type: 'message',
            messageType: 'info',
            content: `Already connected to workspace: ${workspaceId}`,
          };
        }

        // Disconnect from any existing workspace first
        if (bridge.isConnected()) {
          bridge.disconnect();
        }

        try {
          await bridge.connect(workspaceId, ['code', 'review', 'test']);

          if (bridge.isConnected()) {
            return {
              type: 'message',
              messageType: 'info',
              content: [
                '┌────────────────────────────────────────────────┐',
                '│  Recoder Space Connected                       │',
                '├────────────────────────────────────────────────┤',
                `│  Workspace: ${workspaceId.substring(0, 35).padEnd(35)}│`,
                `│  Agent ID:  ${bridge.getAgentId().substring(0, 35).padEnd(35)}│`,
                '│  Status:    Online                             │',
                '├────────────────────────────────────────────────┤',
                '│  You will receive task assignments in          │',
                '│  real-time from the Recoder Space.             │',
                '│                                                │',
                '│  /workspace status  - Check connection         │',
                '│  /workspace leave   - Disconnect               │',
                '└────────────────────────────────────────────────┘',
              ].join('\n'),
            };
          } else {
            return {
              type: 'message',
              messageType: 'error',
              content: [
                'Failed to connect to workspace.',
                '',
                'Possible reasons:',
                '  - backend is not running',
                '  - Workspace ID does not exist',
                '  - Authentication token is invalid',
                '',
                'Check your connection and try again.',
              ].join('\n'),
            };
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to join workspace: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace run
    // -----------------------------------------------------------------------
    {
      name: 'run',
      description: 'Run-oriented commands for the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      subCommands: [
        {
          name: 'start',
          description: 'Start backend execution for a task',
          kind: CommandKind.BUILT_IN,
          action: async (_context, args): Promise<MessageActionReturn> => {
            const token = await authService.getAccessToken();
            if (!token) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Not authenticated. Please run /recoder-login first.',
              };
            }

            const taskId = args?.trim();
            if (!taskId) {
              return {
                type: 'message',
                messageType: 'info',
                content: 'Usage: /workspace run start <task-id>',
              };
            }

            try {
              const response = await fetch(
                `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/execute`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({}),
                },
              );

              if (!response.ok) {
                const errText = await response.text().catch(() => 'Unknown error');
                return {
                  type: 'message',
                  messageType: 'error',
                  content: `Failed to start run (${response.status}): ${errText}`,
                };
              }

              return {
                type: 'message',
                messageType: 'info',
                content: `Started backend run for task ${taskId}.`,
              };
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to start run: ${msg}`,
              };
            }
          },
        },
        {
          name: 'logs',
          description: 'Show run status and logs for a task',
          kind: CommandKind.BUILT_IN,
          action: async (_context, args): Promise<MessageActionReturn> => {
            const token = await authService.getAccessToken();
            if (!token) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Not authenticated. Please run /recoder-login first.',
              };
            }

            const taskId = args?.trim();
            if (!taskId) {
              return {
                type: 'message',
                messageType: 'info',
                content: 'Usage: /workspace run logs <task-id>',
              };
            }

            try {
              const response = await fetch(
                `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/context`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                },
              );

              if (!response.ok) {
                const errText = await response.text().catch(() => 'Unknown error');
                return {
                  type: 'message',
                  messageType: 'error',
                  content: `Failed to fetch run context (${response.status}): ${errText}`,
                };
              }

              const raw = await response.json();
              const context: TaskContextResponse = raw.data || raw;
              const lines: string[] = [
                `Run ${context.run?.taskId ?? context.task.id} [${context.run?.state ?? context.task.state}]`,
                '',
                `startedAt=${context.run?.startedAt ?? '—'}`,
                `completedAt=${context.run?.completedAt ?? '—'}`,
                `exitCode=${context.run?.exitCode ?? '—'}`,
                `branch=${context.run?.branch ?? '—'}`,
                `reviewReady=${context.run?.reviewReady ? 'yes' : 'no'}`,
                `mergeRequested=${context.run?.mergeRequested ? 'yes' : 'no'}`,
                `artifacts=${context.run?.artifactCount ?? 0} previews=${context.run?.previewCount ?? 0} logs=${context.run?.logCount ?? 0}`,
              ];

              if (context.runtime?.logs?.length) {
                lines.push('');
                lines.push('Logs:');
                for (const log of context.runtime.logs) {
                  lines.push(`- ${log.label || 'log'}: ${log.excerpt || '(empty)'}`);
                }
              }

              return { type: 'message', messageType: 'info', content: lines.join('\n') };
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to fetch run logs: ${msg}`,
              };
            }
          },
        },
      ],
    },

    // -----------------------------------------------------------------------
    // /workspace approvals
    // -----------------------------------------------------------------------
    {
      name: 'approvals',
      description: 'List pending approvals in the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const bridge = getBridge();
        const workspaceId = bridge.getWorkspaceId();
        if (!workspaceId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not connected to a Recoder Space. Run /workspace join <id> first.',
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/workspaces/${encodeURIComponent(workspaceId)}/approvals?status=pending`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch approvals (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const approvals: WorkspaceApprovalRow[] = raw.data?.approvals || raw.approvals || [];

          if (!approvals.length) {
            return {
              type: 'message',
              messageType: 'info',
              content: 'No pending approvals in the current Recoder Space.',
            };
          }

          const lines: string[] = ['Recoder Space Approvals', ''];
          for (const approval of approvals.slice(0, 12)) {
            const approvalId = String(approval.approvalId || 'unknown');
            const status = String(approval.status || 'pending');
            const action = String(approval.action || 'action');
            const requester = String(approval.requestingAgentId || 'unknown');
            const target = String(approval.targetAgentId || 'unknown');
            lines.push(`- ${approvalId} [${status}] ${action}`);
            lines.push(`  from=${requester} to=${target}`);
          }

          lines.push('');
          lines.push('Use /workspace approve <approval-id> to grant.');
          lines.push('Use /workspace reject <approval-id> to reject.');
          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to list approvals: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace approve <approval-id>
    // -----------------------------------------------------------------------
    {
      name: 'approve',
      description: 'Grant a pending approval in the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const approvalId = args?.trim();
        if (!approvalId) {
          return { type: 'message', messageType: 'info', content: 'Usage: /workspace approve <approval-id>' };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/approvals/${encodeURIComponent(approvalId)}/grant`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                resolvedBy: getBridge().getAgentId(),
              }),
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to grant approval (${response.status}): ${errText}`,
            };
          }

          return { type: 'message', messageType: 'info', content: `Granted approval ${approvalId}.` };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to grant approval: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace reject <approval-id>
    // -----------------------------------------------------------------------
    {
      name: 'reject',
      description: 'Reject a pending approval in the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const approvalId = args?.trim();
        if (!approvalId) {
          return { type: 'message', messageType: 'info', content: 'Usage: /workspace reject <approval-id>' };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/approvals/${encodeURIComponent(approvalId)}/reject`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                resolvedBy: getBridge().getAgentId(),
              }),
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to reject approval (${response.status}): ${errText}`,
            };
          }

          return { type: 'message', messageType: 'info', content: `Rejected approval ${approvalId}.` };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to reject approval: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace tasks
    // -----------------------------------------------------------------------
    {
      name: 'tasks',
      description: 'List tasks in the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const bridge = getBridge();
        const workspaceId = bridge.getWorkspaceId();
        if (!workspaceId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not connected to a Recoder Space. Run /workspace join <id> first.',
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/workspaces/${encodeURIComponent(workspaceId)}/tasks`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch tasks (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const tasks: WorkspaceTaskRow[] = raw.data?.tasks || raw.tasks || [];

          if (!tasks.length) {
            return {
              type: 'message',
              messageType: 'info',
              content: 'No tasks found in the current Recoder Space.',
            };
          }

          const lines: string[] = [
            'Recoder Space Tasks',
            '',
          ];

          for (const task of tasks.slice(0, 12)) {
            const prompt = String(task.prompt || task.id).replace(/\s+/g, ' ').slice(0, 60);
            const state = String(task.state || 'unknown');
            const assignee = String(task.assignee_agent_id || 'unassigned');
            const suffix = [
              task.approval?.status ? `approval:${task.approval.status}` : null,
              task.handoff?.status ? `handoff:${task.handoff.status}` : null,
              task.review?.merge?.status ? `merge:${task.review.merge.status}` : null,
            ]
              .filter(Boolean)
              .join(' ');
            lines.push(`- ${task.id} [${state}] ${prompt}`);
            lines.push(`  assignee=${assignee}${suffix ? ` ${suffix}` : ''}`);
          }

          lines.push('');
          lines.push('Use /workspace claim <task-id> to claim a task.');
          lines.push('Use /workspace logs <task-id> to inspect timeline and logs.');

          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to list tasks: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace claim <task-id>
    // -----------------------------------------------------------------------
    {
      name: 'claim',
      description: 'Claim a task in the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const taskId = args?.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Usage: /workspace claim <task-id>',
          };
        }

        const bridge = getBridge();
        const sessionId = bridge.getSessionId();
        if (!sessionId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'No active bridge session. Reconnect with /workspace join <id> first.',
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/claim`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: sessionId,
                agent_id: bridge.getAgentId(),
              }),
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to claim task (${response.status}): ${errText}`,
            };
          }

          return {
            type: 'message',
            messageType: 'info',
            content: `Claimed task ${taskId} as ${bridge.getAgentId()}.`,
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to claim task: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace logs <task-id>
    // -----------------------------------------------------------------------
    {
      name: 'logs',
      description: 'Show task logs and timeline for a Recoder Space task',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const taskId = args?.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Usage: /workspace logs <task-id>',
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/context`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch task context (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const context: TaskContextResponse = raw.data || raw;
          const lines: string[] = [
            `Task ${context.task.id} [${context.task.state}]`,
            '',
            'Timeline:',
          ];

          for (const entry of (context.timeline || []).slice(-12)) {
            const at = entry.at ? new Date(entry.at).toLocaleString() : 'unknown-time';
            const title = entry.title || entry.type || 'event';
            lines.push(`- ${at} ${title}${entry.detail ? ` :: ${entry.detail}` : ''}`);
          }

          if (context.runtime?.logs?.length) {
            lines.push('');
            lines.push('Logs:');
            for (const log of context.runtime.logs) {
              lines.push(`- ${log.label || 'log'}: ${log.excerpt || '(empty)'}`);
            }
          }

          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to fetch task logs: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace timeline <task-id>
    // -----------------------------------------------------------------------
    {
      name: 'timeline',
      description: 'Show the canonical timeline for a Recoder Space task',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const taskId = args?.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Usage: /workspace timeline <task-id>',
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/context`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch task context (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const context: TaskContextResponse = raw.data || raw;
          const lines: string[] = [`Task ${context.task.id} [${context.task.state}]`, '', 'Timeline:'];

          for (const entry of context.timeline || []) {
            const at = entry.at ? new Date(entry.at).toLocaleString() : 'unknown-time';
            const title = entry.title || entry.type || 'event';
            lines.push(`- ${at} ${title}${entry.detail ? ` :: ${entry.detail}` : ''}`);
          }

          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to fetch task timeline: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace artifacts <task-id>
    // -----------------------------------------------------------------------
    {
      name: 'artifacts',
      description: 'List artifacts attached to a Recoder Space task',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const taskId = args?.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Usage: /workspace artifacts <task-id>',
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/context`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch task context (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const context: TaskContextResponse = raw.data || raw;
          const artifacts = context.runtime?.artifacts || [];

          if (!artifacts.length) {
            return {
              type: 'message',
              messageType: 'info',
              content: `No artifacts attached to task ${taskId}.`,
            };
          }

          const lines: string[] = [`Task ${context.task.id} artifacts`, ''];
          for (const artifact of artifacts) {
            lines.push(
              `- ${artifact.key || 'artifact'} [${artifact.artifact_type || 'unknown'}]${artifact.path ? ` ${artifact.path}` : ''}`,
            );
          }

          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to fetch artifacts: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace artifact <task-id> <file-path>
    // -----------------------------------------------------------------------
    {
      name: 'artifact',
      description: 'Attach a local file artifact to a Recoder Space task',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const parts = args?.trim().split(/\s+/) ?? [];
        const taskId = parts[0];
        const filePath = parts.slice(1).join(' ').trim();
        if (!taskId || !filePath) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Usage: /workspace artifact <task-id> <file-path>',
          };
        }

        if (!existsSync(filePath)) {
          return {
            type: 'message',
            messageType: 'error',
            content: `File not found: ${filePath}`,
          };
        }

        try {
          const content = readFileSync(filePath, 'utf8');
          const mimeType = mime.lookup(filePath) || 'text/plain';
          const artifactType: ArtifactInputRow['artifact_type'] =
            filePath.endsWith('.diff') || filePath.endsWith('.patch')
              ? 'patch'
              : filePath.endsWith('.md')
                ? 'report'
                : filePath.endsWith('.log')
                  ? 'log'
                  : 'file';

          const artifact: ArtifactInputRow = {
            key: filePath.split('/').pop() || `artifact-${Date.now()}`,
            artifact_type: artifactType,
            mime_type: String(mimeType),
            content,
            path: filePath,
          };

          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/a2a/tasks/${encodeURIComponent(taskId)}/artifacts`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                artifacts: [artifact],
                reason: 'Artifact attached from Recoder Code CLI',
                triggeredBy: getBridge().getAgentId(),
              }),
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to attach artifact (${response.status}): ${errText}`,
            };
          }

          return {
            type: 'message',
            messageType: 'info',
            content: `Attached artifact ${artifact.key} to task ${taskId}.`,
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to attach artifact: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace create <prompt>
    // -----------------------------------------------------------------------
    {
      name: 'create',
      description: 'Create a task in the current Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const prompt = args?.trim();
        if (!prompt) {
          return {
            type: 'message',
            messageType: 'info',
            content: [
              'Create Task',
              '',
              'Usage: /workspace create <task prompt>',
              '',
              'Example:',
              '  /workspace create Add pricing page with three tiers and FAQ',
            ].join('\n'),
          };
        }

        const bridge = getBridge();
        const workspaceId = bridge.getWorkspaceId();
        if (!workspaceId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not connected to a Recoder Space. Run /workspace join <id> first.',
          };
        }

        const threadId = `thread_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

        try {
          const response = await fetch(`${DOCKER_BACKEND_URL}/api/a2a/tasks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workspace_id: workspaceId,
              thread_id: threadId,
              requester: {
                agent_id: bridge.getAgentId(),
                platform: 'custom',
                name: 'Recoder Code CLI',
              },
              payload: {
                kind: 'text',
                text: prompt,
              },
              auto_route: true,
              metadata: {
                source: 'recoder-code-cli',
                createdFrom: 'workspace.create',
              },
            }),
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to create task (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const task = raw.data || raw;
          return {
            type: 'message',
            messageType: 'info',
            content: [
              '┌────────────────────────────────────────────────┐',
              '│  Recoder Space Task Created                    │',
              '├────────────────────────────────────────────────┤',
              `│  Workspace: ${workspaceId.substring(0, 34).padEnd(34)}│`,
              `│  Task ID:   ${String(task.id || 'unknown').substring(0, 34).padEnd(34)}│`,
              `│  State:     ${String(task.state || 'submitted').substring(0, 34).padEnd(34)}│`,
              '├────────────────────────────────────────────────┤',
              `│  ${prompt.substring(0, 46).padEnd(46)}│`,
              '│                                                │',
              '│  The Space can now route or dispatch this      │',
              '│  task to an available agent.                   │',
              '└────────────────────────────────────────────────┘',
            ].join('\n'),
          };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to create task: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace context
    // -----------------------------------------------------------------------
    {
      name: 'context',
      description: 'Show the structured context package for the current or specified Recoder Space',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        const token = await authService.getAccessToken();
        if (!token) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Not authenticated. Please run /recoder-login first.',
          };
        }

        const bridge = getBridge();
        const workspaceId = args?.trim() || bridge.getWorkspaceId();
        if (!workspaceId) {
          return {
            type: 'message',
            messageType: 'info',
            content: [
              'Recoder Space Context',
              '',
              'Usage: /workspace context [workspace-id]',
              '',
              'Connect to a space first with /workspace join <id>,',
              'or pass a workspace ID explicitly.',
            ].join('\n'),
          };
        }

        try {
          const response = await fetch(
            `${DOCKER_BACKEND_URL}/api/spaces/${encodeURIComponent(workspaceId)}/context`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            return {
              type: 'message',
              messageType: 'error',
              content: `Failed to fetch space context (${response.status}): ${errText}`,
            };
          }

          const raw = await response.json();
          const context: WorkspaceContextPackage = raw.data || raw;
          const summary = context.summary || {};
          const recentTasks = context.recentTasks || [];
          const pendingApprovals = context.pendingApprovals || [];

          const lines: string[] = [
            '┌────────────────────────────────────────────────┐',
            '│  Recoder Space Context                         │',
            '├────────────────────────────────────────────────┤',
            `│  Name: ${String(context.workspace?.name || workspaceId).substring(0, 40).padEnd(40)}│`,
            `│  ID:   ${String(context.workspace?.workspaceId || workspaceId).substring(0, 40).padEnd(40)}│`,
            `│  Ver:  ${String(context.contextVersion || 'unknown').substring(0, 40).padEnd(40)}│`,
            '├────────────────────────────────────────────────┤',
            `│  Agents: ${String(summary.totalAgents ?? 0).padEnd(4)} Online: ${String(summary.onlineAgents ?? 0).padEnd(5)} Tasks: ${String(summary.totalTasks ?? 0).padEnd(6)}│`,
            `│  Active: ${String(summary.activeTasks ?? 0).padEnd(4)} Approvals: ${String(summary.pendingApprovals ?? 0).padEnd(3)} Handoffs: ${String(summary.activeHandoffs ?? 0).padEnd(3)}│`,
          ];

          if (recentTasks.length > 0) {
            lines.push('├────────────────────────────────────────────────┤');
            lines.push('│  Recent Tasks                                  │');
            lines.push('│                                                │');
            for (const task of recentTasks.slice(0, 3)) {
              const prompt = String(task.prompt || '').substring(0, 31);
              const state = String(task.state || '').substring(0, 10);
              const assignee = String(task.assignee_agent_id || '').substring(0, 44);
              lines.push(`│  ${prompt.padEnd(31)} ${state.padEnd(10)}│`);
              if (assignee) {
                lines.push(`│    -> ${assignee.padEnd(40)}│`);
              }
            }
          }

          if (pendingApprovals.length > 0) {
            lines.push('├────────────────────────────────────────────────┤');
            lines.push('│  Pending Approvals                             │');
            lines.push('│                                                │');
            for (const approval of pendingApprovals.slice(0, 2)) {
              const action = String(approval.action || '').substring(0, 18);
              const requester = String(approval.requester || '').substring(0, 10);
              const target = String(approval.target || '').substring(0, 10);
              lines.push(`│  ${action.padEnd(18)} ${requester.padEnd(10)} ${target.padEnd(10)}│`);
            }
          }

          lines.push('└────────────────────────────────────────────────┘');
          return { type: 'message', messageType: 'info', content: lines.join('\n') };
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to fetch space context: ${msg}`,
          };
        }
      },
    },

    // -----------------------------------------------------------------------
    // /workspace leave
    // -----------------------------------------------------------------------
    {
      name: 'leave',
      description: 'Disconnect from current workspace',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const bridge = getBridge();

        if (!bridge.isConnected()) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'Not connected to any workspace.',
          };
        }

        const workspaceId = bridge.getWorkspaceId() || 'unknown';
        bridge.disconnect();

        return {
          type: 'message',
          messageType: 'info',
          content: [
            '┌────────────────────────────────────────────────┐',
            '│  Recoder Space Disconnected                    │',
            '├────────────────────────────────────────────────┤',
            `│  Left: ${workspaceId.substring(0, 40).padEnd(40)}│`,
            '│  Status: Offline                               │',
            '│                                                │',
            '│  Reconnect with: /workspace join <id>          │',
            '└────────────────────────────────────────────────┘',
          ].join('\n'),
        };
      },
    },

    // -----------------------------------------------------------------------
    // /workspace status
    // -----------------------------------------------------------------------
    {
      name: 'status',
      description: 'Show current connection status and online agents',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const bridge = getBridge();

        if (!bridge.isConnected()) {
          return {
            type: 'message',
            messageType: 'info',
            content: [
              '┌────────────────────────────────────────────────┐',
              '│  Recoder Space Status                          │',
              '├────────────────────────────────────────────────┤',
              '│  Status:    Disconnected                       │',
              `│  Agent ID:  ${bridge.getAgentId().substring(0, 35).padEnd(35)}│`,
              '│                                                │',
              '│  Connect with: /workspace join <id>            │',
              '└────────────────────────────────────────────────┘',
            ].join('\n'),
          };
        }

        const workspaceId = bridge.getWorkspaceId() || 'none';
        const lines: string[] = [
          '┌────────────────────────────────────────────────┐',
          '│  Recoder Space Status                          │',
          '├────────────────────────────────────────────────┤',
          '│  Status:    Connected                          │',
          `│  Workspace: ${workspaceId.substring(0, 35).padEnd(35)}│`,
          `│  Agent ID:  ${bridge.getAgentId().substring(0, 35).padEnd(35)}│`,
        ];

        // Try to fetch online agents from the backend
        const token = await authService.getAccessToken();
        if (token) {
          try {
            const response = await fetch(
              `${DOCKER_BACKEND_URL}/api/spaces/${encodeURIComponent(workspaceId)}/agents`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            if (response.ok) {
              const data = await response.json();
              const agents: WorkspaceAgentInfo[] = data.agents || data.data || [];

              if (agents.length > 0) {
                lines.push('├────────────────────────────────────────────────┤');
                lines.push(`│  Online Agents (${String(agents.length).padEnd(30)}│`);
                lines.push('│                                                │');

                for (const agent of agents) {
                  const local = agent.isLocal ? ' (local)' : '';
                  const caps = agent.capabilities.length > 0
                    ? ` [${agent.capabilities.join(', ')}]`
                    : '';
                  const label = `${agent.agentId}${local}${caps}`;
                  lines.push(`│    ${label.substring(0, 44).padEnd(44)}│`);
                }
              }
            }
          } catch {
            // Silently skip agent listing on error
          }
        }

        lines.push('├────────────────────────────────────────────────┤');
        lines.push('│  /workspace leave  - Disconnect                │');
        lines.push('└────────────────────────────────────────────────┘');

        return { type: 'message', messageType: 'info', content: lines.join('\n') };
      },
    },
  ],

  // -------------------------------------------------------------------------
  // Default action (no subcommand)
  // -------------------------------------------------------------------------
  action: async (): Promise<MessageActionReturn> => {
    const bridge = getBridge();
    const connected = bridge.isConnected();
    const wsId = bridge.getWorkspaceId();

    const statusLine = connected
      ? `Connected to: ${wsId}`
      : 'Disconnected';

    return {
      type: 'message',
      messageType: 'info',
      content: [
        `Recoder Space (${statusLine})`,
        '',
        'Commands:',
        '  /workspace list       - List available workspaces',
        '  /workspace join <id>  - Connect to a workspace',
        '  /workspace run start  - Start backend task execution',
        '  /workspace run logs   - Show run status and logs',
        '  /workspace approvals  - List pending approvals',
        '  /workspace approve .. - Grant an approval',
        '  /workspace reject ..  - Reject an approval',
        '  /workspace tasks      - List tasks in the current space',
        '  /workspace claim ..   - Claim a task',
        '  /workspace logs ..    - Show task logs and timeline',
        '  /workspace artifact . - Attach a local artifact to a task',
        '  /workspace artifacts  - List task artifacts',
        '  /workspace timeline . - Show canonical task timeline',
        '  /workspace create ... - Create a task in the current space',
        '  /workspace context    - Show space context',
        '  /workspace leave      - Disconnect from workspace',
        '  /workspace status     - Show connection status',
      ].join('\n'),
    };
  },
};
