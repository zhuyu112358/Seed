/**
 * Seed SDK - Entity factory
 *
 * Produces declarative EntityConfig objects for the common world archetypes
 * (ground, walls, boxes, lights, doors, trigger zones, soul anchors).
 */

import type {
  CollisionShape,
  EntityConfig,
  IEntityFactory,
  IVector3,
  MaterialType,
} from '../types/index.js';
import { materialDensity } from './PhysicsConfig.js';

let nextId = 1;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(nextId++).toString(36)}`;
}

function boxShape(center: IVector3, size: IVector3): CollisionShape {
  const hx = size.x / 2;
  const hy = size.y / 2;
  const hz = size.z / 2;
  return {
    type: 'aabb',
    aabb: {
      min: { x: center.x - hx, y: center.y - hy, z: center.z - hz },
      max: { x: center.x + hx, y: center.y + hy, z: center.z + hz },
    },
  };
}

function sphereShape(center: IVector3, radius: number): CollisionShape {
  return { type: 'sphere', sphere: { center: { ...center }, radius } };
}

export class EntityFactory implements IEntityFactory {
  createGround(position: IVector3, size: IVector3, material: MaterialType = 'stone'): EntityConfig {
    return {
      id: genId('ground'), type: 'static', name: 'ground',
      position: { ...position }, material, isStatic: true,
      collisionShape: boxShape(position, size), state: { surface: true },
    };
  }

  createWall(position: IVector3, size: IVector3, material: MaterialType = 'stone'): EntityConfig {
    return {
      id: genId('wall'), type: 'static', name: 'wall',
      position: { ...position }, material, isStatic: true,
      collisionShape: boxShape(position, size),
    };
  }

  createBox(position: IVector3, size = 1, material: MaterialType = 'wood'): EntityConfig {
    const volume = size * size * size;
    const mass = Math.max(0.01, volume * (materialDensity[material] ?? 1000));
    const half = size / 2;
    return {
      id: genId('box'), type: 'dynamic', name: 'box',
      position: { ...position }, velocity: { x: 0, y: 0, z: 0 },
      mass, material, isStatic: false,
      collisionShape: boxShape(position, { x: size, y: size, z: size }),
      state: { halfExtents: { x: half, y: half, z: half } },
    };
  }

  createLight(position: IVector3, radius = 8, intensity = 1): EntityConfig {
    return {
      id: genId('light'), type: 'interactive', name: 'light',
      position: { ...position }, material: 'energy', isStatic: true,
      collisionShape: sphereShape(position, 0.3),
      state: { on: true, radius, intensity, color: '#fff4c2' },
    };
  }

  createDoor(position: IVector3, width = 1.2, height = 2.2): EntityConfig {
    return {
      id: genId('door'), type: 'interactive', name: 'door',
      position: { ...position }, material: 'wood', isStatic: true,
      collisionShape: boxShape(position, { x: width, y: height, z: 0.15 }),
      state: { open: false, locked: false, width, height },
    };
  }

  createTriggerZone(position: IVector3, radius: number, onEnter?: string): EntityConfig {
    return {
      id: genId('zone'), type: 'trigger', name: 'trigger-zone',
      position: { ...position }, material: 'energy', isStatic: true, isTrigger: true,
      collisionShape: sphereShape(position, radius),
      state: { radius, onEnter: onEnter ?? 'zone.enter' },
    };
  }

  createSoulAnchor(soulId: string, position: IVector3): EntityConfig {
    return {
      id: `soul_${soulId}`, type: 'soul', name: `soul:${soulId}`,
      position: { ...position }, material: 'energy', mass: 5,
      collisionShape: sphereShape(position, 0.5), state: { soulId },
    };
  }

  custom(config: Partial<EntityConfig>): EntityConfig {
    return {
      id: config.id ?? genId('ent'),
      type: config.type ?? 'dynamic',
      name: config.name ?? 'entity',
      position: config.position ? { ...config.position } : { x: 0, y: 0, z: 0 },
      velocity: config.velocity ? { ...config.velocity } : { x: 0, y: 0, z: 0 },
      rotation: config.rotation ? { ...config.rotation } : { x: 0, y: 0, z: 0 },
      mass: config.mass ?? 1,
      material: config.material ?? 'wood',
      collisionShape: config.collisionShape,
      state: config.state ? { ...config.state } : {},
      properties: config.properties ? { ...config.properties } : {},
      components: config.components ? [...config.components] : [],
      isStatic: config.isStatic ?? false,
      isTrigger: config.isTrigger ?? false,
    };
  }
}
