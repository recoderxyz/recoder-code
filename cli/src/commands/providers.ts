/**
 * Providers command - Manage AI providers (Ollama, OpenRouter, etc.)
 */

import type { CommandModule, Argv } from 'yargs';
import { listProviders } from './providers/list.js';
import { listProviderModels } from './providers/models.js';
import { pullModel } from './providers/pull.js';
import { configureProvider } from './providers/config.js';

const listCommand: CommandModule = {
  command: 'list',
  describe: 'List all available providers',
  handler: async () => {
    await listProviders();
    process.exit(0);
  },
};

const modelsCommand: CommandModule<{}, { provider?: string }> = {
  command: 'models [provider]',
  describe: 'List models from all providers',
  builder: (yargs: Argv) =>
    yargs.positional('provider', {
      describe: 'Filter by provider (ollama, openrouter)',
      type: 'string',
    }) as Argv<{ provider?: string }>,
  handler: async (argv) => {
    await listProviderModels(argv.provider);
    process.exit(0);
  },
};

const pullCommand: CommandModule<{}, { model: string }> = {
  command: 'pull <model>',
  describe: 'Pull an Ollama model',
  builder: (yargs: Argv) =>
    yargs.positional('model', {
      describe: 'Model name (e.g., llama3.1:8b, qwen2.5-coder:7b)',
      type: 'string',
      demandOption: true,
    }) as Argv<{ model: string }>,
  handler: async (argv) => {
    await pullModel(argv.model);
    process.exit(0);
  },
};

const configCommand: CommandModule<{}, { provider?: string }> = {
  command: 'config [provider]',
  describe: 'Configure provider API keys',
  builder: (yargs: Argv) =>
    yargs.positional('provider', {
      describe: 'Provider to configure (openrouter, anthropic, openai, groq)',
      type: 'string',
    }) as Argv<{ provider?: string }>,
  handler: async (argv) => {
    await configureProvider(argv.provider);
    process.exit(0);
  },
};

export const providersCommand: CommandModule = {
  command: 'providers',
  describe: 'Manage AI providers (Ollama, OpenRouter, etc.)',
  builder: (yargs: Argv) =>
    yargs
      .command(listCommand)
      .command(modelsCommand)
      .command(pullCommand)
      .command(configCommand)
      .demandCommand(0)
      .version(false),
  handler: async () => {
    await listProviders();
    process.exit(0);
  },
};
