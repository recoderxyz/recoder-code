/**
 * 'recoder web download' command
 * Download web project to local machine
 */

import type { CommandModule } from 'yargs';
import { RecoderWebService } from '../../services/RecoderWebService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface DownloadArgs {
  urlId: string;
  output?: string;
}

export const downloadCommand: CommandModule<{}, DownloadArgs> = {
  command: 'download <urlId> [output]',
  describe: 'Download project files to local machine',
  builder: (yargs) =>
    yargs
      .positional('urlId', {
        type: 'string',
        description: 'Project URL ID from web IDE',
        demandOption: true,
      })
      .positional('output', {
        type: 'string',
        description: 'Output directory (optional)',
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

      const result = await webService.downloadProject(argv.urlId, argv.output);

      console.log('\n✅ Download complete!');
      console.log(`📂 Location: ${result.directory}`);
      console.log(`📄 Files: ${result.fileCount}`);
      console.log(`\n💡 Next steps:`);
      console.log(`  cd ${result.directory}`);
      console.log(`  npm install && npm run dev`);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
