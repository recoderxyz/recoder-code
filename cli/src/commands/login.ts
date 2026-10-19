/**
 * Top-level login/logout/whoami commands for Recoder platform API token auth.
 *
 * These commands manage an API token (sk-recoder-*) in ~/.recoder/config.json
 * which is used by the MCP server (recoder-a2a-server.js) and other integrations.
 *
 * This is separate from the OAuth-based `recoder-code auth login` flow which
 * manages session tokens in ~/.recoder/auth.json.
 */

import type { CommandModule } from 'yargs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import * as readline from 'node:readline';

const CONFIG_DIR = path.join(homedir(), '.recoder');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const API_KEYS_URL = 'https://recoder.xyz/tr/dashboard/api-keys';
const DEFAULT_API_URL = 'https://api.recoder.xyz/v1';
const DEFAULT_DOCKER_URL = 'https://docker.recoder.xyz';

export interface RecoderPlatformConfig {
  apiToken: string;
  apiUrl: string;
  dockerUrl: string;
}

function readConfig(): RecoderPlatformConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    if (!raw.apiToken) return null;
    return raw as RecoderPlatformConfig;
  } catch {
    return null;
  }
}

function writeConfig(config: RecoderPlatformConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

function removeConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      // Read existing config, remove apiToken, keep other fields
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      delete raw.apiToken;
      delete raw.apiUrl;
      delete raw.dockerUrl;
      // If nothing meaningful remains, delete the file
      const remainingKeys = Object.keys(raw).filter((k) => k !== 'version');
      if (remainingKeys.length === 0) {
        fs.unlinkSync(CONFIG_FILE);
      } else {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(raw, null, 2), {
          mode: 0o600,
        });
      }
    }
  } catch {
    // If we can't parse existing config, just delete it
    try {
      fs.unlinkSync(CONFIG_FILE);
    } catch {
      // ignore
    }
  }
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function testApiKey(
  token: string,
  apiUrl: string,
): Promise<{ ok: boolean; info?: string; error?: string }> {
  try {
    const url = `${apiUrl}/billing/account-state`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      const plan = data?.plan || data?.data?.plan || 'unknown';
      const email = data?.email || data?.data?.email;
      let info = `Plan: ${String(plan).toUpperCase()}`;
      if (email) info = `Email: ${email}, ${info}`;
      return { ok: true, info };
    }

    // Non-2xx but we got a response
    return {
      ok: false,
      error: `API returned ${response.status} ${response.statusText}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Network error',
    };
  }
}

// ── login command ──

export const topLevelLoginCommand: CommandModule = {
  command: 'login',
  describe: 'Authenticate with Recoder platform using an API key',
  builder: (yargs) =>
    yargs
      .option('token', {
        alias: 't',
        type: 'string',
        description: 'API token (sk-recoder-*) — skips interactive prompt',
      })
      .option('api-url', {
        type: 'string',
        description: 'API base URL',
        default: DEFAULT_API_URL,
      })
      .option('docker-url', {
        type: 'string',
        description: 'Docker backend URL',
        default: DEFAULT_DOCKER_URL,
      })
      .option('skip-verify', {
        type: 'boolean',
        description: 'Skip API key verification',
        default: false,
      }),
  handler: async (argv) => {
    try {
      // Check if already logged in
      const existing = readConfig();
      if (existing?.apiToken) {
        console.log('Already logged in with a Recoder API token.');
        console.log(
          `  Token: ${existing.apiToken.slice(0, 14)}...${existing.apiToken.slice(-4)}`,
        );
        console.log(`  API:   ${existing.apiUrl}`);
        console.log('');
        const answer = await prompt(
          'Replace existing token? (y/N): ',
        );
        if (answer.toLowerCase() !== 'y') {
          console.log('Cancelled.');
          process.exit(0);
        }
      }

      let token = argv.token as string | undefined;

      if (!token) {
        console.log('');
        console.log(
          'Visit the following URL to create an API key:',
        );
        console.log(`  ${API_KEYS_URL}`);
        console.log('');
        token = await prompt('Paste your API key (sk-recoder-*): ');
      }

      if (!token) {
        console.error('No API key provided.');
        process.exit(1);
      }

      // Validate format
      if (!token.startsWith('sk-recoder-')) {
        console.error(
          'Invalid API key format. Key must start with "sk-recoder-".',
        );
        console.error(`  Got: ${token.slice(0, 20)}...`);
        console.error(`  Create a key at: ${API_KEYS_URL}`);
        process.exit(1);
      }

      const apiUrl = (argv['api-url'] as string) || DEFAULT_API_URL;
      const dockerUrl =
        (argv['docker-url'] as string) || DEFAULT_DOCKER_URL;

      // Optionally verify the key
      if (!argv['skip-verify']) {
        process.stdout.write('Verifying API key... ');
        const result = await testApiKey(token, apiUrl);
        if (result.ok) {
          console.log('OK');
          if (result.info) {
            console.log(`  ${result.info}`);
          }
        } else {
          console.log('WARNING');
          console.log(
            `  Could not verify key: ${result.error}`,
          );
          console.log(
            '  The key has been saved anyway. It may work once the API is reachable.',
          );
        }
      }

      // Save config
      writeConfig({
        apiToken: token,
        apiUrl,
        dockerUrl,
      });

      console.log('');
      console.log('Login successful! Configuration saved to:');
      console.log(`  ${CONFIG_FILE}`);
      console.log('');
      console.log(
        'The MCP server will pick up RECODER_API_TOKEN from this config.',
      );
      console.log(
        'You can also export it manually: export RECODER_API_TOKEN="<your-key>"',
      );
      console.log('');

      process.exit(0);
    } catch (error: any) {
      console.error(`Login failed: ${error.message}`);
      process.exit(1);
    }
  },
};

// ── logout command ──

export const topLevelLogoutCommand: CommandModule = {
  command: 'logout',
  describe: 'Remove saved Recoder platform API token',
  handler: async () => {
    try {
      const existing = readConfig();

      if (!existing?.apiToken) {
        console.log('Not logged in (no API token found).');
        process.exit(0);
      }

      removeConfig();
      console.log('Logged out. API token removed from:');
      console.log(`  ${CONFIG_FILE}`);
      process.exit(0);
    } catch (error: any) {
      console.error(`Logout failed: ${error.message}`);
      process.exit(1);
    }
  },
};

// ── whoami command ──

export const topLevelWhoamiCommand: CommandModule = {
  command: 'whoami',
  describe: 'Show current Recoder platform authentication',
  handler: async () => {
    try {
      const config = readConfig();

      if (!config?.apiToken) {
        console.log('Not logged in.');
        console.log('');
        console.log('Run "recoder-code login" to authenticate.');
        process.exit(1);
      }

      console.log('');
      console.log('Recoder Platform Authentication:');
      console.log(
        `  Token:  ${config.apiToken.slice(0, 14)}...${config.apiToken.slice(-4)}`,
      );
      console.log(`  API:    ${config.apiUrl}`);
      console.log(`  Docker: ${config.dockerUrl}`);
      console.log(`  Config: ${CONFIG_FILE}`);

      // Try to fetch account info
      process.stdout.write('  Account: ');
      const result = await testApiKey(config.apiToken, config.apiUrl);
      if (result.ok && result.info) {
        console.log(result.info);
      } else {
        console.log('(could not fetch — API may be unreachable)');
      }

      console.log('');
      process.exit(0);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  },
};
