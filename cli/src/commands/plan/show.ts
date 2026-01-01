/**
 * 'recoder plan show' command
 */

import type { CommandModule } from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import { PlanningService } from '../../services/PlanningService.js';
import { RecoderConfigService } from '../../services/RecoderConfigService.js';

interface ShowArgs {
  id: string;
  json?: boolean;
}

export const showPlanCommand: CommandModule<{}, ShowArgs> = {
  command: 'show <id>',
  describe: 'Show plan details',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Plan ID',
        demandOption: true,
      })
      .option('json', {
        alias: 'j',
        type: 'boolean',
        describe: 'Output as JSON',
      }),
  handler: async (argv) => {
    const planningService = new PlanningService();
    const configService = new RecoderConfigService();

    const plan = planningService.loadPlan(argv.id);

    if (!plan) {
      console.error(`❌ Plan not found: ${argv.id}`);
      console.log('\n💡 List plans with: recoder plan list');
      process.exit(1);
    }

    if (argv.json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    // Show markdown version
    const mdPath = path.join(configService.getPlansDir(), `${argv.id}.md`);
    if (fs.existsSync(mdPath)) {
      console.log(fs.readFileSync(mdPath, 'utf-8'));
    } else {
      console.log(planningService.planToMarkdown(plan));
    }
  },
};
