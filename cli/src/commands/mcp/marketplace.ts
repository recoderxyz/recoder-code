/**
 * MCP Marketplace Command
 * Browse and install MCP servers from curated catalog
 */

import type { CommandModule } from 'yargs';
import { loadSettings, SettingScope } from '../../config/settings.js';
import type { MCPServerConfig } from 'recoder-code-core';
import * as readline from 'readline';

// Marketplace catalog shared across Recoder clients.
type MarketplaceCategory =
  | 'browser'
  | 'database'
  | 'devtools'
  | 'filesystem'
  | 'git'
  | 'search'
  | 'cloud'
  | 'productivity'
  | 'ai'
  | 'communication'
  | 'other';

interface MarketplaceServer {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  author: string;
  verified: boolean;
  featured: boolean;
  toolCount: number;
  installCommand: {
    type: 'npx' | 'npm' | 'uvx' | 'docker' | 'binary';
    command: string;
    args?: string[];
    env?: Record<string, string>;
    envRequired?: string[];
  };
  tags: string[];
}

// Curated catalog of popular MCP servers
const MARKETPLACE_CATALOG: MarketplaceServer[] = [
  // Featured
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and manage files and directories',
    category: 'filesystem',
    author: 'Anthropic',
    verified: true,
    featured: true,
    toolCount: 14,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-filesystem',
      args: ['/workspace'],
    },
    tags: ['files', 'read', 'write'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repos, issues, and PRs',
    category: 'git',
    author: 'Anthropic',
    verified: true,
    featured: true,
    toolCount: 26,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-github',
      envRequired: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    },
    tags: ['github', 'git', 'repos'],
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation with Chrome',
    category: 'browser',
    author: 'Anthropic',
    verified: true,
    featured: true,
    toolCount: 7,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-puppeteer',
    },
    tags: ['browser', 'automation'],
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search using Brave Search API',
    category: 'search',
    author: 'Anthropic',
    verified: true,
    featured: true,
    toolCount: 2,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-brave-search',
      envRequired: ['BRAVE_API_KEY'],
    },
    tags: ['search', 'web'],
  },
  // Database
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    category: 'database',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 5,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-postgres',
      envRequired: ['POSTGRES_CONNECTION_STRING'],
    },
    tags: ['database', 'postgres', 'sql'],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Local SQLite database operations',
    category: 'database',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 4,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-sqlite',
      args: ['--db-path', './database.db'],
    },
    tags: ['database', 'sqlite'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Supabase database, auth, and storage',
    category: 'database',
    author: 'supabase',
    verified: true,
    featured: false,
    toolCount: 15,
    installCommand: {
      type: 'npx',
      command: '-y supabase-mcp-server',
      envRequired: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
    },
    tags: ['database', 'supabase'],
  },
  // AI & Tools
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Dynamic problem-solving through thought sequences',
    category: 'ai',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 1,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-sequential-thinking',
    },
    tags: ['thinking', 'reasoning'],
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent memory using knowledge graph',
    category: 'ai',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 9,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-memory',
    },
    tags: ['memory', 'knowledge-graph'],
  },
  // Git
  {
    id: 'git',
    name: 'Git',
    description: 'Local git repository operations',
    category: 'git',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 8,
    installCommand: {
      type: 'uvx',
      command: 'mcp-server-git',
      args: ['--repository', '.'],
    },
    tags: ['git', 'version-control'],
  },
  // Productivity
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read and send Slack messages',
    category: 'communication',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 6,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-slack',
      envRequired: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
    },
    tags: ['slack', 'messaging'],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and write Notion pages and databases',
    category: 'productivity',
    author: 'notion',
    verified: true,
    featured: false,
    toolCount: 8,
    installCommand: {
      type: 'npx',
      command: '-y @notionhq/notion-mcp-server',
      envRequired: ['NOTION_API_KEY'],
    },
    tags: ['notion', 'notes'],
  },
  // Other
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Make HTTP requests and fetch web content',
    category: 'other',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 2,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-fetch',
    },
    tags: ['http', 'fetch', 'api'],
  },
  {
    id: 'time',
    name: 'Time',
    description: 'Get current time in any timezone',
    category: 'other',
    author: 'Anthropic',
    verified: true,
    featured: false,
    toolCount: 2,
    installCommand: {
      type: 'npx',
      command: '-y @modelcontextprotocol/server-time',
    },
    tags: ['time', 'timezone'],
  },
];

const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  browser: 'Browser',
  database: 'Database',
  devtools: 'DevTools',
  filesystem: 'Filesystem',
  git: 'Git & VCS',
  search: 'Search',
  cloud: 'Cloud',
  productivity: 'Productivity',
  ai: 'AI & ML',
  communication: 'Communication',
  other: 'Other',
};

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function listMarketplace(category?: string, search?: string) {
  let servers = MARKETPLACE_CATALOG;

  if (category) {
    servers = servers.filter((s) => s.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    servers = servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q))
    );
  }

  if (servers.length === 0) {
    console.log('No servers found matching your criteria.');
    return;
  }

  console.log('\n📦 MCP Server Marketplace\n');
  console.log('─'.repeat(60));

  // Group by category
  const grouped = new Map<MarketplaceCategory, MarketplaceServer[]>();
  for (const server of servers) {
    const list = grouped.get(server.category) || [];
    list.push(server);
    grouped.set(server.category, list);
  }

  for (const [cat, catServers] of grouped) {
    console.log(`\n${CATEGORY_LABELS[cat]}:`);
    for (const server of catServers) {
      const verified = server.verified ? '✓' : ' ';
      const featured = server.featured ? '★' : ' ';
      console.log(
        `  ${featured}${verified} ${server.id.padEnd(20)} ${server.name.padEnd(18)} (${server.toolCount} tools)`
      );
      console.log(`      ${server.description}`);
    }
  }

  console.log('\n─'.repeat(60));
  console.log('★ = Featured  ✓ = Verified\n');
  console.log('Install with: recoder mcp marketplace install <id>');
  console.log('Categories: ' + Object.keys(CATEGORY_LABELS).join(', '));
}

