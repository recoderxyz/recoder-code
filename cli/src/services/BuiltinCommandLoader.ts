/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICommandLoader } from './types.js';
import type { SlashCommand } from '../ui/commands/types.js';
import type { Config } from 'recoder-code-core';
import { aboutCommand } from '../ui/commands/aboutCommand.js';
import { addModelCommand } from '../ui/commands/addModelCommand.js';
import { agentsCommand } from '../ui/commands/agentsCommand.js';
import { approvalModeCommand } from '../ui/commands/approvalModeCommand.js';
import { authCommand } from '../ui/commands/authCommand.js';
import { browseModelsCommand } from '../ui/commands/browseModelsCommand.js';
import { bugCommand } from '../ui/commands/bugCommand.js';
import { chatCommand } from '../ui/commands/chatCommand.js';
import { clearCommand } from '../ui/commands/clearCommand.js';
import { compressCommand } from '../ui/commands/compressCommand.js';
import { copyCommand } from '../ui/commands/copyCommand.js';
import { corgiCommand } from '../ui/commands/corgiCommand.js';
import { docsCommand } from '../ui/commands/docsCommand.js';
import { directoryCommand } from '../ui/commands/directoryCommand.js';
import { editorCommand } from '../ui/commands/editorCommand.js';
import { extensionsCommand } from '../ui/commands/extensionsCommand.js';
import { helpCommand } from '../ui/commands/helpCommand.js';
import { ideCommand } from '../ui/commands/ideCommand.js';
import { initCommand } from '../ui/commands/initCommand.js';
import { mcpCommand } from '../ui/commands/mcpCommand.js';
import { memoryCommand } from '../ui/commands/memoryCommand.js';
import { modelCommand } from '../ui/commands/modelCommand.js';
import { privacyCommand } from '../ui/commands/privacyCommand.js';
import { quitCommand, quitConfirmCommand } from '../ui/commands/quitCommand.js';
import { restoreCommand } from '../ui/commands/restoreCommand.js';
import { settingsCommand } from '../ui/commands/settingsCommand.js';
import { statsCommand } from '../ui/commands/statsCommand.js';
import { summaryCommand } from '../ui/commands/summaryCommand.js';
import { terminalSetupCommand } from '../ui/commands/terminalSetupCommand.js';
import { themeCommand } from '../ui/commands/themeCommand.js';
import { toolsCommand } from '../ui/commands/toolsCommand.js';
import { vimCommand } from '../ui/commands/vimCommand.js';
import { setupGithubCommand } from '../ui/commands/setupGithubCommand.js';
import { setupApiCommand, setupApiKeyCommand } from '../ui/commands/setupApiCommand.js';
import { openrouterCommand } from '../ui/commands/openrouterCommand.js';
import { imageCommand } from '../ui/commands/imageCommand.js';
import { audioCommand } from '../ui/commands/audioCommand.js';
import { pdfCommand } from '../ui/commands/pdfCommand.js';
import { byokCommand } from '../ui/commands/byokCommand.js';
import {
  recoderLoginCommand,
  recoderLogoutCommand,
  recoderStatusCommand,
  recoderSetApiKeyCommand,
} from '../ui/commands/recoderLoginCommand.js';
import { filesCommand } from '../ui/commands/filesCommand.js';
import { searchCommand } from '../ui/commands/searchCommand.js';
import { findCommand } from '../ui/commands/findCommand.js';
import { treeCommand } from '../ui/commands/treeCommand.js';
import { webCommand } from '../ui/commands/webCommand.js';
import { modelRecommendCommand } from '../ui/commands/modelRecommendCommand.js';
import { recentModelsCommand } from '../ui/commands/recentModelsCommand.js';
import { compareModelsCommand } from '../ui/commands/compareModelsCommand.js';
import { ollamaCommand } from '../ui/commands/ollamaCommand.js';
import { providersCommand } from '../ui/commands/providersCommand.js';
import { connectCommand } from '../ui/commands/connectCommand.js';
import { modelsCommand } from '../ui/commands/modelsCommand.js';
import { agentCommand } from '../ui/commands/agentCommand.js';

/**
 * Loads the core, hard-coded slash commands that are an integral part
 * of the Gemini CLI application.
 */
export class BuiltinCommandLoader implements ICommandLoader {
  constructor(private config: Config | null) {}

  /**
   * Gathers all raw built-in command definitions, injects dependencies where
   * needed (e.g., config) and filters out any that are not available.
   *
   * @param _signal An AbortSignal (unused for this synchronous loader).
   * @returns A promise that resolves to an array of `SlashCommand` objects.
   */
  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    const allDefinitions: Array<SlashCommand | null> = [
      aboutCommand,
      addModelCommand,
      agentsCommand,
      approvalModeCommand,
      authCommand,
      browseModelsCommand,
      bugCommand,
      chatCommand,
      clearCommand,
      compressCommand,
      copyCommand,
      corgiCommand,
      docsCommand,
      directoryCommand,
      editorCommand,
      extensionsCommand,
      filesCommand,
      findCommand,
      helpCommand,
      ideCommand(this.config),
      imageCommand,
      audioCommand,
      pdfCommand,
      byokCommand,
      initCommand,
      mcpCommand,
      memoryCommand,
      modelCommand,
      modelRecommendCommand,
      recentModelsCommand,
      compareModelsCommand,
      openrouterCommand,
      privacyCommand,
      quitCommand,
      quitConfirmCommand,
      recoderLoginCommand,
      recoderLogoutCommand,
      recoderStatusCommand,
      recoderSetApiKeyCommand,
      restoreCommand(this.config),
      searchCommand,
      statsCommand,
      summaryCommand,
      themeCommand,
      toolsCommand,
      treeCommand,
      settingsCommand,
      vimCommand,
      setupGithubCommand,
      setupApiCommand,
      setupApiKeyCommand,
      terminalSetupCommand,
      webCommand,
      ollamaCommand,
      providersCommand,
      connectCommand,
      modelsCommand,
      agentCommand,
    ];

    return allDefinitions.filter((cmd): cmd is SlashCommand => cmd !== null);
  }
}
