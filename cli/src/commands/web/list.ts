/**
 * 'recoder web list' command
 * List all web projects
 */

import type { CommandModule } from 'yargs';
import { RecoderWebService } from '../../services/RecoderWebService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface ListArgs {
  limit?: number;
}

export const listCommand: CommandModule<{}, ListArgs> = {
  command: 'list',
  describe: 'List all your web projects',
  builder: (yargs) =>
    yargs.option('limit', {
      alias: 'l',
      type: 'number',
      description: 'Maximum number of projects to show',
      default: 50,
    }),
  handler: async (argv) => {
    const webService = new RecoderWebService();
    const authService = new RecoderAuthService();

    try {
      // Check authentication
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        console.error('❌ Not authenticated');
        console.log('💡 Run: recoder auth login');
        process.exit(1);
      }

      console.log('📋 Fetching your web projects...\n');

      const projects = await webService.listProjects(argv.limit || 50);

      if (projects.length === 0) {
        console.log('No projects found. Create one at: http://localhost:5173');
        return;
      }

      console.log(`Found ${projects.length} projects:\n`);

      // Print table
      console.log('┌' + '─'.repeat(68) + '┐');
      console.log(
        '│ ' +
        'URL ID'.padEnd(16) + ' │ ' +
        'Description'.padEnd(30) + ' │ ' +
        'Files'.padEnd(5) + ' │ ' +
        'Messages'.padEnd(8) + ' │'
      );
      console.log('├' + '─'.repeat(68) + '┤');

      for (const project of projects) {
        const urlId = project.urlId.substring(0, 14) + '...';
        const description = (project.description || 'Untitled')
          .substring(0, 28)
          .padEnd(30);
        const fileCount = (project.fileCount?.toString() || '?').padEnd(5);
        const msgCount = project.messageCount.toString().padEnd(8);

        console.log(
          '│ ' +
          urlId.padEnd(16) + ' │ ' +
          description + ' │ ' +
          fileCount + ' │ ' +
          msgCount + ' │'
        );
      }

      console.log('└' + '─'.repeat(68) + '┘');

      console.log('\n💡 Commands:');
      console.log('  recoder web download <urlId>  - Download project files');
      console.log('  recoder web open <urlId>      - Open in browser');
      console.log('  recoder web info <urlId>      - Show project details');
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
