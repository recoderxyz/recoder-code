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
  OpenRouterImageGenerator,
  type ImageGenerationOptions 
} from 'recoder-code-core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Parse command arguments for image generation
 */
function parseImageArgs(args: string): {
  prompt: string;
  options: ImageGenerationOptions;
} {
  const parts = args.split('--').map((p) => p.trim());
  const prompt = parts[0];
  const options: ImageGenerationOptions = { prompt };

  // Parse flags
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const [key, ...valueParts] = part.split(' ');
    const value = valueParts.join(' ').trim();

    switch (key.toLowerCase()) {
      case 'model':
        options.model = value;
        break;
      case 'size':
        options.size = value as any;
        break;
      case 'quality':
        options.quality = value as 'standard' | 'hd';
        break;
      case 'n':
      case 'count':
        options.n = parseInt(value);
        break;
      case 'style':
        options.style = value as 'vivid' | 'natural';
        break;
      case 'negative':
      case 'negative-prompt':
        options.negativePrompt = value;
        break;
      case 'seed':
        options.seed = parseInt(value);
        break;
      case 'steps':
        options.steps = parseInt(value);
        break;
      case 'guidance':
      case 'guidance-scale':
        options.guidanceScale = parseFloat(value);
        break;
    }
  }

  return { prompt, options };
}

/**
 * Save image to file system
 */
