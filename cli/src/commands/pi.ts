/**
 * `recoder-code pi <prompt>` — run a coding task with the Recoder-owned pi agent
 * runtime (@recoder/pi-coding-agent, merged from earendil-works/pi) against the
 * local workspace. Makes pi a first-class engine in Recoder Code alongside the
 * Gemini-based core.
 */
import type { CommandModule, Argv } from 'yargs';
import { runPiCodingTask, isPiRuntimeAvailable } from 'recoder-code-core';

interface PiArgs {
  prompt: string;
  model?: string;
  cwd?: string;
}

export const piCommand: CommandModule<object, PiArgs> = {
  command: 'pi <prompt>',
  describe: 'Run a coding task with the owned pi agent runtime (@recoder/pi-coding-agent)',
  builder: (yargs: Argv) =>
    yargs
      .positional('prompt', {
        type: 'string',
        describe: 'The coding task to perform',
        demandOption: true,
      })
      .option('model', {
        type: 'string',
        describe: 'Model as provider/modelId, e.g. anthropic/claude-sonnet-4',
      })
      .option('cwd', {
        type: 'string',
        describe: 'Working directory (defaults to current directory)',
      }) as Argv<PiArgs>,
  handler: async (argv) => {
    if (!(await isPiRuntimeAvailable())) {
      console.error('pi runtime (@recoder/pi-coding-agent) is not available.');
      process.exitCode = 1;
      return;
    }
    const result = await runPiCodingTask({
      prompt: String(argv.prompt),
      model: argv.model,
      cwd: argv.cwd,
    });
    if (result.text) {
      console.log(result.text);
    }
    if (result.filesChanged.length > 0) {
      console.log(`\nFiles changed (${result.filesChanged.length}): ${result.filesChanged.join(', ')}`);
    }
    if (!result.success) {
      process.exitCode = 1;
    }
  },
};
