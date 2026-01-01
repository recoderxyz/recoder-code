/**
 * Providers config command - Configure API keys
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const CONFIG_DIR = path.join(os.homedir(), '.recoder-code');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

export async function configureProvider(provider?: string) {
  if (!provider) {
    console.log(chalk.bold.cyan('\n⚙️  Provider Configuration\n'));
    console.log(chalk.yellow('Available providers:'));
    console.log(chalk.gray('  • openrouter - OpenRouter API (100+ models)'));
    console.log(chalk.gray('  • anthropic  - Anthropic Claude'));
    console.log(chalk.gray('  • openai     - OpenAI GPT'));
    console.log(chalk.gray('  • groq       - Groq (fast inference)'));
    console.log();
    console.log(chalk.cyan('Usage: recoder providers config <provider>'));
    console.log();
    return;
  }

  const envVars: Record<string, string> = {
    openrouter: 'OPENROUTER_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
  };

  const envVar = envVars[provider.toLowerCase()];
  if (!envVar) {
    console.log(chalk.red(`\n❌ Unknown provider: ${provider}`));
    console.log(chalk.gray('Valid: openrouter, anthropic, openai, groq\n'));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log(chalk.bold.cyan(`\n⚙️  Configure ${provider}\n`));

  const apiKey = await question(chalk.white(`Enter ${envVar}: `));
  rl.close();

  if (!apiKey.trim()) {
    console.log(chalk.yellow('\nNo key provided, skipping.\n'));
    return;
  }

  // Save to env file
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  // Update or add the key
  const regex = new RegExp(`^${envVar}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${envVar}=${apiKey.trim()}`);
  } else {
    envContent += `\n${envVar}=${apiKey.trim()}`;
  }

  fs.writeFileSync(ENV_FILE, envContent.trim() + '\n');

  console.log(chalk.green(`\n✓ Saved to ${ENV_FILE}`));
  console.log(chalk.gray(`  Add to shell: export ${envVar}="${apiKey.trim()}"`));
  console.log();
}
