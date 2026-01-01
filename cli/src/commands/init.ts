/**
 * 'recoder init' command
 * Initialize .recoder folder in project
 */

import type { CommandModule } from 'yargs';
import { RecoderConfigService } from '../services/RecoderConfigService.js';

interface InitArgs {
  global?: boolean;
  force?: boolean;
}

export const initCommand: CommandModule<{}, InitArgs> = {
  command: 'init',
  describe: 'Initialize .recoder folder in current directory',
  builder: (yargs) =>
    yargs
      .option('global', {
        alias: 'g',
        type: 'boolean',
        describe: 'Initialize global ~/.recoder config',
      })
      .option('force', {
        alias: 'f',
        type: 'boolean',
        describe: 'Overwrite existing config',
      }),
  handler: async (argv) => {
    const configService = new RecoderConfigService();
    const location = argv.global ? 'global (~/.recoder)' : 'project (.recoder)';

    if (configService.exists({ global: argv.global }) && !argv.force) {
      console.log(`⚠️  .recoder already exists in ${location}`);
      console.log('   Use --force to reinitialize');
      return;
    }

    await configService.init({ global: argv.global });

    console.log(`✅ Initialized .recoder in ${location}`);
    console.log('\nCreated structure:');
    console.log('  .recoder/');
    console.log('  ├── config.json    # Project configuration');
    console.log('  ├── plans/         # Project plans');
    console.log('  ├── context/       # Context files (rules, instructions)');
    console.log('  ├── cache/         # Temporary cache');
    console.log('  └── .gitignore     # Ignores cache folder');
    console.log('\n💡 Next steps:');
    console.log('   recoder plan create "My Project"  # Create a project plan');
    console.log('   recoder context add rules         # Add context rules');
  },
};
