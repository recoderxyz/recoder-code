/**
 * 'recoder plan delete' command
 */

import type { CommandModule } from 'yargs';
import { PlanningService } from '../../services/PlanningService.js';

interface DeleteArgs {
  id: string;
}

export const deletePlanCommand: CommandModule<{}, DeleteArgs> = {
  command: 'delete <id>',
  describe: 'Delete a plan',
  builder: (yargs) =>
    yargs.positional('id', {
      type: 'string',
      description: 'Plan ID',
      demandOption: true,
    }),
  handler: async (argv) => {
    const planningService = new PlanningService();

    if (planningService.deletePlan(argv.id)) {
      console.log(`✅ Deleted plan: ${argv.id}`);
    } else {
      console.error(`❌ Plan not found: ${argv.id}`);
      process.exit(1);
    }
  },
};
