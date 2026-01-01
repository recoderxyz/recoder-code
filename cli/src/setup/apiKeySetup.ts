/**
 * API Key Setup Wizard for First-Time Users
 * Helps users configure their OpenRouter API key
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import * as readline from 'node:readline';

const CONFIG_DIR = path.join(homedir(), '.recoder-code');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

export interface ApiKeyConfig {
  apiKey: string;
  baseUrl: string;
  provider: 'openrouter' | 'openai' | 'custom';
  defaultModel?: string;
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  // Check environment variables first
  if (process.env['OPENAI_API_KEY'] && process.env['OPENAI_BASE_URL']) {
    return true;
  }

  // Check config file
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    return content.includes('OPENAI_API_KEY') && content.includes('OPENAI_BASE_URL');
  }

  return false;
}

/**
 * Load API key configuration from file
 */
export function loadApiKeyConfig(): ApiKeyConfig | null {
  if (!fs.existsSync(ENV_FILE)) {
    return null;
  }

  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n');
  
  const config: Partial<ApiKeyConfig> = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    
    if (key === 'OPENAI_API_KEY') config.apiKey = value;
    if (key === 'OPENAI_BASE_URL') config.baseUrl = value;
    if (key === 'OPENAI_MODEL') config.defaultModel = value;
  }

  if (!config.apiKey || !config.baseUrl) {
    return null;
  }

  // Detect provider
  if (config.baseUrl.includes('openrouter')) {
    config.provider = 'openrouter';
  } else if (config.baseUrl.includes('api.openai.com')) {
    config.provider = 'openai';
  } else {
    config.provider = 'custom';
  }

  return config as ApiKeyConfig;
}

/**
 * Save API key configuration to file
 */
export function saveApiKeyConfig(config: ApiKeyConfig): void {
  // Create config directory if it doesn't exist
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const content = `# Recoder Code Configuration
# Generated on ${new Date().toISOString()}

# API Configuration
OPENAI_API_KEY="${config.apiKey}"
OPENAI_BASE_URL="${config.baseUrl}"
${config.defaultModel ? `OPENAI_MODEL="${config.defaultModel}"` : ''}

# Provider: ${config.provider}
# To get an OpenRouter API key, visit: https://openrouter.ai/keys
# To get an OpenAI API key, visit: https://platform.openai.com/api-keys
`;

  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 }); // Secure file permissions
  console.log(`\n✅ Configuration saved to: ${ENV_FILE}`);
}

/**
 * Interactive API key setup wizard
 */
export async function runApiKeySetup(): Promise<ApiKeyConfig | null> {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         🚀 Recoder Code - First Time Setup            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Welcome! Let\'s configure your AI API key.\n');
  console.log('Recoder Code works with multiple AI providers:\n');
  console.log('  1. OpenRouter  - Access 30+ models (Recommended)');
  console.log('  2. OpenAI      - GPT-4, GPT-4o, etc.');
  console.log('  3. Custom      - Any OpenAI-compatible API\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    // Select provider
    const providerChoice = await question('Select provider (1/2/3) [1]: ');
    const providerNum = providerChoice.trim() || '1';

    let provider: 'openrouter' | 'openai' | 'custom';
    let baseUrl: string;
    let signupUrl: string;

    if (providerNum === '1') {
      provider = 'openrouter';
      baseUrl = 'https://openrouter.ai/api/v1';
      signupUrl = 'https://openrouter.ai/keys';
      
      console.log('\n📝 OpenRouter Setup');
      console.log('   • Access 30+ AI models (DeepSeek, Claude, GPT-4, etc.)');
      console.log('   • Many free models available');
      console.log(`   • Get API key: ${signupUrl}\n`);
    } else if (providerNum === '2') {
      provider = 'openai';
      baseUrl = 'https://api.openai.com/v1';
      signupUrl = 'https://platform.openai.com/api-keys';
      
      console.log('\n📝 OpenAI Setup');
      console.log('   • Access GPT-4, GPT-4o, GPT-3.5');
      console.log('   • High quality responses');
      console.log(`   • Get API key: ${signupUrl}\n`);
    } else {
      provider = 'custom';
      console.log('\n📝 Custom API Setup');
      baseUrl = await question('Enter API base URL: ');
      signupUrl = '';
    }

    // Get API key
    const apiKey = await question('Enter your API key: ');
    
    if (!apiKey.trim()) {
      console.log('\n❌ API key is required. Setup cancelled.');
      rl.close();
      return null;
    }

    // Optional: Default model
    let defaultModel: string | undefined;
    if (provider === 'openrouter') {
      const setModel = await question('Set default model? (leave empty for auto) [google/gemini-2.0-flash-exp:free]: ');
      defaultModel = setModel.trim() || 'google/gemini-2.0-flash-exp:free';
    }

    const config: ApiKeyConfig = {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      provider,
      defaultModel,
    };

    // Save configuration
    saveApiKeyConfig(config);

    // Also export to current shell
    console.log('\n📋 To use in current shell, run:');
    console.log(`   export OPENAI_API_KEY="${config.apiKey}"`);
    console.log(`   export OPENAI_BASE_URL="${config.baseUrl}"`);
    if (config.defaultModel) {
      console.log(`   export OPENAI_MODEL="${config.defaultModel}"`);
    }

    console.log('\n✨ Setup complete! You can now use Recoder Code.\n');
    console.log('Try: recoder-code -p "hello world"\n');

    rl.close();
    return config;
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    rl.close();
    return null;
  }
}

/**
 * Load API key from config file into environment
 */
export function loadApiKeyToEnv(): boolean {
  const config = loadApiKeyConfig();
  if (!config) {
    return false;
  }

  process.env['OPENAI_API_KEY'] = config.apiKey;
  process.env['OPENAI_BASE_URL'] = config.baseUrl;
  if (config.defaultModel) {
    process.env['OPENAI_MODEL'] = config.defaultModel;
  }

  return true;
}

/**
 * Show setup prompt if API key is not configured
 */
export async function checkAndSetupApiKey(): Promise<boolean> {
  // First, try to load from config file
  if (loadApiKeyToEnv()) {
    return true;
  }

  // Check if already in environment
  if (isApiKeyConfigured()) {
    return true;
  }

  // Not configured - show setup wizard
  console.log('\n⚠️  API key not configured.\n');
  const proceed = await promptSetup();
  
  if (!proceed) {
    console.log('\nℹ️  You can configure your API key later by running:');
    console.log('   recoder-code --setup\n');
    return false;
  }

  const config = await runApiKeySetup();
  if (config) {
    // Load into environment for this session
    loadApiKeyToEnv();
    return true;
  }

  return false;
}

async function promptSetup(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Would you like to configure it now? (y/n) [y]: ', (answer) => {
      rl.close();
      const response = answer.trim().toLowerCase();
      resolve(response === '' || response === 'y' || response === 'yes');
    });
  });
}
