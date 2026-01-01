/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getCliVersion } from '../../utils/version.js';
import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import process from 'node:process';
import { MessageType, type HistoryItemAbout } from '../types.js';
import { AuthType } from 'recoder-code-core';

/**
 * Convert raw auth type value to user-friendly display name
 */
function getAuthTypeDisplayName(authType: string): string {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
    case AuthType.RECODER_AUTH:
      return 'recoder.xyz';
    case AuthType.USE_OPENAI:
      return 'OpenRouter';
    case AuthType.LOGIN_WITH_GOOGLE:
      return 'Google OAuth';
    case AuthType.USE_GEMINI:
      return 'Gemini API Key';
    case AuthType.USE_VERTEX_AI:
      return 'Vertex AI';
    case AuthType.CLOUD_SHELL:
      return 'Cloud Shell';
    default:
      return authType || 'Unknown';
  }
}

export const aboutCommand: SlashCommand = {
  name: 'about',
  description: 'show version info',
  kind: CommandKind.BUILT_IN,
  action: async (context) => {
    const osVersion = process.platform;
    let sandboxEnv = 'no sandbox';
    if (process.env['SANDBOX'] && process.env['SANDBOX'] !== 'sandbox-exec') {
      sandboxEnv = process.env['SANDBOX'];
    } else if (process.env['SANDBOX'] === 'sandbox-exec') {
      sandboxEnv = `sandbox-exec (${
        process.env['SEATBELT_PROFILE'] || 'unknown'
      })`;
    }
    const modelVersion = context.services.config?.getModel() || 'Unknown';
    const cliVersion = await getCliVersion();
    const rawAuthType =
      context.services.settings.merged.security?.auth?.selectedType || '';
    const selectedAuthType = getAuthTypeDisplayName(rawAuthType);
    const gcpProject = process.env['GOOGLE_CLOUD_PROJECT'] || '';
    const ideClient =
      (context.services.config?.getIdeMode() &&
        context.services.config?.getIdeClient()?.getDetectedIdeDisplayName()) ||
      '';

    const aboutItem: Omit<HistoryItemAbout, 'id'> = {
      type: MessageType.ABOUT,
      cliVersion,
      osVersion,
      sandboxEnv,
      modelVersion,
      selectedAuthType,
      gcpProject,
      ideClient,
    };

    context.ui.addItem(aboutItem, Date.now());
  },
};
