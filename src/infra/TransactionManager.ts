import crypto from 'node:crypto';
import type { ILogger, Transaction, TransactionOperation } from '../types/index.js';

export interface TransactionManagerConfig { logger?: ILogger; transactionTimeoutMs?: number; }
interface Checkpoint { id: string; timestamp: number; transactionIds: string[]; }

class NullLogger implements ILogger {
  debug(): void {} info(): void {} warn(): void {} error(): void {} fatal(): void {}
  child(): ILogger { return this; }
}

export class TransactionManager {
  private readonly logger: ILogger;
  private readonly transactionTimeoutMs: number;
  private readonly transactions = new Map<string, Transaction>();
  private readonly checkpoints: Checkpoint[] = [];
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(config: TransactionManagerConfig = {}) {
    this.logger = config.logger ?? new NullLogger();
    this.transactionTimeoutMs = config.transactionTimeoutMs ?? 30000;
    this.sweepTimer = setInterval(() => this.sweep(), 1000);
    if (typeof this.sweepTimer.unref === 'function') this.sweepTimer.unref();
  }
  beginTransaction(): Transaction {
    const tx: Transaction = { id: crypto.randomUUID(), timestamp: Date.now(), operations: [], status: 'pending', undoLog: [] };
    this.transactions.set(tx.id, tx); return tx;
  }
  commitTransaction(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== 'pending') return false;
    tx.status = 'committed'; return true;
  }
  rollbackTransaction(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== 'pending') return false;
    tx.status = 'rolled_back'; return true;
  }
  addOperation(txId: string, operation: TransactionOperation, previousState: Record<string, unknown>): void {
    const tx = this.transactions.get(txId); if (!tx) return;
    tx.operations.push(operation); tx.undoLog.push({ operation, previousState });
  }
  getTransaction(txId: string): Transaction | undefined { return this.transactions.get(txId); }
  getActiveTransactions(): Transaction[] { return Array.from(this.transactions.values()).filter((t) => t.status === 'pending'); }
  createCheckpoint(): string {
    const c: Checkpoint = { id: crypto.randomUUID(), timestamp: Date.now(), transactionIds: this.getActiveTransactions().map((t) => t.id) };
    this.checkpoints.push(c); return c.id;
  }
  rollbackToCheckpoint(checkpointId: string): boolean {
    const c = this.checkpoints.find((x) => x.id === checkpointId); if (!c) return false;
    const before = new Set(c.transactionIds);
    for (const tx of this.getActiveTransactions().filter((t) => !before.has(t.id))) this.rollbackTransaction(tx.id);
    return true;
  }
  listCheckpoints(): Array<{ id: string; timestamp: number; transactionCount: number }> {
    return this.checkpoints.map((c) => ({ id: c.id, timestamp: c.timestamp, transactionCount: c.transactionIds.length }));
  }
  private sweep(): void {
    const now = Date.now();
    for (const tx of this.transactions.values()) {
      if (tx.status === 'pending' && now - tx.timestamp > this.transactionTimeoutMs) this.rollbackTransaction(tx.id);
    }
  }
  destroy(): void { clearInterval(this.sweepTimer); }
}
