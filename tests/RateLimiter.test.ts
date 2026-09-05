import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/security/RateLimiter.js';

test('requests within the quota are allowed with decreasing remaining', () => {
  const rl = new RateLimiter(3, 1000);
  const t = 100_000;
  const r1 = rl.check('c1', t);
  const r2 = rl.check('c1', t);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);
  assert.equal(r2.remaining, 1);
});

test('requests beyond the quota are blocked with a retryAfterMs', () => {
  const rl = new RateLimiter(2, 1000);
  const t = 100_000;
  rl.check('c2', t);
  rl.check('c2', t);
  const blocked = rl.check('c2', t);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);
});

test('a new window after windowMs resets the counter', () => {
  const rl = new RateLimiter(1, 1000);
  const t = 100_000;
  assert.equal(rl.check('c3', t).allowed, true);
  assert.equal(rl.check('c3', t).allowed, false);
  assert.equal(rl.check('c3', t + 1000).allowed, true);
});

test('reset clears all client windows', () => {
  const rl = new RateLimiter(1, 1000);
  const t = 100_000;
  rl.check('c4', t);
  assert.equal(rl.check('c4', t).allowed, false);
  rl.reset();
  assert.equal(rl.check('c4', t).allowed, true);
});
