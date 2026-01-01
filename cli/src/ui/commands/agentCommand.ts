/**
 * /agent slash command - Manage AI agents
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { SlashCommand, MessageActionReturn } from './types.js';
import { CommandKind } from './types.js';

const AGENTS_DIR = path.join(os.homedir(), '.recoder-code', 'agents');

interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
}

const AGENT_TEMPLATES: Record<string, AgentConfig> = {
  explorer: {
    name: 'explorer',
    description: 'Code discovery & research specialist',
    systemPrompt: `You are an expert code explorer. Your role is to search codebases, find patterns, and analyze architecture.

APPROACH:
1. Start with broad searches using Grep/Glob
2. Narrow down based on findings
3. Read specific files for details
4. Cross-reference related code

GUIDELINES:
- Use absolute file paths
- Include code snippets with context
- NEVER modify files - only analyze`,
  },
  planner: {
    name: 'planner',
    description: 'Architecture & task planning specialist',
    systemPrompt: `You are a technical planner. Break down complex tasks into actionable steps.

OUTPUT FORMAT:
- Clear task breakdown with numbered steps
- File paths that will be created/modified
- Dependencies between tasks
- Estimated complexity

GUIDELINES:
- Be specific about file locations
- Consider edge cases
- NEVER implement - only plan`,
  },
  coder: {
    name: 'coder',
    description: 'Implementation specialist',
    systemPrompt: `You are an expert developer focused on writing clean, production-ready code.

CODE QUALITY:
- Follow existing code style
- Use proper TypeScript types
- Handle edge cases and errors
- Keep functions focused and small

GUIDELINES:
- Make minimal, focused changes
- Preserve existing functionality
- Add comments for complex logic`,
  },
  reviewer: {
    name: 'reviewer',
    description: 'Code quality & security specialist',
    systemPrompt: `You are a senior code reviewer focused on quality, security, and maintainability.

REVIEW CRITERIA:
- Security: Vulnerabilities, injection risks
- Performance: Efficiency, memory usage
- Quality: Structure, readability
- Error Handling: Edge cases

GUIDELINES:
- Provide specific file paths and line references
- Include code examples for fixes
- NEVER modify code - only analyze`,
  },
  tester: {
    name: 'tester',
    description: 'Test creation specialist',
    systemPrompt: `You are a testing specialist creating comprehensive tests.

TEST QUALITY:
- Descriptive test names
- Both positive and negative cases
- Proper isolation between tests
- Meaningful assertions

GUIDELINES:
- Follow existing test patterns
- Test behavior, not implementation`,
  },
  documenter: {
    name: 'documenter',
    description: 'Documentation specialist',
    systemPrompt: `You are a technical documentation specialist.

DOCUMENTATION TYPES:
- README files with setup instructions
- API documentation with examples
- Code comments for complex logic

GUIDELINES:
- Clear, concise language
- Working code examples
- ONLY create docs when requested`,
  },
};

function loadUserAgents(): AgentConfig[] {
  const agents: AgentConfig[] = [];
  try {
    if (!fs.existsSync(AGENTS_DIR)) return agents;
    for (const file of fs.readdirSync(AGENTS_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        agents.push(JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, file), 'utf-8')));
      } catch {
        // Skip invalid
      }
    }
  } catch {
    // Ignore
  }
  return agents;
}

function saveAgent(agent: AgentConfig): void {
  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(AGENTS_DIR, `${agent.name}.json`), JSON.stringify(agent, null, 2));
}

export const agentCommand: SlashCommand = {
  name: 'agent',
  description: 'Manage AI agents',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List all available agents',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const userAgents = loadUserAgents();
        const lines = ['AI Agents', '', 'Built-in:'];

        for (const [name, agent] of Object.entries(AGENT_TEMPLATES)) {
          lines.push(`  • ${name} - ${agent.description}`);
        }

        if (userAgents.length > 0) {
          lines.push('', 'Custom:');
          for (const agent of userAgents) {
            lines.push(`  • ${agent.name} - ${agent.description}`);
          }
        }

        lines.push('', 'Commands:', '  /agent create <name> [template] - Create agent', '  /agent show <name>              - Show agent details', '  /agent use <name>               - Use agent for next task');

        return { type: 'message', messageType: 'info', content: lines.join('\n') };
      },
    },
    {
      name: 'create',
      description: 'Create a new agent (e.g., /agent create myagent coder)',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'info',
            content: `Create Agent

Usage: /agent create <name> [template]

Templates: ${Object.keys(AGENT_TEMPLATES).join(', ')}

Examples:
  /agent create my-coder coder
  /agent create security-reviewer reviewer

The agent will be saved to ~/.recoder-code/agents/<name>.json
You can then edit the JSON to customize the system prompt.`,
          };
        }

        const parts = args.trim().split(/\s+/);
        const name = parts[0];
        const template = parts[1] || 'coder';

        if (!AGENT_TEMPLATES[template]) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Unknown template: ${template}. Available: ${Object.keys(AGENT_TEMPLATES).join(', ')}`,
          };
        }

        const agent: AgentConfig = {
          ...AGENT_TEMPLATES[template],
          name,
          description: `Custom ${template} agent`,
        };

        saveAgent(agent);

        return {
          type: 'message',
          messageType: 'info',
          content: `✓ Created agent: ${name}

Based on: ${template}
Saved to: ~/.recoder-code/agents/${name}.json

Edit the JSON file to customize the system prompt.
Use with: /agent use ${name}`,
        };
      },
    },
    {
      name: 'show',
      description: 'Show agent details',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /agent show <name>',
          };
        }

        const name = args.trim();
        let agent: AgentConfig | undefined;

        // Check templates first
        if (AGENT_TEMPLATES[name]) {
          agent = AGENT_TEMPLATES[name];
        } else {
          // Check user agents
          const userAgents = loadUserAgents();
          agent = userAgents.find((a) => a.name === name);
        }

        if (!agent) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Agent not found: ${name}`,
          };
        }

        return {
          type: 'message',
          messageType: 'info',
          content: `Agent: ${agent.name}

Description: ${agent.description}
${agent.model ? `Model: ${agent.model}` : ''}
${agent.temperature !== undefined ? `Temperature: ${agent.temperature}` : ''}

System Prompt:
${agent.systemPrompt}`,
        };
      },
    },
    {
      name: 'use',
      description: 'Use an agent for the current session',
      kind: CommandKind.BUILT_IN,
      action: async (context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'info',
            content: `Use Agent

Usage: /agent use <name>

Available agents: ${Object.keys(AGENT_TEMPLATES).join(', ')}

Example: /agent use explorer
         /agent use coder`,
          };
        }

        const name = args.trim();
        let agent: AgentConfig | undefined;

        // Check templates first
        if (AGENT_TEMPLATES[name]) {
          agent = AGENT_TEMPLATES[name];
        } else {
          // Check user agents
          const userAgents = loadUserAgents();
          agent = userAgents.find((a) => a.name === name);
        }

        if (!agent) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Agent not found: ${name}\n\nAvailable: ${Object.keys(AGENT_TEMPLATES).join(', ')}`,
          };
        }

        // Store active agent in environment for use by prompts
        process.env['RECODER_ACTIVE_AGENT'] = agent.name;
        process.env['RECODER_AGENT_PROMPT'] = agent.systemPrompt;

        // Set model if specified
        if (agent.model && context.services.config) {
          await context.services.config.setModel(agent.model, {});
        }

        return {
          type: 'message',
          messageType: 'info',
          content: `✓ Agent activated: ${agent.name}

${agent.description}

The agent's system prompt is now active for this session.
${agent.model ? `Model: ${agent.model}` : ''}`,
        };
      },
    },
    {
      name: 'remove',
      description: 'Remove a custom agent',
      kind: CommandKind.BUILT_IN,
      action: async (_context, args): Promise<MessageActionReturn> => {
        if (!args?.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /agent remove <name>',
          };
        }

        const name = args.trim();

        if (AGENT_TEMPLATES[name]) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Cannot remove built-in agent: ${name}`,
          };
        }

        const filePath = path.join(AGENTS_DIR, `${name}.json`);
        if (!fs.existsSync(filePath)) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Agent not found: ${name}`,
          };
        }

        fs.unlinkSync(filePath);
        return {
          type: 'message',
          messageType: 'info',
          content: `✓ Removed agent: ${name}`,
        };
      },
    },
  ],
  action: async (): Promise<MessageActionReturn> => {
    const userAgents = loadUserAgents();
    const total = Object.keys(AGENT_TEMPLATES).length + userAgents.length;

    return {
      type: 'message',
      messageType: 'info',
      content: `AI Agents (${total} available)

Built-in: ${Object.keys(AGENT_TEMPLATES).join(', ')}
Custom: ${userAgents.length > 0 ? userAgents.map((a) => a.name).join(', ') : 'none'}

Commands:
  /agent list              - List all agents
  /agent create <name>     - Create from template
  /agent show <name>       - Show agent details
  /agent remove <name>     - Remove custom agent`,
    };
  },
};
