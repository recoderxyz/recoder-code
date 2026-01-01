/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'recoder-code ai' command
import type { CommandModule, Argv } from 'yargs';
import { generateCommand } from './ai/generate.js';
import { chatCommand } from './ai/chat.js';
import { usageCommand } from './ai/usage.js';
import { modelsCommand } from './ai/models.js';

export const aiCommand: CommandModule = {
  command: 'ai',
  describe: 'AI-powered code generation and chat (Premium)',
  builder: (yargs: Argv) =>
    yargs
      .command(generateCommand)
      .command(chatCommand)
      .command(usageCommand)
      .command(modelsCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
  },
};
