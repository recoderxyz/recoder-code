/**
 * 'recoder web launch' command
 * Open recoder-web IDE in browser
 */

import type { CommandModule } from 'yargs';
import open from 'open';

const WEB_IDE_URL = 'https://recoder.xyz';

interface LaunchArgs {
  new?: boolean;
  browser?: string;
  copy?: boolean;
  dashboard?: boolean;
}

export const launchCommand: CommandModule<{}, LaunchArgs> = {
  command: 'launch',
  describe: 'Open recoder-web IDE in browser',
  builder: (yargs) =>
    yargs
      .option('new', {
        alias: 'n',
        type: 'boolean',
        describe: 'Create a new project',
      })
      .option('dashboard', {
        alias: 'd',
        type: 'boolean',
        describe: 'Open dashboard/projects list',
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
    let url = WEB_IDE_URL;
    if (argv.new) {
      url = `${WEB_IDE_URL}/new`;
    } else if (argv.dashboard) {
      url = `${WEB_IDE_URL}/dashboard`;
    }

    if (argv.copy) {
      const { default: clipboardy } = await import('clipboardy');
      await clipboardy.write(url);
      console.log(`📋 Copied to clipboard: ${url}`);
      return;
    }

    console.log(`🌐 Opening recoder-web...`);
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

    console.log('✅ Browser opened');
  },
};
