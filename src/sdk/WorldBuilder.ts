/**
 * Seed SDK - WorldBuilder
 *
 * Fluent builder that assembles a declarative WorldConfig from entity configs,
 * physics overrides, communication strategies, listeners and soul registrations.
 * `build()` returns the immutable config; `buildAndStart()` spins up a lightweight
 * self-contained running world so the SDK is usable before the full engine lands.
 */

import type {
  EntityConfig, ICommunicationStrategy, IWorldBuilder, IVector3,
  PhysicsConfig, WorldBuildOptions, WorldConfig, WorldEvent, WorldStats,
} from '../types/index.js';
import { createPhysicsConfig, defaultPhysicsConfig } from './PhysicsConfig.js';

let worldSeq = 1;

interface PendingListener { type: string; handler: (event: WorldEvent) => void; }
interface PendingSoul { soulId: string; spawnPosition: IVector3; }

interface LiveEntity {
  id: string; type: EntityConfig['type']; name: string;
  position: IVector3; velocity: IVector3; mass: number;
  state: Record<string, unknown>;
}

/**
 * Lightweight running world returned by buildAndStart.
 * TODO: replace with the full engine/WorldEngine once its subsystems converge.
 */
export class RunningWorld {
  public readonly config: WorldConfig;
  private readonly entities = new Map<string, LiveEntity>();
  private readonly strategies: ICommunicationStrategy[] = [];
  private readonly listeners = new Map<string, Set<(e: WorldEvent) => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private startTime = 0;
  private worldTime = 0;
  private running = false;

  constructor(config: WorldConfig) { this.config = config; }

  addEntity(config: EntityConfig): LiveEntity {
    const entity: LiveEntity = {
      id: config.id ?? `ent_${this.tickCount}_${this.entities.size}`,
      type: config.type, name: config.name,
      position: config.position ? { ...config.position } : { x: 0, y: 0, z: 0 },
      velocity: config.velocity ? { ...config.velocity } : { x: 0, y: 0, z: 0 },
      mass: config.mass ?? 1, state: { ...(config.state ?? {}) },
    };
    this.entities.set(entity.id, entity);
    return entity;
  }
  removeEntity(id: string): boolean { return this.entities.delete(id); }
  getEntity(id: string): LiveEntity | undefined { return this.entities.get(id); }
  getAllEntities(): LiveEntity[] { return [...this.entities.values()]; }
  addStrategy(strategy: ICommunicationStrategy): void { this.strategies.push(strategy); }
  on(type: string, handler: (e: WorldEvent) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler); this.listeners.set(type, set);
  }
  start(): void {
    if (this.running) return;
    this.running = true; this.startTime = Date.now();
    const intervalMs = 1000 / Math.max(1, this.config.tickRate);
    const dt = intervalMs / 1000;
    this.timer = setInterval(() => this.tick(dt), intervalMs);
  }
  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  get isRunning(): boolean { return this.running; }

  tick(deltaTime: number): void {
    this.tickCount += 1; this.worldTime += deltaTime;
    for (const s of this.strategies) { try { s.update(deltaTime); } catch { /* isolated */ } }
    const set = this.listeners.get('tick');
    if (set) {
      const event: WorldEvent = {
        id: `tick_${this.tickCount}`, type: 'tick', name: 'tick', severity: 'info',
        position: { x: 0, y: 0, z: 0 }, radius: 0, status: 'active',
        createdAt: Date.now(), data: { tick: this.tickCount, worldTime: this.worldTime },
      };
      for (const h of set) { try { h(event); } catch { /* isolated */ } }
    }
  }

  getStats(): WorldStats {
    const uptime = this.startTime === 0 ? 0 : Date.now() - this.startTime;
    return {
      tickCount: this.tickCount, uptimeMs: uptime,
      entityCount: this.entities.size, activeEvents: 0,
      avgTickTimeMs: 0, p99TickTimeMs: 0, fps: this.config.tickRate,
      memoryUsageMB: process.memoryUsage().heapUsed / (1024 * 1024),
      collisionsPerSecond: 0, interactionsPerSecond: 0,
    };
  }

  destroy(): void {
    this.stop(); this.entities.clear(); this.listeners.clear();
    for (const s of this.strategies) { try { s.destroy(); } catch { /* isolated */ } }
  }
}

