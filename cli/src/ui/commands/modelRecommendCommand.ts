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

/**
 * Task type for model recommendations
 */
type TaskType = 'coding' | 'reasoning' | 'chat' | 'vision' | 'speed' | 'cost';

/**
 * Model recommendation with details
 */
interface ModelRecommendation {
  id: string;
  name: string;
  reason: string;
  contextLength: string;
  cost: string;
  features: string[];
  addCommand: string;
}

/**
 * Get model recommendations based on task type
 */
function getRecommendations(taskType: TaskType): ModelRecommendation[] {
  const recommendations: Record<TaskType, ModelRecommendation[]> = {
    coding: [
      {
        id: 'anthropic/claude-3.5-sonnet-20240620',
        name: 'Claude 3.5 Sonnet',
        reason: 'Best overall coding model with superior accuracy and speed',
        contextLength: '200K',
        cost: 'Premium (~$3/1M tokens)',
        features: ['Code generation', 'Debugging', 'Refactoring', 'Documentation'],
        addCommand: '/add-model anthropic/claude-3.5-sonnet-20240620 "Claude Sonnet 3.5"',
      },
      {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder (Free)',
        reason: 'Best free coding model with excellent code understanding',
        contextLength: '262K',
        cost: 'Free',
        features: ['Code generation', 'Code review', 'Multi-language', 'Large context'],
        addCommand: '/add-model qwen/qwen3-coder:free "Qwen Coder"',
      },
      {
        id: 'deepseek/deepseek-v3',
        name: 'DeepSeek V3',
        reason: 'Excellent for complex coding tasks and algorithms',
        contextLength: '164K',
        cost: 'Premium (~$0.27/1M tokens)',
        features: ['Algorithms', 'Math', 'Code optimization', 'System design'],
        addCommand: '/add-model deepseek/deepseek-v3 "DeepSeek V3"',
      },
    ],
    reasoning: [
      {
        id: 'openai/o1-preview',
        name: 'OpenAI O1 Preview',
        reason: 'Advanced reasoning with extended chain-of-thought',
        contextLength: '128K',
        cost: 'Premium (~$15/1M tokens)',
        features: ['Deep reasoning', 'Problem solving', 'Planning', 'Analysis'],
        addCommand: '/add-model openai/o1-preview "O1 Preview"',
      },
      {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air (Free)',
        reason: 'Free model with thinking mode for agent tasks',
        contextLength: '131K',
        cost: 'Free',
        features: ['Thinking mode', 'Agent tasks', 'Planning', 'MoE architecture'],
        addCommand: '/add-model z-ai/glm-4.5-air:free "GLM 4.5 Air"',
      },
      {
        id: 'google/gemini-2.0-flash-thinking-exp',
        name: 'Gemini 2.0 Flash Thinking',
        reason: 'Fast thinking model with vision support',
        contextLength: '1M',
        cost: 'Premium (~$0.10/1M tokens)',
        features: ['Thinking mode', 'Vision', 'Long context', 'Speed'],
        addCommand: '/add-model google/gemini-2.0-flash-thinking-exp "Gemini Thinking"',
      },
    ],
    chat: [
      {
        id: 'anthropic/claude-3.5-sonnet-20240620',
        name: 'Claude 3.5 Sonnet',
        reason: 'Most natural conversational AI with great personality',
        contextLength: '200K',
        cost: 'Premium (~$3/1M tokens)',
        features: ['Natural language', 'Long conversations', 'Context retention'],
        addCommand: '/add-model anthropic/claude-3.5-sonnet-20240620 "Claude Sonnet 3.5"',
      },
      {
        id: 'deepseek/deepseek-chat-v3-0324:free',
        name: 'DeepSeek Chat V3 (Free)',
        reason: 'Free model with strong conversational abilities',
        contextLength: '164K',
        cost: 'Free',
        features: ['Conversation', 'General knowledge', 'Multilingual'],
        addCommand: '/add-model deepseek/deepseek-chat-v3-0324:free "DeepSeek Chat"',
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        reason: 'Fast and versatile with multimodal support',
        contextLength: '128K',
        cost: 'Premium (~$2.50/1M tokens)',
        features: ['Multimodal', 'Fast', 'Versatile', 'Tool calling'],
        addCommand: '/add-model openai/gpt-4o "GPT-4o"',
      },
    ],
    vision: [
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        reason: 'Best free vision model with huge context window',
        contextLength: '1M',
        cost: 'Free',
        features: ['Image understanding', 'Fast', 'Long context', 'Multimodal'],
        addCommand: '/add-model google/gemini-2.0-flash-exp:free "Gemini Flash"',
      },
      {
        id: 'anthropic/claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        reason: 'Best vision quality for complex image analysis',
        contextLength: '200K',
        cost: 'Premium (~$15/1M tokens)',
        features: ['Superior vision', 'Image analysis', 'OCR', 'Diagrams'],
        addCommand: '/add-model anthropic/claude-3-opus-20240229 "Claude Opus"',
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        reason: 'Fast multimodal processing',
        contextLength: '128K',
        cost: 'Premium (~$2.50/1M tokens)',
        features: ['Vision', 'Fast', 'Multimodal', 'General purpose'],
        addCommand: '/add-model openai/gpt-4o "GPT-4o"',
      },
    ],
    speed: [
      {
        id: 'anthropic/claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        reason: 'Fastest Claude model with great quality',
        contextLength: '200K',
        cost: 'Premium (~$0.25/1M tokens)',
        features: ['Ultra fast', 'Quality', 'Affordable', 'Tool calling'],
        addCommand: '/add-model anthropic/claude-3-haiku-20240307 "Claude Haiku"',
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        reason: 'Extremely fast free model with vision',
        contextLength: '1M',
        cost: 'Free',
        features: ['Ultra fast', 'Vision', 'Long context', 'Free'],
        addCommand: '/add-model google/gemini-2.0-flash-exp:free "Gemini Flash"',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        reason: 'Smallest GPT-4o with great speed',
        contextLength: '128K',
        cost: 'Premium (~$0.15/1M tokens)',
        features: ['Fast', 'Affordable', 'Capable', 'Tool calling'],
        addCommand: '/add-model openai/gpt-4o-mini "GPT-4o Mini"',
      },
    ],
    cost: [
      {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder (Free)',
        reason: 'Best free coding model',
        contextLength: '262K',
        cost: 'Free',
        features: ['Coding', 'Large context', 'Tool calling', 'Zero cost'],
        addCommand: '/add-model qwen/qwen3-coder:free "Qwen Coder"',
      },
      {
        id: 'deepseek/deepseek-chat-v3-0324:free',
        name: 'DeepSeek Chat V3 (Free)',
        reason: 'Powerful free model for general tasks',
        contextLength: '164K',
        cost: 'Free',
        features: ['General', 'Reasoning', 'Free', '685B params'],
        addCommand: '/add-model deepseek/deepseek-chat-v3-0324:free "DeepSeek Chat"',
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        reason: 'Free vision and speed',
        contextLength: '1M',
        cost: 'Free',
        features: ['Vision', 'Speed', 'Long context', 'Free'],
        addCommand: '/add-model google/gemini-2.0-flash-exp:free "Gemini Flash"',
      },
    ],
  };

  return recommendations[taskType] || [];
}

