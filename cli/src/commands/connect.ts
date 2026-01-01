/**
 * /connect command - Interactive provider setup and health check
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { getProviderRegistry } from '../providers/registry.js';
import type { AIProvider, CustomProviderConfig } from '../providers/types.js';

const CONFIG_DIR = path.join(os.homedir(), '.recoder-code');
const ENV_FILE = path.join(CONFIG_DIR, '.env');
const CUSTOM_PROVIDERS_DIR = path.join(CONFIG_DIR, 'custom_providers');

interface ProviderStatus {
  provider: AIProvider;
  available: boolean;
  latency?: number;
  error?: string;
}

/**
 * Check health of all providers
 */
async function checkProviderHealth(provider: AIProvider): Promise<ProviderStatus> {
  const start = Date.now();

  try {
    let url: string;
    let headers: Record<string, string> = {};

    if (provider.isLocal) {
      // Local providers - check if running
      url = provider.engine === 'ollama'
        ? `${provider.baseUrl}/api/tags`
        : `${provider.baseUrl}/models`;
    } else {
      // Cloud providers - check API with key
      const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined;

      if (!apiKey) {
        return { provider, available: false, error: 'No API key configured' };
      }

      if (provider.id === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (provider.id === 'openai') {
        url = 'https://api.openai.com/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (provider.id === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages';
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        // For Anthropic, we just check if key format is valid
        if (apiKey.startsWith('sk-ant-')) {
          return { provider, available: true, latency: Date.now() - start };
        }
      } else if (provider.id === 'groq') {
        url = 'https://api.groq.com/openai/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        // Generic OpenAI-compatible check
        url = `${provider.baseUrl}/models`;
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;

    if (response.ok || response.status === 401) {
      // 401 means the endpoint exists but key is wrong
      return {
        provider,
        available: response.ok,
        latency,
        error: response.status === 401 ? 'Invalid API key' : undefined
      };
    }

    return { provider, available: false, latency, error: `HTTP ${response.status}` };
  } catch (error: any) {
    return {
      provider,
      available: false,
      error: error.code === 'ECONNREFUSED' ? 'Not running' : error.message
    };
  }
}

/**
 * Interactive connect command
 */
export async function connectCommand(args: string[] = []) {
  const registry = getProviderRegistry();
  const subcommand = args[0];

  if (!subcommand || subcommand === 'status') {
    await showProviderStatus();
    return;
  }

  if (subcommand === 'add') {
    await addProvider(args[1]);
    return;
  }

  if (subcommand === 'test') {
    await testProvider(args[1]);
    return;
  }

  if (subcommand === 'local') {
    await detectLocalProviders();
    return;
  }

  if (subcommand === 'custom') {
    await addCustomProvider();
    return;
  }

  // If provider name given, configure it
  await configureProviderKey(subcommand);
}

/**
 * Show status of all providers
 */
async function showProviderStatus() {
  const registry = getProviderRegistry();
  const providers = registry.getAllProviders();

  console.log(chalk.bold.cyan('\n🔌 Provider Status\n'));

  // Group by type
  const local = providers.filter(p => p.isLocal);
  const cloud = providers.filter(p => !p.isLocal && p.isBuiltin);
  const custom = providers.filter(p => !p.isBuiltin);

  // Check local providers
  console.log(chalk.bold('Local AI:'));
  for (const provider of local) {
    const status = await checkProviderHealth(provider);
    const icon = status.available ? chalk.green('✓') : chalk.gray('○');
    const latencyStr = status.latency ? chalk.gray(` (${status.latency}ms)`) : '';
    const errorStr = status.error ? chalk.red(` - ${status.error}`) : '';
    console.log(`  ${icon} ${provider.name}${latencyStr}${errorStr}`);
  }

  // Check cloud providers
  console.log(chalk.bold('\nCloud Providers:'));
  for (const provider of cloud) {
    const hasKey = provider.apiKeyEnv ? !!process.env[provider.apiKeyEnv] : false;
    const icon = hasKey ? chalk.green('✓') : chalk.gray('○');
    const keyStatus = hasKey ? chalk.gray(' (configured)') : chalk.yellow(' (no key)');
    console.log(`  ${icon} ${provider.name}${keyStatus}`);
  }

  // Custom providers
  if (custom.length > 0) {
    console.log(chalk.bold('\nCustom Providers:'));
    for (const provider of custom) {
      const status = await checkProviderHealth(provider);
      const icon = status.available ? chalk.green('✓') : chalk.gray('○');
      console.log(`  ${icon} ${provider.name} (${provider.baseUrl})`);
    }
  }

  console.log(chalk.gray('\nCommands:'));
  console.log(chalk.gray('  /connect <provider>  - Configure API key'));
  console.log(chalk.gray('  /connect local       - Detect local AI servers'));
  console.log(chalk.gray('  /connect custom      - Add custom provider'));
  console.log(chalk.gray('  /connect test <provider> - Test connection'));
  console.log();
}

/**
 * Configure provider API key
 */
async function configureProviderKey(providerId: string) {
  const registry = getProviderRegistry();
  const provider = registry.getProvider(providerId);

  if (!provider) {
    console.log(chalk.red(`\n❌ Unknown provider: ${providerId}`));
    console.log(chalk.gray('Run /connect to see available providers\n'));
    return;
  }

  if (provider.isLocal) {
    console.log(chalk.yellow(`\n${provider.name} is a local provider - no API key needed.`));
    console.log(chalk.gray('Run /connect local to check if it\'s running.\n'));
    return;
  }

  if (!provider.apiKeyEnv) {
    console.log(chalk.yellow(`\n${provider.name} doesn't require an API key.\n`));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  console.log(chalk.bold.cyan(`\n⚙️  Configure ${provider.name}\n`));

  // Show help for getting API key
  const keyUrls: Record<string, string> = {
    openrouter: 'https://openrouter.ai/keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    openai: 'https://platform.openai.com/api-keys',
    groq: 'https://console.groq.com/keys',
    deepseek: 'https://platform.deepseek.com/api_keys',
    together: 'https://api.together.xyz/settings/api-keys',
    fireworks: 'https://fireworks.ai/account/api-keys',
    mistral: 'https://console.mistral.ai/api-keys',
    google: 'https://aistudio.google.com/apikey',
  };

  if (keyUrls[provider.id]) {
    console.log(chalk.gray(`Get your key: ${keyUrls[provider.id]}\n`));
  }

  const currentKey = process.env[provider.apiKeyEnv];
  if (currentKey) {
    const masked = currentKey.substring(0, 8) + '...' + currentKey.substring(currentKey.length - 4);
    console.log(chalk.gray(`Current key: ${masked}\n`));
  }

  const apiKey = await question(chalk.white(`Enter ${provider.apiKeyEnv}: `));
  rl.close();

  if (!apiKey.trim()) {
    console.log(chalk.yellow('\nNo key provided, skipping.\n'));
    return;
  }

  // Test the key before saving
  console.log(chalk.gray('\nTesting connection...'));
  process.env[provider.apiKeyEnv] = apiKey.trim();
  const status = await checkProviderHealth(provider);

  if (!status.available && status.error === 'Invalid API key') {
    console.log(chalk.red('\n❌ API key appears to be invalid.'));
    const save = await new Promise<string>((resolve) => {
      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl2.question(chalk.yellow('Save anyway? (y/N): '), (answer) => {
        rl2.close();
        resolve(answer);
      });
    });
    if (save.toLowerCase() !== 'y') {
      console.log(chalk.gray('Key not saved.\n'));
      return;
    }
  } else if (status.available) {
    console.log(chalk.green(`✓ Connected! (${status.latency}ms)`));
  }

  // Save to env file
  saveApiKey(provider.apiKeyEnv, apiKey.trim());

  console.log(chalk.green(`\n✓ Saved to ${ENV_FILE}`));
  console.log(chalk.gray(`\nTo use immediately, run:`));
  console.log(chalk.cyan(`  export ${provider.apiKeyEnv}="${apiKey.trim()}"\n`));
}

/**
 * Save API key to env file
 */
function saveApiKey(envVar: string, value: string) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  const regex = new RegExp(`^${envVar}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${envVar}=${value}`);
  } else {
    envContent += `\n${envVar}=${value}`;
  }

  fs.writeFileSync(ENV_FILE, envContent.trim() + '\n');
}

/**
 * Detect local AI servers
 */
async function detectLocalProviders() {
  console.log(chalk.bold.cyan('\n🔍 Detecting Local AI Servers\n'));

  const localServers = [
    { name: 'Ollama', url: 'http://localhost:11434/api/tags', port: 11434 },
    { name: 'LM Studio', url: 'http://localhost:1234/v1/models', port: 1234 },
    { name: 'llama.cpp', url: 'http://localhost:8080/v1/models', port: 8080 },
    { name: 'vLLM', url: 'http://localhost:8000/v1/models', port: 8000 },
    { name: 'LocalAI', url: 'http://localhost:8080/v1/models', port: 8080 },
  ];

  for (const server of localServers) {
    try {
      const start = Date.now();
      const response = await fetch(server.url, { signal: AbortSignal.timeout(2000) });
      const latency = Date.now() - start;

      if (response.ok) {
        console.log(chalk.green(`✓ ${server.name}`), chalk.gray(`(localhost:${server.port}, ${latency}ms)`));

        // Get model list for Ollama
        if (server.name === 'Ollama') {
          const data = await response.json() as { models: Array<{ name: string }> };
          if (data.models && data.models.length > 0) {
            console.log(chalk.gray(`  Models: ${data.models.slice(0, 5).map(m => m.name).join(', ')}${data.models.length > 5 ? '...' : ''}`));
          }
        }
      }
    } catch {
      console.log(chalk.gray(`○ ${server.name}`), chalk.gray(`(not running on port ${server.port})`));
    }
  }

  console.log(chalk.gray('\nTo use a local model:'));
  console.log(chalk.cyan('  recoder --model ollama/llama3.2'));
  console.log(chalk.cyan('  recoder --model lmstudio/local-model\n'));
}

/**
 * Test specific provider connection
 */
async function testProvider(providerId?: string) {
  if (!providerId) {
    console.log(chalk.yellow('\nUsage: /connect test <provider>\n'));
    return;
  }

  const registry = getProviderRegistry();
  const provider = registry.getProvider(providerId);

  if (!provider) {
    console.log(chalk.red(`\n❌ Unknown provider: ${providerId}\n`));
    return;
  }

  console.log(chalk.cyan(`\nTesting ${provider.name}...`));
  const status = await checkProviderHealth(provider);

  if (status.available) {
    console.log(chalk.green(`✓ Connected! (${status.latency}ms)\n`));
  } else {
    console.log(chalk.red(`✗ Failed: ${status.error}\n`));
  }
}

/**
 * Add custom provider interactively
 */
async function addCustomProvider() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  console.log(chalk.bold.cyan('\n➕ Add Custom Provider\n'));
  console.log(chalk.gray('Add any OpenAI-compatible API endpoint.\n'));

  const id = await question(chalk.white('Provider ID (e.g., my-api): '));
  if (!id.trim()) {
    rl.close();
    return;
  }

  const name = await question(chalk.white('Display Name: ')) || id;
  const baseUrl = await question(chalk.white('Base URL (e.g., http://localhost:8000/v1): '));

  if (!baseUrl.trim()) {
    console.log(chalk.yellow('\nBase URL required.\n'));
    rl.close();
    return;
  }

  const apiKeyEnv = await question(chalk.white('API Key env var (optional, e.g., MY_API_KEY): '));
  const isLocalStr = await question(chalk.white('Is local server? (y/N): '));

  rl.close();

  const config: CustomProviderConfig = {
    id: id.trim().toLowerCase().replace(/\s+/g, '-'),
    name: name.trim(),
    engine: 'openai',
    baseUrl: baseUrl.trim(),
    apiKeyEnv: apiKeyEnv.trim() || undefined,
    isLocal: isLocalStr.toLowerCase() === 'y',
    models: [],
    supportsStreaming: true,
  };

  // Save to file
  if (!fs.existsSync(CUSTOM_PROVIDERS_DIR)) {
    fs.mkdirSync(CUSTOM_PROVIDERS_DIR, { recursive: true });
  }

  const filePath = path.join(CUSTOM_PROVIDERS_DIR, `${config.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));

  console.log(chalk.green(`\n✓ Custom provider saved to ${filePath}`));
  console.log(chalk.gray(`\nTo use: recoder --model ${config.id}/model-name\n`));
}

/**
 * Add provider (alias for configure)
 */
async function addProvider(providerId?: string) {
  if (!providerId) {
    console.log(chalk.yellow('\nUsage: /connect add <provider>\n'));
    return;
  }
  await configureProviderKey(providerId);
}
