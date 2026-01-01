/**
 * Cost Tracker Service
 * Tracks token usage and costs per session
 */

import { calculateCost, formatCost, isExpensiveModel } from './modelPricing.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface UsageRecord {
  timestamp: Date;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  operation: string; // e.g., "chat", "tool-call", "subagent"
}

export interface SessionStats {
  sessionStart: Date;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  records: UsageRecord[];
}

export interface CostBudget {
  sessionLimit?: number;  // Max cost per session (e.g., $1.00)
  hourlyLimit?: number;   // Max cost per hour (e.g., $5.00)
  dailyLimit?: number;    // Max cost per day (e.g., $20.00)
  warningThreshold?: number; // Warn when reaching % of limit (e.g., 0.8 = 80%)
}

const DEFAULT_BUDGET: CostBudget = {
  sessionLimit: 2.0,      // $2 per session
  hourlyLimit: 10.0,      // $10 per hour
  dailyLimit: 50.0,       // $50 per day
  warningThreshold: 0.75, // Warn at 75%
};

export class CostTracker {
  private sessionStats: SessionStats;
  private budget: CostBudget;
  private logFilePath: string;
  private warningIssued = false;

  constructor(budget: CostBudget = DEFAULT_BUDGET) {
    this.sessionStats = {
      sessionStart: new Date(),
      totalCost: 0,
      totalTokens: 0,
      requestCount: 0,
      records: [],
    };
    this.budget = { ...DEFAULT_BUDGET, ...budget };

    // Setup log file
    const homeDir = os.homedir();
    const logDir = path.join(homeDir, '.recoder-code', 'logs');
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create log directory:', error);
    }
    this.logFilePath = path.join(logDir, 'cost-tracking.log');
  }

  /**
   * Track a request and its cost
   */
  trackRequest(
    model: string,
    promptTokens: number,
    completionTokens: number,
    operation: string = 'chat',
  ): UsageRecord {
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(model, promptTokens, completionTokens);

    const record: UsageRecord = {
      timestamp: new Date(),
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
      operation,
    };

    // Update session stats
    this.sessionStats.totalCost += cost;
    this.sessionStats.totalTokens += totalTokens;
    this.sessionStats.requestCount++;
    this.sessionStats.records.push(record);

    // Log to file
    this.logToFile(record);

    // Check if we should warn user
    this.checkBudgetWarnings();

    return record;
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Check if request would exceed budget
   */
  wouldExceedBudget(estimatedCost: number): {
    wouldExceed: boolean;
    reason?: string;
    currentCost: number;
    limit: number;
  } {
    const newSessionCost = this.sessionStats.totalCost + estimatedCost;

    // Check session limit
    if (this.budget.sessionLimit && newSessionCost > this.budget.sessionLimit) {
      return {
        wouldExceed: true,
        reason: 'session',
        currentCost: this.sessionStats.totalCost,
        limit: this.budget.sessionLimit,
      };
    }

    // Check hourly limit
    if (this.budget.hourlyLimit) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourCost = this.sessionStats.records
        .filter(r => r.timestamp > hourAgo)
        .reduce((sum, r) => sum + r.cost, 0);

      if (hourCost + estimatedCost > this.budget.hourlyLimit) {
        return {
          wouldExceed: true,
          reason: 'hourly',
          currentCost: hourCost,
          limit: this.budget.hourlyLimit,
        };
      }
    }

    // Check daily limit
    if (this.budget.dailyLimit) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dayCost = this.sessionStats.records
        .filter(r => r.timestamp > dayAgo)
        .reduce((sum, r) => sum + r.cost, 0);

      if (dayCost + estimatedCost > this.budget.dailyLimit) {
        return {
          wouldExceed: true,
          reason: 'daily',
          currentCost: dayCost,
          limit: this.budget.dailyLimit,
        };
      }
    }

    return {
      wouldExceed: false,
      currentCost: this.sessionStats.totalCost,
      limit: this.budget.sessionLimit || 0,
    };
  }

  /**
   * Check if we should warn user about approaching limits
   */
  private checkBudgetWarnings(): void {
    if (this.warningIssued) return;

    const threshold = this.budget.warningThreshold || 0.75;

    // Check session budget
    if (this.budget.sessionLimit) {
      const percentage = this.sessionStats.totalCost / this.budget.sessionLimit;
      if (percentage >= threshold) {
        this.warningIssued = true;
        console.warn(
          `\n⚠️  Cost Warning: You've used ${formatCost(this.sessionStats.totalCost)} ` +
          `out of ${formatCost(this.budget.sessionLimit)} session budget (${(percentage * 100).toFixed(0)}%)\n`,
        );
      }
    }
  }

  /**
   * Get formatted cost summary for display
   */
  getFormattedSummary(): string {
    const stats = this.sessionStats;
    const duration = Date.now() - stats.sessionStart.getTime();
    const durationMins = Math.floor(duration / 60000);

    let summary = '\n📊 Session Cost Summary\n';
    summary += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    summary += `Session Duration: ${durationMins} minutes\n`;
    summary += `Total Requests: ${stats.requestCount}\n`;
    summary += `Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;
    summary += `Total Cost: ${formatCost(stats.totalCost)}\n`;

    if (this.budget.sessionLimit) {
      const percentage = (stats.totalCost / this.budget.sessionLimit) * 100;
      summary += `Budget Used: ${percentage.toFixed(1)}% of ${formatCost(this.budget.sessionLimit)}\n`;
    }

    // Group by model
    const modelCosts = new Map<string, { cost: number; tokens: number; requests: number }>();
    for (const record of stats.records) {
      const existing = modelCosts.get(record.model) || { cost: 0, tokens: 0, requests: 0 };
      existing.cost += record.cost;
      existing.tokens += record.totalTokens;
      existing.requests += 1;
      modelCosts.set(record.model, existing);
    }

    if (modelCosts.size > 0) {
      summary += '\n📈 Cost by Model:\n';
      for (const [model, data] of modelCosts.entries()) {
        const modelName = model.split('/').pop() || model;
        summary += `  • ${modelName}: ${formatCost(data.cost)} (${data.requests} requests, ${data.tokens.toLocaleString()} tokens)\n`;
      }
    }

    summary += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return summary;
  }

  /**
   * Log usage record to file
   */
  private logToFile(record: UsageRecord): void {
    try {
      const logLine = JSON.stringify({
        ...record,
        timestamp: record.timestamp.toISOString(),
      }) + '\n';

      fs.appendFileSync(this.logFilePath, logLine, 'utf-8');
    } catch (error) {
      // Silently fail - logging is not critical
    }
  }

  /**
   * Get recommendations to reduce costs
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.sessionStats;

    // Check if using expensive models
    const expensiveRequests = stats.records.filter(r => isExpensiveModel(r.model));
    if (expensiveRequests.length > stats.requestCount * 0.5) {
      recommendations.push(
        '💡 Consider using more affordable models like google/gemini-2.0-flash-exp or deepseek/deepseek-chat-v3',
      );
    }

    // Check if making many requests
    if (stats.requestCount > 20) {
      recommendations.push(
        '💡 You\'re making many API requests. Consider batching operations or using context more efficiently',
      );
    }

    // Check for high token usage
    const avgTokensPerRequest = stats.totalTokens / stats.requestCount;
    if (avgTokensPerRequest > 50000) {
      recommendations.push(
        '💡 High token usage detected. Consider compressing context with /compress command',
      );
    }

    return recommendations;
  }

  /**
   * Reset session stats (useful for testing or new session)
   */
  reset(): void {
    this.sessionStats = {
      sessionStart: new Date(),
      totalCost: 0,
      totalTokens: 0,
      requestCount: 0,
      records: [],
    };
    this.warningIssued = false;
  }
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker();
  }
  return costTrackerInstance;
}

export function resetCostTracker(budget?: CostBudget): void {
  costTrackerInstance = new CostTracker(budget);
}
