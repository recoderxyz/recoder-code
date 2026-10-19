/**
 * Models command - Manage AI models across all providers
 */

import type { CommandModule, Argv } from 'yargs';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getOllamaProvider,
  getOpenRouterProvider,
  getAnthropicProvider,
  getOpenAIProvider,
  getGroqProvider,
  parseModelId,
} from '../providers/index.js';
import { selectModel } from './models/select.js';
import { compareModels } from './models/compare.js';
import { RecoderAuthService } from '../services/RecoderAuthService.js';

async function requireAuth(): Promise<void> {
  const authService = new RecoderAuthService();
  const session = await authService.getSession();
  if (!session) {
    console.error('❌ Please login first: recoder auth login');
    process.exit(1);
  }
}

const CONFIG_DIR = path.join(os.homedir(), '.recoder-code');
const CUSTOM_MODELS_FILE = path.join(CONFIG_DIR, 'custom-models.json');
const DEFAULT_MODEL_FILE = path.join(CONFIG_DIR, 'default-model.json');

interface CustomModel {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
}

function loadCustomModels(): CustomModel[] {
  try {
    if (fs.existsSync(CUSTOM_MODELS_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_MODELS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveCustomModels(models: CustomModel[]): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CUSTOM_MODELS_FILE, JSON.stringify(models, null, 2));
}

function getDefaultModel(): string | null {
  try {
    if (fs.existsSync(DEFAULT_MODEL_FILE)) {
      return JSON.parse(fs.readFileSync(DEFAULT_MODEL_FILE, 'utf-8')).model;
    }
  } catch {}
  return null;
}

function setDefaultModel(model: string): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(DEFAULT_MODEL_FILE, JSON.stringify({ model }, null, 2));
}

const listCommand: CommandModule<{}, { provider?: string }> = {
  command: 'list [provider]',
  describe: 'List all available models',
  builder: (yargs: Argv) =>
    yargs.positional('provider', {
      describe: 'Filter by provider (ollama, openrouter, anthropic, openai, groq)',
      type: 'string',
    }) as Argv<{ provider?: string }>,
  handler: async (argv) => {
    await requireAuth();
    console.log(chalk.bold.cyan('\n🤖 Available Models\n'));

    const defaultModel = getDefaultModel();
    if (defaultModel) {
      console.log(chalk.green(`Default: ${defaultModel}\n`));
    }

    const filter = argv.provider?.toLowerCase();

    // Ollama
    if (!filter || filter === 'ollama') {
      const ollama = getOllamaProvider();
      if (await ollama.isAvailable()) {
        console.log(chalk.yellow('Ollama (Local):'));
        const models = await ollama.getModels();
        models.forEach((m) => console.log(chalk.gray(`  • ollama/${m.name}`)));
        if (models.length === 0) console.log(chalk.gray('  No models installed'));
        console.log();
      }
    }

    // Anthropic
    if (!filter || filter === 'anthropic') {
      const anthropic = getAnthropicProvider();
      if (anthropic.isConfigured()) {
        console.log(chalk.yellow('Anthropic:'));
        anthropic.getModels().forEach((m) => console.log(chalk.gray(`  • anthropic/${m.id}`)));
        console.log();
      }
    }

    // OpenAI
    if (!filter || filter === 'openai') {
      const openai = getOpenAIProvider();
      if (openai.isConfigured()) {
        console.log(chalk.yellow('OpenAI:'));
        openai.getModels().forEach((m) => console.log(chalk.gray(`  • openai/${m.id}`)));
        console.log();
      }
    }

    // Groq
    if (!filter || filter === 'groq') {
      const groq = getGroqProvider();
      if (groq.isConfigured()) {
        console.log(chalk.yellow('Groq:'));
        groq.getModels().forEach((m) => console.log(chalk.gray(`  • groq/${m.id}`)));
        console.log();
      }
    }

    // OpenRouter (show count only)
    if (!filter || filter === 'openrouter') {
      const openrouter = getOpenRouterProvider();
      if (openrouter.isConfigured()) {
        const models = await openrouter.getModels();
        console.log(chalk.yellow(`OpenRouter: ${models.length} models`));
        console.log(chalk.gray('  Use: recoder providers models openrouter'));
        console.log();
      }
    }

    // Custom models
    const custom = loadCustomModels();
    if (custom.length > 0 && !filter) {
      console.log(chalk.yellow('Custom:'));
      custom.forEach((m) => console.log(chalk.gray(`  • ${m.id}`)));
      console.log();
    }

    console.log(chalk.cyan('💡 Usage: recoder --model <provider/model-id>'));
    console.log();
    process.exit(0);
  },
};

const addCommand: CommandModule<{}, { model: string; name?: string; provider?: string }> = {
  command: 'add <model>',
  describe: 'Add a custom model',
  builder: (yargs: Argv) =>
    yargs
      .positional('model', { describe: 'Model ID', type: 'string', demandOption: true })
      .option('name', { describe: 'Display name', type: 'string' })
      .option('provider', { describe: 'Provider', type: 'string' }) as Argv<{
      model: string;
      name?: string;
      provider?: string;
    }>,
  handler: async (argv) => {
    await requireAuth();
    const parsed = parseModelId(argv.model);
    const models = loadCustomModels();

    if (models.some((m) => m.id === argv.model)) {
      console.log(chalk.yellow(`\n⚠️  Model ${argv.model} already exists\n`));
      process.exit(1);
    }

    models.push({
      id: argv.model,
      name: argv.name || parsed.model,
      provider: argv.provider || parsed.provider,
    });

    saveCustomModels(models);
    console.log(chalk.green(`\n✓ Added ${argv.model}\n`));
    process.exit(0);
  },
};

const removeCommand: CommandModule<{}, { model: string }> = {
  command: 'remove <model>',
  describe: 'Remove a custom model',
  builder: (yargs: Argv) =>
    yargs.positional('model', { describe: 'Model ID', type: 'string', demandOption: true }) as Argv<{
      model: string;
    }>,
  handler: async (argv) => {
    await requireAuth();
    const models = loadCustomModels();
    const filtered = models.filter((m) => m.id !== argv.model);

    if (filtered.length === models.length) {
      console.log(chalk.yellow(`\n⚠️  Model ${argv.model} not found\n`));
      process.exit(1);
    }

    saveCustomModels(filtered);
    console.log(chalk.green(`\n✓ Removed ${argv.model}\n`));
    process.exit(0);
  },
};

const setDefaultCommand: CommandModule<{}, { model: string }> = {
  command: 'default <model>',
  describe: 'Set default model',
  builder: (yargs: Argv) =>
    yargs.positional('model', { describe: 'Model ID', type: 'string', demandOption: true }) as Argv<{
      model: string;
    }>,
  handler: async (argv) => {
    await requireAuth();
    setDefaultModel(argv.model);
    console.log(chalk.green(`\n✓ Default model set to ${argv.model}\n`));
    process.exit(0);
  },
};

const selectCommand: CommandModule = {
  command: 'select',
  describe: 'Interactive model selection with fuzzy search',
  handler: async () => {
    await requireAuth();
    await selectModel();
    process.exit(0);
  },
};

const compareCommand: CommandModule = {
  command: 'compare',
  describe: 'Compare multiple models side-by-side',
  handler: async () => {
    await requireAuth();
    await compareModels();
    process.exit(0);
  },
};

export const modelsCommand: CommandModule = {
  command: 'models',
  describe: 'Manage AI models',
  builder: (yargs: Argv) =>
    yargs
      .command(listCommand)
      .command(selectCommand)
      .command(compareCommand)
      .command(addCommand)
      .command(removeCommand)
      .command(setDefaultCommand)
      .demandCommand(0)
      .version(false),
  handler: async () => {
    // Default: list models
    await listCommand.handler!({ provider: undefined, _: [], $0: '' });
  },
};
