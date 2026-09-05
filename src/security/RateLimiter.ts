// RateLimiter: fixed-window per-client limiter.

export interface RateLimitResult { allowed: boolean; remaining: number; retryAfterMs: number; }

export class RateLimiter {
  private readonly windows = new Map<string, { windowStart: number; count: number }>();
  constructor(private readonly qps: number, private readonly windowMs = 1000) {}
  check(clientId: string, now = Date.now()): RateLimitResult {
    const existing = this.windows.get(clientId);
    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.windows.set(clientId, { windowStart: now, count: 1 });
      return { allowed: true, remaining: this.qps - 1, retryAfterMs: 0 };
    }
    if (existing.count < this.qps) {
      existing.count++;
      return { allowed: true, remaining: this.qps - existing.count, retryAfterMs: 0 };
    }
    return { allowed: false, remaining: 0, retryAfterMs: this.windowMs - (now - existing.windowStart) };
  }
  reset(): void { this.windows.clear(); }
}
