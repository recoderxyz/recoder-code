/**
 * Multi-Edit Tool
 *
 * Apply multiple edits to one or more files in a single tool call.
 * Inspired by opencode's multiedit tool.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ToolCallConfirmationDetails,
  ToolInvocation,
  ToolLocation,
  ToolResult,
  ToolResultDisplay,
} from './tools.js';
import { BaseDeclarativeTool, Kind, BaseToolInvocation } from './tools.js';
import type { Config } from '../config/config.js';
import { makeRelative } from '../utils/paths.js';

interface SingleEdit {
  file_path: string;
  old_string: string;
  new_string: string;
}

export interface MultiEditParams {
  edits: SingleEdit[];
}

class MultiEditInvocation extends BaseToolInvocation<MultiEditParams, ToolResult> {
  constructor(
    private readonly config: Config,
    params: MultiEditParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const files = [...new Set(this.params.edits.map((e) => e.file_path))];
    return `Apply ${this.params.edits.length} edit(s) across ${files.length} file(s)`;
  }

  toolLocations(): ToolLocation[] {
    return [...new Set(this.params.edits.map((e) => e.file_path))].map((p) => ({ path: p }));
  }

  async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const results: string[] = [];
    const errors: string[] = [];

    for (const edit of this.params.edits) {
      const absPath = path.isAbsolute(edit.file_path)
        ? edit.file_path
        : path.resolve(this.config.getWorkingDir(), edit.file_path);

      try {
        const isNew = !fs.existsSync(absPath);

        if (isNew && edit.old_string === '') {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, edit.new_string, 'utf-8');
          results.push(`Created: ${makeRelative(absPath, this.config.getWorkingDir())}`);
        } else if (isNew) {
          errors.push(`File not found: ${edit.file_path}`);
        } else {
          const content = fs.readFileSync(absPath, 'utf-8');
          if (!content.includes(edit.old_string)) {
            errors.push(`old_string not found in ${edit.file_path}`);
            continue;
          }
          fs.writeFileSync(absPath, content.replace(edit.old_string, edit.new_string), 'utf-8');
          results.push(`Edited: ${makeRelative(absPath, this.config.getWorkingDir())}`);
        }
      } catch (err) {
        errors.push(`${edit.file_path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const summary = [...results, ...(errors.length > 0 ? ['Errors:', ...errors] : [])].join('\n');

    return {
      llmContent: summary,
      returnDisplay: summary,
      ...(errors.length > 0 ? { error: { message: errors.join('; ') } } : {}),
    };
  }
}

const PARAM_SCHEMA = {
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      description: 'List of edits to apply',
      items: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          old_string: { type: 'string', description: 'Text to find (empty to create new file)' },
          new_string: { type: 'string', description: 'Replacement text' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
  },
  required: ['edits'],
};

export class MultiEditTool extends BaseDeclarativeTool<MultiEditParams, ToolResult> {
  constructor(private readonly config: Config) {
    super(
      'multi_edit',
      'Multi Edit',
      'Apply multiple edits across one or more files in a single call. Each edit specifies file_path, old_string, and new_string.',
      Kind.Edit,
      PARAM_SCHEMA,
    );
  }

  protected createInvocation(params: MultiEditParams): ToolInvocation<MultiEditParams, ToolResult> {
    return new MultiEditInvocation(this.config, params);
  }
}
