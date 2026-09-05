// EntityFactory: pre-built entity archetype constructors.
// Returns EntityConfig objects that can be passed to WorldBuilder.addEntity()
// or used to construct Entity instances directly.

import { GameObject, Entity } from './Entity.js';
import type {
  EntityConfig,
  EntityType,
  IVector3,
  MaterialType,
} from '../types/index.js';

/**
 * Static factory for common entity archetypes.
 * Implements the IEntityFactory contract from types/index.ts.
 */
export class EntityFactory {
  /** Create a static ground plane. */
  static createGround(
    position: IVector3,
    size: IVector3,
    material: MaterialType = 'stone',
  ): EntityConfig {
    return {
      type: 'static',
      name: 'Ground',
      position: { ...position },
      mass: 10000,
      material,
      state: { size: { ...size } },
      isStatic: true,
    };
  }

  /** Create a static wall. */
  static createWall(
    position: IVector3,
    size: IVector3,
    material: MaterialType = 'stone',
  ): EntityConfig {
    return {
      type: 'static',
      name: 'Wall',
      position: { ...position },
      mass: 5000,
      material,
      state: { size: { ...size } },
      isStatic: true,
    };
  }

  /** Create a dynamic movable box. */
  static createBox(
    position: IVector3,
    size: number = 1,
    material: MaterialType = 'wood',
  ): EntityConfig {
    return {
      type: 'dynamic',
      name: 'Box',
      position: { ...position },
      mass: size * size * size,
      material,
      state: { size },
    };
  }

  /** Create a light source entity. */
  static createLight(
    position: IVector3,
    radius: number = 10,
    intensity: number = 1.0,
  ): EntityConfig {
    return {
      type: 'effect',
      name: 'Light',
      position: { ...position },
      mass: 0,
      material: 'energy',
      state: { radius, intensity },
    };
  }

  /** Create an interactive door. */
  static createDoor(
    position: IVector3,
    width: number = 2,
    height: number = 3,
  ): EntityConfig {
    return {
      type: 'interactive',
      name: 'Door',
      position: { ...position },
      mass: 50,
      material: 'wood',
      state: { width, height, open: false },
      properties: { interactable: true, action: 'toggle' },
    };
  }

  /** Create a trigger zone that fires events on entry. */
  static createTriggerZone(
    position: IVector3,
    radius: number,
    onEnter?: string,
  ): EntityConfig {
    return {
      type: 'trigger',
      name: 'TriggerZone',
      position: { ...position },
      mass: 0,
      material: 'energy',
      state: { radius, onEnter: onEnter ?? null },
      isTrigger: true,
    };
  }

  /** Create a soul anchor / spawn point. */
  static createSoulAnchor(
    soulId: string,
    position: IVector3,
  ): EntityConfig {
    return {
      id: `soul_${soulId}`,
      type: 'soul',
      name: `soul:${soulId}`,
      position: { ...position },
      mass: 1,
      material: 'energy',
      state: { soulId },
    };
  }

  /** Create a custom entity from partial config. */
  static custom(config: Partial<EntityConfig>): EntityConfig {
    return {
      type: (config.type ?? 'dynamic') as EntityType,
      name: config.name ?? 'CustomEntity',
      position: config.position ? { ...config.position } : { x: 0, y: 0, z: 0 },
      ...config,
    };
  }
}
