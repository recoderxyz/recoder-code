/**
 * Logout Command - Clear stored credentials
 */

import * as vscode from 'vscode';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';

export function registerLogoutCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.auth.logout', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to logout? This will clear your stored API key.',
      'Logout',
      'Cancel'
    );

    if (confirm !== 'Logout') {
      return;
    }

    try {
      await authService.logout();
      vscode.window.showInformationMessage('Successfully logged out');

      // Refresh the auth status view
      vscode.commands.executeCommand('recoder.authStatus.refresh');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Logout failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
