import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/security/RateLimiter.js';

test('RateLimiter allows up to QPS then blocks', () => {
  const rl = new RateLimiter(3, 1000);
  const t0 = 1000;
  assert.equal(rl.check('client', t0).allowed, true);
  assert.equal(rl.check('client', t0).allowed, true);
  assert.equal(rl.check('client', t0).allowed, true);
  const blocked = rl.check('client', t0);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test('RateLimiter separates clients and resets window', () => {
  const rl = new RateLimiter(1, 1000);
  assert.equal(rl.check('a', 0).allowed, true);
  assert.equal(rl.check('b', 0).allowed, true); // different client
  assert.equal(rl.check('a', 0).allowed, false);
  assert.equal(rl.check('a', 1000).allowed, true); // new window
});
