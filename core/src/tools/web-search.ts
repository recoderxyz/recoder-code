/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
  type ToolCallConfirmationDetails,
  type ToolInfoConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';

import type { Config } from '../config/config.js';
import { ApprovalMode } from '../config/config.js';
import { getErrorMessage } from '../utils/errors.js';

interface TavilyResultItem {
  title: string;
  url: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilyResultItem[];
}

/**
 * Parameters for the WebSearchTool.
 */
export interface WebSearchToolParams {
  /**
   * The search query.
   */
  query: string;
}

/**
 * Extends ToolResult to include sources for web search.
 */
export interface WebSearchToolResult extends ToolResult {
  sources?: Array<{ title: string; url: string }>;
}

class WebSearchToolInvocation extends BaseToolInvocation<
  WebSearchToolParams,
  WebSearchToolResult
> {
  constructor(
    private readonly config: Config,
    params: WebSearchToolParams,
  ) {
    super(params);
  }

  override getDescription(): string {
    return `Searching the web for: "${this.params.query}"`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }

    const confirmationDetails: ToolInfoConfirmationDetails = {
      type: 'info',
      title: 'Confirm Web Search',
      prompt: `Search the web for: "${this.params.query}"`,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(signal: AbortSignal): Promise<WebSearchToolResult> {
    const searxngUrl = process.env['SEARXNG_URL'] || 'http://127.0.0.1:8888';

    try {
      // Try SearXNG first (self-hosted, no API key, no rate limits)
      const params = new URLSearchParams({
        q: this.params.query,
        format: 'json',
        pageno: '1',
      });

      const response = await fetch(`${searxngUrl}/search?${params.toString()}`, { signal });

      if (!response.ok) {
        throw new Error(`SearXNG error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        results: Array<{ title: string; url: string; content: string; engine: string }>;
      };

      const rawResults = data.results || [];
      if (rawResults.length === 0) {
        return await this._tavilyFallback(signal);
      }

      const sources = rawResults.slice(0, 5).map((r) => ({
        title: r.title || 'Untitled',
        url: r.url || '',
      }));

      let content = rawResults
        .slice(0, 5)
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.content || ''}\n   URL: ${r.url}`)
        .join('\n\n');

      content += `\n\nSources:\n${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})`).join('\n')}`;

      return {
        llmContent: `Web search results for "${this.params.query}":\n\n${content}`,
        returnDisplay: `Search results for "${this.params.query}" returned (${rawResults.length} results).`,
        sources,
      };
    } catch (error: unknown) {
      console.warn(`SearXNG failed, trying Tavily fallback: ${getErrorMessage(error)}`);
      return await this._tavilyFallback(signal);
    }
  }

  private async _tavilyFallback(signal: AbortSignal): Promise<WebSearchToolResult> {
    const apiKey = this.config.getTavilyApiKey() || process.env['TAVILY_API_KEY'];
    if (!apiKey) {
      return {
        llmContent: 'Web search failed: SearXNG is unavailable and no TAVILY_API_KEY is configured as fallback.',
        returnDisplay: 'Web search unavailable.',
      };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, query: this.params.query, search_depth: 'basic', max_results: 5, include_answer: true }),
        signal,
      });

      if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);

      const data = (await response.json()) as TavilySearchResponse;
      const sources = (data.results || []).map((r) => ({ title: r.title, url: r.url }));
      let content = data.answer?.trim() || sources.slice(0, 3).map((s, i) => `${i + 1}. ${s.title} - ${s.url}`).join('\n');
      if (sources.length > 0) content += `\n\nSources:\n${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})`).join('\n')}`;

      return { llmContent: `Web search results for "${this.params.query}":\n\n${content}`, returnDisplay: `Search results returned.`, sources };
    } catch (error: unknown) {
      const errorMessage = `Error during web search: ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      return { llmContent: `Error: ${errorMessage}`, returnDisplay: 'Error performing web search.' };
    }
  }
}

/**
 * A tool to perform web searches using Google Search via the Gemini API.
 */
export class WebSearchTool extends BaseDeclarativeTool<
  WebSearchToolParams,
  WebSearchToolResult
> {
  static readonly Name: string = 'web_search';

  constructor(private readonly config: Config) {
    super(
      WebSearchTool.Name,
      'WebSearch',
      'Performs a web search using the Tavily API and returns a concise answer with sources. Requires the TAVILY_API_KEY environment variable.',
      Kind.Search,
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information on the web.',
          },
        },
        required: ['query'],
      },
    );
  }

  /**
   * Validates the parameters for the WebSearchTool.
   * @param params The parameters to validate
   * @returns An error message string if validation fails, null if valid
   */
  protected override validateToolParamValues(
    params: WebSearchToolParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(
    params: WebSearchToolParams,
  ): ToolInvocation<WebSearchToolParams, WebSearchToolResult> {
    return new WebSearchToolInvocation(this.config, params);
  }
}