export class WorldBuilder implements IWorldBuilder {
  private options: WorldBuildOptions = { name: 'untitled-world' };
  private physicsOverrides: Partial<PhysicsConfig> = {};
  private readonly pendingEntities: EntityConfig[] = [];
  private readonly strategies: ICommunicationStrategy[] = [];
  private readonly eventListeners: PendingListener[] = [];
  private readonly souls: PendingSoul[] = [];
  private tickRate = 60;
  private weatherEnabled = false;
  private weatherInitial?: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow' | 'windy' | 'extreme';
  private clockEnabled = false;
  private clockDayLength = 60;
  private eventsEnabled = false;
  private eventsMaxActive = 10;

  createWorld(options: WorldBuildOptions): this {
    this.options = options;
    if (options.tickRate !== undefined) this.tickRate = options.tickRate;
    this.weatherEnabled = options.weather ?? false;
    this.clockEnabled = options.clock ?? false;
    this.eventsEnabled = options.events ?? false;
    if (options.physics) this.physicsOverrides = { ...options.physics };
    return this;
  }
  addEntity(config: EntityConfig): string {
    const id = config.id ?? `ent_${this.pendingEntities.length}_${worldSeq++}`;
    this.pendingEntities.push({ ...config, id });
    return id;
  }
  addEntities(configs: EntityConfig[]): string[] { return configs.map((c) => this.addEntity(c)); }
  setPhysicsConfig(config: Partial<PhysicsConfig>): this {
    this.physicsOverrides = { ...this.physicsOverrides, ...config };
    return this;
  }
  addCommunicationStrategy(strategy: ICommunicationStrategy): this {
    try { strategy.initialize({}); } catch { /* defensive */ }
    this.strategies.push(strategy);
    return this;
  }
  addEventListener(type: string, handler: (event: WorldEvent) => void): this {
    this.eventListeners.push({ type, handler });
    return this;
  }
  registerSoul(soulId: string, spawnPosition: IVector3): this {
    this.souls.push({ soulId, spawnPosition });
    return this;
  }
  setTickRate(rate: number): this { this.tickRate = Math.max(1, Math.floor(rate)); return this; }
  enableWeather(initialState?: typeof this.weatherInitial): this {
    this.weatherEnabled = true; this.weatherInitial = initialState; return this;
  }
  enableClock(dayLengthSeconds: number): this {
    this.clockEnabled = true; this.clockDayLength = dayLengthSeconds; return this;
  }
  enableEvents(maxActive = 10): this {
    this.eventsEnabled = true; this.eventsMaxActive = maxActive; return this;
  }

  build(): WorldConfig {
    const physics: PhysicsConfig = {
      ...createPhysicsConfig({ ...defaultPhysicsConfig, ...this.physicsOverrides }),
    };
    const strategyNames = this.strategies.map((s) => s.name);
    return {
      id: this.options.id ?? `world_${Date.now().toString(36)}_${worldSeq++}`,
      name: this.options.name,
      description: this.options.description ?? '',
      version: '0.1.0',
      bounds: this.options.bounds ?? {
        min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 20, z: 50 },
      },
      physics, tickRate: this.tickRate, maxEntities: 10000,
      communication: { strategies: strategyNames, defaultStrategy: strategyNames[0] ?? 'none' },
      weather: { enabled: this.weatherEnabled, ...(this.weatherInitial ? { initialState: this.weatherInitial } : {}) },
      clock: { enabled: this.clockEnabled, dayLengthSeconds: this.clockDayLength },
      events: { enabled: this.eventsEnabled, maxActiveEvents: this.eventsMaxActive },
      snapshot: { enabled: true, intervalMs: 5000, maxSnapshots: 20, directory: 'snapshots' },
    };
  }

  async buildAndStart(): Promise<RunningWorld> {
    const config = this.build();
    const world = new RunningWorld(config);
    for (const cfg of this.pendingEntities) world.addEntity(cfg);
    for (const s of this.strategies) world.addStrategy(s);
    for (const { type, handler } of this.eventListeners) world.on(type, handler);
    for (const { soulId, spawnPosition } of this.souls) {
      world.addEntity({
        id: `soul_${soulId}`, type: 'soul', name: `soul:${soulId}`,
        position: { ...spawnPosition }, material: 'energy', state: { soulId },
      });
    }
    world.start();
    return world;
  }
}