/**
 * Smart model recommendation command
 */
export const modelRecommendCommand: SlashCommand = {
  name: 'recommend',
  description: 'Get smart model recommendations based on your task',
  kind: CommandKind.BUILT_IN,

  action: async (context: CommandContext): Promise<MessageActionReturn> => {
    const taskType = context.invocation?.args?.trim().toLowerCase() as TaskType;

    if (!taskType) {
      return {
        type: 'message',
        messageType: 'info',
        content: `🎯 Smart Model Recommendations

Get personalized model suggestions based on your task:

**Usage:**
  /recommend <task-type>

**Available Task Types:**
  • coding     - Best models for code generation, debugging, refactoring
  • reasoning  - Models with advanced reasoning and problem-solving
  • chat       - Natural conversation and general assistance
  • vision     - Image understanding and multimodal tasks
  • speed      - Fastest response times
  • cost       - Most affordable options (free models)

**Examples:**
  /recommend coding      → Get coding model recommendations
  /recommend vision      → Get vision model recommendations  
  /recommend cost        → Get free model recommendations

**Quick Comparison:**
  /openrouter free       → Browse all free models
  /openrouter premium    → Browse premium models
  /browse-models search  → Search for specific models

💡 After seeing recommendations, add models with the provided /add-model commands`,
      };
    }

    const validTasks: TaskType[] = ['coding', 'reasoning', 'chat', 'vision', 'speed', 'cost'];
    
    if (!validTasks.includes(taskType)) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Invalid task type: "${taskType}"

Valid task types:
  • coding     - Code generation and debugging
  • reasoning  - Problem solving and analysis
  • chat       - Conversation and assistance
  • vision     - Image understanding
  • speed      - Fastest models
  • cost       - Most affordable

Example: /recommend coding`,
      };
    }

    const recommendations = getRecommendations(taskType);

    if (recommendations.length === 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No recommendations found for task: ${taskType}`,
      };
    }

    // Format recommendations
    const taskEmojis: Record<TaskType, string> = {
      coding: '💻',
      reasoning: '🧠',
      chat: '💬',
      vision: '👁️',
      speed: '⚡',
      cost: '💰',
    };

    const taskNames: Record<TaskType, string> = {
      coding: 'Coding & Development',
      reasoning: 'Reasoning & Problem Solving',
      chat: 'Chat & Conversation',
      vision: 'Vision & Multimodal',
      speed: 'Speed & Performance',
      cost: 'Cost Optimization (Free Models)',
    };

    let content = `${taskEmojis[taskType]} **Model Recommendations for ${taskNames[taskType]}**\n\n`;

    recommendations.forEach((rec, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      content += `${medal} **${rec.name}**\n`;
      content += `   ${rec.reason}\n\n`;
      content += `   • Context: ${rec.contextLength}\n`;
      content += `   • Cost: ${rec.cost}\n`;
      content += `   • Features: ${rec.features.join(', ')}\n\n`;
      content += `   ${rec.addCommand}\n\n`;
    });

    // Add comparison info
    content += '📊 **Quick Comparison:**\n\n';
    
    if (taskType === 'cost') {
      content += '✓ All recommended models are 100% free\n';
      content += '✓ No API costs or rate limits\n';
      content += '✓ Full tool calling support\n';
      content += '✓ Long context windows (130K-1M tokens)\n\n';
      content += '💡 For premium features, try: /recommend coding or /recommend reasoning';
    } else if (taskType === 'coding') {
      content += `Best: ${recommendations[0].name} (premium quality)\n`;
      content += `Free: ${recommendations[1].name} (excellent performance)\n`;
      content += `Specialized: ${recommendations[2].name} (algorithms & math)\n\n`;
      content += '💰 To see free alternatives: /recommend cost';
    } else if (taskType === 'speed') {
      content += 'All recommended models prioritize response speed\n';
      content += `Fastest: ${recommendations[0].name}\n`;
      content += `Free Fast: ${recommendations[1].name}\n\n`;
      content += '⚡ For balanced speed + quality: /recommend coding';
    } else {
      content += `Top Choice: ${recommendations[0].name}\n`;
      content += `Alternative: ${recommendations[1].name}\n\n`;
      content += '💡 See more options with /browse-models or /openrouter search';
    }

    // Add next steps
    content += '\n**Next Steps:**\n';
    content += '1. Copy an /add-model command above\n';
    content += '2. Run it to add the model\n';
    content += '3. Switch to it with /model\n';
    content += '4. Check costs with /openrouter credits';

    return {
      type: 'message',
      messageType: 'info',
      content,
    };
  },
};
