/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MCPServerConfig } from 'recoder-code-core';

/**
 * Default MCP servers that come pre-configured with Recoder Code.
 * All servers listed here have been tested and confirmed working.
 */
export const DEFAULT_MCP_SERVERS: Record<string, MCPServerConfig> = {
  // GitHub MCP - Repository management (26 tools)
  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    description: `GitHub MCP - Manage repos, issues, and PRs without leaving your environment.`,
    trust: false,
    timeout: 30000,
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}',
    },
  },

  // Playwright MCP - Browser automation
  playwright: {
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    description: `Playwright MCP - Browser automation using accessibility tree. Fast and LLM-friendly.`,
    trust: false,
    timeout: 60000,
  },

  // Sequential Thinking - Problem-solving
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    description: `Sequential Thinking - Break down complex problems into manageable steps.`,
    trust: false,
    timeout: 30000,
  },

  // Puppeteer - Chrome automation (7 tools)
  puppeteer: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    description: `Puppeteer - Chrome automation for screenshots, navigation, and interaction.`,
    trust: false,
    timeout: 60000,
  },

  // Memory Bank - Knowledge graphs (9 tools)
  'memory-bank': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    description: `Memory Bank - Organize project knowledge using knowledge graphs.`,
    trust: false,
    timeout: 30000,
  },

  // Filesystem - File operations (14 tools)
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    description: `Filesystem - Read, write, and manage files with permission control.`,
    trust: false,
    timeout: 30000,
  },

  // Brave Search - Web search (requires API key)
  'brave-search': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    description: `Brave Search - Privacy-focused web search. Requires BRAVE_API_KEY.`,
    trust: false,
    timeout: 30000,
    env: {
      BRAVE_API_KEY: '${BRAVE_API_KEY}',
    },
  },

  // Slack - Team integration (requires credentials)
  slack: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    description: `Slack - Send messages and interact with Slack. Requires SLACK_BOT_TOKEN and SLACK_TEAM_ID.`,
    trust: false,
    timeout: 30000,
    env: {
      SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}',
      SLACK_TEAM_ID: '${SLACK_TEAM_ID}',
    },
  },

  // GitMCP Docs - Remote GitHub documentation access (5 tools)
  'gitmcp-docs': {
    command: 'npx',
    args: ['-y', 'mcp-remote', 'https://gitmcp.io/docs'],
    description: `GitMCP - Access ANY GitHub repository's documentation dynamically. Extremely powerful!`,
    trust: false,
    timeout: 30000,
  },

  // ==================== EXTENDED SERVERS (Disabled by default) ====================
  // Uncomment these to enable additional functionality
  
  /* 
  // Google Drive - Document access (requires OAuth)
  'google-drive': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gdrive'],
    description: `Google Drive - Access Google Drive files, docs, sheets. OAuth flow on first use.`,
    trust: false,
    timeout: 30000,
  },

  // Google Maps - Location services (requires API key)
  'google-maps': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-maps'],
    description: `Google Maps - Geocoding, directions, places, distances. Requires GOOGLE_MAPS_API_KEY.`,
    trust: false,
    timeout: 30000,
    env: {
      GOOGLE_MAPS_API_KEY: '${GOOGLE_MAPS_API_KEY}',
    },
  },

  // EverArt - AI image generation (requires API key)
  everart: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everart'],
    description: `EverArt - AI art generation from text prompts. Requires EVERART_API_KEY.`,
    trust: false,
    timeout: 60000,
    env: {
      EVERART_API_KEY: '${EVERART_API_KEY}',
    },
  },

  // Everything - MCP protocol demo/testing
  everything: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    description: `Everything - Demonstrates all MCP features. Useful for testing.`,
    trust: false,
    timeout: 30000,
  },
  */
};

export function getDefaultMcpServers(): Record<string, MCPServerConfig> {
  return JSON.parse(JSON.stringify(DEFAULT_MCP_SERVERS));
}

export function getEssentialMcpServers(): Record<string, MCPServerConfig> {
  return {
    github: DEFAULT_MCP_SERVERS.github,
    playwright: DEFAULT_MCP_SERVERS.playwright,
    filesystem: DEFAULT_MCP_SERVERS.filesystem,
    puppeteer: DEFAULT_MCP_SERVERS.puppeteer,
    'memory-bank': DEFAULT_MCP_SERVERS['memory-bank'],
    'sequential-thinking': DEFAULT_MCP_SERVERS['sequential-thinking'],
    'gitmcp-docs': DEFAULT_MCP_SERVERS['gitmcp-docs'],
  };
}

/**
 * Get extended MCP servers with additional integrations.
 * These servers are commented out by default but can be enabled.
 */
export function getExtendedMcpServers(): Record<string, MCPServerConfig> {
  return {
    ...DEFAULT_MCP_SERVERS,
    'google-drive': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gdrive'],
      description: `Google Drive - Access Google Drive files, docs, sheets. OAuth flow on first use.`,
      trust: false,
      timeout: 30000,
    },
    'google-maps': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
      description: `Google Maps - Geocoding, directions, places, distances. Requires GOOGLE_MAPS_API_KEY.`,
      trust: false,
      timeout: 30000,
      env: {
        GOOGLE_MAPS_API_KEY: '${GOOGLE_MAPS_API_KEY}',
      },
    },
    everart: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everart'],
      description: `EverArt - AI art generation from text prompts. Requires EVERART_API_KEY.`,
      trust: false,
      timeout: 60000,
      env: {
        EVERART_API_KEY: '${EVERART_API_KEY}',
      },
    },
    everything: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      description: `Everything - Demonstrates all MCP features. Useful for testing.`,
      trust: false,
      timeout: 30000,
    },
  };
}

export const MCP_SERVER_CATEGORIES = {
  essential: ['github', 'filesystem', 'gitmcp-docs'],
  automation: ['playwright', 'puppeteer'],
  'problem-solving': ['sequential-thinking'],
  memory: ['memory-bank'],
  search: ['brave-search'],
  integrations: ['slack'],
  remote: ['gitmcp-docs'],
} as const;

export function getServersRequiringCredentials(): string[] {
  return ['brave-search', 'slack'];
}

export async function checkNpmAvailability(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('npx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
