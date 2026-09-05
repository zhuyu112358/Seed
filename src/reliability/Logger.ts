/**
 * Seed Engine - Reliability Logger
 *
 * Zero-dependency structured logger shared by the engine, SDK, bridge and
 * evaluator. It mirrors lines to the console and appends to logs/seed.log.
 * `Logger.for(module)` returns a pino-style child logger that accepts either
 * `(message, meta?)` or `(bindings, message)`; `createLogger(module)` returns
 * the strict ILogger used by the public SDK surface.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ILogger, LogLevel } from '../types/index.js';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

/** Pino-compatible child logger used by internal modules. */
class StructuredLogger implements ILogger {
  constructor(
    private readonly module: string,
    private readonly getLevel: () => LogLevel,
  ) {}

  private enabled(level: LogLevel): boolean {
    return levelRank[level] >= levelRank[this.getLevel()];
  }

  private emit(level: LogLevel, a: string | Record<string, unknown>, b?: string | Record<string, unknown>): void {
    if (!this.enabled(level)) return;
    let meta: Record<string, unknown>;
    let message: string;
    if (typeof a === 'string') {
      message = a;
      meta = (b && typeof b === 'object') ? b : {};
    } else {
      meta = a;
      message = typeof b === 'string' ? b : '';
    }
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      module: this.module,
      message,
      ...meta,
    });
    // eslint-disable-next-line no-console
    console.log(line);
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(path.join(LOG_DIR, 'seed.log'), line + '\n', 'utf8');
    } catch {
      // Logging must never break the simulation; ignore file errors.
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void;
  debug(bindings: Record<string, unknown>, message?: string): void;
  debug(a: string | Record<string, unknown>, b?: string | Record<string, unknown>): void {
    this.emit('debug', a, b);
  }

  info(message: string, meta?: Record<string, unknown>): void;
  info(bindings: Record<string, unknown>, message?: string): void;
  info(a: string | Record<string, unknown>, b?: string | Record<string, unknown>): void {
    this.emit('info', a, b);
  }

  warn(message: string, meta?: Record<string, unknown>): void;
  warn(bindings: Record<string, unknown>, message?: string): void;
  warn(a: string | Record<string, unknown>, b?: string | Record<string, unknown>): void {
    this.emit('warn', a, b);
  }

  error(message: string, meta?: Record<string, unknown>): void;
  error(bindings: Record<string, unknown>, message?: string): void;
  error(a: string | Record<string, unknown>, b?: string | Record<string, unknown>): void {
    this.emit('error', a, b);
  }

  fatal(message: string, meta?: Record<string, unknown>): void;
  fatal(bindings: Record<string, unknown>, message?: string): void;
  fatal(a: string | Record<string, unknown>, b?: string | Record<string, unknown>): void {
    this.emit('fatal', a, b);
  }

  child(module: string): StructuredLogger {
    return new StructuredLogger(`${this.module}:${module}`, this.getLevel);
  }
}

/** Static root used across the engine and infra layers. */
export class Logger {
  private static rootLevel: LogLevel =
    (process.env.SEED_LOG_LEVEL as LogLevel) || 'info';

  /** Create a child logger tagged with a module name. */
  static for(module: string): ILogger {
    return new StructuredLogger(module, () => Logger.rootLevel);
  }

  static level(level: LogLevel): void {
    Logger.rootLevel = level;
  }

  static get logDir(): string {
    return LOG_DIR;
  }
}

/**
 * Public SDK factory: returns the strict ILogger. Provided so SDK / bridge /
 * evaluator callers don't depend on the internal pino-style facade.
 */
export function createLogger(module: string): ILogger {
  return Logger.for(module);
}
