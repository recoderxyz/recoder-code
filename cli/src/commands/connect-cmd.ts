/**
 * Connect command module - Add custom providers interactively
 */

import type { CommandModule } from 'yargs';
import { connectProvider } from './connect.js';
import { RecoderAuthService } from '../services/RecoderAuthService.js';

export const connectCommand: CommandModule = {
  command: 'connect',
  describe: 'Add a custom AI provider (LM Studio, vLLM, etc.)',
  handler: async () => {
    // Require authentication
    const authService = new RecoderAuthService();
    const session = await authService.getSession();
    if (!session) {
      console.error('❌ Please login first: recoder auth login');
      process.exit(1);
    }

    await connectProvider();
    process.exit(0);
  },
};
