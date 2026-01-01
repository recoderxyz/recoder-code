/**
 * Recoder AI Service Client
 * Handles AI requests through Recoder.xyz backend with cost controls
 */

import { RecoderAuthService } from './RecoderAuthService.js';

const RECODER_API_BASE = process.env['RECODER_API_URL'] || 'https://recoder.xyz';

export interface AIGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  language?: string;
  framework?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIChatOptions {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
}

export interface AICompleteOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  success: boolean;
  data?: {
    content?: string; // For complete endpoint
    code?: string; // For generate endpoint (backward compatibility)
    message?: string; // For chat endpoint
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    cost?: number; // Cost in USD
    metadata?: {
      tokensUsed?: number;
      costUSD: number;
      remainingBudget: number;
      budgetPercent: number;
      requestId?: string;
      latency?: number;
      cached?: boolean;
    };
  };
  metadata?: {
    requestId?: string;
    latency?: number;
    cached?: boolean;
  };
  warning?: {
    level: 'info' | 'warning' | 'critical';
    message: string;
  };
  error?: string;
  message?: string;
}

export interface UsageStats {
  plan: string;
  monthlyLimit: number;
  currentSpend: number;
  remainingBudget: number;
  percentUsed: number;
  totalRequests: number;
  averageCostPerRequest: number;
  resetDate: string;
  daysUntilReset: number;
  topModels: Array<{
    model: string;
    requests: number;
    cost: number;
  }>;
}

export interface ModelRecommendation {
  model: string;
  estimatedCost: number;
  quality: string;
  speed: string;
  reason: string;
}

export class RecoderAIService {
  private authService: RecoderAuthService;

  constructor() {
    this.authService = new RecoderAuthService();
  }

