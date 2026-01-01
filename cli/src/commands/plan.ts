/**
 * 'recoder plan' command
 * Project planning module
 */

import type { CommandModule, Argv } from 'yargs';
import { createPlanCommand } from './plan/create.js';
import { listPlanCommand } from './plan/list.js';
import { showPlanCommand } from './plan/show.js';
import { deletePlanCommand } from './plan/delete.js';
import { scaffoldPlanCommand } from './plan/scaffold.js';

export const planCommand: CommandModule = {
  command: 'plan',
  describe: 'Project planning - create technical architecture and implementation plans',
  builder: (yargs: Argv) =>
    yargs
      .command(createPlanCommand)
      .command(listPlanCommand)
      .command(showPlanCommand)
      .command(deletePlanCommand)
      .command(scaffoldPlanCommand)
      .demandCommand(1, 'You need at least one command. Try: recoder plan create')
      .version(false),
  handler: () => {},
};
