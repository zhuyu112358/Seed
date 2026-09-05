import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/security/RateLimiter.js';

function makeLimiter() {
  return new RateLimiter({
    enabled: true,
    maxRequests: 5,
    windowMs: 1000,
    perSoul: true,
    perIP: true,
    burstMultiplier: 1,
  });
}

test('consume allows up to capacity then rejects', () => {
  const rl = makeLimiter();
  for (let i = 0; i < 5; i++) {
    const r = rl.consume('client-1');
    assert.equal(r.allowed, true, `request ${i + 1} should be allowed`);
  }
  const blocked = rl.consume('client-1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs >= 0);
});

test('check reports the current bucket state without consuming', () => {
  const rl = makeLimiter();
  assert.equal(rl.check('client-2').allowed, true);
  rl.consume('client-2', 5);
  const after = rl.check('client-2');
  assert.equal(after.allowed, false);
});

test('reset and resetAll clear buckets independently', () => {
  const rl = makeLimiter();
  rl.consume('a', 5);
  rl.consume('b', 5);
  rl.reset('a');
  assert.equal(rl.check('a').allowed, true);
  assert.equal(rl.check('b').allowed, false);
  rl.resetAll();
  assert.equal(rl.check('b').allowed, true);
});

test('getStats accumulates totals and tracks active keys', () => {
  const rl = makeLimiter();
  rl.consume('k1');
  rl.consume('k1');
  rl.consume('k2');
  const stats = rl.getStats();
  assert.equal(stats.totalRequests, 3);
  assert.equal(stats.allowed, 3);
  assert.equal(stats.activeKeys, 2);
});

test('a disabled limiter always allows requests', () => {
  const rl = new RateLimiter({
    enabled: false, maxRequests: 1, windowMs: 1000, perSoul: true, perIP: true, burstMultiplier: 1,
  });
  for (let i = 0; i < 10; i++) assert.equal(rl.consume('any').allowed, true);
});
