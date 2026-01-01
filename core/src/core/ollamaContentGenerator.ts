/**
 * Ollama Content Generator - Local AI support
 * Integrates Ollama with the ContentGenerator interface
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { ContentGenerator, ContentGeneratorConfig } from './contentGenerator.js';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaContentGenerator implements ContentGenerator {
  private baseUrl: string;
  private model: string;

  constructor(config: ContentGeneratorConfig) {
    this.baseUrl = config.baseUrl || process.env['OLLAMA_BASE_URL'] || DEFAULT_OLLAMA_URL;
    this.model = config.model.replace('ollama/', ''); // Remove provider prefix
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string
  ): Promise<GenerateContentResponse> {
    const messages = this.convertToOllamaMessages(request.contents);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: request.config?.temperature ?? 0.7,
          top_p: request.config?.topP ?? 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return this.convertToGenerateContentResponse(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const self = this;
    const messages = this.convertToOllamaMessages(request.contents);

    async function* streamGenerator(): AsyncGenerator<GenerateContentResponse> {
      const response = await fetch(`${self.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: self.model,
          messages,
          stream: true,
          options: {
            temperature: request.config?.temperature ?? 0.7,
            top_p: request.config?.topP ?? 0.9,
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as OllamaChatResponse;
            yield self.convertToGenerateContentResponse(data);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    return streamGenerator();
  }

  async countTokens(_request: CountTokensParameters): Promise<CountTokensResponse> {
    // Ollama doesn't have a direct token counting API
    return { totalTokens: 0 };
  }

  async embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse> {
    throw new Error('Embeddings not yet supported for Ollama');
  }

  private convertToOllamaMessages(contents: GenerateContentParameters['contents']): OllamaChatMessage[] {
    if (!contents) return [];
    if (!Array.isArray(contents)) return [];

    const messages: OllamaChatMessage[] = [];
    for (const content of contents) {
      // Type guard for Content objects
      if (typeof content === 'object' && 'role' in content && 'parts' in content) {
        let text = '';
        const parts = content.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part === 'object' && 'text' in part) {
              text += (part as { text: string }).text;
            }
          }
        }

        const contentRole = (content as { role: string }).role;
        const role: 'system' | 'user' | 'assistant' =
          contentRole === 'model' ? 'assistant' : contentRole === 'user' ? 'user' : 'system';
        messages.push({ role, content: text });
      }
    }
    return messages;
  }

  private convertToGenerateContentResponse(data: OllamaChatResponse): GenerateContentResponse {
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: data.message?.content || '' }],
          },
          finishReason: data.done ? 'STOP' : undefined,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: data.prompt_eval_count || 0,
        candidatesTokenCount: data.eval_count || 0,
        totalTokenCount: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    } as GenerateContentResponse;
  }
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(baseUrl?: string): Promise<boolean> {
  const url = baseUrl || process.env['OLLAMA_BASE_URL'] || DEFAULT_OLLAMA_URL;
  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create Ollama content generator
 */
export function createOllamaContentGenerator(
  config: ContentGeneratorConfig
): ContentGenerator {
  return new OllamaContentGenerator(config);
}
