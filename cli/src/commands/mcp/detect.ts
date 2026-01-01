/**
 * 'recoder mcp detect' command
 * Auto-detect MCP servers from common config locations
 */

import type { CommandModule } from 'yargs';
import * as fs from 'fs';
import * as os from 'os';
import * as readline from 'readline';
import { loadSettings, SettingScope } from '../../config/settings.js';
import type { MCPServerConfig } from 'recoder-code-core';

interface DetectedServer {
  name: string;
  source: string;
  config: MCPServerConfig;
}

const CONFIG_LOCATIONS = [
  { path: '~/Library/Application Support/Claude/claude_desktop_config.json', name: 'Claude Desktop' },
  { path: '~/.config/claude/claude_desktop_config.json', name: 'Claude Desktop (Linux)' },
  { path: '%APPDATA%/Claude/claude_desktop_config.json', name: 'Claude Desktop (Windows)' },
  { path: '~/.cursor/mcp.json', name: 'Cursor' },
  { path: '~/.vscode/mcp-servers.json', name: 'VSCode' },
  { path: '~/.mcp/config.json', name: 'MCP Config' },
  { path: './.mcp.json', name: 'Project MCP' },
  { path: './mcp.json', name: 'Project MCP' },
  { path: '~/.config/mcp/servers.json', name: 'MCP Servers' },
];

function expandPath(p: string): string {
  return p
    .replace(/^~/, os.homedir())
    .replace(/%APPDATA%/g, process.env.APPDATA || '');
}

function detectServers(): DetectedServer[] {
  const detected: DetectedServer[] = [];
  const seen = new Set<string>();

  for (const loc of CONFIG_LOCATIONS) {
    const fullPath = expandPath(loc.path);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const servers = content.mcpServers || content.servers || content;

      if (typeof servers === 'object' && !Array.isArray(servers)) {
        for (const [name, config] of Object.entries(servers)) {
          if (typeof config === 'object' && config !== null && !seen.has(name)) {
            seen.add(name);
            detected.push({
              name,
              source: loc.name,
              config: config as MCPServerConfig,
            });
          }
        }
      }
    } catch {
      // Skip invalid configs
    }
  }

  return detected;
}

function getServerInfo(config: MCPServerConfig): { type: string; info: string } {
  if (config.command) {
    return { type: 'stdio', info: `${config.command} ${config.args?.join(' ') || ''}`.trim() };
  } else if (config.url) {
    return { type: 'sse', info: config.url };
  } else if (config.httpUrl) {
    return { type: 'http', info: config.httpUrl };
  }
  return { type: 'unknown', info: JSON.stringify(config) };
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function addServer(name: string, config: MCPServerConfig, scope: SettingScope): Promise<void> {
  const settings = loadSettings(process.cwd());
  const existingSettings = settings.forScope(scope).settings;
  const mcpServers = { ...(existingSettings.mcpServers || {}) };
  mcpServers[name] = config;
  settings.setValue(scope, 'mcpServers', mcpServers);
}

interface DetectArgs {
  add?: boolean;
  scope?: string;
  interactive?: boolean;
}

export const detectCommand: CommandModule<{}, DetectArgs> = {
  command: 'detect',
  describe: 'Auto-detect MCP servers from common config locations',
  builder: (yargs) =>
    yargs
      .option('add', {
        alias: 'a',
        type: 'boolean',
        describe: 'Add all detected servers',
      })
      .option('interactive', {
        alias: 'i',
        type: 'boolean',
        describe: 'Interactively choose which servers to add',
      })
      .option('scope', {
        alias: 's',
        type: 'string',
        choices: ['user', 'project'],
        default: 'project',
        describe: 'Configuration scope for added servers',
      }),
  handler: async (argv) => {
    console.log('🔍 Scanning for MCP servers...\n');

    const detected = detectServers();

    if (detected.length === 0) {
      console.log('No MCP servers detected.');
      console.log('\nSearched locations:');
      CONFIG_LOCATIONS.forEach((loc) => console.log(`  - ${loc.path}`));
      return;
    }

    console.log(`Found ${detected.length} MCP server(s):\n`);

    const scope = argv.scope === 'user' ? SettingScope.User : SettingScope.Workspace;
    let addedCount = 0;

    for (const server of detected) {
      const { type, info } = getServerInfo(server.config);

      console.log(`  📦 ${server.name}`);
      console.log(`     Source: ${server.source}`);
      console.log(`     Type: ${type}`);
      console.log(`     Config: ${info}`);

      if (argv.add) {
        await addServer(server.name, server.config, scope);
        console.log(`     ✅ Added to ${argv.scope} settings`);
        addedCount++;
      } else if (argv.interactive) {
        const answer = await prompt(`     Add this server? (y/n): `);
        if (answer === 'y' || answer === 'yes') {
          await addServer(server.name, server.config, scope);
          console.log(`     ✅ Added to ${argv.scope} settings`);
          addedCount++;
        } else {
          console.log(`     ⏭️  Skipped`);
        }
      }
      console.log();
    }

    if (addedCount > 0) {
      console.log(`\n✅ Added ${addedCount} server(s) to ${argv.scope} settings`);
    } else if (!argv.add && !argv.interactive) {
      console.log('💡 Use --add to add all servers, or --interactive to choose');
    }
  },
};
