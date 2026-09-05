// WorldBuilder: fluent SDK for constructing a World. Keeps engine/SDK separation
// clean: concrete worlds are assembled here, then handed to WorldEngine.

import { World, type WorldSystem } from '../engine/World.js';
import type { Entity } from '../entity/Entity.js';
import { PhysicsSystem } from '../physics/PhysicsSystem.js';
import { PhysicsConfig } from '../physics/PhysicsConfig.js';

export class WorldBuilder {
  private world: World;
  private physics: PhysicsSystem | null = null;

  constructor(name = 'unnamed-world') {
    this.world = new World({ name, tickRate: 60 });
  }

  /** Set world-level config (name, tickRate). */
  setConfig(cfg: Partial<{ name: string; tickRate: number }>): this {
    this.world.config.name = cfg.name ?? this.world.config.name;
    this.world.config.tickRate = cfg.tickRate ?? this.world.config.tickRate;
    return this;
  }

  /** Add an entity (GameObject, zone, soul proxy, ...). */
  addEntity(entity: Entity): this {
    this.world.addEntity(entity);
    return this;
  }

  /** Register a custom system. */
  addSystem(system: WorldSystem): this {
    this.world.addSystem(system);
    return this;
  }

  /** Attach a physics system with the given config. */
  usePhysics(config: PhysicsConfig = PhysicsConfig.defaults()): this {
    this.physics = new PhysicsSystem({ config });
    this.world.addSystem(this.physics);
    return this;
  }

  build(): World {
    return this.world;
  }

  /** Accessor so callers can grab the wired physics system after build. */
  get physicsSystem(): PhysicsSystem | null {
    return this.physics;
  }
}
