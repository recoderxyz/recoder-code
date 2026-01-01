/**
 * 'recoder plan scaffold' command
 */

import type { CommandModule } from 'yargs';
import { PlanningService } from '../../services/PlanningService.js';

interface ScaffoldArgs {
  id: string;
  output?: string;
}

export const scaffoldPlanCommand: CommandModule<{}, ScaffoldArgs> = {
  command: 'scaffold <id>',
  describe: 'Generate folder structure from plan',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Plan ID',
        demandOption: true,
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        describe: 'Output directory (default: current)',
      }),
  handler: async (argv) => {
    const planningService = new PlanningService();
    const plan = planningService.loadPlan(argv.id);

    if (!plan) {
      console.error(`❌ Plan not found: ${argv.id}`);
      process.exit(1);
    }

    console.log(`🏗️  Scaffolding: ${plan.name}\n`);

    const created = planningService.generateScaffold(plan, argv.output);

    if (created.length === 0) {
      console.log('No new files/folders created (structure already exists)');
      return;
    }

    console.log(`Created ${created.length} items:\n`);
    created.forEach((p) => console.log(`  ✅ ${p}`));
    console.log('\n✅ Scaffold complete');
  },
};
