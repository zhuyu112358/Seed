import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/security/RateLimiter.js';
test('allow then reject', () => { const rl = new RateLimiter(2); assert.equal(rl.check('c').allowed,true); assert.equal(rl.check('c').allowed,true); assert.equal(rl.check('c').allowed,false); });
