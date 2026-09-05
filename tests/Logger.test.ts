// Unit tests for src/reliability/Logger.ts
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Logger, createLogger } from '../src/reliability/Logger.js';

function captureConsoleLog(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = ((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  }) as typeof console.log;
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

describe('Logger', () => {
  afterEach(() => {
    Logger.level('info');
  });
  it('Logger.for returns a logger with the ILogger surface', () => {
    const log = Logger.for('unit-test');
    assert.equal(typeof log.info, 'function');
    assert.equal(typeof log.child, 'function');
    log.info('hello');
  });
  it('level filter suppresses lower severity output', () => {
    Logger.level('error');
    const log = Logger.for('filter-test');
    const joined = captureConsoleLog(() => {
      log.debug('d'); log.info('i'); log.warn('w'); log.error('e'); log.fatal('f');
    }).join('\n');
    assert.ok(!joined.includes('d'));
    assert.ok(!joined.includes('i'));
    assert.ok(!joined.includes('w'));
    assert.ok(joined.includes('e'));
    assert.ok(joined.includes('f'));
  });
  it('child creates a nested logger', () => {
    const child = Logger.for('parent').child('nested');
    assert.equal(typeof child.info, 'function');
    child.info('from child');
  });
  it('createLogger factory returns a working logger', () => {
    const log = createLogger('factory');
    log.warn('ok');
    assert.equal(typeof log.child, 'function');
  });
  it('exposes a logDir path', () => {
    assert.ok(Logger.logDir.length > 0);
  });
});
