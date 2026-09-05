// World: a configurable container that holds entities, systems and config.
// The engine itself is world-agnostic; concrete worlds are built by the SDK's
// WorldBuilder and handed to the engine.

import { Entity, GameObject } from '../entity/Entity.js';
import { EventSystem } from '../event/EventSystem.js';
import { WorldTickEvent } from '../event/Event.js';

/** Lifecycle phase of a world instance. */
export type SystemState = 'created' | 'running' | 'stopped' | 'error';

/** A lifecycle system pluggable into a world. */
export interface WorldSystem {
  readonly name: string;
  enabled: boolean;
  start?(): void;
  stop?(): void;
  tick(dt: number, world: World, events: EventSystem): void;
}

export interface WorldConfig {
  name: string;
  tickRate: number; // ticks per second
}

export class World {
  public readonly config: WorldConfig;
  public readonly entities = new Map<string, Entity>();
  public readonly systems: WorldSystem[] = [];
  public readonly events = new EventSystem();
  public worldTime = 0;
  public tick = 0;
  public state: SystemState = 'created';

  constructor(config: WorldConfig) {
    this.config = config;
  }

  addEntity(entity: Entity): this {
    this.entities.set(entity.id, entity);
    return this;
  }

  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  addSystem(system: WorldSystem): this {
    this.systems.push(system);
    return this;
  }

  /** All GameObjects (physical bodies) in the world. */
  bodies(): GameObject[] {
    const out: GameObject[] = [];
    for (const e of this.entities.values()) {
      if (e instanceof GameObject) out.push(e);
    }
    return out;
  }

  /** All entities of a given type. */
  queryByType(type: string): Entity[] {
    const out: Entity[] = [];
    for (const e of this.entities.values()) if (e.type === type) out.push(e);
    return out;
  }

  /** Iterate every entity with a callback. */
  iterate(fn: (e: Entity) => void): void {
    for (const e of this.entities.values()) fn(e);
  }

  start(): void {
    this.state = 'running';
    for (const s of this.systems) s.start?.();
  }

  stop(): void {
    this.state = 'stopped';
    for (const s of this.systems) s.stop?.();
  }

  /** Advance the world by one fixed timestep. */
  step(dt: number): void {
    this.tick++;
    this.worldTime += dt;
    this.events.emit(new WorldTickEvent(this.tick, this.worldTime));
    for (const s of this.systems) {
      if (!s.enabled) continue;
      s.tick(dt, this, this.events);
    }
  }
}
