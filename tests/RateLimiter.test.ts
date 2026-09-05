// Unit tests for src/security/RateLimiter.ts (token-bucket)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/security/RateLimiter.js';
import type { RateLimitConfig } from '../src/types/index.js';

function cfg(over: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return { enabled: true, maxRequests: 3, windowMs: 1000, perSoul: true, perIP: false, burstMultiplier: 1, ...over };
}

describe('RateLimiter', () => {
  it('consume allows up to the capacity then rejects', () => {
    const rl = new RateLimiter(cfg());
    assert.equal(rl.consume('c').allowed, true);
    assert.equal(rl.consume('c').allowed, true);
    assert.equal(rl.consume('c').allowed, true);
    assert.equal(rl.consume('c').allowed, false);
  });

  it('rejected consume reports a positive retryAfterMs', () => {
    const rl = new RateLimiter(cfg());
    rl.consume('c'); rl.consume('c'); rl.consume('c');
    const blocked = rl.consume('c');
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
  });

  it('check observes tokens without consuming', () => {
    const rl = new RateLimiter(cfg());
    rl.consume('c');
    const before = rl.check('c').remaining;
    rl.check('c'); rl.check('c');
    assert.equal(rl.check('c').remaining, before);
    assert.equal(before, 2);
  });

  it('reset clears one key and resetAll clears everything', () => {
    const rl = new RateLimiter(cfg());
    rl.consume('a'); rl.consume('b');
    assert.equal(rl.getStats().activeKeys, 2);
    rl.reset('a');
    assert.equal(rl.getStats().activeKeys, 1);
    rl.resetAll();
    assert.equal(rl.getStats().activeKeys, 0);
  });

  it('getStats tracks total / allowed / rejected counts', () => {
    const rl = new RateLimiter(cfg());
    rl.consume('c'); rl.consume('c'); rl.consume('c'); rl.consume('c');
    const s = rl.getStats();
    assert.equal(s.totalRequests, 4);
    assert.equal(s.allowed, 3);
    assert.equal(s.rejected, 1);
  });

  it('disabled mode allows every request', () => {
    const rl = new RateLimiter(cfg({ enabled: false }));
    for (let i = 0; i < 10; i++) assert.equal(rl.consume('c').allowed, true);
  });

  it('burstMultiplier enlarges the burst capacity', () => {
    const rl = new RateLimiter(cfg({ maxRequests: 3, burstMultiplier: 2 }));
    for (let i = 0; i < 6; i++) assert.equal(rl.consume('c').allowed, true);
    assert.equal(rl.consume('c').allowed, false);
  });
});
