/**
 * 'recoder web sync' command
 * Intelligent two-way sync between local and web
 */

import type { CommandModule } from 'yargs';
import path from 'node:path';
import { RecoderWebService } from '../../services/RecoderWebService.js';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

interface SyncArgs {
  urlId?: string;
  directory?: string;
  'dry-run'?: boolean;
  'prefer-local'?: boolean;
  'prefer-remote'?: boolean;
}

export const syncCommand: CommandModule<{}, SyncArgs> = {
  command: 'sync [urlId]',
  describe: 'Sync files between local directory and web project',
  builder: (yargs) =>
    yargs
      .positional('urlId', {
        type: 'string',
        description: 'Project URL ID (optional, will read from .recoder-web if present)',
      })
      .option('directory', {
        type: 'string',
        alias: 'd',
        description: 'Directory to sync (defaults to current directory)',
        default: process.cwd(),
      })
      .option('dry-run', {
        type: 'boolean',
        description: 'Show what would be synced without actually syncing',
        default: false,
      })
      .option('prefer-local', {
        type: 'boolean',
        description: 'Prefer local changes on conflict (upload)',
        default: false,
      })
      .option('prefer-remote', {
        type: 'boolean',
        description: 'Prefer remote changes on conflict (download)',
        default: false,
      })
      .check((argv) => {
        if (argv['prefer-local'] && argv['prefer-remote']) {
          throw new Error('Cannot use both --prefer-local and --prefer-remote');
        }
        return true;
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
          console.log('💡 Usage: recoder web sync <urlId>');
          console.log('   Or run from a directory downloaded with: recoder web download <urlId>');
          process.exit(1);
        }
      }

      console.log(`🔄 Syncing project: ${urlId}`);
      console.log(`📂 Local directory: ${targetDir}\n`);

      // Get remote project
      console.log('📥 Fetching remote project...');
      const project = await webService.getProject(urlId);
      const remoteFiles = project.fileSnapshot;

      // Scan local files
      console.log('📂 Scanning local directory...');
      const localFiles = await webService.scanDirectory(targetDir);

      // Detect changes
      const changes = await webService.detectChanges(localFiles, remoteFiles);

      // Display changes
      console.log('\n📊 Sync Analysis:');
      console.log('─'.repeat(60));

      const hasLocalChanges = changes.added.length > 0 || changes.modified.length > 0;
      const hasRemoteChanges = changes.deleted.length > 0; // Deleted locally = exists only remotely

      if (changes.added.length > 0) {
        console.log(`\n✨ Local additions (${changes.added.length}):`);
        changes.added.slice(0, 10).forEach((file) => console.log(`  + ${file}`));
        if (changes.added.length > 10) {
          console.log(`  ... and ${changes.added.length - 10} more`);
        }
      }

      if (changes.modified.length > 0) {
        console.log(`\n✏️  Modified files (${changes.modified.length}):`);
        changes.modified.slice(0, 10).forEach((file) => console.log(`  ~ ${file}`));
        if (changes.modified.length > 10) {
          console.log(`  ... and ${changes.modified.length - 10} more`);
        }
      }

      if (changes.deleted.length > 0) {
        console.log(`\n🗑️  Deleted locally (${changes.deleted.length}):`);
        changes.deleted.slice(0, 10).forEach((file) => console.log(`  - ${file}`));
        if (changes.deleted.length > 10) {
          console.log(`  ... and ${changes.deleted.length - 10} more`);
        }
      }

      if (changes.unchanged.length > 0) {
        console.log(`\n✓ Unchanged: ${changes.unchanged.length} files`);
      }

      const hasChanges = hasLocalChanges || hasRemoteChanges;

      if (!hasChanges) {
        console.log('\n✅ Everything is in sync!');
        return;
      }

      // Determine sync strategy
      let strategy: 'upload' | 'download' | 'interactive' = 'interactive';

      if (argv['prefer-local']) {
        strategy = 'upload';
        console.log('\n📤 Strategy: Upload local changes to remote (--prefer-local)');
      } else if (argv['prefer-remote']) {
        strategy = 'download';
        console.log('\n📥 Strategy: Download remote changes to local (--prefer-remote)');
      } else if (hasLocalChanges && !hasRemoteChanges) {
        strategy = 'upload';
        console.log('\n📤 Strategy: Upload (only local changes detected)');
      } else if (!hasLocalChanges && hasRemoteChanges) {
        strategy = 'download';
        console.log('\n📥 Strategy: Download (only remote changes detected)');
      } else {
        console.log('\n⚠️  Conflict detected: Both local and remote have changes');
        console.log('💡 Use --prefer-local to upload or --prefer-remote to download');
        console.log('   Or manually resolve conflicts and run sync again');
        process.exit(1);
      }

      // Dry run mode
      if (argv['dry-run']) {
        console.log('\n🔍 Dry run mode - no files were synced');
        console.log('💡 Remove --dry-run to actually sync');
        return;
      }

      // Execute sync
      if (strategy === 'upload') {
        console.log('\n📤 Uploading local changes...');
        const result = await webService.uploadProject(urlId, localFiles);

        if (result.success) {
          console.log(`\n✅ Upload complete!`);
          console.log(`📊 Synced ${result.fileCount} files to web`);
          console.log(`🌐 View at: ${webService.getProjectUrl(urlId)}`);
        } else {
          console.error('❌ Upload failed');
          process.exit(1);
        }
      } else if (strategy === 'download') {
        console.log('\n📥 Downloading remote changes...');
        const fs = await import('node:fs/promises');

        // Write remote files to local
        for (const [filePath, content] of Object.entries(remoteFiles)) {
          if (!localFiles[filePath] || localFiles[filePath] !== content) {
            const fullPath = path.join(targetDir, filePath);
            const fileDir = path.dirname(fullPath);
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');
            console.log(`  ✓ ${filePath}`);
          }
        }

        console.log(`\n✅ Download complete!`);
        console.log(`📊 Synced ${Object.keys(remoteFiles).length} files from web`);
      }

      // Update metadata
      const fs = await import('node:fs/promises');
      const metadataFile = path.join(targetDir, '.recoder-web');
      await fs.writeFile(
        metadataFile,
        JSON.stringify(
          {
            urlId: project.urlId,
            description: project.description,
            lastSync: new Date().toISOString(),
            syncStrategy: strategy,
            webUrl: webService.getProjectUrl(project.urlId),
          },
          null,
          2
        ),
        'utf-8'
      );

      console.log(`\n💡 Sync complete! Use 'recoder web sync' again to keep in sync.`);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },
};
