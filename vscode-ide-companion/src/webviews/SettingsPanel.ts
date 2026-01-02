/**
 * Settings Panel WebView
 * Provides a comprehensive settings UI for Recoder Code configuration
 */

import * as vscode from 'vscode';

interface SettingsData {
  defaultProvider: string;
  defaultModel: string;
  enableInlineSuggestions: boolean;
  enableCodeLens: boolean;
  enableAutoCompletion: boolean;
  maxTokens: number;
  temperature: number;
  enableTelemetry: boolean;
  autoSaveChats: boolean;
  theme: string;
  diffTheme: string;
  diffCustomColors: Record<string, string>;
  apiKeys: Record<string, string>;
  customProviders: CustomProvider[];
  ollamaHost: string;
  lmStudioHost: string;
}

interface CustomProvider {
  name: string;
  baseURL: string;
  apiKey?: string;
  models: string[];
}

export class SettingsPanel {
  private static currentPanel: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext
  ) {
    this.panel = panel;

    // Set initial HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Send current settings to webview
    this.sendCurrentSettings();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'saveSettings':
            await this.saveSettings(message.settings);
            break;
          case 'resetSettings':
            await this.resetSettings();
            break;
          case 'testProvider':
            await this.testProvider(message.provider);
            break;
          case 'detectLocalProviders':
            await this.detectLocalProviders();
            break;
          case 'applyDiffTheme':
            await this.applyDiffTheme(message.theme);
            break;
          case 'resetDiffTheme':
            await this.resetDiffTheme();
            break;
          case 'exportSettings':
            await this.exportSettings();
            break;
          case 'importSettings':
            await this.importSettings();
            break;
        }
      },
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        SettingsPanel.currentPanel = undefined;
        this.disposables.forEach(d => d.dispose());
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    // If panel already exists, show it
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'recoderSettings',
      'Recoder Code Settings',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'assets')
        ]
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, context);
  }

  private async sendCurrentSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('recoderCode');
    const settings: SettingsData = {
      defaultProvider: config.get('defaultProvider', 'openrouter'),
      defaultModel: config.get('defaultModel', ''),
      enableInlineSuggestions: config.get('enableInlineSuggestions', false),
      enableCodeLens: config.get('enableCodeLens', true),
      enableAutoCompletion: config.get('enableAutoCompletion', true),
      maxTokens: config.get('maxTokens', 4096),
      temperature: config.get('temperature', 0.7),
      enableTelemetry: config.get('enableTelemetry', false),
      autoSaveChats: config.get('autoSaveChats', true),
      theme: config.get('theme', 'auto'),
      diffTheme: config.get('diffTheme', 'auto'),
      diffCustomColors: config.get('diffCustomColors', {}),
      apiKeys: config.get('apiKeys', {}),
      customProviders: config.get('customProviders', []),
      ollamaHost: config.get('ollamaHost', 'http://localhost:11434'),
      lmStudioHost: config.get('lmStudioHost', 'http://localhost:1234')
    };

    this.panel.webview.postMessage({
      type: 'currentSettings',
      settings
    });
  }

  private async saveSettings(settings: SettingsData): Promise<void> {
    const config = vscode.workspace.getConfiguration('recoderCode');
    
    try {
      await config.update('defaultProvider', settings.defaultProvider);
      await config.update('defaultModel', settings.defaultModel);
      await config.update('enableInlineSuggestions', settings.enableInlineSuggestions);
      await config.update('enableCodeLens', settings.enableCodeLens);
      await config.update('enableAutoCompletion', settings.enableAutoCompletion);
      await config.update('maxTokens', settings.maxTokens);
      await config.update('temperature', settings.temperature);
      await config.update('enableTelemetry', settings.enableTelemetry);
      await config.update('autoSaveChats', settings.autoSaveChats);
      await config.update('theme', settings.theme);
      await config.update('diffTheme', settings.diffTheme);
      await config.update('diffCustomColors', settings.diffCustomColors);
      await config.update('apiKeys', settings.apiKeys);
      await config.update('customProviders', settings.customProviders);
      await config.update('ollamaHost', settings.ollamaHost);
      await config.update('lmStudioHost', settings.lmStudioHost);

      this.panel.webview.postMessage({
        type: 'settingsSaved'
      });

      vscode.window.showInformationMessage('Settings saved successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save settings: ${error}`);
      this.panel.webview.postMessage({
        type: 'error',
        message: `Failed to save settings: ${error}`
      });
    }
  }

  private async resetSettings(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Are you sure you want to reset all settings to defaults?',
      'Reset',
      'Cancel'
    );

    if (choice === 'Reset') {
      const config = vscode.workspace.getConfiguration('recoderCode');
      
      // Reset all settings to default values
      await config.update('defaultProvider', undefined);
      await config.update('defaultModel', undefined);
      await config.update('enableInlineSuggestions', undefined);
      await config.update('enableCodeLens', undefined);
      await config.update('enableAutoCompletion', undefined);
      await config.update('maxTokens', undefined);
      await config.update('temperature', undefined);
      await config.update('enableTelemetry', undefined);
      await config.update('autoSaveChats', undefined);
      await config.update('theme', undefined);
      await config.update('apiKeys', undefined);
      await config.update('customProviders', undefined);
      await config.update('ollamaHost', undefined);
      await config.update('lmStudioHost', undefined);

      this.sendCurrentSettings();
      vscode.window.showInformationMessage('Settings reset to defaults!');
    }
  }

  private async testProvider(provider: { name: string; baseURL?: string; apiKey?: string }): Promise<void> {
    try {
      this.panel.webview.postMessage({
        type: 'testingProvider',
        provider: provider.name
      });

      // Use the provider service to test the connection
      const { ProviderService } = await import('../services/ProviderService.js');
      const { AIService } = await import('../services/AIService.js');
      
      const providerService = new ProviderService(this.context);
      const aiService = new AIService(providerService);

      // Temporarily update configuration for testing
      if (provider.apiKey) {
        const config = vscode.workspace.getConfiguration('recoderCode');
        const apiKeys = config.get<Record<string, string>>('apiKeys') || {};
        apiKeys[provider.name] = provider.apiKey;
        await config.update('apiKeys', apiKeys);
      }

      // Test the configuration
      const result = await aiService.testConfiguration();
      
      this.panel.webview.postMessage({
        type: 'providerTestResult',
        provider: provider.name,
        success: result.success,
        message: result.message + (result.latency ? ` (${result.latency}ms)` : '')
      });

    } catch (error) {
      this.panel.webview.postMessage({
        type: 'providerTestResult',
        provider: provider.name,
        success: false,
        message: `Connection failed: ${error}`
      });
    }
  }

  private getDefaultBaseURL(provider: string): string {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com';
      case 'groq': return 'https://api.groq.com/openai/v1';
      case 'deepseek': return 'https://api.deepseek.com/v1';
      case 'mistral': return 'https://api.mistral.ai/v1';
      case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
      case 'ollama': return 'http://localhost:11434';
      case 'lmstudio': return 'http://localhost:1234';
      default: return '';
    }
  }

  private async detectLocalProviders(): Promise<void> {
    try {
      const { ProviderService } = await import('../services/ProviderService.js');
      const providerService = new ProviderService(this.context);
      
      const detectedProviders = await providerService.detectLocalProviders();
      
      const formattedProviders = detectedProviders.map(result => ({
        name: result.provider.name,
        host: result.provider.baseUrl,
        status: result.available ? 'running' : 'not detected',
        models: result.models?.length || 0
      }));

      this.panel.webview.postMessage({
        type: 'localProvidersDetected',
        providers: formattedProviders
      });
    } catch (error) {
      this.panel.webview.postMessage({
        type: 'error',
        message: `Failed to detect local providers: ${error}`
      });
    }
  }

  private async exportSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('recoderCode');
    const settings = {
      defaultProvider: config.get('defaultProvider'),
      defaultModel: config.get('defaultModel'),
      enableInlineSuggestions: config.get('enableInlineSuggestions'),
      enableCodeLens: config.get('enableCodeLens'),
      enableAutoCompletion: config.get('enableAutoCompletion'),
      maxTokens: config.get('maxTokens'),
      temperature: config.get('temperature'),
      enableTelemetry: config.get('enableTelemetry'),
      autoSaveChats: config.get('autoSaveChats'),
      theme: config.get('theme'),
      customProviders: config.get('customProviders'),
      ollamaHost: config.get('ollamaHost'),
      lmStudioHost: config.get('lmStudioHost'),
      // Don't export API keys for security
    };

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('recoder-settings.json'),
      filters: {
        'JSON': ['json']
      }
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(settings, null, 2)));
      vscode.window.showInformationMessage('Settings exported successfully!');
    }
  }

  private async importSettings(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        'JSON': ['json']
      }
    });

    if (uri && uri[0]) {
      try {
        const content = await vscode.workspace.fs.readFile(uri[0]);
        const settings = JSON.parse(content.toString());
        
        const config = vscode.workspace.getConfiguration('recoderCode');
        
        // Import each setting
        for (const [key, value] of Object.entries(settings)) {
          if (value !== undefined) {
            await config.update(key, value);
          }
        }

        this.sendCurrentSettings();
        vscode.window.showInformationMessage('Settings imported successfully!');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import settings: ${error}`);
      }
    }
  }

  private async applyDiffTheme(themeName: string): Promise<void> {
    try {
      const { DiffThemeService } = await import('../services/DiffThemeService.js');
      const diffThemeService = new DiffThemeService(this.context);
      
      // Update the setting first
      const config = vscode.workspace.getConfiguration('recoderCode');
      await config.update('diffTheme', themeName);
      
      // Apply the theme
      await diffThemeService.applyCurrentTheme();
      
      this.panel.webview.postMessage({
        type: 'diffThemeApplied',
        theme: themeName
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply diff theme: ${error}`);
    }
  }

  private async resetDiffTheme(): Promise<void> {
    try {
      const { DiffThemeService } = await import('../services/DiffThemeService.js');
      const diffThemeService = new DiffThemeService(this.context);
      
      await diffThemeService.resetToDefault();
      
      // Reset setting to auto
      const config = vscode.workspace.getConfiguration('recoderCode');
      await config.update('diffTheme', 'auto');
      
      this.sendCurrentSettings();
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to reset diff theme: ${error}`);
    }
  }

  private getWebviewContent(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recoder Code Settings</title>
        <style>
            :root {
              --vscode-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              --border-radius: 6px;
              --spacing-xs: 4px;
              --spacing-sm: 8px;
              --spacing-md: 16px;
              --spacing-lg: 24px;
              --spacing-xl: 32px;
            }
            
            body {
              font-family: var(--vscode-font-family);
              padding: var(--spacing-lg);
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
              margin: 0;
              line-height: 1.5;
            }
            
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
            
            .header {
              margin-bottom: var(--spacing-xl);
              text-align: center;
            }
            
            .header h1 {
              margin: 0 0 var(--spacing-sm) 0;
              font-size: 28px;
              font-weight: 600;
            }
            
            .header p {
              margin: 0;
              color: var(--vscode-descriptionForeground);
              font-size: 16px;
            }
            
            .section {
              margin-bottom: var(--spacing-xl);
              padding: var(--spacing-lg);
              border: 1px solid var(--vscode-panel-border);
              border-radius: var(--border-radius);
              background-color: var(--vscode-panel-background);
            }
            
            .section-header {
              display: flex;
              align-items: center;
              margin-bottom: var(--spacing-md);
              padding-bottom: var(--spacing-sm);
              border-bottom: 1px solid var(--vscode-panel-border);
            }
            
            .section-header h2 {
              margin: 0;
              font-size: 18px;
              font-weight: 600;
            }
            
            .section-header .icon {
              margin-right: var(--spacing-sm);
              font-size: 20px;
            }
            
            .form-group {
              margin-bottom: var(--spacing-md);
            }
            
            .form-group:last-child {
              margin-bottom: 0;
            }
            
            label {
              display: block;
              margin-bottom: var(--spacing-xs);
              font-weight: 500;
              color: var(--vscode-foreground);
            }
            
            .description {
              font-size: 13px;
              color: var(--vscode-descriptionForeground);
              margin-bottom: var(--spacing-sm);
            }
            
            input, select, textarea {
              width: 100%;
              padding: var(--spacing-sm);
              border: 1px solid var(--vscode-input-border);
              border-radius: var(--border-radius);
              background-color: var(--vscode-input-background);
              color: var(--vscode-input-foreground);
              font-family: inherit;
              font-size: 14px;
              box-sizing: border-box;
            }
            
            input:focus, select:focus, textarea:focus {
              outline: none;
              border-color: var(--vscode-focusBorder);
            }
            
            .checkbox-group {
              display: flex;
              align-items: center;
              margin-bottom: var(--spacing-sm);
            }
            
            .checkbox-group input[type="checkbox"] {
              width: auto;
              margin-right: var(--spacing-sm);
            }
            
            .checkbox-group label {
              margin: 0;
              cursor: pointer;
              font-weight: normal;
            }
            
            .button-group {
              display: flex;
              gap: var(--spacing-sm);
              margin-top: var(--spacing-lg);
              justify-content: center;
              flex-wrap: wrap;
            }
            
            button {
              padding: var(--spacing-sm) var(--spacing-md);
              border: 1px solid var(--vscode-button-border);
              border-radius: var(--border-radius);
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              cursor: pointer;
              font-family: inherit;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            }
            
            button:hover {
              background-color: var(--vscode-button-hoverBackground);
            }
            
            .button-primary {
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
            }
            
            .button-secondary {
              background-color: var(--vscode-button-secondaryBackground);
              color: var(--vscode-button-secondaryForeground);
            }
            
            .button-danger {
              background-color: var(--vscode-errorForeground);
              color: var(--vscode-editor-background);
            }
            
            .provider-test {
              display: flex;
              align-items: center;
              gap: var(--spacing-sm);
              margin-top: var(--spacing-sm);
            }
            
            .provider-test button {
              padding: var(--spacing-xs) var(--spacing-sm);
              font-size: 12px;
            }
            
            .status-indicator {
              padding: var(--spacing-xs) var(--spacing-sm);
              border-radius: var(--border-radius);
              font-size: 12px;
              font-weight: 500;
            }
            
            .status-success {
              background-color: var(--vscode-testing-iconPassed);
              color: var(--vscode-editor-background);
            }
            
            .status-error {
              background-color: var(--vscode-testing-iconFailed);
              color: var(--vscode-editor-background);
            }
            
            .status-testing {
              background-color: var(--vscode-testing-iconQueued);
              color: var(--vscode-editor-background);
            }
            
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: var(--spacing-md);
            }
            
            @media (max-width: 600px) {
              .grid {
                grid-template-columns: 1fr;
              }
              
              .button-group {
                flex-direction: column;
              }
            }
            
            .custom-provider {
              border: 1px solid var(--vscode-panel-border);
              border-radius: var(--border-radius);
              padding: var(--spacing-md);
              margin-bottom: var(--spacing-md);
              background-color: var(--vscode-editor-background);
            }
            
            .custom-provider-header {
              display: flex;
              justify-content: between;
              align-items: center;
              margin-bottom: var(--spacing-sm);
            }
            
            .remove-provider {
              background-color: var(--vscode-errorForeground);
              color: white;
              border: none;
              padding: var(--spacing-xs);
              border-radius: var(--border-radius);
              cursor: pointer;
              font-size: 12px;
            }
            
            .notification {
              padding: var(--spacing-md);
              border-radius: var(--border-radius);
              margin-bottom: var(--spacing-md);
              border: 1px solid;
            }
            
            .notification-success {
              background-color: var(--vscode-inputValidation-infoBackground);
              border-color: var(--vscode-inputValidation-infoBorder);
              color: var(--vscode-inputValidation-infoForeground);
            }
            
            .notification-error {
              background-color: var(--vscode-inputValidation-errorBackground);
              border-color: var(--vscode-inputValidation-errorBorder);
              color: var(--vscode-inputValidation-errorForeground);
            }
            
            .hidden {
              display: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Recoder Code Settings</h1>
                <p>Configure your AI-powered coding assistant</p>
            </div>
            
            <div id="notifications"></div>
            
            <!-- AI Provider Settings -->
            <div class="section">
                <div class="section-header">
                    <span class="icon">🤖</span>
                    <h2>AI Provider Settings</h2>
                </div>
                
                <div class="grid">
                    <div class="form-group">
                        <label for="defaultProvider">Default Provider</label>
                        <div class="description">Choose your preferred AI provider</div>
                        <select id="defaultProvider">
                            <option value="openrouter">OpenRouter (350+ models, free tier)</option>
                            <option value="openai">OpenAI (GPT-4, requires API key)</option>
                            <option value="anthropic">Anthropic (Claude 3.5, requires API key)</option>
                            <option value="groq">Groq (Fast inference, free tier)</option>
                            <option value="ollama">Ollama (Local AI)</option>
                            <option value="deepseek">DeepSeek (DeepSeek V3, free tier)</option>
                            <option value="mistral">Mistral (Mistral models, free tier)</option>
                            <option value="google">Google (Gemini Pro, free tier)</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="defaultModel">Default Model</label>
                        <div class="description">Specific model to use (optional)</div>
                        <input type="text" id="defaultModel" placeholder="e.g., gpt-4o, claude-3-5-sonnet">
                    </div>
                </div>
            </div>
            
            <!-- Feature Settings -->
            <div class="section">
                <div class="section-header">
                    <span class="icon">⚡</span>
                    <h2>Features</h2>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="enableInlineSuggestions">
                    <label for="enableInlineSuggestions">Enable Inline Suggestions (Experimental)</label>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="enableCodeLens">
                    <label for="enableCodeLens">Show Code Lens Actions</label>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="enableAutoCompletion">
                    <label for="enableAutoCompletion">Enable AI Auto-Completion</label>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="autoSaveChats">
                    <label for="autoSaveChats">Auto-save Chat Conversations</label>
                </div>
            </div>
            
            <!-- AI Behavior Settings -->
            <div class="section">
                <div class="section-header">
                    <span class="icon">🎛️</span>
                    <h2>AI Behavior</h2>
                </div>
                
                <div class="grid">
                    <div class="form-group">
                        <label for="maxTokens">Max Tokens</label>
                        <div class="description">Maximum length of AI responses</div>
                        <input type="number" id="maxTokens" min="256" max="32768" step="256">
                    </div>
                    
                    <div class="form-group">
                        <label for="temperature">Temperature</label>
                        <div class="description">Creativity level (0 = deterministic, 2 = very creative)</div>
                        <input type="number" id="temperature" min="0" max="2" step="0.1">
                    </div>
                </div>
            </div>
            
            <!-- Local AI Settings -->
            <div class="section">
                <div class="section-header">
                    <span class="icon">🏠</span>
                    <h2>Local AI Settings</h2>
                </div>
                
                <div class="grid">
                    <div class="form-group">
                        <label for="ollamaHost">Ollama Host</label>
                        <div class="description">URL for your Ollama server</div>
                        <input type="text" id="ollamaHost" placeholder="http://localhost:11434">
                        <div class="provider-test">
                            <button onclick="testProvider('ollama')">Test Connection</button>
                            <div id="ollama-status"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="lmStudioHost">LM Studio Host</label>
                        <div class="description">URL for your LM Studio server</div>
                        <input type="text" id="lmStudioHost" placeholder="http://localhost:1234">
                        <div class="provider-test">
                            <button onclick="testProvider('lmstudio')">Test Connection</button>
                            <div id="lmstudio-status"></div>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <button onclick="detectLocalProviders()" class="button-secondary">
                        🔍 Detect Local AI Servers
                    </button>
                    <div id="local-providers-result" style="margin-top: 12px;"></div>
                </div>
            </div>
            
            <!-- API Keys -->
            <div class="section">
                <div class="section-header">
                    <span class="icon">🔐</span>
                    <h2>API Keys</h2>
                </div>
                
                <div class="description">API keys are stored securely in VS Code's secret storage</div>
                
                <div class="grid">
                    <div class="form-group">
                        <label for="openaiKey">OpenAI API Key</label>
                        <input type="password" id="openaiKey" placeholder="sk-...">
                        <div class="provider-test">
                            <button onclick="testProvider('openai')">Test Key</button>
                            <div id="openai-status"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="anthropicKey">Anthropic API Key</label>
                        <input type="password" id="anthropicKey" placeholder="sk-ant-...">
                        <div class="provider-test">
                            <button onclick="testProvider('anthropic')">Test Key</button>
                            <div id="anthropic-status"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="groqKey">Groq API Key</label>
                        <input type="password" id="groqKey" placeholder="gsk_...">
                        <div class="provider-test">
                            <button onclick="testProvider('groq')">Test Key</button>
                            <div id="groq-status"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="deepseekKey">DeepSeek API Key</label>
                        <input type="password" id="deepseekKey" placeholder="sk-...">
                        <div class="provider-test">
                            <button onclick="testProvider('deepseek')">Test Key</button>
                            <div id="deepseek-status"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="mistralKey">Mistral API Key</label>
                        <input type="password" id="mistralKey" placeholder="...">
                        <div class="provider-test">
                            <button onclick="testProvider('mistral')">Test Key</button>
                            <div id="mistral-status"></div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="googleKey">Google AI API Key</label>
                        <input type="password" id="googleKey" placeholder="AI...">
                        <div class="provider-test">
                            <button onclick="testProvider('google')">Test Key</button>
                            <div id="google-status"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Appearance Settings -->
            <div class="section">
                <div class="section-header">
                    <span class="icon">🎨</span>
                    <h2>Appearance</h2>
                </div>
                
                <div class="grid">
                    <div class="form-group">
                        <label for="theme">Theme</label>
                        <div class="description">Theme for Recoder Code UI components</div>
                        <select id="theme">
                            <option value="auto">Auto (Follow VS Code)</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="high-contrast">High Contrast</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="diffTheme">Diff Theme</label>
                        <div class="description">Custom theme for diff view styling</div>
                        <select id="diffTheme" onchange="onDiffThemeChange()">
                            <option value="auto">Auto (Follow VS Code)</option>
                            <option value="github">GitHub Style</option>
                            <option value="monokai">Monokai Pro</option>
                            <option value="solarized">Solarized</option>
                            <option value="dracula">Dracula</option>
                            <option value="nord">Nord</option>
                            <option value="custom">Custom Colors</option>
                        </select>
                        <div style="margin-top: 8px;">
                            <button onclick="applyDiffTheme()" class="button-secondary" style="margin-right: 8px;">🎨 Apply Theme</button>
                            <button onclick="resetDiffTheme()" class="button-secondary">🔄 Reset to Default</button>
                        </div>
                    </div>
                </div>
                
                <!-- Custom Diff Colors -->
                <div id="customDiffColors" class="hidden" style="margin-top: 16px;">
                    <h3 style="margin-bottom: 12px;">Custom Diff Colors</h3>
                    <div class="grid">
                        <div class="form-group">
                            <label for="addedBackground">Added Background</label>
                            <input type="color" id="addedBackground" value="#1e5f2e">
                        </div>
                        <div class="form-group">
                            <label for="addedForeground">Added Text</label>
                            <input type="color" id="addedForeground" value="#ffffff">
                        </div>
                        <div class="form-group">
                            <label for="removedBackground">Removed Background</label>
                            <input type="color" id="removedBackground" value="#5f1e1e">
                        </div>
                        <div class="form-group">
                            <label for="removedForeground">Removed Text</label>
                            <input type="color" id="removedForeground" value="#ffffff">
                        </div>
                        <div class="form-group">
                            <label for="modifiedBackground">Modified Background</label>
                            <input type="color" id="modifiedBackground" value="#2e4d5f">
                        </div>
                        <div class="form-group">
                            <label for="modifiedForeground">Modified Text</label>
                            <input type="color" id="modifiedForeground" value="#ffffff">
                        </div>
                    </div>
                    
                    <!-- Diff Preview -->
                    <div style="margin-top: 16px;">
                        <h4>Preview</h4>
                        <div id="diffPreview" class="diff-container" style="font-family: 'Courier New', monospace; font-size: 14px; border: 1px solid #666; border-radius: 6px; overflow: hidden;">
                            <div class="diff-line-added" style="padding: 4px 8px;">+ Added line example</div>
                            <div class="diff-line-removed" style="padding: 4px 8px;">- Removed line example</div>
                            <div class="diff-line-modified" style="padding: 4px 8px;">~ Modified line example</div>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="enableTelemetry">
                        <label for="enableTelemetry">Enable Anonymous Analytics</label>
                    </div>
                    <div class="description">Help improve Recoder Code with anonymous usage data</div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="button-group">
                <button onclick="saveSettings()" class="button-primary">💾 Save Settings</button>
                <button onclick="resetSettings()" class="button-danger">🔄 Reset to Defaults</button>
                <button onclick="exportSettings()" class="button-secondary">📤 Export Settings</button>
                <button onclick="importSettings()" class="button-secondary">📥 Import Settings</button>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            let currentSettings = {};
            
            // Listen for messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.type) {
                    case 'currentSettings':
                        currentSettings = message.settings;
                        loadSettings(message.settings);
                        break;
                    case 'settingsSaved':
                        showNotification('Settings saved successfully!', 'success');
                        break;
                    case 'providerTestResult':
                        showProviderTestResult(message.provider, message.success, message.message);
                        break;
                    case 'testingProvider':
                        showProviderTesting(message.provider);
                        break;
                    case 'localProvidersDetected':
                        showLocalProvidersResult(message.providers);
                        break;
                    case 'error':
                        showNotification(message.message, 'error');
                        break;
                }
            });
            
            function loadSettings(settings) {
                document.getElementById('defaultProvider').value = settings.defaultProvider || 'openrouter';
                document.getElementById('defaultModel').value = settings.defaultModel || '';
                document.getElementById('enableInlineSuggestions').checked = settings.enableInlineSuggestions || false;
                document.getElementById('enableCodeLens').checked = settings.enableCodeLens ?? true;
                document.getElementById('enableAutoCompletion').checked = settings.enableAutoCompletion ?? true;
                document.getElementById('maxTokens').value = settings.maxTokens || 4096;
                document.getElementById('temperature').value = settings.temperature ?? 0.7;
                document.getElementById('enableTelemetry').checked = settings.enableTelemetry || false;
                document.getElementById('autoSaveChats').checked = settings.autoSaveChats ?? true;
                document.getElementById('theme').value = settings.theme || 'auto';
                document.getElementById('diffTheme').value = settings.diffTheme || 'auto';
                document.getElementById('ollamaHost').value = settings.ollamaHost || 'http://localhost:11434';
                document.getElementById('lmStudioHost').value = settings.lmStudioHost || 'http://localhost:1234';
                
                // Load API keys
                const apiKeys = settings.apiKeys || {};
                document.getElementById('openaiKey').value = apiKeys.openai || '';
                document.getElementById('anthropicKey').value = apiKeys.anthropic || '';
                document.getElementById('groqKey').value = apiKeys.groq || '';
                document.getElementById('deepseekKey').value = apiKeys.deepseek || '';
                document.getElementById('mistralKey').value = apiKeys.mistral || '';
                document.getElementById('googleKey').value = apiKeys.google || '';
                
                // Load custom diff colors
                const customColors = settings.diffCustomColors || {};
                document.getElementById('addedBackground').value = customColors.addedBackground || '#1e5f2e';
                document.getElementById('addedForeground').value = customColors.addedForeground || '#ffffff';
                document.getElementById('removedBackground').value = customColors.removedBackground || '#5f1e1e';
                document.getElementById('removedForeground').value = customColors.removedForeground || '#ffffff';
                document.getElementById('modifiedBackground').value = customColors.modifiedBackground || '#2e4d5f';
                document.getElementById('modifiedForeground').value = customColors.modifiedForeground || '#ffffff';
                
                // Show/hide custom colors based on theme
                onDiffThemeChange();
                updateDiffPreview();
            }
            
            function gatherSettings() {
                return {
                    defaultProvider: document.getElementById('defaultProvider').value,
                    defaultModel: document.getElementById('defaultModel').value,
                    enableInlineSuggestions: document.getElementById('enableInlineSuggestions').checked,
                    enableCodeLens: document.getElementById('enableCodeLens').checked,
                    enableAutoCompletion: document.getElementById('enableAutoCompletion').checked,
                    maxTokens: parseInt(document.getElementById('maxTokens').value),
                    temperature: parseFloat(document.getElementById('temperature').value),
                    enableTelemetry: document.getElementById('enableTelemetry').checked,
                    autoSaveChats: document.getElementById('autoSaveChats').checked,
                    theme: document.getElementById('theme').value,
                    diffTheme: document.getElementById('diffTheme').value,
                    diffCustomColors: {
                        addedBackground: document.getElementById('addedBackground').value,
                        addedForeground: document.getElementById('addedForeground').value,
                        removedBackground: document.getElementById('removedBackground').value,
                        removedForeground: document.getElementById('removedForeground').value,
                        modifiedBackground: document.getElementById('modifiedBackground').value,
                        modifiedForeground: document.getElementById('modifiedForeground').value
                    },
                    ollamaHost: document.getElementById('ollamaHost').value,
                    lmStudioHost: document.getElementById('lmStudioHost').value,
                    apiKeys: {
                        openai: document.getElementById('openaiKey').value,
                        anthropic: document.getElementById('anthropicKey').value,
                        groq: document.getElementById('groqKey').value,
                        deepseek: document.getElementById('deepseekKey').value,
                        mistral: document.getElementById('mistralKey').value,
                        google: document.getElementById('googleKey').value
                    },
                    customProviders: [] // TODO: Implement custom providers UI
                };
            }
            
            function saveSettings() {
                const settings = gatherSettings();
                vscode.postMessage({
                    type: 'saveSettings',
                    settings: settings
                });
            }
            
            function resetSettings() {
                vscode.postMessage({
                    type: 'resetSettings'
                });
            }
            
            function testProvider(provider) {
                const settings = gatherSettings();
                const providerData = {
                    name: provider,
                    apiKey: settings.apiKeys[provider],
                    baseURL: provider === 'ollama' ? settings.ollamaHost : 
                            provider === 'lmstudio' ? settings.lmStudioHost : undefined
                };
                
                vscode.postMessage({
                    type: 'testProvider',
                    provider: providerData
                });
            }
            
            function detectLocalProviders() {
                vscode.postMessage({
                    type: 'detectLocalProviders'
                });
            }
            
            function exportSettings() {
                vscode.postMessage({
                    type: 'exportSettings'
                });
            }
            
            function importSettings() {
                vscode.postMessage({
                    type: 'importSettings'
                });
            }
            
            function showNotification(message, type) {
                const notifications = document.getElementById('notifications');
                const notification = document.createElement('div');
                notification.className = \`notification notification-\${type}\`;
                notification.textContent = message;
                notifications.appendChild(notification);
                
                setTimeout(() => {
                    notification.remove();
                }, 5000);
            }
            
            function showProviderTestResult(provider, success, message) {
                const statusEl = document.getElementById(\`\${provider}-status\`);
                statusEl.innerHTML = \`
                    <div class="status-indicator status-\${success ? 'success' : 'error'}">
                        \${success ? '✅' : '❌'} \${message}
                    </div>
                \`;
            }
            
            function showProviderTesting(provider) {
                const statusEl = document.getElementById(\`\${provider}-status\`);
                statusEl.innerHTML = \`
                    <div class="status-indicator status-testing">
                        ⏳ Testing...
                    </div>
                \`;
            }
            
            function showLocalProvidersResult(providers) {
                const resultEl = document.getElementById('local-providers-result');
                resultEl.innerHTML = \`
                    <div style="border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 12px; background-color: var(--vscode-editor-background);">
                        <h4 style="margin: 0 0 8px 0;">🔍 Local AI Detection Results</h4>
                        \${providers.map(p => \`
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span><strong>\${p.name}</strong> (\${p.host})</span>
                                <span class="status-indicator status-\${p.status === 'running' ? 'success' : 'error'}">
                                    \${p.status === 'running' ? '✅ Running' : '❌ Not detected'}
                                </span>
                            </div>
                        \`).join('')}
                    </div>
                \`;
            }
            
            // Diff Theme Functions
            function onDiffThemeChange() {
                const themeSelect = document.getElementById('diffTheme');
                const customColorsDiv = document.getElementById('customDiffColors');
                
                if (themeSelect.value === 'custom') {
                    customColorsDiv.classList.remove('hidden');
                } else {
                    customColorsDiv.classList.add('hidden');
                }
            }
            
            function updateDiffPreview() {
                const preview = document.getElementById('diffPreview');
                if (!preview) return;
                
                const addedBg = document.getElementById('addedBackground').value;
                const addedFg = document.getElementById('addedForeground').value;
                const removedBg = document.getElementById('removedBackground').value;
                const removedFg = document.getElementById('removedForeground').value;
                const modifiedBg = document.getElementById('modifiedBackground').value;
                const modifiedFg = document.getElementById('modifiedForeground').value;
                
                const addedLine = preview.querySelector('.diff-line-added');
                const removedLine = preview.querySelector('.diff-line-removed');
                const modifiedLine = preview.querySelector('.diff-line-modified');
                
                if (addedLine) {
                    addedLine.style.backgroundColor = addedBg;
                    addedLine.style.color = addedFg;
                }
                if (removedLine) {
                    removedLine.style.backgroundColor = removedBg;
                    removedLine.style.color = removedFg;
                }
                if (modifiedLine) {
                    modifiedLine.style.backgroundColor = modifiedBg;
                    modifiedLine.style.color = modifiedFg;
                }
            }
            
            function applyDiffTheme() {
                const themeName = document.getElementById('diffTheme').value;
                vscode.postMessage({
                    type: 'applyDiffTheme',
                    theme: themeName
                });
            }
            
            function resetDiffTheme() {
                vscode.postMessage({
                    type: 'resetDiffTheme'
                });
            }
            
            // Add event listeners for color inputs
            document.addEventListener('DOMContentLoaded', function() {
                const colorInputs = ['addedBackground', 'addedForeground', 'removedBackground', 'removedForeground', 'modifiedBackground', 'modifiedForeground'];
                colorInputs.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.addEventListener('input', updateDiffPreview);
                    }
                });
            });
        </script>
    </body>
    </html>
    `;
  }
}