async function installFromMarketplace(
  serverId: string,
  scope: string,
  envValues: string[]
) {
  const server = MARKETPLACE_CATALOG.find((s) => s.id === serverId);

  if (!server) {
    console.error(`Server "${serverId}" not found in marketplace.`);
    console.log('\nAvailable servers:');
    MARKETPLACE_CATALOG.forEach((s) => console.log(`  - ${s.id}: ${s.name}`));
    return;
  }

  // Parse env values from command line
  const envMap: Record<string, string> = {};
  for (const env of envValues) {
    const [key, ...valueParts] = env.split('=');
    if (key && valueParts.length > 0) {
      envMap[key] = valueParts.join('=');
    }
  }

  // Check for required env vars
  const missingEnv = server.installCommand.envRequired?.filter(
    (key) => !envMap[key] && !process.env[key]
  );

  if (missingEnv && missingEnv.length > 0) {
    console.log(`\n${server.name} requires the following environment variables:\n`);
    for (const key of missingEnv) {
      const value = await prompt(`  ${key}: `);
      if (value) {
        envMap[key] = value;
      }
    }

    // Check again
    const stillMissing = server.installCommand.envRequired?.filter(
      (key) => !envMap[key]
    );
    if (stillMissing && stillMissing.length > 0) {
      console.error(`\nMissing required environment variables: ${stillMissing.join(', ')}`);
      return;
    }
  }

  // Build the server config
  const { installCommand } = server;
  let command: string;
  let args: string[];

  switch (installCommand.type) {
    case 'npx':
      command = 'npx';
      args = installCommand.command.split(' ').filter(Boolean);
      if (installCommand.args) {
        args.push(...installCommand.args);
      }
      break;
    case 'uvx':
      command = 'uvx';
      args = [installCommand.command];
      if (installCommand.args) {
        args.push(...installCommand.args);
      }
      break;
    default:
      command = installCommand.command;
      args = installCommand.args || [];
  }

  // Save to settings
  const settingsScope = scope === 'user' ? SettingScope.User : SettingScope.Workspace;
  const settings = loadSettings(process.cwd());

  const newServer: Partial<MCPServerConfig> = {
    command,
    args,
    env: Object.keys(envMap).length > 0 ? envMap : undefined,
    description: server.description,
    trust: server.verified,
  };

  const existingSettings = settings.forScope(settingsScope).settings;
  const mcpServers = existingSettings.mcpServers || {};

  if (mcpServers[serverId]) {
    console.log(`Server "${serverId}" is already installed. Updating...`);
  }

  mcpServers[serverId] = newServer as MCPServerConfig;
  settings.setValue(settingsScope, 'mcpServers', mcpServers);

  console.log(`\n✅ ${server.name} installed successfully!`);
  console.log(`   ID: ${serverId}`);
  console.log(`   Command: ${command} ${args.join(' ')}`);
  if (Object.keys(envMap).length > 0) {
    console.log(`   Environment: ${Object.keys(envMap).join(', ')}`);
  }
  console.log(`   Scope: ${scope}`);
  console.log(`\nThe server will be available on your next recoder session.`);
}

export const marketplaceCommand: CommandModule = {
  command: 'marketplace [action]',
  describe: 'Browse and install MCP servers from marketplace',
  builder: (yargs) =>
    yargs
      .positional('action', {
        describe: 'Action to perform',
        type: 'string',
        choices: ['list', 'install', 'search'],
        default: 'list',
      })
      .option('category', {
        alias: 'c',
        describe: 'Filter by category',
        type: 'string',
        choices: Object.keys(CATEGORY_LABELS),
      })
      .option('search', {
        alias: 'q',
        describe: 'Search servers by name or tags',
        type: 'string',
      })
      .option('id', {
        describe: 'Server ID to install',
        type: 'string',
      })
      .option('scope', {
        alias: 's',
        describe: 'Configuration scope',
        type: 'string',
        default: 'project',
        choices: ['user', 'project'],
      })
      .option('env', {
        alias: 'e',
        describe: 'Environment variables (KEY=value)',
        type: 'array',
        string: true,
        default: [],
      })
      .example('$0 mcp marketplace', 'List all available servers')
      .example('$0 mcp marketplace --category database', 'List database servers')
      .example('$0 mcp marketplace install --id github -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx', 'Install GitHub server')
      .example('$0 mcp marketplace search --query search', 'Search for servers'),
  handler: async (argv) => {
    const action = argv.action as string;
    const category = argv.category as string | undefined;
    const search = argv.search as string | undefined;
    const id = argv.id as string | undefined;
    const scope = argv.scope as string;
    const env = argv.env as string[];

    switch (action) {
      case 'install':
        if (!id) {
          console.error('Please specify a server ID with --id');
          console.log('Example: recoder mcp marketplace install --id github');
          return;
        }
        await installFromMarketplace(id, scope, env);
        break;
      case 'search':
        await listMarketplace(category, search || argv._[2]?.toString());
        break;
      case 'list':
      default:
        await listMarketplace(category, search);
        break;
    }
  },
};
