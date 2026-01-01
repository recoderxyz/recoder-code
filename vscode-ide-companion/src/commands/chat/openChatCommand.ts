/**
 * Open Chat Command
 */

import * as vscode from 'vscode';
import { ChatPanel } from '../../webviews/ChatPanel.js';
import type { RecoderAuthService } from '../../services/RecoderAuthService.js';

export function registerOpenChatCommand(
  context: vscode.ExtensionContext,
  authService: RecoderAuthService
): vscode.Disposable {
  return vscode.commands.registerCommand('recoder.chat.open', () => {
    ChatPanel.createOrShow(context, authService);
  });
}
