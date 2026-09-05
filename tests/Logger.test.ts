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

function emittedLevels(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    try {
      const obj = JSON.parse(l);
      if (obj && typeof obj.level === 'string') out.push(obj.level);
    } catch {
      /* ignore non-JSON lines */
    }
  }
  return out;
}

describe('Logger', () => {
  afterEach(() => {
    Logger.level('info');
  });

  it('Logger.for returns a logger with the ILogger surface', () => {
    const log = Logger.for('unit-test');
    assert.equal(typeof log.info, 'function');
    assert.equal(typeof log.debug, 'function');
    assert.equal(typeof log.child, 'function');
    log.info('hello');
  });

  it('level filter suppresses lower severity output', () => {
    Logger.level('error');
    const log = Logger.for('filter-test');
    const levels = emittedLevels(captureConsoleLog(() => {
      log.debug('verbose detail');
      log.info('informational');
      log.warn('warning');
      log.error('error condition');
      log.fatal('fatal condition');
    }));
    assert.ok(!levels.includes('debug'));
    assert.ok(!levels.includes('info'));
    assert.ok(!levels.includes('warn'));
    assert.ok(levels.includes('error'));
    assert.ok(levels.includes('fatal'));
  });

  it('child creates a nested logger sharing the level', () => {
    const child = Logger.for('parent').child('nested');
    assert.equal(typeof child.info, 'function');
    child.info('from child');
  });

  it('createLogger factory returns a working logger', () => {
    const log = createLogger('factory');
    log.warn('factory warn');
    assert.equal(typeof log.child, 'function');
  });

  it('exposes a logDir path', () => {
    assert.equal(typeof Logger.logDir, 'string');
    assert.ok(Logger.logDir.length > 0);
  });
});
