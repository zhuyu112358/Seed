import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import type { ILogger, LogEntry, LogLevel, LoggerConfig } from '../types/index.js';

const SEED_LEVELS: winston.config.AbstractConfigSetLevels = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 };
const SEED_COLORS: winston.config.AbstractConfigSetColors = { fatal: 'magenta bold', error: 'red bold', warn: 'yellow', info: 'green', debug: 'gray' };

export function parseMaxFileSize(size: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(b|k|kb|m|mb|g|gb)?$/i.exec(size.trim());
  if (!m) return 10 * 1024 * 1024;
  const v = parseFloat(m[1]); const u = (m[2] ?? 'b').toLowerCase();
  if (u === 'k' || u === 'kb') return Math.round(v * 1024);
  if (u === 'm' || u === 'mb') return Math.round(v * 1024 * 1024);
  if (u === 'g' || u === 'gb') return Math.round(v * 1024 * 1024 * 1024);
  return Math.round(v);
}

export class Logger implements ILogger {
  private static defaultInstance: Logger | null = null;
  private readonly winston: winston.Logger;
  private readonly moduleName: string;
  private silent: boolean;
  private constructor(w: winston.Logger, moduleName: string, silent: boolean) { this.winston = w; this.moduleName = moduleName; this.silent = silent; }

  static create(config: LoggerConfig): Logger {
    const useTTY = Boolean(process.stdout.isTTY);
    fs.mkdirSync(config.logDirectory, { recursive: true });
    const transports: winston.transport[] = [];
    if (config.consoleEnabled) {
      transports.push(new winston.transports.Console({ format: useTTY ? winston.format.combine(winston.format.colorize(), winston.format.printf(Logger.fmt)) : winston.format.printf(Logger.fmt) }));
    }
    if (config.fileEnabled) {
      transports.push(new winston.transports.File({ filename: path.join(config.logDirectory, 'seed.log'), maxsize: parseMaxFileSize(config.maxFileSize), maxFiles: config.maxFiles, format: config.jsonFormat ? winston.format.combine(winston.format.timestamp(), winston.format.json()) : winston.format.printf(Logger.fmt) }));
    }
    winston.addColors(SEED_COLORS);
    const inst = winston.createLogger({ levels: SEED_LEVELS, level: config.level, format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.timestamp()), transports: transports.length > 0 ? transports : [new winston.transports.Console({ silent: true })] });
    return new Logger(inst, 'seed', false);
  }
  static getDefault(): Logger { if (!Logger.defaultInstance) { Logger.defaultInstance = Logger.create({ level: 'info', consoleEnabled: true, fileEnabled: false, logDirectory: path.resolve(process.cwd(), 'logs'), maxFileSize: '10m', maxFiles: 5, jsonFormat: true }); } return Logger.defaultInstance; }

  private static fmt(info: winston.Logform.TransformableInfo): string {
    const mod = (info.module as string | undefined) ?? 'seed';
    const base = `${info.timestamp ?? new Date().toISOString()} [${info.level}] [${mod}] ${info.message}`;
    const keys = Object.keys(info).filter((k) => !['timestamp','level','message','module','stack'].includes(k));
    const meta = keys.length ? ` ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, info[k]])))}` : '';
    const stack = info.stack ? `\n${info.stack}` : '';
    return base + meta + stack;
  }

  setSilent(s: boolean): void { this.silent = s; this.winston.silent = s; }
  isSilent(): boolean { return this.silent; }
  setLevel(l: LogLevel): void { this.winston.level = l; }
  getLevel(): LogLevel { return this.winston.level as LogLevel; }

  debug(message: string, meta?: Record<string, unknown>): void;
  debug(bindings: Record<string, unknown>, message?: string): void;
  debug(a: string | Record<string, unknown>, b?: Record<string, unknown> | string): void { this.emit('debug', a, b); }
  info(message: string, meta?: Record<string, unknown>): void;
  info(bindings: Record<string, unknown>, message?: string): void;
  info(a: string | Record<string, unknown>, b?: Record<string, unknown> | string): void { this.emit('info', a, b); }
  warn(message: string, meta?: Record<string, unknown>): void;
  warn(bindings: Record<string, unknown>, message?: string): void;
  warn(a: string | Record<string, unknown>, b?: Record<string, unknown> | string): void { this.emit('warn', a, b); }
  error(message: string, meta?: Record<string, unknown>): void;
  error(bindings: Record<string, unknown>, message?: string): void;
  error(a: string | Record<string, unknown>, b?: Record<string, unknown> | string): void { this.emit('error', a, b); }
  fatal(message: string, meta?: Record<string, unknown>): void;
  fatal(bindings: Record<string, unknown>, message?: string): void;
  fatal(a: string | Record<string, unknown>, b?: Record<string, unknown> | string): void { this.emit('fatal', a, b); }

  private emit(level: LogLevel, a: string | Record<string, unknown>, b?: Record<string, unknown> | string): void {
    if (this.silent) return;
    let message: string; let meta: Record<string, unknown> | undefined;
    if (typeof a === 'string') { message = a; meta = typeof b === 'object' ? b : undefined; }
    else { meta = a; message = typeof b === 'string' ? b : ''; }
    const payload: Record<string, unknown> = { module: this.moduleName };
    if (meta) for (const [k, v] of Object.entries(meta)) { if (v instanceof Error) { payload.stack = v.stack ?? String(v); payload[k] = v.message; } else { payload[k] = v; } }
    this.winston.log(level, message, payload);
  }

  child(module: string): ILogger { return new Logger(this.winston, this.moduleName === 'seed' ? module : `${this.moduleName}:${module}`, this.silent); }

  flush(): Promise<void> {
    return new Promise((resolve) => {
      const ts = this.winston.transports;
      if (ts.length === 0) return resolve();
      for (const t of ts) { setImmediate(() => { const f = (t as { flush?: () => void }).flush; if (typeof f === 'function') { try { f.call(t); } catch { /* best effort */ } } }); }
      resolve();
    });
  }
  get module(): string { return this.moduleName; }
  readonly entryType: LogEntry | undefined = undefined;
}
export function createLogger(config: LoggerConfig): ILogger { return Logger.create(config); }
