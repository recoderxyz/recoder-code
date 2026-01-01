/**
 * 'recoder web push' command
 * Upload local directory to web project
 */

import type { CommandModule } from 'yargs';
import path from 'node:path';
import { RecoderWebService } from '../../services/RecoderWebService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface PushArgs {
  urlId?: string;
  directory?: string;
  title?: string;
  'dry-run'?: boolean;
}

export const pushCommand: CommandModule<{}, PushArgs> = {
  command: 'push [urlId]',
  describe: 'Upload local files to web project',
  builder: (yargs) =>
    yargs
      .positional('urlId', {
        type: 'string',
        description: 'Project URL ID (optional, will read from .recoder-web if present)',
      })
      .option('directory', {
        type: 'string',
        alias: 'd',
        description: 'Directory to upload (defaults to current directory)',
        default: process.cwd(),
      })
      .option('title', {
        type: 'string',
        alias: 't',
        description: 'Project title/description',
      })
      .option('dry-run', {
        type: 'boolean',
        description: 'Show what would be uploaded without actually uploading',
        default: false,
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

      const targetDir = path.resolve(argv.directory || process.cwd());
      let urlId = argv.urlId;

      // Try to read .recoder-web metadata if no urlId provided
      if (!urlId) {
        try {
          const fs = await import('node:fs/promises');
          const metadataPath = path.join(targetDir, '.recoder-web');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          urlId = metadata.urlId;
          console.log(`📋 Found project ID from .recoder-web: ${urlId}`);
        } catch {
          console.error('❌ No project ID provided and no .recoder-web file found');
          console.log('💡 Usage: recoder web push <urlId>');
          console.log('   Or run from a directory downloaded with: recoder web download <urlId>');
          process.exit(1);
        }
      }

      console.log(`📂 Scanning directory: ${targetDir}\n`);

      // Scan local files
      const localFiles = await webService.scanDirectory(targetDir);
      const fileCount = Object.keys(localFiles).length;

      if (fileCount === 0) {
        console.error('❌ No files found in directory');
        process.exit(1);
      }

      console.log(`✓ Found ${fileCount} files\n`);

      // Get remote files to show diff
      let remoteFiles: Record<string, string> = {};
      try {
        const project = await webService.getProject(urlId);
        remoteFiles = project.fileSnapshot;
        console.log(`📊 Comparing with remote project...`);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          console.log(`📝 Creating new project: ${urlId}`);
        } else {
          throw error;
        }
      }

      // Detect changes
      const changes = await webService.detectChanges(localFiles, remoteFiles);

      // Display changes
      console.log('\n📋 Changes detected:');
      console.log('─'.repeat(60));

      if (changes.added.length > 0) {
        console.log(`\n✨ Added (${changes.added.length}):`);
        changes.added.forEach((file) => console.log(`  + ${file}`));
      }

      if (changes.modified.length > 0) {
        console.log(`\n✏️  Modified (${changes.modified.length}):`);
        changes.modified.forEach((file) => console.log(`  ~ ${file}`));
      }

      if (changes.deleted.length > 0) {
        console.log(`\n🗑️  Deleted (${changes.deleted.length}):`);
        changes.deleted.forEach((file) => console.log(`  - ${file}`));
      }

      if (changes.unchanged.length > 0) {
        console.log(`\n✓ Unchanged: ${changes.unchanged.length} files`);
      }

      const hasChanges =
        changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0;

      if (!hasChanges) {
        console.log('\n✅ No changes detected - project is up to date!');
        return;
      }

      // Dry run mode
      if (argv['dry-run']) {
        console.log('\n🔍 Dry run mode - no files were uploaded');
        console.log('💡 Remove --dry-run to actually upload');
        return;
      }

      // Upload files
      console.log('\n📤 Uploading to web project...');

      const result = await webService.uploadProject(urlId, localFiles, argv.title);

      if (result.success) {
        console.log(`\n✅ Upload complete!`);
        console.log(`📊 Uploaded ${result.fileCount} files`);
        console.log(`🌐 View at: ${webService.getProjectUrl(urlId)}`);
      } else {
        console.error('❌ Upload failed');
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
