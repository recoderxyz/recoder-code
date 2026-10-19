/**
 * auth setup-mcp subcommand
 * Delegates to the top-level setup-mcp command logic.
 */

import type { CommandModule } from 'yargs';
import { runSetupMcp } from '../setupMcp.js';

export const setupMcpAuthCommand: CommandModule = {
  command: 'setup-mcp',
  describe: 'Configure Recoder MCP server for Claude Code',
  builder: (yargs) =>
    yargs
      .option('global', {
        alias: 'g',
        type: 'boolean',
        description: 'Write to global config (~/.claude/.mcp.json) instead of project-level',
        default: false,
      })
      .option('path', {
        type: 'string',
        description: 'Custom path for .mcp.json output',
      }),
  handler: async (argv) => {
    try {
      await runSetupMcp({
        global: argv['global'] as boolean,
        path: argv['path'] as string | undefined,
      });
      process.exit(0);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  },
};
