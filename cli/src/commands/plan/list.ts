/**
 * 'recoder plan list' command
 */

import type { CommandModule } from 'yargs';
import { PlanningService } from '../../services/PlanningService.js';

export const listPlanCommand: CommandModule = {
  command: 'list',
  describe: 'List all project plans',
  handler: async () => {
    const planningService = new PlanningService();
    const plans = planningService.listPlans();

    if (plans.length === 0) {
      console.log('No plans found.');
      console.log('\n💡 Create one with: recoder plan create "My Project"');
      return;
    }

    console.log(`📋 Project Plans (${plans.length})\n`);

    for (const plan of plans) {
      const status = {
        draft: '📝',
        active: '🔄',
        completed: '✅',
        archived: '📦',
      }[plan.status] || '❓';

      console.log(`${status} ${plan.name}`);
      console.log(`   ID: ${plan.id}`);
      console.log(`   Status: ${plan.status}`);
      console.log(`   Created: ${plan.createdAt.split('T')[0]}`);
      console.log(`   Phases: ${plan.phases.length}`);
      console.log();
    }
  },
};
