import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/security/RateLimiter.js';
test('allows within limit', () => { const rl = new RateLimiter(5); for(let i=0;i<5;i++) assert.equal(rl.check('c1').allowed,true); });
test('rejects over limit', () => { const rl = new RateLimiter(2); rl.check('c2'); rl.check('c2'); assert.equal(rl.check('c2').allowed,false); });
test('reset clears', () => { const rl = new RateLimiter(1); rl.check('c3'); rl.reset(); assert.equal(rl.check('c3').allowed,true); });
