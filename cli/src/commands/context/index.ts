/**
 * recoder context
 * Manage .recoder/ project context
 */

import { Command } from 'commander';
import { createContextInitCommand } from './init.js';
import { createContextEditCommand } from './edit.js';

export function createContextCommand() {
  const command = new Command('context')
    .description('Manage .recoder/ project context directory')
    .addCommand(createContextInitCommand())
    .addCommand(createContextEditCommand());

  return command;
}
