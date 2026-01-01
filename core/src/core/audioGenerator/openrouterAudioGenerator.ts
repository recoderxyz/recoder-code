/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  AudioGenerationModel,
  TranscriptionOptions,
  TextToSpeechOptions,
  TranslationOptions,
  TranscriptionResult,
  TTSResult,
  AudioFormat,
} from './types.js';
import { AUDIO_MODELS } from './types.js';

/**
 * OpenRouter Audio Generator
 * Supports transcription, text-to-speech, and translation using OpenRouter API
 */
export class OpenRouterAudioGenerator {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey =
      apiKey ||
      process.env['OPENROUTER_API_KEY'] ||
      process.env['OPENAI_API_KEY'] ||
      '';
    this.baseUrl =
      baseUrl ||
      process.env['OPENROUTER_AUDIO_BASE_URL'] ||
      'https://openrouter.ai/api/v1';

    if (!this.apiKey) {
      throw new Error(
        'API key is required. Set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.',
      );
    }
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(
    options: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    const model = options.model || 'openai/whisper-1';
    const modelInfo = AUDIO_MODELS[model];

    if (!modelInfo || modelInfo.type !== 'transcription') {
      throw new Error(
        `Model ${model} is not supported for transcription. Use whisper-1, chirp, or seamless-m4t.`,
      );
    }

    try {
      const startTime = Date.now();

      // Read audio file if path is provided
      const audioBuffer =
        typeof options.audioFile === 'string'
          ? await fs.readFile(options.audioFile)
          : options.audioFile;

      // Create form data
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
        type: `audio/${options.format || 'mp3'}`,
      });
      formData.append('file', audioBlob, `audio.${options.format || 'mp3'}`);
      formData.append('model', model);

      if (options.language) {
        formData.append('language', options.language);
      }

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      if (options.responseFormat) {
        formData.append('response_format', options.responseFormat);
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', String(options.temperature));
      }

      if (options.timestampGranularities) {
        formData.append(
          'timestamp_granularities[]',
          options.timestampGranularities.join(','),
        );
      }

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Transcription failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const result = await response.json();
      const endTime = Date.now();

      // Extract metadata from headers
      const generationId = response.headers.get('x-openrouter-generation-id');
      const cost = response.headers.get('x-openrouter-cost');

      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
        words: result.words,
        metadata: {
          id: generationId || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          model,
          processingTime: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Transcription failed: ${String(error)}`);
    }
  }

  /**
   * Generate speech from text
   */
  async textToSpeech(options: TextToSpeechOptions): Promise<TTSResult> {
    const model = options.model || 'openai/tts-1';
    const modelInfo = AUDIO_MODELS[model];

    if (!modelInfo || modelInfo.type !== 'tts') {
      throw new Error(
        `Model ${model} is not supported for text-to-speech. Use tts-1, tts-1-hd, or elevenlabs models.`,
      );
    }

    try {
      const startTime = Date.now();

      // Build request body
      const requestBody: any = {
        model,
        input: options.text,
        voice: options.voice || 'alloy',
      };

      if (options.format) {
        requestBody.response_format = options.format;
      }

      if (options.speed !== undefined) {
        requestBody.speed = options.speed;
      }

      // ElevenLabs-specific options
      if (model.includes('elevenlabs')) {
        if (options.stability !== undefined) {
          requestBody.stability = options.stability;
        }
        if (options.similarityBoost !== undefined) {
          requestBody.similarity_boost = options.similarityBoost;
        }
      }

      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Text-to-speech failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      // Get audio buffer
      const audioBuffer = await response.arrayBuffer();
      const endTime = Date.now();

      // Extract metadata from headers
      const generationId = response.headers.get('x-openrouter-generation-id');
      const cost = response.headers.get('x-openrouter-cost');

      return {
        audio: Buffer.from(audioBuffer),
        format: (options.format || 'mp3') as AudioFormat,
        metadata: {
          id: generationId || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          model,
          voice: options.voice || 'alloy',
          processingTime: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Text-to-speech failed: ${String(error)}`);
    }
  }

  /**
   * Translate audio to English text
   */
  async translate(options: TranslationOptions): Promise<TranscriptionResult> {
    const model = options.model || 'openai/whisper-1';
    const modelInfo = AUDIO_MODELS[model];

    if (!modelInfo || !('supportsTranslation' in modelInfo) || !modelInfo.supportsTranslation) {
      throw new Error(
        `Model ${model} does not support translation. Use whisper-1 or seamless-m4t.`,
      );
    }

    try {
      const startTime = Date.now();

      // Read audio file if path is provided
      const audioBuffer =
        typeof options.audioFile === 'string'
          ? await fs.readFile(options.audioFile)
          : options.audioFile;

      // Create form data
      const formData = new FormData();
      const audioBlob = new Blob([new Uint8Array(audioBuffer)], {
        type: `audio/${options.format || 'mp3'}`,
      });
      formData.append('file', audioBlob, `audio.${options.format || 'mp3'}`);
      formData.append('model', model);

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', String(options.temperature));
      }

      const response = await fetch(`${this.baseUrl}/audio/translations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/QwenLM/qwen-code.git',
          'X-Title': 'Qwen Code',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Translation failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const result = await response.json();
      const endTime = Date.now();

      // Extract metadata from headers
      const generationId = response.headers.get('x-openrouter-generation-id');
      const cost = response.headers.get('x-openrouter-cost');

      return {
        text: result.text,
        language: 'en', // Whisper always translates to English
        duration: result.duration,
        metadata: {
          id: generationId || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          model,
          processingTime: (endTime - startTime) / 1000,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Translation failed: ${String(error)}`);
    }
  }

  /**
   * List available audio models
   */
  static listModels(): Array<{
    id: AudioGenerationModel;
    name: string;
    provider: string;
    type: string;
    capabilities: string[];
  }> {
    return Object.entries(AUDIO_MODELS).map(([id, info]: [string, any]) => {
      const capabilities: string[] = [];

      if (info.type) capabilities.push(info.type);
      if (info.supportsTimestamps) capabilities.push('timestamps');
      if (info.supportsTranslation) capabilities.push('translation');
      if (info.supportsVoiceCustomization)
        capabilities.push('voice customization');
      if (info.quality) capabilities.push(`${info.quality} quality`);

      return {
        id: id as AudioGenerationModel,
        name: info.name,
        provider: info.provider,
        type: info.type,
        capabilities,
      };
    });
  }

  /**
   * Get model information
   */
  static getModelInfo(modelId: AudioGenerationModel) {
    return AUDIO_MODELS[modelId];
  }
}
