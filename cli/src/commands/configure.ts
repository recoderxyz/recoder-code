/**
 * recoder configure - Interactive configuration wizard
 */

import type { CommandModule } from 'yargs';
import * as readline from 'readline';
import { getProviderRegistry } from '../providers/registry.js';
import { BUILTIN_PROVIDERS } from '../providers/types.js';

export const configureCommand: CommandModule = {
  command: 'configure',
  describe: 'Interactive configuration wizard',
  handler: async () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    const select = async (prompt: string, options: string[]): Promise<number> => {
      console.log(`\n${prompt}`);
      options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
      const answer = await ask('\nSelect (number): ');
      const idx = parseInt(answer, 10) - 1;
      return idx >= 0 && idx < options.length ? idx : 0;
    };

    try {
      console.log('\n🔧 Recoder Configuration\n');

      const mainOptions = [
        'Configure Providers',
        'Add Custom Provider',
        'Set Default Model',
        'Show Status',
        'Exit',
      ];

      const choice = await select('What would you like to configure?', mainOptions);

      const registry = getProviderRegistry();

      switch (choice) {
        case 0: {
          // Configure Providers
          console.log('\n📡 Provider Configuration\n');
          console.log('Set environment variables for cloud providers:\n');

          for (const p of BUILTIN_PROVIDERS.filter((p) => !p.isLocal && p.apiKeyEnv)) {
            const hasKey = !!process.env[p.apiKeyEnv!];
            console.log(`  ${hasKey ? '✓' : '✗'} ${p.name}: export ${p.apiKeyEnv}=your-key`);
          }

          console.log('\nLocal providers (auto-detected when running):');
          for (const p of BUILTIN_PROVIDERS.filter((p) => p.isLocal)) {
            const available = await registry.isProviderAvailable(p.id);
            console.log(`  ${available ? '✓' : '✗'} ${p.name} - ${p.baseUrl}`);
          }
          break;
        }

        case 1: {
          // Add Custom Provider
          console.log('\n➕ Add Custom Provider\n');

          const id = await ask('Provider ID (e.g., corporate): ');
          if (!id.trim()) {
            console.log('Cancelled.');
            break;
          }

          const engineIdx = await select('API Engine:', ['openai', 'anthropic', 'ollama', 'google']);
          const engines = ['openai', 'anthropic', 'ollama', 'google'] as const;
          const engine = engines[engineIdx];

          const baseUrl = await ask('Base URL (e.g., http://localhost:1234/v1): ');
          const apiKeyEnv = await ask('API Key env var (optional, press Enter to skip): ');

          const provider = {
            id: id.trim(),
            name: id.trim().charAt(0).toUpperCase() + id.trim().slice(1),
            engine,
            baseUrl: baseUrl.trim(),
            apiKeyEnv: apiKeyEnv.trim() || undefined,
            models: [],
            isLocal: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
          };

          registry.addCustomProvider(provider);
          registry.saveCustomProviderFile(provider);

          console.log(`\n✓ Added provider: ${provider.id}`);
          console.log(`  Config saved to: ~/.recoder-code/custom_providers/${provider.id}.json`);
          console.log(`  Use with: recoder --model ${provider.id}/<model-name>`);
          break;
        }

        case 2: {
          // Set Default Model
          console.log('\n🎯 Set Default Model\n');

          const available = await registry.getAvailableProviders();
          if (available.length === 0) {
            console.log('No providers available. Configure API keys first.');
            break;
          }

          const providerIdx = await select(
            'Select provider:',
            available.map((p) => `${p.name} (${p.id})`)
          );
          const provider = available[providerIdx];

          const models = await registry.getModels(provider.id);
          if (models.length === 0) {
            const modelId = await ask('Enter model name: ');
            if (modelId.trim()) {
              registry.setDefault(provider.id, `${provider.id}/${modelId.trim()}`);
              console.log(`\n✓ Default set to: ${provider.id}/${modelId.trim()}`);
            }
          } else {
            const modelIdx = await select(
              'Select model:',
              models.slice(0, 20).map((m) => m.id)
            );
            const model = models[modelIdx];
            registry.setDefault(provider.id, `${provider.id}/${model.id}`);
            console.log(`\n✓ Default set to: ${provider.id}/${model.id}`);
          }
          break;
        }

        case 3: {
          // Show Status
          console.log('\n📊 Status\n');

          const def = registry.getDefault();
          console.log(`Default model: ${def.model}\n`);

          const available = await registry.getAvailableProviders();
          console.log(`Available providers (${available.length}):`);
          for (const p of available) {
            const models = await registry.getModels(p.id);
            console.log(`  • ${p.name}: ${models.length} models`);
          }
          break;
        }

        default:
          console.log('Goodbye!');
      }
    } finally {
      rl.close();
    }

    process.exit(0);
  },
};
