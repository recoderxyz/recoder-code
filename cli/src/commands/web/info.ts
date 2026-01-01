/**
 * 'recoder web info' command
 * Show detailed project information
 */

import type { CommandModule } from 'yargs';
import { RecoderWebService } from '../../services/RecoderWebService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface InfoArgs {
  urlId: string;
}

export const infoCommand: CommandModule<{}, InfoArgs> = {
  command: 'info <urlId>',
  describe: 'Show detailed project information',
  builder: (yargs) =>
    yargs.positional('urlId', {
      type: 'string',
      description: 'Project URL ID from web IDE',
      demandOption: true,
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

      console.log('📋 Fetching project details...\n');

      const project = await webService.getProject(argv.urlId);

      console.log('📦 Project Information');
      console.log('─'.repeat(60));
      console.log(`URL ID:       ${project.urlId}`);
      console.log(`Description:  ${project.description || 'Untitled Project'}`);
      console.log(`Messages:     ${project.messages.length}`);
      console.log(`Files:        ${Object.keys(project.fileSnapshot).length}`);
      console.log(`Web URL:      ${webService.getProjectUrl(project.urlId)}`);

      if (Object.keys(project.fileSnapshot).length > 0) {
        console.log('\n📁 Files:');
        for (const filePath of Object.keys(project.fileSnapshot)) {
          const content = project.fileSnapshot[filePath];
          const size = content.length;
          const sizeStr = size > 1024
            ? `${(size / 1024).toFixed(1)}KB`
            : `${size}B`;
          console.log(`  • ${filePath} (${sizeStr})`);
        }
      }

      console.log('\n💡 Commands:');
      console.log(`  recoder web download ${argv.urlId}  - Download files`);
      console.log(`  recoder web open ${argv.urlId}      - Open in browser`);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
