// WorldBuilder: fluent SDK for constructing a World.
import { World, type WorldSystem } from '../engine/World.js';
import type { Entity } from '../entity/Entity.js';
import { PhysicsSystem } from '../physics/PhysicsSystem.js';
import { PhysicsConfig } from '../physics/PhysicsConfig.js';
export class WorldBuilder {
  private world: World;
  private physics: PhysicsSystem | null = null;
  constructor(name = 'unnamed-world') { this.world = new World({ name, tickRate: 60 }); }
  setConfig(cfg: Partial<{ name: string; tickRate: number }>): this { this.world.config.name = cfg.name ?? this.world.config.name; this.world.config.tickRate = cfg.tickRate ?? this.world.config.tickRate; return this; }
  addEntity(entity: Entity): this { this.world.addEntity(entity); return this; }
  addSystem(system: WorldSystem): this { this.world.addSystem(system); return this; }
  usePhysics(config: PhysicsConfig = PhysicsConfig.defaults()): this { this.physics = new PhysicsSystem({ config }); this.world.addSystem(this.physics); return this; }
  build(): World { return this.world; }
  get physicsSystem(): PhysicsSystem | null { return this.physics; }
}
