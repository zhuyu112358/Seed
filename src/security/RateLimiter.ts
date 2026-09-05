/**
 * Seed Engine - RateLimiter
 *
 * Token-bucket rate limiter. Each key (soul id, IP, or any string) gets its
 * own bucket that refills continuously at maxRequests/windowMs tokens per
 * millisecond, up to a burst capacity of burstMultiplier * maxRequests.
 * Consuming tokens when the bucket is empty rejects the request and tells the
 * client how long to wait (retryAfterMs) before retrying.
 *
 * Buckets with no activity for more than 5 windows are reaped automatically to
 * bound memory usage.
 */

import type { ILogger, RateLimitConfig } from '../types/index.js';

interface Bucket {
  /** Current number of tokens in the bucket. */
  tokens: number;
  /** Timestamp of the last refill computation. */
  lastRefill: number;
  /** Timestamp of the last consumption/check activity. */
  lastAccess: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface CheckResult {
  allowed: boolean;
  remaining: number;
}

export interface RateLimiterStats {
  totalRequests: number;
  allowed: number;
  rejected: number;
  activeKeys: number;
  topKeys: Array<{ key: string; remaining: number }>;
}

class NullLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  fatal(): void {}
  child(): ILogger {
    return this;
  }
}

export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly logger: ILogger;
  private readonly buckets = new Map<string, Bucket>();
  private readonly refillPerMs: number;
  private readonly capacity: number;
  private readonly staleThresholdMs: number;

  private totalRequests = 0;
  private allowedCount = 0;
  private rejectedCount = 0;

  constructor(config: RateLimitConfig, logger?: ILogger) {
    this.config = config;
    this.logger = logger ?? new NullLogger();
    this.refillPerMs = config.windowMs > 0 ? config.maxRequests / config.windowMs : config.maxRequests;
    this.capacity = Math.max(config.maxRequests, config.burstMultiplier * config.maxRequests);
    // Reap buckets untouched for more than 5 windows.
    this.staleThresholdMs = config.windowMs * 5;
  }

  /** Refill a bucket based on elapsed time since the last refill. */
  private refill(bucket: Bucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
      bucket.lastRefill = now;
    }
  }

  /** Get (or lazily create) the bucket for a key. */
  private getBucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: Date.now(), lastAccess: Date.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  /**
   * Attempt to consume `tokens` from the key's bucket. When the limiter is
   * disabled every request is allowed.
   */
  consume(key: string, tokens = 1): ConsumeResult {
    this.totalRequests += 1;

    if (!this.config.enabled) {
      this.allowedCount += 1;
      return { allowed: true, remaining: this.capacity, retryAfterMs: 0 };
    }

    this.reapStaleBuckets();

    const now = Date.now();
    const bucket = this.getBucket(key);
    this.refill(bucket, now);
    bucket.lastAccess = now;

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      this.allowedCount += 1;
      return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
    }

    this.rejectedCount += 1;
    const missing = tokens - bucket.tokens;
    const retryAfterMs = this.refillPerMs > 0 ? Math.ceil(missing / this.refillPerMs) : 0;
    this.logger.debug('Rate limit exceeded', { key, retryAfterMs });
    return { allowed: false, remaining: bucket.tokens, retryAfterMs };
  }

  /** Peek whether a request would be allowed, without consuming tokens. */
  check(key: string): CheckResult {
    if (!this.config.enabled) {
      return { allowed: true, remaining: this.capacity };
    }
    const now = Date.now();
    const bucket = this.getBucket(key);
    this.refill(bucket, now);
    bucket.lastAccess = now;
    return { allowed: bucket.tokens >= 1, remaining: bucket.tokens };
  }

  /** Reset a single key's bucket back to full capacity. */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Reset all buckets and counters. */
  resetAll(): void {
    this.buckets.clear();
    this.totalRequests = 0;
    this.allowedCount = 0;
    this.rejectedCount = 0;
  }

  /** Aggregate statistics with the most-used keys. */
  getStats(): RateLimiterStats {
    const now = Date.now();
    const entries = Array.from(this.buckets.entries()).map(([key, bucket]) => {
      this.refill(bucket, now);
      return { key, remaining: bucket.tokens };
    });
    entries.sort((a, b) => a.remaining - b.remaining);
    return {
      totalRequests: this.totalRequests,
      allowed: this.allowedCount,
      rejected: this.rejectedCount,
      activeKeys: this.buckets.size,
      topKeys: entries.slice(0, 10),
    };
  }

  /** Drop buckets that have not been used for more than 5 windows. */
  private reapStaleBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastAccess > this.staleThresholdMs) {
        this.buckets.delete(key);
      }
    }
  }
}
