import { Entity, GameObject } from "../entity/Entity.js";
import type { EntityConfig } from "../types/index.js";
import { PhysicsSystem } from "../physics/PhysicsSystem.js";
import { World } from "./World.js";
export type WorldEngineEvent = "tick" | "entityCreated" | "entityRemoved" | "error";
export type WorldEngineCallback = (payload?: unknown) => void;
export interface WorldEngineStats { tickCount: number; uptimeMs: number; entityCount: number; activeEvents: number; avgTickTimeMs: number; p99TickTimeMs: number; fps: number; memoryUsageMB: number; collisionsPerSecond: number; interactionsPerSecond: number; }
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
  get currentWorld(): World { return this.world; }
  get isRunning(): boolean { return this.running; }
  start(): void { if (this.running) return; this.running = true; this.world.start(); const ms = 1000 / Math.max(1, this.world.config.tickRate); this.timer = setInterval(() => { try { this.tick(ms / 1000); } catch (err) { this.emit("error", err); } }, ms); if (this.timer && typeof this.timer.unref === "function") this.timer.unref(); }
  stop(): void { this.running = false; this.world.stop(); if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  tick(dt: number): void { const t0 = Date.now(); this.world.step(dt); this.tickCount++; const el = Date.now() - t0; this.tickSamples.push(el); if (this.tickSamples.length > TICK_WINDOW) this.tickSamples.shift(); this.emit("tick", { tick: this.tickCount, deltaTime: dt }); }
  getStats(): WorldEngineStats { const s = [...this.tickSamples].sort((a, b) => a - b); const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0; const p99 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.99))] : 0; const up = Date.now() - this.startedAt; return { tickCount: this.tickCount, uptimeMs: up, entityCount: this.world.entities.size, activeEvents: 0, avgTickTimeMs: avg, p99TickTimeMs: p99, fps: up > 0 ? (this.tickCount / up) * 1000 : 0, memoryUsageMB: process.memoryUsage().heapUsed / (1024 * 1024), collisionsPerSecond: this.physics.counters.collisions, interactionsPerSecond: 0 }; }
  createEntity(config: EntityConfig): Entity { const e = new GameObject({ name: config.name ?? config.type, type: config.type as never, position: config.position, mass: config.mass, material: config.material }); if (config.id) Object.defineProperty(e, "id", { value: config.id, writable: false }); this.world.addEntity(e); this.emit("entityCreated", e); return e; }
  removeEntity(id: string): boolean { const r = this.world.removeEntity(id); if (r) this.emit("entityRemoved", id); return r; }
  getEntity(id: string): Entity | undefined { return this.world.getEntity(id); }
  getAllEntities(): Entity[] { return [...this.world.entities.values()]; }
  on(ev: WorldEngineEvent, cb: WorldEngineCallback): void { let s = this.listeners.get(ev); if (!s) { s = new Set(); this.listeners.set(ev, s); } s.add(cb); }
  off(ev: WorldEngineEvent, cb: WorldEngineCallback): void { this.listeners.get(ev)?.delete(cb); }
  private emit(ev: WorldEngineEvent, payload?: unknown): void { const s = this.listeners.get(ev); if (!s) return; for (const cb of s) { try { cb(payload); } catch { /* swallow */ } } }
  destroy(): void { this.stop(); this.listeners.clear(); }
}