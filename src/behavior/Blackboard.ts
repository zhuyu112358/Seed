// Blackboard: shared data store for behavior tree agents.
// Per-agent key-value storage with change notification.
import { EventEmitter } from "node:events";

export class Blackboard {
  private data = new Map<string, unknown>();
  private emitter = new EventEmitter();

  /** Get a value by key. Returns undefined if not set. */
  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  /** Set a value. Triggers change event. */
  set(key: string, value: unknown): void {
    this.data.set(key, value);
    this.emitter.emit("change", key, value);
    this.emitter.emit(`change:${key}`, value);
  }

  /** Check if a key exists. */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /** Delete a key. */
  delete(key: string): boolean {
    const existed = this.data.delete(key);
    if (existed) {
      this.emitter.emit("change", key, undefined);
      this.emitter.emit(`change:${key}`, undefined);
    }
    return existed;
  }

  /** Get all keys. */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /** Clear all data. */
  clear(): void {
    this.data.clear();
    this.emitter.emit("clear");
  }

  /** Subscribe to all changes. Returns unsubscribe function. */
  onChange(callback: (key: string, value: unknown) => void): () => void {
    this.emitter.on("change", callback);
    return () => this.emitter.off("change", callback);
  }

  /** Subscribe to changes on a specific key. Returns unsubscribe function. */
  onKeyChange(key: string, callback: (value: unknown) => void): () => void {
    this.emitter.on(`change:${key}`, callback);
    return () => this.emitter.off(`change:${key}`, callback);
  }

  /** Get number of entries. */
  get size(): number {
    return this.data.size;
  }

  /** Serialize to plain object. */
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.data) {
      obj[key] = value;
    }
    return obj;
  }

  /** Deserialize from plain object. */
  static fromJSON(data: Record<string, unknown>): Blackboard {
    const bb = new Blackboard();
    for (const [key, value] of Object.entries(data)) {
      bb.data.set(key, value);
    }
    return bb;
  }
}
