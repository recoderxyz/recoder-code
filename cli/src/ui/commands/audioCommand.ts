/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  OpenRouterAudioGenerator,
  type TranscriptionOptions,
  type TextToSpeechOptions,
} from 'recoder-code-core';
import * as fs from 'fs/promises';
import * as path from 'path';

export const audioCommand: SlashCommand = {
  name: 'audio',
  description: 'Audio generation and transcription (Whisper, TTS, translation)',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    return {
      type: 'message',
      messageType: 'info',
      content:
        '🎤 Audio Features\n\n' +
        '**Available Commands:**\n' +
        '  /audio transcribe <file>      Transcribe audio to text\n' +
        '  /audio tts "<text>"           Convert text to speech\n' +
        '  /audio translate <file>       Translate audio to English\n' +
        '  /audio models                 List available audio models\n' +
        '  /audio help                   Show this help\n\n' +
        '**Examples:**\n' +
        '  /audio transcribe recording.mp3\n' +
        '  /audio tts "Hello, world!" --voice nova --format mp3\n' +
        '  /audio translate spanish_audio.wav\n\n' +
        '🔑 Requires: OPENROUTER_API_KEY or OPENAI_API_KEY',
    };
  },
  subCommands: [
    {
      name: 'transcribe',
      description: 'Transcribe audio file to text',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim();

        if (!args) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /audio transcribe <file> [options]\n\n' +
              'Options:\n' +
              '  --model <model>       Model to use (whisper-1, chirp, seamless-m4t)\n' +
              '  --language <lang>     Audio language (e.g., en, es, fr)\n' +
              '  --format <format>     Response format (json, text, srt, vtt)\n' +
              '  --timestamps          Include word-level timestamps',
          };
        }

        try {
          const parts = args.split('--');
          const filePath = parts[0].trim();
          
          // Parse options
          const options: TranscriptionOptions = {
            audioFile: filePath,
          };

          for (let i = 1; i < parts.length; i++) {
            const [key, value] = parts[i].split(' ').map((s) => s.trim());
            
            if (key === 'model') options.model = value as any;
            if (key === 'language') options.language = value;
            if (key === 'format') options.responseFormat = value as any;
            if (key === 'timestamps') options.timestampGranularities = ['word', 'segment'];
          }

          const generator = new OpenRouterAudioGenerator();
          const result = await generator.transcribe(options);

          let content = '✅ Transcription complete!\n\n';
          content += `**Text:**\n${result.text}\n\n`;
          
          if (result.language) {
            content += `**Language:** ${result.language}\n`;
          }
          
          if (result.duration) {
            content += `**Duration:** ${result.duration.toFixed(2)}s\n`;
          }

          if (result.metadata?.cost) {
            content += `**Cost:** $${result.metadata.cost.toFixed(4)}\n`;
          }

          return {
            type: 'message',
            messageType: 'info',
            content,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Transcription failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'tts',
      description: 'Convert text to speech',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim();

        if (!args) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /audio tts "<text>" [options]\n\n' +
              'Options:\n' +
              '  --model <model>       Model (tts-1, tts-1-hd, elevenlabs)\n' +
              '  --voice <voice>       Voice (alloy, echo, fable, onyx, nova, shimmer)\n' +
              '  --format <format>     Format (mp3, opus, aac, flac, wav)\n' +
              '  --speed <speed>       Speed (0.25-4.0)',
          };
        }

        try {
          // Extract text (can be in quotes)
          const textMatch = args.match(/"([^"]+)"/);
          const text = textMatch ? textMatch[1] : args.split('--')[0].trim();

          const options: TextToSpeechOptions = {
            text,
          };

          // Parse options
          const optionsPart = args.substring(text.length);
          const parts = optionsPart.split('--');

          for (let i = 1; i < parts.length; i++) {
            const [key, value] = parts[i].split(' ').map((s) => s.trim());
            
            if (key === 'model') options.model = value as any;
            if (key === 'voice') options.voice = value as any;
            if (key === 'format') options.format = value as any;
            if (key === 'speed') options.speed = parseFloat(value);
          }

          const generator = new OpenRouterAudioGenerator();
          const result = await generator.textToSpeech(options);

          // Save audio file
          const timestamp = Date.now();
          const filename = `tts_${timestamp}.${result.format}`;
          const audioDir = path.join(process.cwd(), '.recoder', 'audio');
          await fs.mkdir(audioDir, { recursive: true });
          
          const filepath = path.join(audioDir, filename);
          await fs.writeFile(filepath, result.audio);

          let content = '✅ Text-to-speech complete!\n\n';
          content += `**Saved to:** ${filepath}\n`;
          content += `**Format:** ${result.format}\n`;
          content += `**Voice:** ${result.metadata?.voice}\n`;
          
          if (result.metadata?.cost) {
            content += `**Cost:** $${result.metadata.cost.toFixed(4)}\n`;
          }

          return {
            type: 'message',
            messageType: 'info',
            content,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Text-to-speech failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'translate',
      description: 'Translate audio to English',
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<MessageActionReturn> => {
        const args = context.invocation?.args?.trim();

        if (!args) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /audio translate <file> [options]\n\n' +
              'Translates audio from any language to English.\n\n' +
              'Options:\n' +
              '  --model <model>       Model to use (whisper-1, seamless-m4t)',
          };
        }

        try {
          const parts = args.split('--');
          const filePath = parts[0].trim();

          const generator = new OpenRouterAudioGenerator();
          const result = await generator.translate({
            audioFile: filePath,
          });

          let content = '✅ Translation complete!\n\n';
          content += `**Translated Text:**\n${result.text}\n\n`;
          content += `**Target Language:** English\n`;
          
          if (result.duration) {
            content += `**Duration:** ${result.duration.toFixed(2)}s\n`;
          }

          if (result.metadata?.cost) {
            content += `**Cost:** $${result.metadata.cost.toFixed(4)}\n`;
          }

          return {
            type: 'message',
            messageType: 'info',
            content,
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Translation failed: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    },
    {
      name: 'models',
      description: 'List available audio models',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const models = OpenRouterAudioGenerator.listModels();

        let content = '🎤 Available Audio Models\n\n';

        // Group by type
        const byType: Record<string, typeof models> = {};
        models.forEach((model) => {
          if (!byType[model.type]) {
            byType[model.type] = [];
          }
          byType[model.type].push(model);
        });

        Object.entries(byType).forEach(([type, typeModels]) => {
          content += `**${type.toUpperCase()}**\n`;
          typeModels.forEach((model) => {
            content += `  • **${model.id}** - ${model.name} (${model.provider})\n`;
            if (model.capabilities.length > 0) {
              content += `    ${model.capabilities.join(', ')}\n`;
            }
          });
          content += '\n';
        });

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
  ],
};
