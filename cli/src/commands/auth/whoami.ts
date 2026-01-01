/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export const whoamiCommand: CommandModule = {
  command: 'whoami',
  describe: 'Show current authenticated user',
  handler: async () => {
    try {
      const authService = new RecoderAuthService();
      const user = await authService.getUser();

      if (!user) {
        console.log('❌ Not authenticated');
        console.log('💡 Run: recoder-code auth login\n');
        process.exit(1);
      }

      console.log('\n👤 Current User:');
      console.log(`  Name:  ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  ID:    ${user.id}`);
      console.log(`  Plan:  ${user.subscription_plan?.toUpperCase()}\n`);

      process.exit(0);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  },
};
