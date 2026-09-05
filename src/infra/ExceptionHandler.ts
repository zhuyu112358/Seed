import type { ExceptionInfo, ILogger, RecoveryAction } from '../types/index.js';

export interface ExceptionHandlerConfig {
  logger?: ILogger;
  onFatal?: (info: ExceptionInfo) => void;
  historySize?: number;
}
export type RecoveryStrategy = (error: Error, context: Record<string, unknown>, entityId?: string) => RecoveryAction[];

class NullLogger implements ILogger {
  debug(): void {} info(): void {} warn(): void {} error(): void {} fatal(): void {}
  child(): ILogger { return this; }
}

export class ExceptionHandler {
  private readonly logger: ILogger;
  private readonly onFatal?: (info: ExceptionInfo) => void;
  private readonly historySize: number;
  private readonly history: ExceptionInfo[] = [];
  private readonly isolated = new Set<string>();
  private readonly strategies = new Map<string, RecoveryStrategy>();
  private totalErrors = 0;
  private readonly byModule = new Map<string, number>();
  private readonly bySeverity = new Map<string, number>();
  private attempts = 0; private successes = 0;

  constructor(config: ExceptionHandlerConfig = {}) {
    this.logger = config.logger ?? new NullLogger();
    this.onFatal = config.onFatal; this.historySize = config.historySize ?? 500;
  }

  handle(error: Error, module: string, context: Record<string, unknown> = {}, entityId?: string): RecoveryAction[] {
    const severity = this.classify(error);
    const info: ExceptionInfo = { error, module, entityId, timestamp: Date.now(), severity, context };
    this.record(info);
    this.logger.error(`[${module}] ${error.message}`, { severity, entityId, stack: error.stack });
    const strategy = this.strategies.get(module);
    const actions = strategy ? strategy(error, context, entityId) : this.defaultActions(severity, module, entityId);
    this.attempts += 1;
    if (!actions.some((a) => a.type === 'restart_world')) this.successes += 1;
    if (severity === 'fatal') this.onFatal?.(info);
    return actions;
  }

  private classify(error: Error): 'recoverable' | 'degraded' | 'fatal' {
    const name = error.name ?? ''; const msg = error.message ?? '';
    if (name === 'OutOfMemoryError' || /out of memory|heap limit|ENOMEM/i.test(msg)) return 'fatal';
    const f = error as Error & { recoverable?: boolean; fatal?: boolean };
    if (f.fatal === true) return 'fatal';
    if (f.recoverable === true) return 'degraded';
    if (error instanceof TypeError || error instanceof RangeError) return 'recoverable';
    return 'recoverable';
  }

  private defaultActions(severity: 'recoverable' | 'degraded' | 'fatal', module: string, entityId?: string): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    if (entityId) { this.isolated.add(entityId); actions.push({ type: 'isolate_entity', target: entityId, reason: `Isolated entity "${entityId}"` }); }
    if (severity === 'fatal') { actions.push({ type: 'restart_world', reason: `Fatal in "${module}"` }); actions.push({ type: 'alert', reason: 'Fatal world error' }); }
    else if (severity === 'degraded') { actions.push({ type: 'degrade', target: module, reason: `Degrading "${module}"` }); actions.push({ type: 'alert', reason: `Degraded "${module}"` }); }
    else actions.push({ type: 'alert', reason: `Recoverable error in "${module}"` });
    return actions;
  }

  registerRecoveryStrategy(module: string, strategy: RecoveryStrategy): void { this.strategies.set(module, strategy); }
  getErrorHistory(): ExceptionInfo[] { return [...this.history]; }
  getIsolatedEntities(): string[] { return Array.from(this.isolated); }
  clearIsolatedEntity(entityId: string): boolean { return this.isolated.delete(entityId); }
  setupProcessHandlers(): void {
    process.on('uncaughtException', (e: Error) => this.handle(e, 'process', { phase: 'uncaughtException' }));
    process.on('unhandledRejection', (r: unknown) => this.handle(r instanceof Error ? r : new Error(String(r)), 'process', { phase: 'unhandledRejection' }));
  }
  getStats(): { totalErrors: number; errorsByModule: Record<string, number>; errorsBySeverity: Record<string, number>; recoverySuccessRate: number; isolatedEntityCount: number; } {
    return {
      totalErrors: this.totalErrors,
      errorsByModule: Object.fromEntries(this.byModule),
      errorsBySeverity: { recoverable: this.bySeverity.get('recoverable') ?? 0, degraded: this.bySeverity.get('degraded') ?? 0, fatal: this.bySeverity.get('fatal') ?? 0 },
      recoverySuccessRate: this.attempts === 0 ? 1 : this.successes / this.attempts,
      isolatedEntityCount: this.isolated.size,
    };
  }
  private record(info: ExceptionInfo): void {
    this.history.push(info); if (this.history.length > this.historySize) this.history.shift();
    this.totalErrors += 1;
    this.byModule.set(info.module, (this.byModule.get(info.module) ?? 0) + 1);
    this.bySeverity.set(info.severity, (this.bySeverity.get(info.severity) ?? 0) + 1);
  }
}