  /**
   * Generate code with AI (uses unified complete endpoint)
   */
  async generateCode(options: AIGenerateOptions): Promise<AIResponse> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please run: recoder-code auth login');
    }

    try {
      // Build system prompt with context
      let systemPrompt = 'You are an expert programmer. Generate clean, efficient, and well-documented code.';
      if (options.language) {
        systemPrompt += ` Use ${options.language} programming language.`;
      }
      if (options.framework) {
        systemPrompt += ` Use ${options.framework} framework.`;
      }
      if (options.systemPrompt) {
        systemPrompt = options.systemPrompt;
      }

      const response = await fetch(`${RECODER_API_BASE}/api/cli/ai/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: options.prompt,
          systemPrompt,
          model: options.model,
          maxTokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'BUDGET_EXCEEDED') {
          return {
            success: false,
            error: 'BUDGET_EXCEEDED',
            message: data.message,
            data: data.data,
          };
        }
        throw new Error(data.message || 'Failed to generate code');
      }

      // Map response to expected format
      if (data.success && data.data) {
        data.data.code = data.data.content || data.data.code;
      }

      return data;
    } catch (error: any) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  /**
   * Chat with AI (uses unified complete endpoint)
   */
  async chat(options: AIChatOptions): Promise<AIResponse> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please run: recoder-code auth login');
    }

    try {
      // Convert messages to prompt format
      const lastMessage = options.messages[options.messages.length - 1];
      const conversationHistory = options.messages
        .slice(0, -1)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const systemPrompt = conversationHistory
        ? `You are a helpful AI assistant. Previous conversation:\n\n${conversationHistory}\n\nContinue the conversation naturally.`
        : 'You are a helpful AI assistant for software development.';

      const response = await fetch(`${RECODER_API_BASE}/api/cli/ai/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: lastMessage.content,
          systemPrompt,
          model: options.model,
          maxTokens: 2048,
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'BUDGET_EXCEEDED') {
          return {
            success: false,
            error: 'BUDGET_EXCEEDED',
            message: data.message,
            data: data.data,
          };
        }
        throw new Error(data.message || 'Failed to chat');
      }

      // Map response to expected format
      if (data.success && data.data) {
        data.data.message = data.data.content || data.data.message;
      }

      return data;
    } catch (error: any) {
      throw new Error(`AI chat failed: ${error.message}`);
    }
  }

  /**
   * Complete prompt with AI (direct unified endpoint)
   */
  async complete(options: AICompleteOptions): Promise<AIResponse> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please run: recoder-code auth login');
    }

    try {
      const response = await fetch(`${RECODER_API_BASE}/api/cli/ai/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: options.prompt,
          systemPrompt: options.systemPrompt,
          model: options.model,
          maxTokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'BUDGET_EXCEEDED') {
          return {
            success: false,
            error: 'BUDGET_EXCEEDED',
            message: data.message,
            data: data.data,
          };
        }
        throw new Error(data.message || 'Failed to complete');
      }

      return data;
    } catch (error: any) {
      throw new Error(`AI completion failed: ${error.message}`);
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please run: recoder-code auth login');
    }

    try {
      const response = await fetch(`${RECODER_API_BASE}/api/cli/ai/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error: any) {
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
  }

  /**
   * Get model recommendations based on budget
   */
  async getModelRecommendations(
    task: string = 'code-generation',
    budget?: number,
  ): Promise<ModelRecommendation[]> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please run: recoder-code auth login');
    }

    try {
      const url = new URL(`${RECODER_API_BASE}/api/cli/ai/models`);
      url.searchParams.set('task', task);
      if (budget) {
        url.searchParams.set('budget', budget.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch model recommendations');
      }

      const data = await response.json();
      return data.data.recommendations;
    } catch (error: any) {
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }
  }

  /**
   * Check if user has budget remaining
   */
  async hasBudget(): Promise<boolean> {
    try {
      const token = await this.authService.getAccessToken();
      if (!token) return false;

      const response = await fetch(`${RECODER_API_BASE}/api/cli/ai/budget`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.hasBudget || data.remainingBudget > 0;
    } catch {
      return false;
    }
  }

  /**
   * Format cost display
   */
  formatCost(costUSD: number): string {
    return `$${costUSD.toFixed(4)}`;
  }

  /**
   * Format budget display
   */
  formatBudget(stats: UsageStats): string {
    const percent = stats.percentUsed.toFixed(1);
    const remaining = this.formatCost(stats.remainingBudget);
    const limit = this.formatCost(stats.monthlyLimit);
    
    return `${remaining} / ${limit} remaining (${percent}% used)`;
  }

  /**
   * Get budget emoji based on usage
   */
  getBudgetEmoji(percentUsed: number): string {
    if (percentUsed >= 95) return '🔴';
    if (percentUsed >= 90) return '🟠';
    if (percentUsed >= 75) return '🟡';
    return '🟢';
  }

  /**
   * Display warning message
   */
  displayWarning(warning?: { level: string; message: string }): void {
    if (!warning) return;

    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };

    console.log(`\n${emoji[warning.level as keyof typeof emoji] || 'ℹ️'} ${warning.message}`);
  }

  /**
   * Display cost information
   */
  displayCostInfo(metadata: any): void {
    if (!metadata) return;

    // Handle both old and new metadata formats
    const costUSD = metadata.costUSD || metadata.cost || 0;
    const remainingBudget = metadata.remainingBudget || 0;
    const budgetPercent = metadata.budgetPercent || 0;
    const tokensUsed =
      metadata.tokensUsed || metadata.usage?.totalTokens || metadata.usage?.outputTokens || 0;

    const costEmoji = this.getBudgetEmoji(budgetPercent);
    console.log(
      `\n📊 Cost: ${this.formatCost(costUSD)} | Remaining: ${this.formatCost(remainingBudget)} ${costEmoji}`,
    );
    console.log(`   Tokens: ${tokensUsed.toLocaleString()} | Budget: ${budgetPercent.toFixed(1)}%`);

    // Display additional metadata if available
    if (metadata.requestId) {
      console.log(`   Request ID: ${metadata.requestId}`);
    }
    if (metadata.latency) {
      console.log(`   Latency: ${metadata.latency}ms`);
    }
    if (metadata.cached) {
      console.log(`   ⚡ Cached response (reduced cost)`);
    }
  }

  /**
   * Handle budget exceeded error
   */
  handleBudgetExceeded(error: any): void {
    console.error('\n🚨 Monthly AI Budget Exceeded');
    console.error('─'.repeat(50));
    
    if (error.data) {
      console.error(`Current Spend: ${this.formatCost(error.data.currentSpend)}`);
      console.error(`Monthly Limit: ${this.formatCost(error.data.monthlyLimit)}`);
      console.error(`Resets On: ${new Date(error.data.resetDate).toLocaleDateString()}`);
      console.error(`Days Until Reset: ${error.data.daysUntilReset}`);
    }
    
    console.error('\n💡 Options:');
    console.error('   1. Upgrade your plan at https://recoder.xyz/pricing');
    console.error('   2. Wait for monthly reset');
    console.error('   3. Use your own OpenRouter API key (free tier)');
  }
}
