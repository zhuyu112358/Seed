/**
 * Generic object pool for reusing frequently created/destroyed objects.
 * Reduces GC pressure by recycling objects instead of allocating new ones.
 *
 * Usage:
 *   const pool = new ObjectPool({
 *     factory: () => new Vector3(),
 *     reset: (v) => { v.x = 0; v.y = 0; v.z = 0; },
 *     initialSize: 100,
 *     maxSize: 1000,
 *   });
 *   const v = pool.acquire();
 *   // use v...
 *   pool.release(v);
 */

/** Configuration for ObjectPool. */
export interface ObjectPoolConfig<T> {
  /** Factory function that creates a new object instance. */
  factory: () => T;
  /** Optional function to reset an object to its initial state before reuse. */
  reset?: (obj: T) => void;
  /** Optional function to validate an object before returning it to the pool. */
  validate?: (obj: T) => boolean;
  /** Number of objects to pre-allocate on construction. Default: 0. */
  initialSize?: number;
  /** Maximum number of objects kept in the pool. Excess released objects are discarded. Default: Infinity. */
  maxSize?: number;
}

/** Statistics about pool usage. */
export interface PoolStats {
  /** Total objects created by the factory. */
  createdCount: number;
  /** Total objects acquired from the pool. */
  acquiredCount: number;
  /** Total objects released back to the pool. */
  releasedCount: number;
  /** Number of objects currently in use (acquired but not released). */
  activeCount: number;
  /** Number of objects currently idle in the pool. */
  poolSize: number;
  /** Maximum pool size limit. */
  maxSize: number;
}

/**
 * A generic object pool that recycles objects to reduce garbage collection overhead.
 * Particularly useful for short-lived objects like vectors, particles, projectiles,
 * and temporary entities in game loops.
 */
export class ObjectPool<T> {
  private readonly factory: () => T;
  private readonly resetFn?: (obj: T) => void;
  private readonly validateFn?: (obj: T) => boolean;
  private readonly maxSize: number;

  private pool: T[] = [];
  private activeSet = new Set<T>();

  private createdCount = 0;
  private acquiredCount = 0;
  private releasedCount = 0;

  constructor(config: ObjectPoolConfig<T>) {
    this.factory = config.factory;
    this.resetFn = config.reset;
    this.validateFn = config.validate;
    this.maxSize = config.maxSize ?? Infinity;

    const initial = config.initialSize ?? 0;
    for (let i = 0; i < initial; i++) {
      this.pool.push(this.createObject());
    }
  }

  /** Acquire an object from the pool. Creates a new one if the pool is empty. */
  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
      if (this.validateFn && !this.validateFn(obj)) {
        // Invalid object: discard and create a fresh one.
        obj = this.createObject();
      }
    } else {
      obj = this.createObject();
    }
    this.activeSet.add(obj);
    this.acquiredCount++;
    return obj;
  }

  /** Release an object back to the pool for reuse. The object is reset before storage. */
  release(obj: T): void {
    if (!this.activeSet.has(obj)) {
      // Object was not acquired from this pool; ignore to prevent double-release.
      return;
    }
    this.activeSet.delete(obj);
    this.releasedCount++;

    if (this.resetFn) {
      this.resetFn(obj);
    }

    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
    // If pool is at max capacity, the object is discarded (will be GC'd).
  }

  /** Pre-allocate objects into the pool up to the specified count. */
  preallocate(count: number): void {
    const target = Math.min(count, this.maxSize);
    while (this.pool.length < target) {
      this.pool.push(this.createObject());
    }
  }

  /** Remove all idle objects from the pool. Active objects remain valid. */
  clear(): void {
    this.pool.length = 0;
  }

  /** Get current pool statistics. */
  getStats(): PoolStats {
    return {
      createdCount: this.createdCount,
      acquiredCount: this.acquiredCount,
      releasedCount: this.releasedCount,
      activeCount: this.activeSet.size,
      poolSize: this.pool.length,
      maxSize: this.maxSize,
    };
  }

  /** Number of idle objects currently in the pool. */
  get size(): number {
    return this.pool.length;
  }

  /** Number of objects currently in use. */
  get activeCount(): number {
    return this.activeSet.size;
  }

  private createObject(): T {
    this.createdCount++;
    return this.factory();
  }
}
