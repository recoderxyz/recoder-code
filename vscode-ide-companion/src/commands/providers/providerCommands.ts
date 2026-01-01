/**
 * Provider Commands
 * Commands for managing AI providers
 */

import * as vscode from 'vscode';
import { ProviderService, BUILTIN_PROVIDERS } from '../../services/ProviderService.js';
import open from 'open';

export function registerProviderCommands(
  context: vscode.ExtensionContext,
  providerService: ProviderService
): void {
  // List all providers
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.providers.list', async () => {
      const items: vscode.QuickPickItem[] = [];

      // Local providers
      items.push({ label: 'Local Providers', kind: vscode.QuickPickItemKind.Separator });
      for (const provider of providerService.getLocalProviders()) {
        const status = await providerService.checkLocalProvider(provider);
        items.push({
          label: `$(${status.available ? 'check' : 'circle-outline'}) ${provider.name}`,
          description: status.available ? `Running (${status.latency}ms)` : 'Not running',
          detail: provider.description,
        });
      }

      // Cloud providers
      items.push({ label: 'Cloud Providers', kind: vscode.QuickPickItemKind.Separator });
      for (const provider of providerService.getCloudProviders()) {
        const hasKey = providerService.hasApiKey(provider);
        items.push({
          label: `$(${hasKey ? 'check' : 'key'}) ${provider.name}`,
          description: hasKey ? 'Configured' : 'API key needed',
          detail: provider.description,
        });
      }

      const selected = await vscode.window.showQuickPick(items, {
        title: 'AI Providers (12+)',
        placeHolder: 'Select a provider to configure',
      });

      if (selected && !selected.label.startsWith('$(check)')) {
        // Offer to configure
        const providerName = selected.label.replace(/^\$\([^)]+\)\s*/, '');
        const provider = BUILTIN_PROVIDERS.find(p => p.name === providerName);

        if (provider?.isLocal) {
          const action = await vscode.window.showInformationMessage(
            `${provider.name} is a local provider. Visit their website to install.`,
            'Open Website'
          );
          if (action === 'Open Website' && provider.website) {
            open(provider.website);
          }
        } else if (provider) {
          vscode.commands.executeCommand('recoder.providers.configure');
        }
      }
    })
  );

  // Detect local providers
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.providers.detectLocal', async () => {
      const statusMessage = vscode.window.setStatusBarMessage('$(sync~spin) Detecting local AI servers...');

      try {
        const results = await providerService.detectLocalProviders();
        const available = results.filter(r => r.available);

        statusMessage.dispose();

        if (available.length === 0) {
          const action = await vscode.window.showWarningMessage(
            'No local AI servers detected. Install Ollama or LM Studio to run AI locally.',
            'Install Ollama',
            'Install LM Studio'
          );

          if (action === 'Install Ollama') {
            open('https://ollama.ai');
          } else if (action === 'Install LM Studio') {
            open('https://lmstudio.ai');
          }
          return;
        }

        const items: vscode.QuickPickItem[] = [];
        for (const result of available) {
          items.push({
            label: `$(check) ${result.provider.name}`,
            description: result.models?.length ? `${result.models.length} models` : 'Running',
          });

          if (result.models) {
            for (const model of result.models.slice(0, 5)) {
              items.push({
                label: `    ${model.name}`,
                description: model.id,
              });
            }
            if (result.models.length > 5) {
              items.push({
                label: `    ... and ${result.models.length - 5} more`,
                description: '',
              });
            }
          }
        }

        vscode.window.showQuickPick(items, {
          title: 'Local AI Servers Detected',
          placeHolder: 'Select a model to use',
        });
      } catch (error) {
        statusMessage.dispose();
        vscode.window.showErrorMessage(`Failed to detect local AI: ${error}`);
      }
    })
  );

  // Configure provider API key
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.providers.configure', async () => {
      const cloudProviders = providerService.getCloudProviders();

      const items = cloudProviders.map(p => ({
        label: p.name,
        description: providerService.hasApiKey(p) ? 'Configured' : 'Not configured',
        detail: p.description,
        provider: p,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        title: 'Configure Provider API Key',
        placeHolder: 'Select a provider',
      });

      if (!selected) return;

      const provider = selected.provider;

      // Show where to get API key
      const getKeyAction = await vscode.window.showInformationMessage(
        `Get your ${provider.name} API key from their website.`,
        'Get API Key',
        'I have a key'
      );

      if (getKeyAction === 'Get API Key' && provider.website) {
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
        open(keyUrls[provider.id] || provider.website);
        return;
      }

      const apiKey = await vscode.window.showInputBox({
        title: `Enter ${provider.name} API Key`,
        prompt: `Enter your ${provider.apiKeyEnv} value`,
        password: true,
        placeHolder: 'sk-...',
      });

      if (!apiKey) return;

      await providerService.setApiKey(provider.id, apiKey);
      vscode.window.showInformationMessage(`${provider.name} API key saved!`);
    })
  );

  // Social links
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.openWebsite', () => {
      open('https://recoder.xyz');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.openTwitter', () => {
      open('https://twitter.com/recoderxyz');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.openGitHub', () => {
      open('https://github.com/recoderxyz/recoder-code');
    })
  );
}
