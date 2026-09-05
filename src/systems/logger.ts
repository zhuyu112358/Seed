import type { ILogger } from '../types/index.js';
type Bound = Record<string, unknown>;
function emit(level: string, a: string | Bound, b?: string | Bound): void {
  if (typeof a === 'string') console.log(`[${level}]`, a, b ?? ''); else console.log(`[${level}]`, b ?? '', a);
}
export const consoleFallbackLogger: ILogger = {
  debug(a: string | Bound, b?: string | Bound): void { emit('debug', a, b); },
  info(a: string | Bound, b?: string | Bound): void { emit('info', a, b); },
  warn(a: string | Bound, b?: string | Bound): void { emit('warn', a, b); },
  error(a: string | Bound, b?: string | Bound): void { emit('error', a, b); },
  fatal(a: string | Bound, b?: string | Bound): void { emit('fatal', a, b); },
  child(_m: string): ILogger { return this; },
} as ILogger;
