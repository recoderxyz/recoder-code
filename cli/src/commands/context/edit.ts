/**
 * recoder context edit
 * Edit .recoder/ context files
 */

import fs from 'fs/promises';
import path from 'path';
import { Command } from 'commander';
import { spawn } from 'child_process';

const AVAILABLE_FILES = [
  'context.md',
  'spec.md',
  'prd.md',
  'architecture.md',
  'style-guide.md',
  'api-docs.md',
  'prompts/component.md',
  'prompts/api.md',
  'prompts/test.md',
];

export function createContextEditCommand() {
  return new Command('edit')
    .description('Edit .recoder/ context files')
    .argument('[file]', 'File to edit (default: context.md)')
    .option('-l, --list', 'List available files')
    .action(async (file, options) => {
      const cwd = process.cwd();
      const recoderDir = path.join(cwd, '.recoder');

      // List files
      if (options.list) {
        console.log('Available .recoder/ files:');
        AVAILABLE_FILES.forEach((f, i) => {
          console.log(`  ${i + 1}. ${f}`);
        });
        return;
      }

      // Default to context.md
      const targetFile = file || 'context.md';

      // Validate file
      if (!AVAILABLE_FILES.includes(targetFile)) {
        console.error(`❌ Invalid file: ${targetFile}`);
        console.log('\nAvailable files:');
        AVAILABLE_FILES.forEach(f => console.log(`  - ${f}`));
        process.exit(1);
      }

      const filePath = path.join(recoderDir, targetFile);

      // Check if .recoder/ exists
      try {
        await fs.access(recoderDir);
      } catch {
        console.error('❌ .recoder/ directory not found. Run "recoder context init" first.');
        process.exit(1);
      }

      // Create file if doesn't exist
      try {
        await fs.access(filePath);
      } catch {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, '# ' + targetFile.replace('.md', '').replace(/[-_]/g, ' ').toUpperCase() + '\n\n');
      }

      // Open in editor
      const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
      
      console.log(`📝 Opening ${targetFile} in ${editor}...`);

      const child = spawn(editor, [filePath], {
        stdio: 'inherit',
      });

      child.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ File saved!');
        } else {
          console.error('❌ Editor exited with error');
          process.exit(code || 1);
        }
      });
    });
}
