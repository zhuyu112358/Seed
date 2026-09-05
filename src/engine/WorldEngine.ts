// WorldEngine: top-level engine that owns a World, drives its systems on a
// fixed-timestep loop, and exposes stats / entity management to the API layer.

import { Entity, GameObject } from '../entity/Entity.js';
import type { EntityConfig } from '../types/index.js';
import { PhysicsSystem } from '../physics/PhysicsSystem.js';
import { World } from './World.js';

export type WorldEngineEvent = 'tick' | 'entityCreated' | 'entityRemoved' | 'error';
export type WorldEngineCallback = (payload?: unknown) => void;

export interface WorldEngineStats {
  tickCount: number;
  uptimeMs: number;
  entityCount: number;
  activeEvents: number;
  avgTickTimeMs: number;
  p99TickTimeMs: number;
  fps: number;
  memoryUsageMB: number;
  collisionsPerSecond: number;
  interactionsPerSecond: number;
}

const TICK_WINDOW = 120;

export class WorldEngine {
  private readonly world: World;
  private readonly physics: PhysicsSystem;
  private readonly listeners = new Map<WorldEngineEvent, Set<WorldEngineCallback>>();

  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickCount = 0;
  private readonly startedAt = Date.now();
  private readonly tickSamples: number[] = [];

  constructor(config: { name: string; tickRate?: number }) {
    this.world = new World({ name: config.name, tickRate: config.tickRate ?? 60 });
    this.physics = new PhysicsSystem();
    this.world.addSystem(this.physics);
  }

  /** The active world instance. */
  get currentWorld(): World {
    return this.world;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.world.start();
    const intervalMs = 1000 / Math.max(1, this.world.config.tickRate);
    this.timer = setInterval(() => {
      try {
        this.tick(intervalMs / 1000);
      } catch (err) {
        this.emit('error', err);
      }
    }, intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    this.running = false;
    this.world.stop();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Advance one fixed step. */
  tick(deltaTime: number): void {
    const t0 = Date.now();
    this.world.step(deltaTime);
    this.tickCount += 1;
    const elapsed = Date.now() - t0;
    this.tickSamples.push(elapsed);
    if (this.tickSamples.length > TICK_WINDOW) this.tickSamples.shift();
    this.emit('tick', { tick: this.tickCount, deltaTime });
  }

  getStats(): WorldEngineStats {
    const sorted = [...this.tickSamples].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    const p99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] : 0;
    const uptime = Date.now() - this.startedAt;
    return {
      tickCount: this.tickCount,
      uptimeMs: uptime,
      entityCount: this.world.entities.size,
      activeEvents: 0,
      avgTickTimeMs: avg,
      p99TickTimeMs: p99,
      fps: uptime > 0 ? (this.tickCount / uptime) * 1000 : 0,
      memoryUsageMB: process.memoryUsage().heapUsed / (1024 * 1024),
      collisionsPerSecond: this.physics.counters.collisions,
      interactionsPerSecond: 0,
    };
  }

  createEntity(config: EntityConfig): Entity {
    const entity = new GameObject({
      name: config.name ?? config.type,
      type: config.type as never,
      position: config.position,
      mass: config.mass,
      material: config.material,
    });
    if (config.id) Object.defineProperty(entity, 'id', { value: config.id, writable: false });
    this.world.addEntity(entity);
    this.emit('entityCreated', entity);
    return entity;
  }

  removeEntity(id: string): boolean {
    const removed = this.world.removeEntity(id);
    if (removed) this.emit('entityRemoved', id);
    return removed;
  }

  getEntity(id: string): Entity | undefined {
    return this.world.getEntity(id);
  }

  getAllEntities(): Entity[] {
    return [...this.world.entities.values()];
  }

  on(event: WorldEngineEvent, cb: WorldEngineCallback): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
  }

  off(event: WorldEngineEvent, cb: WorldEngineCallback): void {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: WorldEngineEvent, payload?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(payload);
      } catch {
        // listener errors must not crash the engine
      }
    }
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}
