/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

interface CacheEntry {
  response: any;
  timestamp: number;
}

/**
 * LRU Cache for API responses to reduce redundant requests
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttl: number;

  /**
   * @param maxSize Maximum number of entries (default: 100)
   * @param ttl Time to live in milliseconds (default: 1 hour)
   */
  constructor(maxSize: number = 100, ttl: number = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate cache key from prompt and model
   */
  private getCacheKey(prompt: string, model: string, temperature: number = 0.7): string {
    // Normalize prompt (trim whitespace, lowercase for case-insensitive matching)
    const normalizedPrompt = prompt.trim().toLowerCase();
    const data = `${model}:${temperature}:${normalizedPrompt}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached response if available and not expired
   */
  get(prompt: string, model: string, temperature?: number): any | null {
    const key = this.getCacheKey(prompt, model, temperature);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    console.log(`[Cache] Hit for model ${model} (age: ${Math.round(age / 1000)}s)`);
    return entry.response;
  }

  /**
   * Store response in cache
   */
  set(prompt: string, model: string, response: any, temperature?: number): void {
    const key = this.getCacheKey(prompt, model, temperature);

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });

    console.log(`[Cache] Stored response for model ${model} (total: ${this.cache.size})`);
  }

  /**
   * Clear all cached responses
   */
  clear(): void {
    this.cache.clear();
    console.log('[Cache] Cleared all entries');
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; oldestAge: number } {
    let oldestAge = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      oldestAge,
    };
  }
}

/**
 * Global response cache instance
 */
let globalResponseCache: ResponseCache | null = null;

/**
 * Get or create the global response cache
 */
export function getGlobalResponseCache(): ResponseCache {
  if (!globalResponseCache) {
    globalResponseCache = new ResponseCache();
    // Clean up expired entries every 5 minutes
    setInterval(() => globalResponseCache?.cleanup(), 5 * 60 * 1000);
  }
  return globalResponseCache;
}

/**
 * Reset the global response cache
 */
export function resetGlobalResponseCache(): void {
  globalResponseCache?.clear();
  globalResponseCache = null;
}
