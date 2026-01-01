/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const logoutCommand: CommandModule = {
  command: 'logout',
  describe: 'Logout from Recoder.xyz',
  handler: async () => {
    try {
      const authService = new RecoderAuthService();
      await authService.logout();
      process.exit(0);
    } catch (error: any) {
      console.error(`❌ Logout failed: ${error.message}`);
      process.exit(1);
    }
  },
};
