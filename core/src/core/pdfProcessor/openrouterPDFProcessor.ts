/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import type {
  PDFProcessingOptions,
  PDFProcessingResult,
  PDFToChatOptions,
  PDFChatResult,
  PDFProcessingModel,
} from './types.js';
import { PDF_PROCESSING_MODELS } from './types.js';

/**
 * OpenRouter PDF Processor
 * Supports PDF text extraction, analysis, and chat using multimodal models
 */
export class OpenRouterPDFProcessor {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: PDFProcessingModel;

  constructor(
    apiKey?: string,
    baseUrl?: string,
    defaultModel?: PDFProcessingModel,
  ) {
    this.apiKey =
      apiKey ||
      process.env['OPENROUTER_API_KEY'] ||
      process.env['OPENAI_API_KEY'] ||
      '';
    this.baseUrl =
      baseUrl ||
      process.env['OPENROUTER_BASE_URL'] ||
      'https://openrouter.ai/api/v1';
    this.defaultModel = defaultModel || 'gpt-4o';

    if (!this.apiKey) {
      throw new Error(
        'API key is required. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.',
      );
    }
  }

  /**
   * Process PDF file and extract content
   */
  async process(
    options: PDFProcessingOptions,
  ): Promise<PDFProcessingResult> {
    const model = options.model || this.defaultModel;
    const modelInfo = PDF_PROCESSING_MODELS[model as PDFProcessingModel];

    if (!modelInfo || !modelInfo.supportsPDF) {
      throw new Error(
        `Model ${model} does not support PDF processing. Supported models: ${Object.keys(PDF_PROCESSING_MODELS).join(', ')}`,
      );
    }

    try {
      const startTime = Date.now();

      // Read PDF file if path is provided
      const pdfBuffer =
        typeof options.pdfFile === 'string'
          ? await fs.readFile(options.pdfFile)
          : options.pdfFile;

      // Check file size
      if (pdfBuffer.length > (options.maxFileSize || modelInfo.maxFileSize)) {
        throw new Error(
          `PDF file size (${pdfBuffer.length} bytes) exceeds maximum (${options.maxFileSize || modelInfo.maxFileSize} bytes)`,
        );
      }

      // Convert PDF to base64
      const pdfBase64 = pdfBuffer.toString('base64');

      // Build messages for PDF processing
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.buildProcessingPrompt(options),
            },
            {
              type: 'document',
              document: {
                type: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ];

      // Make API request
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1, // Low temperature for accurate extraction
          response_format:
            options.outputFormat === 'json'
              ? { type: 'json_object' }
              : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `PDF processing failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const result = await response.json();
      const endTime = Date.now();

      // Extract metadata from headers
      const generationId = response.headers.get('x-openrouter-generation-id');
      const cost = response.headers.get('x-openrouter-cost');

      // Parse the response
      const extractedContent = this.parseProcessingResponse(
        result.choices[0].message.content,
        options,
      );

      return {
        ...extractedContent,
        metadata: {
          ...extractedContent.metadata,
          cost: cost ? parseFloat(cost) : undefined,
          model,
          processingTime: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`PDF processing failed: ${String(error)}`);
    }
  }

  /**
   * Chat with PDF content
   */
  async chat(options: PDFToChatOptions): Promise<PDFChatResult> {
    const model = options.model || this.defaultModel;
    const modelInfo = PDF_PROCESSING_MODELS[model as PDFProcessingModel];

    if (!modelInfo || !modelInfo.supportsPDF) {
      throw new Error(
        `Model ${model} does not support PDF processing. Supported models: ${Object.keys(PDF_PROCESSING_MODELS).join(', ')}`,
      );
    }

    try {
      const startTime = Date.now();

      // Read PDF file if path is provided
      const pdfBuffer =
        typeof options.pdfFile === 'string'
          ? await fs.readFile(options.pdfFile)
          : options.pdfFile;

      // Check file size
      if (pdfBuffer.length > modelInfo.maxFileSize) {
        throw new Error(
          `PDF file size (${pdfBuffer.length} bytes) exceeds maximum (${modelInfo.maxFileSize} bytes)`,
        );
      }

      // Convert PDF to base64
      const pdfBase64 = pdfBuffer.toString('base64');

      // Build messages
      const userInstruction =
        options.instruction ||
        'Please analyze this PDF and provide a comprehensive summary.';

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userInstruction,
            },
            {
              type: 'document',
              document: {
                type: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ];

      // Make API request
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `PDF chat failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const result = await response.json();
      const endTime = Date.now();

      // Extract metadata from headers
      const cost = response.headers.get('x-openrouter-cost');

      return {
        response: result.choices[0].message.content,
        pdfContent: {
          text: '', // Would need separate extraction call for full content
          pageCount: 0,
        },
        metadata: {
          inputTokens: result.usage?.prompt_tokens || 0,
          outputTokens: result.usage?.completion_tokens || 0,
          cost: cost ? parseFloat(cost) : undefined,
          model,
          processingTime: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`PDF chat failed: ${String(error)}`);
    }
  }

  /**
   * Build processing prompt based on options
   */
  private buildProcessingPrompt(options: PDFProcessingOptions): string {
    const parts: string[] = [
      'Please extract and analyze the content from this PDF document.',
    ];

    if (options.pages && options.pages !== 'all') {
      parts.push(`Focus on pages: ${options.pages}.`);
    }

    if (options.extractImages) {
      parts.push('Extract and describe all images.');
    }

    if (options.extractTables) {
      parts.push('Extract all tables and convert them to structured format.');
    }

    if (options.performOCR) {
      parts.push(
        `Perform OCR on scanned content${options.ocrLanguage ? ` in ${options.ocrLanguage} language` : ''}.`,
      );
    }

    if (options.outputFormat === 'markdown') {
      parts.push('Format the output in Markdown.');
    } else if (options.outputFormat === 'json') {
      parts.push(
        'Format the output as JSON with structure: {text, pages: [{pageNumber, text, images, tables}], metadata}',
      );
    }

    return parts.join(' ');
  }

  /**
   * Parse processing response from model
   */
  private parseProcessingResponse(
    content: string,
    options: PDFProcessingOptions,
  ): PDFProcessingResult {
    // Try to parse as JSON if that format was requested
    if (options.outputFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        return {
          text: parsed.text || content,
          pages: parsed.pages || [],
          images: parsed.images,
          tables: parsed.tables,
          metadata: parsed.metadata || {
            pageCount: 0,
            fileSize: 0,
          },
        };
      } catch {
        // Fall through to default parsing
      }
    }

    // Default: return content as single text block
    return {
      text: content,
      pages: [
        {
          pageNumber: 1,
          text: content,
        },
      ],
      metadata: {
        pageCount: 1,
        fileSize: content.length,
      },
    };
  }

  /**
   * List supported PDF processing models
   */
  static listModels(): Array<{
    id: PDFProcessingModel;
    name: string;
    provider: string;
    maxFileSize: number;
    maxPages: number;
    capabilities: string[];
  }> {
    return Object.entries(PDF_PROCESSING_MODELS).map(([id, info]: [string, any]) => {
      const capabilities: string[] = [];

      if (info.supportsPDF) capabilities.push('PDF processing');
      if (info.supportsImages) capabilities.push('image extraction');
      if (info.supportsTables) capabilities.push('table extraction');

      return {
        id: id as PDFProcessingModel,
        name: info.name,
        provider: info.provider,
        maxFileSize: info.maxFileSize,
        maxPages: info.maxPages,
        capabilities,
      };
    });
  }

  /**
   * Get model information
   */
  static getModelInfo(modelId: PDFProcessingModel) {
    return PDF_PROCESSING_MODELS[modelId];
  }
}
