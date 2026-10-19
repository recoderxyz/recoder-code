/**
 * Interactive provider configuration command
 */

import inquirer from 'inquirer';
import { customProviderManager } from '../providers/custom-provider-manager.js';
import type { CustomProviderConfig, ProviderEngine } from '../providers/types.js';

export async function connectProvider(): Promise<void> {
  console.log('🔌 Add Custom Provider\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Provider ID (e.g., my-llm):',
      validate: (input: string) => input.length > 0 || 'ID is required',
    },
    {
      type: 'input',
      name: 'name',
      message: 'Provider Name:',
      validate: (input: string) => input.length > 0 || 'Name is required',
    },
    {
      type: 'list',
      name: 'engine',
      message: 'API Compatibility:',
      choices: [
        { name: 'OpenAI-compatible (LM Studio, vLLM, llama.cpp)', value: 'openai' },
        { name: 'Anthropic-compatible', value: 'anthropic' },
        { name: 'Ollama-compatible', value: 'ollama' },
        { name: 'Google Gemini-compatible', value: 'google' },
      ],
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      default: 'http://localhost:1234/v1',
      validate: (input: string) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Invalid URL';
        }
      },
    },
    {
      type: 'confirm',
      name: 'isLocal',
      message: 'Is this a local provider?',
      default: true,
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (leave empty for local):',
      default: '',
    },
  ]);

  const config: CustomProviderConfig = {
    id: answers.id,
    name: answers.name,
    engine: answers.engine as ProviderEngine,
    baseUrl: answers.baseUrl,
    isLocal: answers.isLocal,
    models: [],
    supportsStreaming: true,
  };

  if (answers.apiKey) {
    config.apiKeyEnv = `RECODER_${answers.id.toUpperCase().replace(/-/g, '_')}_API_KEY`;
    console.log(`\n💡 Set your API key: export ${config.apiKeyEnv}="${answers.apiKey}"`);
  }

  await customProviderManager.addProvider(config);

  console.log(`\n✅ Provider "${answers.name}" added successfully!`);
  console.log(`   Use it with: recoder --provider ${answers.id}`);

  // Test connection
  const provider = customProviderManager.get(answers.id);
  if (provider) {
    console.log('\n🔍 Testing connection...');
    const isConnected = await customProviderManager.testConnection(provider);
    if (isConnected) {
      console.log('✅ Connection successful!');
    } else {
      console.log('⚠️  Could not connect. Check your configuration.');
    }
  }
}
