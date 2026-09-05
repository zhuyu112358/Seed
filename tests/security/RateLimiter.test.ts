import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../../src/security/RateLimiter.js';
const cfg = { enabled:true, maxRequests:5, windowMs:1000, perSoul:true, perIP:true, burstMultiplier:2 };
test('consume then reject', () => {
  const rl = new RateLimiter(cfg);
  for (let i=0;i<10;i++) rl.consume('k1');
  assert.equal(rl.getStats().rejected,0);
  const r = rl.consume('k1'); assert.equal(r.allowed,false); assert.ok(r.retryAfterMs>0);
});
test('check', () => {
  const rl = new RateLimiter(cfg); rl.consume('k2',4); assert.equal(rl.check('k2').allowed,true);
});
test('reset', () => {
  const rl = new RateLimiter(cfg); rl.consume('k3',10);
  assert.equal(rl.consume('k3').allowed,false);
  rl.reset('k3'); assert.equal(rl.consume('k3').allowed,true);
});
test('disabled', () => {
  const rl = new RateLimiter({...cfg,enabled:false});
  for (let i=0;i<50;i++) rl.consume('k4');
  assert.equal(rl.getStats().rejected,0);
});
test('resetAll', () => {
  const rl = new RateLimiter(cfg); rl.consume('a'); rl.consume('b'); rl.resetAll();
  assert.equal(rl.getStats().activeKeys,0);
});
test('stats', () => {
  const rl = new RateLimiter(cfg); rl.consume('h'); rl.consume('c');
  assert.equal(rl.getStats().totalRequests,2);
});
