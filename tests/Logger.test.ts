import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logger, createLogger } from '../src/reliability/Logger.js';

test('Logger.logDir points at the project logs directory', () => {
  assert.match(Logger.logDir, /logs$/);
});

test('Logger.for returns a child logger tagged with the module', () => {
  const log = Logger.for('my-module');
  assert.equal(typeof log.info, 'function');
  assert.equal(typeof log.warn, 'function');
  assert.equal(typeof log.error, 'function');
  // Emitting must not throw even with no file access issues.
  assert.doesNotThrow(() => log.info('hello', { k: 1 }));
});

test('Logger.level filters emitted severity', () => {
  Logger.level('error');
  const log = Logger.for('level-test');
  // info should be filtered out; error should pass through.
  assert.doesNotThrow(() => log.info('this is filtered'));
  assert.doesNotThrow(() => log.error('this shows'));
  Logger.level('info');
});

test('createLogger returns an ILogger with a child() method', () => {
  const log = createLogger('factory');
  const child = log.child('sub');
  assert.equal(typeof child.info, 'function');
  assert.doesNotThrow(() => child.debug('child message'));
});
