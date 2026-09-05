import type { IObjectPool } from '../types/index.js';
export interface ObjectPoolOptions<T> { factory: () => T; reset?: (obj: T) => void; maxPoolSize?: number; }
export class ObjectPool<T> implements IObjectPool<T> {
  private readonly factory: () => T;
  private readonly resetFn: ((obj: T) => void) | undefined;
  private readonly maxPoolSize: number;
  private readonly pooled: T[] = [];
  private activeCount = 0;
  constructor(o: ObjectPoolOptions<T>) { this.factory = o.factory; this.resetFn = o.reset; this.maxPoolSize = o.maxPoolSize ?? 1000; }
  acquire(): T { this.activeCount += 1; const r = this.pooled.pop(); return r !== undefined ? r : this.factory(); }
  release(obj: T): void { this.activeCount = Math.max(0, this.activeCount - 1); if (this.resetFn) this.resetFn(obj); if (this.pooled.length < this.maxPoolSize) this.pooled.push(obj); }
  preallocate(n: number): void { for (let i = 0; i < n; i += 1) { if (this.pooled.length >= this.maxPoolSize) break; this.pooled.push(this.factory()); } }
  shrink(): void { this.pooled.length = 0; }
  getStats(): { active: number; pooled: number; total: number } { return { active: this.activeCount, pooled: this.pooled.length, total: this.activeCount + this.pooled.length }; }
  clear(): void { this.pooled.length = 0; this.activeCount = 0; }
}
