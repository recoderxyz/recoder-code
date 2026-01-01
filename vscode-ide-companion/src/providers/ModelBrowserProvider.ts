/**
 * Model Browser Tree Provider
 * Shows available OpenRouter models in the sidebar
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../services/RecoderAuthService.js';
import { OpenRouterService, type ModelInfo } from '../services/OpenRouterService.js';

class ModelTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly modelId?: string,
    public readonly modelInfo?: ModelInfo
  ) {
    super(label, collapsibleState);

    if (modelId) {
      this.command = {
        command: 'recoder.models.select',
        title: 'Select Model',
        arguments: [modelId, modelInfo],
      };
      this.contextValue = 'model';
    }
  }
}

export class ModelBrowserProvider implements vscode.TreeDataProvider<ModelTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ModelTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private models: ModelInfo[] = [];
  private selectedModel: string | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: RecoderAuthService
  ) {
    this.selectedModel = context.globalState.get<string>('recoder.selectedModel');
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ModelTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ModelTreeItem): Promise<ModelTreeItem[]> {
    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      return [
        new ModelTreeItem(
          '⚠️ Not authenticated',
          vscode.TreeItemCollapsibleState.None
        ),
        new ModelTreeItem(
          'Run "Recoder Code: Login" to continue',
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }

    if (!element) {
      // Root level - show categories
      return [
        new ModelTreeItem('🔥 Featured', vscode.TreeItemCollapsibleState.Expanded),
        new ModelTreeItem('💰 Free Models', vscode.TreeItemCollapsibleState.Collapsed),
        new ModelTreeItem('⚡ Premium Models', vscode.TreeItemCollapsibleState.Collapsed),
        new ModelTreeItem('🔄 All Models', vscode.TreeItemCollapsibleState.Collapsed),
      ];
    }

    // Fetch models if not already loaded
    if (this.models.length === 0) {
      try {
        const apiKey = await this.authService.getOpenRouterApiKey();
        if (!apiKey) {
          return [
            new ModelTreeItem(
              '⚠️ No OpenRouter API key',
              vscode.TreeItemCollapsibleState.None
            ),
          ];
        }
        const service = new OpenRouterService(apiKey);
        this.models = await service.getModels();
      } catch (error) {
        return [
          new ModelTreeItem(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
    }

    // Filter models based on category
    let filteredModels: ModelInfo[] = [];

    if (element.label === '🔥 Featured') {
      filteredModels = this.models.filter((m) =>
        [
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'google/gemini-pro-1.5',
          'meta-llama/llama-3.1-70b-instruct',
          'qwen/qwen-2.5-coder-32b-instruct',
        ].some((id) => m.id.includes(id))
      );
    } else if (element.label === '💰 Free Models') {
      filteredModels = this.models.filter(
        (m) => m.id.includes(':free') || parseFloat(m.pricing.prompt) === 0
      );
    } else if (element.label === '⚡ Premium Models') {
      filteredModels = this.models.filter(
        (m) => !m.id.includes(':free') && parseFloat(m.pricing.prompt) > 0
      );
    } else if (element.label === '🔄 All Models') {
      filteredModels = this.models;
    }

    return filteredModels.slice(0, 20).map((model) => {
      const item = new ModelTreeItem(
        model.name || model.id,
        vscode.TreeItemCollapsibleState.None,
        model.id,
        model
      );

      const promptPrice = parseFloat(model.pricing.prompt);
      const isFree = promptPrice === 0 || model.id.includes(':free');
      const isSelected = model.id === this.selectedModel;

      item.description = isFree ? '🆓 Free' : `$${promptPrice.toFixed(6)}/1M tokens`;
      item.tooltip = [
        `Model: ${model.id}`,
        `Context: ${model.context_length.toLocaleString()} tokens`,
        `Prompt: $${model.pricing.prompt}/1M tokens`,
        `Completion: $${model.pricing.completion}/1M tokens`,
        model.description || '',
      ].join('\n');

      if (isSelected) {
        item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      } else if (isFree) {
        item.iconPath = new vscode.ThemeIcon('gift');
      } else {
        item.iconPath = new vscode.ThemeIcon('symbol-method');
      }

      return item;
    });
  }

  setSelectedModel(modelId: string): void {
    this.selectedModel = modelId;
    this.context.globalState.update('recoder.selectedModel', modelId);
    this.refresh();
  }
}
