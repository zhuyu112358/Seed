// WorldSerializer: serializes and deserializes world state for persistence.
// Uses a plugin/registry approach: each system can register its own
// serialize/deserialize functions. Entity state is serialized generically;
// system-specific state is handled by registered serializers.
//
// No hardcoded world content — the serializer is generic and works with any
// world configuration.

import type { World } from "../engine/World.js";
import type { Entity } from "../entity/Entity.js";
import type { WorldSystem } from "../engine/World.js";
import type { IVector3 } from "../types/index.js";

/** Serialized entity state. */
export interface SerializedEntity {
  id: string;
  name: string;
  type: string;
  position: IVector3;
  velocity: IVector3;
  mass: number;
  material: string;
  active: boolean;
  state: Record<string, unknown>;
  properties: Record<string, unknown>;
  children: SerializedEntity[];
}

/** Serialized system state (keyed by system name). */
export type SerializedSystems = Record<string, unknown>;

/** Complete serialized world state. */
export interface SerializedWorld {
  version: number;
  name: string;
  tickRate: number;
  worldTime: number;
  tick: number;
  entities: SerializedEntity[];
  systems: SerializedSystems;
  metadata: Record<string, unknown>;
}

/** A system that can serialize/deserialize its own state. */
export interface ISerializable {
  /** Serialize system state to a JSON-compatible object. */
  serialize(): unknown;
  /** Deserialize system state from a JSON-compatible object. */
  deserialize(data: unknown): void;
}

/** Type guard for ISerializable. */
export function isSerializable(system: WorldSystem): system is WorldSystem & ISerializable {
  return typeof (system as unknown as ISerializable).serialize === "function"
    && typeof (system as unknown as ISerializable).deserialize === "function";
}

/**
 * WorldSerializer: coordinates serialization and deserialization of world state.
 *
 * Entity state is serialized generically (position, velocity, state map, etc.).
 * System state is handled by systems that implement ISerializable, or by
 * externally registered serializers via registerSystemSerializer().
 */
export class WorldSerializer {
  /** Serialization format version. */
  static readonly VERSION = 1;

  /** External system serializers: system name -> {serialize, deserialize}. */
  private systemSerializers = new Map<string, {
    serialize: (world: World) => unknown;
    deserialize: (world: World, data: unknown) => void;
  }>();

  /**
   * Register an external serializer for a system by name.
   * Used for systems that don't implement ISerializable directly.
   */
  registerSystemSerializer(
    systemName: string,
    serialize: (world: World) => unknown,
    deserialize: (world: World, data: unknown) => void,
  ): void {
    this.systemSerializers.set(systemName, { serialize, deserialize });
  }

  /** Serialize a world to a SerializedWorld object. */
  serialize(world: World): SerializedWorld {
    // Serialize entities (top-level only; children are nested).
    const entities: SerializedEntity[] = [];
    for (const entity of world.entities.values()) {
      if (!entity.parent) {
        entities.push(this.serializeEntity(entity));
      }
    }

    // Serialize systems.
    const systems: SerializedSystems = {};
    for (const system of world.systems) {
      if (isSerializable(system)) {
        systems[system.name] = system.serialize();
      } else if (this.systemSerializers.has(system.name)) {
        systems[system.name] = this.systemSerializers.get(system.name)!.serialize(world);
      }
    }

    return {
      version: WorldSerializer.VERSION,
      name: world.config.name,
      tickRate: world.config.tickRate,
      worldTime: world.worldTime,
      tick: world.tick,
      entities,
      systems,
      metadata: {},
    };
  }

  /** Serialize an entity (and its children recursively). */
  private serializeEntity(entity: Entity): SerializedEntity {
    const state: Record<string, unknown> = {};
    for (const [key, value] of entity.state) {
      state[key] = value;
    }

    const properties: Record<string, unknown> = {};
    for (const [key, value] of entity.properties) {
      properties[key] = value;
    }

    const children: SerializedEntity[] = [];
    for (const child of entity.children) {
      children.push(this.serializeEntity(child));
    }

    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
      velocity: { x: entity.velocity.x, y: entity.velocity.y, z: entity.velocity.z },
      mass: entity.mass,
      material: entity.material,
      active: entity.active,
      state,
      properties,
      children,
    };
  }

  /**
   * Deserialize a SerializedWorld into an existing world.
   * Note: systems must already be added to the world; this only restores state.
   * Entities are created via the provided factory function.
   */
  deserialize(
    data: SerializedWorld,
    world: World,
    entityFactory: (serialized: SerializedEntity) => Entity,
  ): void {
    // Restore world time/tick.
    world.worldTime = data.worldTime;
    (world as { tick: number }).tick = data.tick;

    // Clear existing entities.
    world.entities.clear();

    // Restore entities.
    for (const serializedEntity of data.entities) {
      const entity = entityFactory(serializedEntity);
      this.restoreEntityState(entity, serializedEntity);
      world.addEntity(entity);
    }

    // Restore system state.
    for (const system of world.systems) {
      const systemData = data.systems[system.name];
      if (systemData === undefined) continue;

      if (isSerializable(system)) {
        system.deserialize(systemData);
      } else if (this.systemSerializers.has(system.name)) {
        this.systemSerializers.get(system.name)!.deserialize(world, systemData);
      }
    }
  }

  /** Restore entity state from serialized data (state map, properties, children). */
  private restoreEntityState(entity: Entity, data: SerializedEntity): void {
    entity.active = data.active;
    entity.state.clear();
    for (const [key, value] of Object.entries(data.state)) {
      entity.state.set(key, value);
    }
    entity.properties.clear();
    for (const [key, value] of Object.entries(data.properties)) {
      entity.properties.set(key, value);
    }
  }

  /** Serialize a world to a JSON string. */
  toJSON(world: World, pretty = false): string {
    const data = this.serialize(world);
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  /** Deserialize a world from a JSON string. */
  fromJSON(
    json: string,
    world: World,
    entityFactory: (serialized: SerializedEntity) => Entity,
  ): void {
    const data = JSON.parse(json) as SerializedWorld;
    if (data.version !== WorldSerializer.VERSION) {
      throw new Error(`Unsupported serialization version: ${data.version}, expected ${WorldSerializer.VERSION}`);
    }
    this.deserialize(data, world, entityFactory);
  }
}
