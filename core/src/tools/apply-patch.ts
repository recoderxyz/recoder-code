/**
 * Apply Patch Tool
 *
 * Apply a unified diff patch to one or more files. Supports multi-hunk
 * patches with add, delete, and update operations.
 *
 * Inspired by opencode's apply_patch tool.
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

export interface ApplyPatchParams {
  patch: string;
}

interface ParsedHunk {
  filePath: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

function parseUnifiedDiff(patch: string): ParsedHunk[] {
  const hunks: ParsedHunk[] = [];
  const lines = patch.split('\n');
  let currentFile = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect file header
    if (line.startsWith('--- a/') || line.startsWith('--- ')) {
      i++;
      continue;
    }
    if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
      currentFile = line.replace(/^\+\+\+ [ab]\//, '').replace(/^\+\+\+ /, '');
      i++;
      continue;
    }

    // Detect hunk header: @@ -old_start,old_count +new_start,new_count @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch && currentFile) {
      const hunkLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('--- ') && !lines[i].startsWith('diff ')) {
        hunkLines.push(lines[i]);
        i++;
      }

      hunks.push({
        filePath: currentFile,
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newCount: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        lines: hunkLines,
      });
      continue;
    }

    i++;
  }

  return hunks;
}

function applyHunksToContent(content: string, hunks: ParsedHunk[]): string {
  const contentLines = content.split('\n');
  let offset = 0;

  for (const hunk of hunks) {
    const startIdx = hunk.oldStart - 1 + offset;
    const removeLines: number[] = [];
    const addLines: Array<{ idx: number; text: string }> = [];

    let lineIdx = startIdx;
    for (const line of hunk.lines) {
      if (line.startsWith('-')) {
        removeLines.push(lineIdx);
        lineIdx++;
      } else if (line.startsWith('+')) {
        addLines.push({ idx: lineIdx, text: line.slice(1) });
      } else {
        // Context line
        lineIdx++;
      }
    }

    // Remove lines (in reverse to preserve indices)
    for (const idx of removeLines.reverse()) {
      contentLines.splice(idx, 1);
      offset--;
    }

    // Add lines
    let insertOffset = 0;
    for (const add of addLines) {
      const insertIdx = Math.min(add.idx + insertOffset - removeLines.filter((r) => r <= add.idx).length, contentLines.length);
      contentLines.splice(insertIdx, 0, add.text);
      insertOffset++;
      offset++;
    }
  }

  return contentLines.join('\n');
}

class ApplyPatchInvocation extends BaseToolInvocation<ApplyPatchParams, ToolResult> {
  constructor(
    private readonly config: Config,
    params: ApplyPatchParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const hunks = parseUnifiedDiff(this.params.patch);
    const files = [...new Set(hunks.map((h) => h.filePath))];
    return `Apply patch to ${files.length} file(s): ${files.join(', ')}`;
  }

  toolLocations(): ToolLocation[] {
    const hunks = parseUnifiedDiff(this.params.patch);
    return [...new Set(hunks.map((h) => h.filePath))].map((p) => ({
      path: path.isAbsolute(p) ? p : path.resolve(this.config.getWorkingDir(), p),
    }));
  }

  async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const hunks = parseUnifiedDiff(this.params.patch);
    if (hunks.length === 0) {
      return {
        llmContent: 'No hunks found in patch',
        returnDisplay: 'No hunks found in patch',
        error: { message: 'No valid hunks found in the patch' },
      };
    }

    // Group hunks by file
    const byFile = new Map<string, ParsedHunk[]>();
    for (const hunk of hunks) {
      const key = hunk.filePath;
      const existing = byFile.get(key) ?? [];
      existing.push(hunk);
      byFile.set(key, existing);
    }

    const results: string[] = [];
    const errors: string[] = [];

    for (const [filePath, fileHunks] of byFile) {
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.config.getWorkingDir(), filePath);

      try {
        const isNew = !fs.existsSync(absPath);

        if (isNew) {
          // New file: collect all '+' lines
          const newContent = fileHunks
            .flatMap((h) => h.lines)
            .filter((l) => l.startsWith('+'))
            .map((l) => l.slice(1))
            .join('\n');

          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, newContent, 'utf-8');
          results.push(`Created: ${makeRelative(absPath, this.config.getWorkingDir())}`);
        } else {
          const content = fs.readFileSync(absPath, 'utf-8');
          const patched = applyHunksToContent(content, fileHunks);
          fs.writeFileSync(absPath, patched, 'utf-8');
          results.push(`Patched: ${makeRelative(absPath, this.config.getWorkingDir())} (${fileHunks.length} hunk(s))`);
        }
      } catch (err) {
        errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
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
    patch: {
      type: 'string',
      description: 'A unified diff patch string. Supports multi-file, multi-hunk patches.',
    },
  },
  required: ['patch'],
};

export class ApplyPatchTool extends BaseDeclarativeTool<ApplyPatchParams, ToolResult> {
  constructor(private readonly config: Config) {
    super(
      'apply_patch',
      'Apply Patch',
      'Apply a unified diff patch to one or more files. Supports multi-hunk patches for add, delete, and update operations.',
      Kind.Edit,
      PARAM_SCHEMA,
    );
  }

  protected createInvocation(params: ApplyPatchParams): ToolInvocation<ApplyPatchParams, ToolResult> {
    return new ApplyPatchInvocation(this.config, params);
  }
}
