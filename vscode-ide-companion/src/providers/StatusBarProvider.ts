/**
 * Status Bar Provider
 * Shows selected model and usage info in status bar
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../services/RecoderAuthService.js';

export class StatusBarProvider {
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: RecoderAuthService
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'recoder.models.browse';
    this.update();
    this.statusBarItem.show();

    // Update when model changes
    context.subscriptions.push(this.statusBarItem);
  }

  async update(): Promise<void> {
    const selectedModel = this.context.globalState.get<string>('recoder.selectedModel');
    const isAuthenticated = await this.authService.isAuthenticated();

    if (!isAuthenticated) {
      this.statusBarItem.text = '$(circle-slash) Recoder: Not Logged In';
      this.statusBarItem.tooltip = 'Click to login';
      this.statusBarItem.command = 'recoder.auth.login';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (selectedModel) {
      // Extract model name (e.g., "anthropic/claude-3.5-sonnet" -> "claude-3.5-sonnet")
      const modelName = selectedModel.split('/').pop() || selectedModel;
      this.statusBarItem.text = `$(robot) ${modelName}`;
      this.statusBarItem.tooltip = `Active Model: ${selectedModel}\nClick to browse models`;
      this.statusBarItem.command = 'recoder.models.browse';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(robot) Recoder: Select Model';
      this.statusBarItem.tooltip = 'Click to select a model';
      this.statusBarItem.command = 'recoder.models.browse';
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