async function saveImage(
  imageData: { url?: string; b64_json?: string },
  index: number,
): Promise<string> {
  const timestamp = Date.now();
  const filename = `image_${timestamp}_${index}.png`;
  const imagesDir = path.join(process.cwd(), '.recoder', 'images');
  
  // Create directory if it doesn't exist
  await fs.mkdir(imagesDir, { recursive: true });
  
  const filepath = path.join(imagesDir, filename);

  if (imageData.b64_json) {
    // Save from base64
    const buffer = Buffer.from(imageData.b64_json, 'base64');
    await fs.writeFile(filepath, buffer);
  } else if (imageData.url) {
    // Download from URL
    const response = await fetch(imageData.url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await fs.writeFile(filepath, Buffer.from(buffer));
  } else {
    throw new Error('No image data available');
  }

  return filepath;
}

export const imageCommand: SlashCommand = {
  name: 'image',
  description: 'Generate images using AI models (DALL-E, Stable Diffusion, etc.)',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const args = context.invocation?.args?.trim();

    if (!args) {
      return {
        type: 'message',
        messageType: 'info',
        content:
          '🎨 Image Generation\n\n' +
          '**Usage:**\n' +
          '  /image <prompt> [options]\n\n' +
          '**Examples:**\n' +
          '  /image a beautiful sunset over mountains\n' +
          '  /image a cat coding --model dall-e-3 --quality hd\n' +
          '  /image abstract art --model dall-e-2 --n 3\n' +
          '  /image portrait --size 1024x1024\n\n' +
          '**Options:**\n' +
          '  --model <model>           Model to use (dall-e-3 recommended, see /image models for all)\n' +
          '  --size <size>             Image size (1024x1024, 1792x1024, etc.)\n' +
          '  --quality <quality>       Quality (standard, hd) - for DALL-E 3\n' +
          '  --n <count>               Number of images (1-10 for DALL-E 2)\n' +
          '  --style <style>           Style (vivid, natural) - for DALL-E 3\n\n' +
          '**Available Commands:**\n' +
          '  /image models             List all available image models\n' +
          '  /image help               Show this help\n\n' +
          '💡 Tip: Use dall-e-3 or dall-e-2 for reliable image generation\n' +
          '🔑 Requires: OPENROUTER_API_KEY or OPENAI_API_KEY',
      };
    }

    try {
      const { prompt, options } = parseImageArgs(args);

      // Create generator
      const generator = new OpenRouterImageGenerator();

      // Show generation start message
      const startMessage = `🎨 Generating image${options.n && options.n > 1 ? 's' : ''}...\n\n` +
        `**Prompt:** ${prompt}\n` +
        `**Model:** ${options.model || 'dall-e-3'}\n` +
        (options.size ? `**Size:** ${options.size}\n` : '') +
        (options.quality ? `**Quality:** ${options.quality}\n` : '') +
        (options.n ? `**Count:** ${options.n}\n` : '');

      console.log(startMessage);

      // Generate images
      const result = await generator.generate(options);

      if (!result.data || result.data.length === 0) {
        return {
          type: 'message',
          messageType: 'error',
          content: 'No images were generated. Please try again.',
        };
      }

      // Save images
      const savedPaths: string[] = [];
      for (let i = 0; i < result.data.length; i++) {
        const imageData = result.data[i];
        try {
          const filepath = await saveImage(imageData, i);
          savedPaths.push(filepath);
        } catch (error) {
          console.error(`Failed to save image ${i}:`, error);
        }
      }

      // Build success message
      let content = '✅ Image generation complete!\n\n';
      
      if (savedPaths.length > 0) {
        content += '**Saved Images:**\n';
        savedPaths.forEach((p, i) => {
          content += `  ${i + 1}. ${p}\n`;
        });
        content += '\n';
      }

      // Add URLs if available
      const urls = result.data.filter((d) => d.url).map((d) => d.url);
      if (urls.length > 0) {
        content += '**URLs:**\n';
        urls.forEach((url, i) => {
          content += `  ${i + 1}. ${url}\n`;
        });
        content += '\n';
      }

      // Add revised prompts if available
      const revisedPrompts = result.data
        .filter((d) => d.revised_prompt)
        .map((d) => d.revised_prompt);
      if (revisedPrompts.length > 0 && revisedPrompts[0] !== prompt) {
        content += `**Revised Prompt:** ${revisedPrompts[0]}\n\n`;
      }

      // Add metadata
      if (result.metadata) {
        content += '**Metadata:**\n';
        if (result.metadata.cost) {
          content += `  • Cost: $${result.metadata.cost.toFixed(4)}\n`;
        }
        if (result.metadata.time) {
          content += `  • Generation Time: ${result.metadata.time.toFixed(2)}s\n`;
        }
        if (result.metadata.id) {
          content += `  • Generation ID: ${result.metadata.id}\n`;
        }
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
        content:
          '❌ Image generation failed\n\n' +
          `**Error:** ${error instanceof Error ? error.message : String(error)}\n\n` +
          '**Common Issues:**\n' +
          '  • API key not set (OPENROUTER_API_KEY or OPENAI_API_KEY)\n' +
          '  • Insufficient credits\n' +
          '  • Invalid model or parameters\n' +
          '  • Network error\n\n' +
          'Use `/image help` for usage information.',
      };
    }
  },
  subCommands: [
    {
      name: 'models',
      description: 'List all available image generation models',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        const models = OpenRouterImageGenerator.listModels();

        let content = '🎨 Available Image Generation Models\n\n';

        // Group by provider
        const byProvider: Record<string, typeof models> = models.reduce(
          (acc: Record<string, typeof models>, model) => {
            if (!acc[model.provider]) {
              acc[model.provider] = [];
            }
            acc[model.provider].push(model);
            return acc;
          },
          {},
        );

        Object.entries(byProvider).forEach(([provider, providerModels]) => {
          content += `**${provider}**\n`;
          providerModels.forEach((model) => {
            content += `  • **${model.id}** - ${model.name}\n`;
            if (model.capabilities.length > 0) {
              content += `    Supports: ${model.capabilities.join(', ')}\n`;
            }
          });
          content += '\n';
        });

        content += '**Usage:**\n';
        content += '  /image "your prompt" --model <model-id>\n\n';
        content += '**Recommended Models:**\n';
        content += '  /image "a beautiful landscape" --model dall-e-3 --quality hd\n';
        content += '  /image "abstract art" --model dall-e-2 --n 3\n\n';
        content += '💡 DALL-E models are most reliable for actual image generation';

        return {
          type: 'message',
          messageType: 'info',
          content,
        };
      },
    },
    {
      name: 'help',
      description: 'Show image generation help',
      kind: CommandKind.BUILT_IN,
      action: async (): Promise<MessageActionReturn> => {
        return {
          type: 'message',
          messageType: 'info',
          content:
            '🎨 Image Generation\n\n' +
            '**Usage:**\n' +
            '  /image <prompt> [options]\n\n' +
            '**Examples:**\n' +
            '  /image a beautiful sunset over mountains\n' +
            '  /image a cat coding --model dall-e-3 --quality hd\n' +
            '  /image abstract art --model dall-e-2 --n 3\n' +
            '  /image portrait --size 1024x1024\n\n' +
            '**Options:**\n' +
            '  --model <model>           Model to use (dall-e-3 recommended, see /image models for all)\n' +
            '  --size <size>             Image size (1024x1024, 1792x1024, etc.)\n' +
            '  --quality <quality>       Quality (standard, hd) - for DALL-E 3\n' +
            '  --n <count>               Number of images (1-10 for DALL-E 2)\n' +
            '  --style <style>           Style (vivid, natural) - for DALL-E 3\n\n' +
            '**Available Commands:**\n' +
            '  /image models             List all available image models\n' +
            '  /image help               Show this help\n\n' +
            '💡 Tip: Use dall-e-3 or dall-e-2 for reliable image generation\n' +
            '🔑 Requires: OPENROUTER_API_KEY or OPENAI_API_KEY',
        };
      },
    },
  ],
};
