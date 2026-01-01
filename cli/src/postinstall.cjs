#!/usr/bin/env node

/**
 * Post-install script for Recoder Code
 * Shows setup instructions after package installation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.recoder-code');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

// Check if API key is already configured
function isConfigured() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL) {
    return true;
  }
  
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    return content.includes('OPENAI_API_KEY') && content.includes('OPENAI_BASE_URL');
  }
  
  return false;
}

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║       🚀 Recoder Code v2.4.1 Installed!              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

if (isConfigured()) {
  console.log('✅ API key is already configured!\n');
  console.log('Quick Start:');
  console.log('  recoder-code                  # Interactive mode');
  console.log('  recoder-code -p "hello"       # One-shot prompt');
  console.log('  recoder-code --list-models    # List AI models');
  console.log('  recoder-code /setup           # Reconfigure API\n');
} else {
  console.log('⚠️  First time setup required!\n');
  console.log('To get started, run one of these commands:\n');
  console.log('  recoder-code --setup          # Setup wizard (recommended)');
  console.log('  recoder-code                  # Will prompt for setup\n');
  console.log('You\'ll need an API key from:');
  console.log('  • OpenRouter: https://openrouter.ai/keys (free models available)');
  console.log('  • OpenAI: https://platform.openai.com/api-keys\n');
}

console.log('📚 Documentation:');
console.log('  API_KEY_SETUP_GUIDE.md        # Setup guide');
console.log('  QUICK_START.md                # Quick reference');
console.log('  GitHub: https://github.com/caelum0x/recoder-code\n');

console.log('💡 Inside the CLI:');
console.log('  /setup                        # Configure API keys');
console.log('  /help                         # Show all commands');
console.log('  /list-models                  # Browse AI models\n');
