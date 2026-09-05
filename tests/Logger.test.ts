import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../src/reliability/Logger.js';
test('for', () => { assert.ok(Logger.for('t')); });
test('level', () => { Logger.level('error'); Logger.level('info'); });
