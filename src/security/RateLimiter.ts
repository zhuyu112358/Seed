import type { ILogger, RateLimitConfig } from '../types/index.js';

class NullLogger implements ILogger {
  debug(): void {} info(): void {} warn(): void {} error(): void {} fatal(): void {}
  child(): ILogger { return this; }
}

interface Bucket { tokens: number; lastRefill: number; }

export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly logger: ILogger;
  private readonly buckets = new Map<string, Bucket>();
  private totalRequests = 0; private allowed = 0; private rejected = 0;

  constructor(config: RateLimitConfig, logger?: ILogger) {
    this.config = config;
    this.logger = logger ?? new NullLogger();
  }

  private capacity(): number { return Math.max(this.config.maxRequests, Math.round(this.config.burstMultiplier * this.config.maxRequests)); }
  private refillPerMs(): number { return this.config.windowMs > 0 ? this.config.maxRequests / this.config.windowMs : this.config.maxRequests; }

  private getBucket(key: string, now: number): Bucket {
    let b = this.buckets.get(key);
    if (!b) { b = { tokens: this.capacity(), lastRefill: now }; this.buckets.set(key, b); return b; }
    const elapsed = now - b.lastRefill;
    if (elapsed > 0) { b.tokens = Math.min(this.capacity(), b.tokens + elapsed * this.refillPerMs()); b.lastRefill = now; }
    return b;
  }

  consume(key: string, tokens = 1): { allowed: boolean; remaining: number; retryAfterMs: number } {
    this.totalRequests += 1;
    if (!this.config.enabled) { this.allowed += 1; return { allowed: true, remaining: this.capacity(), retryAfterMs: 0 }; }
    this.reapStale();
    const now = Date.now(); const b = this.getBucket(key, now);
    if (b.tokens >= tokens) {
      b.tokens -= tokens; this.allowed += 1;
      return { allowed: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
    }
    this.rejected += 1;
    const deficit = tokens - b.tokens;
    const retryAfterMs = Math.ceil(deficit / this.refillPerMs());
    return { allowed: false, remaining: Math.floor(b.tokens), retryAfterMs };
  }

  check(key: string): { allowed: boolean; remaining: number } {
    const b = this.buckets.get(key);
    if (!b) return { allowed: true, remaining: this.capacity() };
    return { allowed: b.tokens >= 1, remaining: Math.floor(b.tokens) };
  }

  reset(key: string): void { this.buckets.delete(key); }
  resetAll(): void { this.buckets.clear(); }

  getStats(): { totalRequests: number; allowed: number; rejected: number; activeKeys: number; topKeys: Array<{ key: string; tokens: number }> } {
    const topKeys = Array.from(this.buckets.entries())
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .slice(0, 10)
      .map(([key, b]) => ({ key, tokens: Math.floor(b.tokens) }));
    return { totalRequests: this.totalRequests, allowed: this.allowed, rejected: this.rejected, activeKeys: this.buckets.size, topKeys };
  }

  private reapStale(): void {
    const staleMs = this.config.windowMs * 5; const cutoff = Date.now() - staleMs;
    for (const [key, b] of this.buckets) if (b.lastRefill < cutoff) this.buckets.delete(key);
  }
}
