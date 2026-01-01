/**
 * 'recoder web open' command
 * Open web project in browser
 */

import type { CommandModule } from 'yargs';
import open from 'open';
import { RecoderWebService } from '../../services/RecoderWebService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface OpenArgs {
  urlId: string;
  browser?: string;
  copy?: boolean;
}

export const openCommand: CommandModule<{}, OpenArgs> = {
  command: 'open <urlId>',
  describe: 'Open project in web browser',
  builder: (yargs) =>
    yargs
      .positional('urlId', {
        type: 'string',
        description: 'Project URL ID from web IDE',
        demandOption: true,
      })
      .option('browser', {
        alias: 'b',
        type: 'string',
        describe: 'Browser to open (chrome, firefox, safari, edge)',
      })
      .option('copy', {
        alias: 'c',
        type: 'boolean',
        describe: 'Copy URL to clipboard instead of opening',
      }),
  handler: async (argv) => {
    const webService = new RecoderWebService();
    const authService = new RecoderAuthService();

    try {
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        console.error('❌ Not authenticated');
        console.log('💡 Run: recoder auth login');
        process.exit(1);
      }

      console.log('🔍 Verifying project...');
      await webService.getProject(argv.urlId);

      const url = webService.getProjectUrl(argv.urlId);

      if (argv.copy) {
        const { default: clipboardy } = await import('clipboardy');
        await clipboardy.write(url);
        console.log(`📋 Copied to clipboard: ${url}`);
        return;
      }

      console.log(`🌐 Opening project in browser...`);
      console.log(`   ${url}`);

      if (argv.browser) {
        const browserMap: Record<string, string> = {
          chrome: 'google chrome',
          firefox: 'firefox',
          safari: 'safari',
          edge: 'microsoft edge',
        };
        const app = browserMap[argv.browser.toLowerCase()];
        await open(url, app ? { app: { name: app as any } } : undefined);
      } else {
        await open(url);
      }
      console.log('✅ Browser opened successfully');
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
