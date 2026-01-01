/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Audio generation models supported by OpenRouter
 */
export type AudioGenerationModel =
  | 'openai/whisper-1' // Speech-to-text
  | 'openai/tts-1' // Text-to-speech (standard)
  | 'openai/tts-1-hd' // Text-to-speech (high-quality)
  | 'elevenlabs/eleven-monolingual-v1' // ElevenLabs TTS
  | 'elevenlabs/eleven-multilingual-v2' // ElevenLabs multilingual
  | 'google/chirp' // Google Chirp audio generation
  | 'meta/seamless-m4t'; // Meta's multilingual & multimodal AI

/**
 * TTS voice options
 */
export type TTSVoice = 
  | 'alloy' 
  | 'echo' 
  | 'fable' 
  | 'onyx' 
  | 'nova' 
  | 'shimmer';

/**
 * Audio format options
 */
export type AudioFormat =
  | 'mp3'
  | 'opus'
  | 'aac'
  | 'flac'
  | 'wav'
  | 'pcm';

/**
 * Transcription options (Speech-to-text)
 */
export interface TranscriptionOptions {
  /** Audio file to transcribe */
  audioFile: Buffer | string; // Buffer or file path
  
  /** Audio file format */
  format?: AudioFormat;
  
  /** Model to use for transcription */
  model?: Extract<AudioGenerationModel, 'openai/whisper-1' | 'google/chirp' | 'meta/seamless-m4t'>;
  
  /** Language of the audio (ISO-639-1 format) */
  language?: string;
  
  /** Prompt to guide the model's style */
  prompt?: string;
  
  /** Response format */
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  
  /** Temperature for sampling (0-1) */
  temperature?: number;
  
  /** Enable word-level timestamps */
  timestampGranularities?: ('word' | 'segment')[];
}

/**
 * Text-to-speech options
 */
export interface TextToSpeechOptions {
  /** Text to convert to speech */
  text: string;
  
  /** Model to use */
  model?: Extract<
    AudioGenerationModel,
    | 'openai/tts-1'
    | 'openai/tts-1-hd'
    | 'elevenlabs/eleven-monolingual-v1'
    | 'elevenlabs/eleven-multilingual-v2'
  >;
  
  /** Voice to use */
  voice?: TTSVoice | string;
  
  /** Output audio format */
  format?: AudioFormat;
  
  /** Speed of speech (0.25 to 4.0) */
  speed?: number;
  
  /** Voice stability (0-1, ElevenLabs only) */
  stability?: number;
  
  /** Voice similarity boost (0-1, ElevenLabs only) */
  similarityBoost?: number;
}

/**
 * Translation options (Speech-to-text with translation)
 */
export interface TranslationOptions {
  /** Audio file to translate */
  audioFile: Buffer | string;
  
  /** Audio file format */
  format?: AudioFormat;
  
  /** Model to use */
  model?: Extract<AudioGenerationModel, 'openai/whisper-1' | 'meta/seamless-m4t'>;
  
  /** Target language for translation */
  targetLanguage?: string;
  
  /** Prompt to guide translation */
  prompt?: string;
  
  /** Temperature for sampling */
  temperature?: number;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  /** Transcribed text */
  text: string;
  
  /** Language detected (if not specified) */
  language?: string;
  
  /** Duration in seconds */
  duration?: number;
  
  /** Word-level or segment-level timestamps */
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    tokens?: number[];
    temperature?: number;
    avgLogProb?: number;
    compressionRatio?: number;
    noSpeechProb?: number;
  }>;
  
  /** Words with timestamps (if requested) */
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  
  /** Metadata */
  metadata?: {
    id?: string;
    cost?: number;
    model?: string;
    processingTime?: number;
  };
}

/**
 * TTS result
 */
export interface TTSResult {
  /** Audio data as Buffer */
  audio: Buffer;
  
  /** Audio format */
  format: AudioFormat;
  
  /** Duration in seconds (if available) */
  duration?: number;
  
  /** Metadata */
  metadata?: {
    id?: string;
    cost?: number;
    model?: string;
    voice?: string;
    processingTime?: number;
  };
}

/**
 * Model capabilities
 */
export const AUDIO_MODELS = {
  'openai/whisper-1': {
    name: 'OpenAI Whisper',
    provider: 'OpenAI',
    type: 'transcription' as const,
    supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
    maxFileSize: 25 * 1024 * 1024, // 25MB
    supportedLanguages: 'multilingual',
    supportsTimestamps: true,
    supportsTranslation: true,
  },
  'openai/tts-1': {
    name: 'OpenAI TTS Standard',
    provider: 'OpenAI',
    type: 'tts' as const,
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
    speedRange: [0.25, 4.0],
    maxTextLength: 4096,
  },
  'openai/tts-1-hd': {
    name: 'OpenAI TTS HD',
    provider: 'OpenAI',
    type: 'tts' as const,
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
    speedRange: [0.25, 4.0],
    maxTextLength: 4096,
    quality: 'hd',
  },
  'elevenlabs/eleven-monolingual-v1': {
    name: 'ElevenLabs Monolingual',
    provider: 'ElevenLabs',
    type: 'tts' as const,
    languages: ['en'],
    supportsVoiceCustomization: true,
    quality: 'high',
  },
  'elevenlabs/eleven-multilingual-v2': {
    name: 'ElevenLabs Multilingual',
    provider: 'ElevenLabs',
    type: 'tts' as const,
    languages: 'multilingual',
    supportsVoiceCustomization: true,
    quality: 'high',
  },
  'google/chirp': {
    name: 'Google Chirp',
    provider: 'Google',
    type: 'transcription' as const,
    supportedLanguages: 'multilingual',
    quality: 'high',
  },
  'meta/seamless-m4t': {
    name: 'Meta Seamless M4T',
    provider: 'Meta',
    type: 'multimodal' as const,
    supportedLanguages: 'multilingual',
    supportsTranslation: true,
    supportsTranscription: true,
  },
} as const;
