/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple token bucket rate limiter for API requests
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  /**
   * @param requestsPerMinute Maximum requests allowed per minute
   * @param burstSize Maximum burst size (defaults to requestsPerMinute)
   */
  constructor(requestsPerMinute: number = 10, burstSize?: number) {
    this.maxTokens = burstSize || requestsPerMinute;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    // Convert requests per minute to tokens per millisecond
    this.refillRate = requestsPerMinute / 60000;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Acquire a token, waiting if necessary
   * @returns Promise that resolves when a token is acquired
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time until next token is available
    const tokensNeeded = 1 - this.tokens;
    const waitTime = Math.ceil(tokensNeeded / this.refillRate);
    
    if (waitTime > 0) {
      console.log(`[Rate Limiter] Throttling request, waiting ${waitTime}ms to avoid rate limits...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }
  }

  /**
   * Try to acquire a token without waiting
   * @returns true if token acquired, false otherwise
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get current available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global rate limiter
 */
export function getGlobalRateLimiter(requestsPerMinute?: number): RateLimiter {
  if (!globalRateLimiter) {
    const rpm = requestsPerMinute || 
                parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '10');
    globalRateLimiter = new RateLimiter(rpm);
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter = null;
}
