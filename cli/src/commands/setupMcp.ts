/**
 * setup-mcp command
 * Auto-configures the Recoder A2A MCP server for Claude Code (or any MCP client)
 * so users get Recoder tools with zero extra setup after authenticating.
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../services/RecoderAuthService.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/**
 * Resolves the absolute path to the bundled recoder-a2a-server.js.
 * Tries multiple strategies:
 * 1. Relative from dist (npm installed package)
 * 2. Relative from src (development / monorepo)
 * 3. npm require.resolve
 */
function getMcpServerPath(): string {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));

  // Strategy 1: From dist/src/commands/ -> mcp/recoder-a2a-server.js (npm installed)
  // dist layout: dist/src/commands/setupMcp.js
  // mcp dir is at package root: ../../mcp/ relative to dist/src/commands/
  const distPath = path.resolve(thisDir, '..', '..', '..', 'mcp', 'recoder-a2a-server.js');
  if (fs.existsSync(distPath)) {
    return distPath;
  }

  // Strategy 2: From src/commands/ -> mcp/recoder-a2a-server.js (development)
  const devPath = path.resolve(thisDir, '..', '..', 'mcp', 'recoder-a2a-server.js');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Strategy 3: Try require.resolve from the package
  try {
    const require = createRequire(import.meta.url);
    const packageJsonPath = require.resolve('recoder-code/package.json');
    const packageDir = path.dirname(packageJsonPath);
    const resolvedPath = path.join(packageDir, 'mcp', 'recoder-a2a-server.js');
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  } catch {
    // Not resolvable via require
  }

  // Strategy 4: Check in the monorepo root mcp/ directory
  const monorepoPath = path.resolve(thisDir, '..', '..', '..', '..', '..', '..', '..', 'mcp', 'recoder-a2a-server.js');
  if (fs.existsSync(monorepoPath)) {
    return monorepoPath;
  }

  throw new Error(
    'Could not find recoder-a2a-server.js. Please reinstall recoder-code or run from the project root.',
  );
}

interface McpConfig {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
}

/**
 * Reads an existing .mcp.json, or returns an empty config.
 */
function readMcpConfig(filePath: string): McpConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      return {
        mcpServers: parsed.mcpServers || {},
      };
    }
  } catch {
    // File doesn't exist or is invalid JSON
  }
  return { mcpServers: {} };
}

/**
 * Writes the .mcp.json config, preserving other entries.
 */
function writeMcpConfig(filePath: string, config: McpConfig): void {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function runSetupMcp(options: {
  global?: boolean;
  path?: string;
}): Promise<void> {
  const authService = new RecoderAuthService();

  // 1. Check authentication
  const isAuth = await authService.isAuthenticated();
  if (!isAuth) {
    console.error('Not authenticated with Recoder.');
    console.log('Run: recoder-code auth login');
    process.exit(1);
  }

  // 2. Get the access token
  const token = await authService.getAccessToken();
  if (!token) {
    console.error('Could not retrieve access token. Please re-authenticate.');
    console.log('Run: recoder-code auth login --force');
    process.exit(1);
  }

  // 3. Resolve MCP server path
  let mcpServerPath: string;
  try {
    mcpServerPath = getMcpServerPath();
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // 4. Determine .mcp.json location
  let mcpJsonPath: string;
  if (options.path) {
    mcpJsonPath = path.resolve(options.path);
  } else if (options.global) {
    // Global config: ~/.claude/.mcp.json (Claude Code global MCP config)
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const claudeDir = path.join(homeDir, '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    mcpJsonPath = path.join(claudeDir, '.mcp.json');
  } else {
    // Project-level: .mcp.json in current directory
    mcpJsonPath = path.join(process.cwd(), '.mcp.json');
  }

  // 5. Read existing config and merge
  const config = readMcpConfig(mcpJsonPath);

  const existingRecoder = config.mcpServers['recoder'];
  const isUpdate = !!existingRecoder;

  config.mcpServers['recoder'] = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      RECODER_SESSION_TOKEN: token,
      RECODER_DOCKER_URL: process.env['RECODER_DOCKER_URL'] || 'https://docker.recoder.xyz',
      RECODER_API_URL: process.env['RECODER_API_URL'] || 'https://api.recoder.xyz',
      DAYTONA_API_KEY: process.env['DAYTONA_API_KEY'] || '',
      DAYTONA_URL: process.env['DAYTONA_URL'] || '',
    },
  };

  // 6. Write config
  writeMcpConfig(mcpJsonPath, config);

  // 7. Report
  const user = await authService.getUser();
  const serverCount = Object.keys(config.mcpServers).length;

  if (isUpdate) {
    console.log('MCP server "recoder" updated successfully.');
  } else {
    console.log('MCP server "recoder" configured successfully.');
  }

  console.log(`\nConfig: ${mcpJsonPath}`);
  console.log(`Server: ${mcpServerPath}`);
  console.log(`User: ${user?.email || 'Unknown'}`);
  console.log(`Total MCP servers in config: ${serverCount}`);
  console.log(`\nAvailable tools:`);
  console.log(`  - recoder_list_agents    List connected A2A agents`);
  console.log(`  - recoder_list_tasks     View A2A task queue`);
  console.log(`  - recoder_send_task      Send task to another agent`);
  console.log(`  - recoder_create_thread  Create agent thread with sandbox`);
  console.log(`  - recoder_get_thread     Get thread messages`);
  console.log(`  - recoder_sandbox_exec   Execute code in isolated sandbox`);
  console.log(`\nRestart Claude Code (or your MCP client) to use Recoder tools.`);
}

export const setupMcpCommand: CommandModule = {
  command: 'setup-mcp',
  describe: 'Configure Recoder MCP server for Claude Code',
  builder: (yargs) =>
    yargs
      .option('global', {
        alias: 'g',
        type: 'boolean',
        description: 'Write to global config (~/.claude/.mcp.json) instead of project-level',
        default: false,
      })
      .option('path', {
        type: 'string',
        description: 'Custom path for .mcp.json output',
      }),
  handler: async (argv) => {
    try {
      await runSetupMcp({
        global: argv['global'] as boolean,
        path: argv['path'] as string | undefined,
      });
      process.exit(0);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  },
};
