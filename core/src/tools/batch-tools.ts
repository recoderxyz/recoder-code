/**
 * Batch Tools
 *
 * Execute multiple tool calls in a single invocation.
 * Inspired by opencode's batch tool.
 */

import type {
  ToolCallConfirmationDetails,
  ToolInvocation,
  ToolLocation,
  ToolResult,
  ToolResultDisplay,
} from './tools.js';
import { BaseDeclarativeTool, Kind, BaseToolInvocation } from './tools.js';

interface BatchItem {
  tool_name: string;
  params: Record<string, unknown>;
}

export interface BatchToolsParams {
  invocations: BatchItem[];
}

class BatchToolsInvocation extends BaseToolInvocation<BatchToolsParams, ToolResult> {
  constructor(params: BatchToolsParams) {
    super(params);
  }

  getDescription(): string {
    return `Batch execute ${this.params.invocations.length} tool(s): ${this.params.invocations.map((i) => i.tool_name).join(', ')}`;
  }

  async shouldConfirmExecute(): Promise<ToolCallConfirmationDetails | false> {
    return false;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    // Batch execution is handled by the tool scheduler — this tool
    // expresses the intent. If we reach here, return the invocation list.
    const summary = this.params.invocations
      .map((inv, i) => `${i + 1}. ${inv.tool_name}(${JSON.stringify(inv.params).slice(0, 120)})`)
      .join('\n');

    return {
      llmContent: `Batch of ${this.params.invocations.length} tool calls:\n${summary}`,
      returnDisplay: `Batch of ${this.params.invocations.length} tool calls:\n${summary}`,
    };
  }
}

const PARAM_SCHEMA = {
  type: 'object',
  properties: {
    invocations: {
      type: 'array',
      description: 'List of tool calls to execute in parallel',
      items: {
        type: 'object',
        properties: {
          tool_name: { type: 'string', description: 'Name of the tool to call' },
          params: { type: 'object', description: 'Parameters for the tool' },
        },
        required: ['tool_name', 'params'],
      },
    },
  },
  required: ['invocations'],
};

export class BatchToolsTool extends BaseDeclarativeTool<BatchToolsParams, ToolResult> {
  constructor() {
    super(
      'batch',
      'Batch',
      'Execute multiple independent tool calls in parallel. Use when you need to perform several non-dependent operations at once.',
      Kind.Other,
      PARAM_SCHEMA,
    );
  }

  protected createInvocation(params: BatchToolsParams): ToolInvocation<BatchToolsParams, ToolResult> {
    return new BatchToolsInvocation(params);
  }
}
