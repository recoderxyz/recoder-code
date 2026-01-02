/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import { IDEServer } from './ide-server.js';
import { DiffContentProvider, DiffManager } from './diff-manager.js';
import { createLogger } from './utils/logger.js';
import { RecoderAuthService } from './services/RecoderAuthService.js';
import { AuthStatusProvider } from './providers/AuthStatusProvider.js';
import { ModelBrowserProvider } from './providers/ModelBrowserProvider.js';
import { StatusBarProvider } from './providers/StatusBarProvider.js';
import { registerLoginCommand } from './commands/auth/loginCommand.js';
import { registerLogoutCommand } from './commands/auth/logoutCommand.js';
import { registerStatusCommand } from './commands/auth/statusCommand.js';
import { registerSetApiKeyCommand } from './commands/auth/setApiKeyCommand.js';
import { registerSelectModelCommand } from './commands/models/selectModelCommand.js';
import { registerCompareModelsCommand } from './commands/models/compareModelsCommand.js';
import { registerOpenChatCommand } from './commands/chat/openChatCommand.js';
import { registerCreditsCommand } from './commands/openrouter/creditsCommand.js';
import { registerEstimateCommand } from './commands/openrouter/estimateCommand.js';
import { registerActivityCommand } from './commands/openrouter/activityCommand.js';
import { UsageProvider } from './providers/UsageProvider.js';
import { explainCommand } from './commands/code/explainCommand.js';
import { refactorCommand } from './commands/code/refactorCommand.js';
import { addCommentsCommand } from './commands/code/addCommentsCommand.js';
import { generateTestsCommand } from './commands/code/generateTestsCommand.js';
import { ProviderService } from './services/ProviderService.js';
import { registerProviderCommands } from './commands/providers/providerCommands.js';
import { SettingsPanel } from './webviews/SettingsPanel.js';
import { RecoderCodeLensProvider } from './providers/CodeLensProvider.js';
import { registerCodeLensCommands } from './commands/codelens/codeLensCommands.js';
import { GhostProvider, registerGhostCommands } from './providers/GhostProvider.js';
import { 
  AuthStatusViewProvider, 
  ModelSelectorViewProvider, 
  ProvidersViewProvider, 
  ChatHistoryViewProvider, 
  QuickActionsViewProvider,
  registerSidebarCommands 
} from './views/SidebarProvider.js';

const INFO_MESSAGE_SHOWN_KEY = 'recoderCodeInfoMessageShown';
export const DIFF_SCHEME = 'recoder-diff';

let ideServer: IDEServer;
let logger: vscode.OutputChannel;

let log: (message: string) => void = () => {};

