/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const loginCommand: CommandModule = {
  command: 'login',
  describe: 'Login to Recoder.xyz',
  builder: (yargs) =>
    yargs
      .option('web', {
        type: 'boolean',
        description: 'Use web browser OAuth (default)',
        default: false,
      })
      .option('device', {
        type: 'boolean',
        alias: 'device-flow',
        description: 'Use device flow (for SSH/headless environments)',
        default: false,
      })
      .option('api-key', {
        type: 'string',
        description: 'Authenticate with API key',
      })
      .option('force', {
        type: 'boolean',
        alias: 'f',
        description: 'Force re-authentication even if already logged in',
        default: false,
      }),
  handler: async (argv) => {
    try {
      const authService = new RecoderAuthService();

      // Check if already authenticated
      if (!argv.force && (await authService.isAuthenticated())) {
        const user = await authService.getUser();
        console.log('✅ Already authenticated');
        console.log(`📧 Logged in as: ${user?.email || 'Unknown'}`);
        console.log(
          `📋 Plan: ${user?.subscription_plan?.toUpperCase() || 'Unknown'}`,
        );
        console.log('\n💡 Use --force to re-authenticate\n');
        process.exit(0);
      }

      // Determine login method
      if (argv['api-key']) {
        // API key authentication
        await authService.loginWithApiKey(argv['api-key'] as string);
      } else if (argv.device) {
        // Device flow
        await authService.loginWithDeviceFlow();
      } else {
        // Web OAuth (default)
        await authService.loginWithWeb();
      }

      process.exit(0);
    } catch (error: any) {
      console.error(`❌ Login failed: ${error.message}`);
      process.exit(1);
    }
  },
};
