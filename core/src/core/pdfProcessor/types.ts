/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PDF processing options
 */
export interface PDFProcessingOptions {
  /** PDF file as Buffer or file path */
  pdfFile: Buffer | string;

  /** Model to use for processing */
  model?: string;

  /** Pages to extract (e.g., "1-5", "1,3,5", "all") */
  pages?: string;

  /** Whether to extract images */
  extractImages?: boolean;

  /** Whether to extract tables */
  extractTables?: boolean;

  /** Whether to perform OCR on scanned PDFs */
  performOCR?: boolean;

  /** Language for OCR (ISO-639-1 format) */
  ocrLanguage?: string;

  /** Maximum file size in bytes */
  maxFileSize?: number;

  /** Output format for extracted content */
  outputFormat?: 'text' | 'markdown' | 'json';
}

/**
 * PDF processing result
 */
export interface PDFProcessingResult {
  /** Extracted text content */
  text: string;

  /** Page-by-page content */
  pages: Array<{
    pageNumber: number;
    text: string;
    images?: Array<{
      id: string;
      base64?: string;
      url?: string;
      width?: number;
      height?: number;
      caption?: string;
    }>;
    tables?: Array<{
      id: string;
      headers: string[];
      rows: string[][];
      markdown?: string;
    }>;
  }>;

  /** Extracted images (if requested) */
  images?: Array<{
    id: string;
    pageNumber: number;
    base64?: string;
    url?: string;
    width?: number;
    height?: number;
    caption?: string;
  }>;

  /** Extracted tables (if requested) */
  tables?: Array<{
    id: string;
    pageNumber: number;
    headers: string[];
    rows: string[][];
    markdown?: string;
  }>;

  /** Metadata */
  metadata: {
    pageCount: number;
    fileSize: number;
    title?: string;
    author?: string;
    creationDate?: string;
    modificationDate?: string;
    processingTime?: number;
    cost?: number;
    model?: string;
  };
}

/**
 * PDF to chat message options
 */
export interface PDFToChatOptions {
  /** PDF file */
  pdfFile: Buffer | string;

  /** Instruction/question about the PDF */
  instruction?: string;

  /** Model to use for processing and chat */
  model?: string;

  /** Pages to analyze */
  pages?: string;

  /** Temperature for response */
  temperature?: number;

  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * PDF chat result
 */
export interface PDFChatResult {
  /** AI response about the PDF */
  response: string;

  /** Extracted PDF content used for context */
  pdfContent: {
    text: string;
    pageCount: number;
  };

  /** Metadata */
  metadata: {
    inputTokens: number;
    outputTokens: number;
    cost?: number;
    model?: string;
    processingTime?: number;
  };
}

/**
 * Supported PDF models
 */
export const PDF_PROCESSING_MODELS = {
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsImages: true,
    supportsTables: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxPages: 100,
  },
  'claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsImages: true,
    supportsTables: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxPages: 100,
  },
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsImages: true,
    supportsTables: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxPages: 100,
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsImages: true,
    supportsTables: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxPages: 100,
  },
  'gemini-2.0-flash-exp': {
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    supportsPDF: true,
    supportsImages: true,
    supportsTables: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxPages: 2000,
  },
} as const;

export type PDFProcessingModel = keyof typeof PDF_PROCESSING_MODELS;