export async function activate(context: vscode.ExtensionContext) {
  logger = vscode.window.createOutputChannel('Recoder Code Companion');
  log = createLogger(context, logger);
  log('Extension activated');

  // Initialize services
  const authService = new RecoderAuthService(context);
  const providerService = new ProviderService(context);
  const authStatusProvider = new AuthStatusProvider(authService);
  const modelBrowserProvider = new ModelBrowserProvider(context, authService);
  const usageProvider = new UsageProvider(authService);
  const statusBarProvider = new StatusBarProvider(context, authService);

  // Register provider commands
  registerProviderCommands(context, providerService);

  // Register tree views
  vscode.window.registerTreeDataProvider('recoder.authStatus', authStatusProvider);
  vscode.window.registerTreeDataProvider('recoder.models', modelBrowserProvider);
  vscode.window.registerTreeDataProvider('recoder.usage', usageProvider);

  // Register CodeLens provider for supported languages
  const codeLensProvider = new RecoderCodeLensProvider();
  const codeLensLanguages = [
    'typescript', 'typescriptreact', 
    'javascript', 'javascriptreact',
    'python', 'java', 'csharp', 'go', 'rust', 'ruby', 'php',
    'c', 'cpp', 'swift', 'kotlin', 'scala'
  ];
  
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      codeLensLanguages.map(lang => ({ language: lang })),
      codeLensProvider
    )
  );
  log('CodeLens provider registered for languages: ' + codeLensLanguages.join(', '));

  // Register CodeLens commands
  context.subscriptions.push(...registerCodeLensCommands(context));
  log('CodeLens commands registered');

  // Register Ghost Provider (Inline Suggestions)
  const ghostProvider = new GhostProvider(providerService, authService, context);
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' }, // All files
      ghostProvider
    )
  );
  context.subscriptions.push(...registerGhostCommands(context, ghostProvider));
  log('Ghost provider (inline suggestions) registered');

  // Register enhanced sidebar views
  const sidebarAuthStatusView = new AuthStatusViewProvider(authService, context);
  const modelSelectorView = new ModelSelectorViewProvider(providerService, context);
  const providersView = new ProvidersViewProvider(providerService, context);
  const chatHistoryView = new ChatHistoryViewProvider(context, authService);
  const quickActionsView = new QuickActionsViewProvider();

  vscode.window.registerTreeDataProvider('recoder.sidebarAuth', sidebarAuthStatusView);
  vscode.window.registerTreeDataProvider('recoder.modelSelector', modelSelectorView);
  vscode.window.registerTreeDataProvider('recoder.providers', providersView);
  vscode.window.registerTreeDataProvider('recoder.chatHistory', chatHistoryView);
  vscode.window.registerTreeDataProvider('recoder.quickActions', quickActionsView);
  log('Enhanced sidebar views registered');

  // Register sidebar commands
  context.subscriptions.push(...registerSidebarCommands(context, providerService));
  
  // Register sidebar refresh commands
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.sidebarAuth.refresh', () => sidebarAuthStatusView.refresh()),
    vscode.commands.registerCommand('recoder.modelSelector.refresh', () => modelSelectorView.refresh()),
    vscode.commands.registerCommand('recoder.providers.refresh', () => providersView.refresh()),
    vscode.commands.registerCommand('recoder.chatHistory.refresh', () => chatHistoryView.refresh()),
    vscode.commands.registerCommand('recoder.chatHistory.syncNow', async () => {
      const syncService = chatHistoryView.getSyncService();
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Syncing chat history...' },
        async () => syncService.syncAll()
      );
      if (result.synced > 0 || result.failed > 0) {
        vscode.window.showInformationMessage(
          `Chat sync complete: ${result.synced} synced, ${result.failed} failed`
        );
      }
      chatHistoryView.refresh();
    }),
    vscode.commands.registerCommand('recoder.quickActions.refresh', () => quickActionsView.refresh())
  );
  log('Sidebar commands registered');

  // Register refresh commands
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.authStatus.refresh', () => {
      authStatusProvider.refresh();
      usageProvider.refresh();
      statusBarProvider.update();
    }),
    vscode.commands.registerCommand('recoder.models.refresh', () => {
      modelBrowserProvider.refresh();
      statusBarProvider.update();
    }),
    vscode.commands.registerCommand('recoder.usage.refresh', () => {
      usageProvider.refresh();
    })
  );

  // Register auth commands
  context.subscriptions.push(
    registerLoginCommand(context, authService),
    registerLogoutCommand(context, authService),
    registerStatusCommand(context, authService),
    registerSetApiKeyCommand(context, authService)
  );

  // Register model commands
  context.subscriptions.push(
    registerSelectModelCommand(context),
    registerCompareModelsCommand(context, authService),
    vscode.commands.registerCommand('recoder.models.browse', () => {
      vscode.commands.executeCommand('recoder.models.focus');
    })
  );

  // Register chat commands
  context.subscriptions.push(
    registerOpenChatCommand(context, authService)
  );

  // Register OpenRouter commands
  context.subscriptions.push(
    registerCreditsCommand(context, authService),
    registerEstimateCommand(context, authService),
    registerActivityCommand(context, authService)
  );

  // Register code action commands
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.code.explain', () => explainCommand(context, authService)),
    vscode.commands.registerCommand('recoder.code.refactor', () => refactorCommand(context, authService)),
    vscode.commands.registerCommand('recoder.code.addComments', () => addCommentsCommand(context, authService)),
    vscode.commands.registerCommand('recoder.code.generateTests', () => generateTestsCommand(context, authService))
  );

  // Register settings command
  context.subscriptions.push(
    vscode.commands.registerCommand('recoder.settings.open', () => {
      SettingsPanel.createOrShow(context);
    }),
    vscode.commands.registerCommand('recoder.diffTheme.configure', async () => {
      const { DiffThemeService } = await import('./services/DiffThemeService.js');
      const diffThemeService = new DiffThemeService(context);
      await diffThemeService.openThemeSettings();
    })
  );

  const diffContentProvider = new DiffContentProvider();
  const diffManager = new DiffManager(log, diffContentProvider, context);

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.scheme === DIFF_SCHEME) {
        diffManager.cancelDiff(doc.uri);
      }
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      DIFF_SCHEME,
      diffContentProvider,
    ),
    vscode.commands.registerCommand('recoder.diff.accept', (uri?: vscode.Uri) => {
      const docUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (docUri && docUri.scheme === DIFF_SCHEME) {
        diffManager.acceptDiff(docUri);
      }
    }),
    vscode.commands.registerCommand('recoder.diff.cancel', (uri?: vscode.Uri) => {
      const docUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (docUri && docUri.scheme === DIFF_SCHEME) {
        diffManager.cancelDiff(docUri);
      }
    }),
  );

  ideServer = new IDEServer(log, diffManager);
  try {
    await ideServer.start(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to start IDE server: ${message}`);
  }

  if (!context.globalState.get(INFO_MESSAGE_SHOWN_KEY)) {
    void vscode.window.showInformationMessage(
      'Recoder Code Companion extension successfully installed.',
    );
    context.globalState.update(INFO_MESSAGE_SHOWN_KEY, true);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      ideServer.updateWorkspacePath();
    }),
    vscode.commands.registerCommand('recoder-code.runRecoder', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showInformationMessage(
          'No folder open. Please open a folder to run Recoder Code.',
        );
        return;
      }

      let selectedFolder: vscode.WorkspaceFolder | undefined;
      if (workspaceFolders.length === 1) {
        selectedFolder = workspaceFolders[0];
      } else {
        selectedFolder = await vscode.window.showWorkspaceFolderPick({
          placeHolder: 'Select a folder to run Recoder Code in',
        });
      }

      if (selectedFolder) {
        const recoderCmd = 'recoder';
        const terminal = vscode.window.createTerminal({
          name: `Recoder Code (${selectedFolder.name})`,
          cwd: selectedFolder.uri.fsPath,
        });
        terminal.show();
        terminal.sendText(recoderCmd);
      }
    }),
    vscode.commands.registerCommand('recoder-code.showNotices', async () => {
      const noticePath = vscode.Uri.joinPath(
        context.extensionUri,
        'NOTICES.txt',
      );
      await vscode.window.showTextDocument(noticePath);
    }),
  );
}

export async function deactivate(): Promise<void> {
  log('Extension deactivated');
  try {
    if (ideServer) {
      await ideServer.stop();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to stop IDE server during deactivation: ${message}`);
  } finally {
    if (logger) {
      logger.dispose();
    }
  }
}
