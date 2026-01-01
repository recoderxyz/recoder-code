/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'recoder auth' command
import type { CommandModule, Argv } from 'yargs';
import { loginCommand } from './auth/login.js';
import { logoutCommand } from './auth/logout.js';
import { statusCommand } from './auth/status.js';
import { setApiKeyCommand } from './auth/set-api-key.js';
import { quotaCommand } from './auth/quota.js';
import { whoamiCommand } from './auth/whoami.js';

export const authCommand: CommandModule = {
  command: 'auth',
  describe: 'Authenticate with Recoder.xyz',
  builder: (yargs: Argv) =>
    yargs
      .command(loginCommand)
      .command(logoutCommand)
      .command(statusCommand)
      .command(setApiKeyCommand)
      .command(quotaCommand)
      .command(whoamiCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
    // thanks to demandCommand(1) in the builder.
  },
};
