// EntityFactory: builds the commonly used entity archetypes used by worlds.

import { GameObject } from './Entity.js';
import { Vector3 } from './Vector3.js';
import type { IVector3 } from '../types/index.js';

export class EntityFactory {
  /** A static (immovable) box, e.g. the ground / a wall. */
  static staticBox(name: string, center: IVector3, halfExtents: IVector3): GameObject {
    const obj = new GameObject({
      name,
      type: 'static',
      position: center,
      velocity: { x: 0, y: 0, z: 0 },
      mass: Number.POSITIVE_INFINITY,
      material: 'stone',
      halfExtents,
      interactable: true,
      hittable: true,
    });
    return obj;
  }

  /** A movable dynamic box with the given mass, material and initial velocity. */
  static dynamicBox(opts: {
    name: string;
    position: IVector3;
    mass?: number;
    material?: string;
    velocity?: IVector3;
    halfExtents?: IVector3;
  }): GameObject {
    return new GameObject({
      name: opts.name,
      type: 'dynamic',
      position: opts.position,
      velocity: opts.velocity ?? { x: 0, y: 0, z: 0 },
      mass: opts.mass ?? 1,
      material: opts.material ?? 'wood',
      halfExtents: opts.halfExtents ?? { x: 0.5, y: 0.5, z: 0.5 },
      interactable: true,
      hittable: true,
    });
  }

  /** A non-physical region that fires EntityEnterZone / EntityLeaveZone events. */
  static zoneTrigger(opts: {
    name: string;
    center: IVector3;
    halfExtents: IVector3;
    onEnter?: (entityId: string) => void;
  }): GameObject {
    const zone = new GameObject({
      name: opts.name,
      type: 'trigger',
      position: opts.center,
      halfExtents: opts.halfExtents,
      mass: 0,
      material: 'zone',
      interactable: false,
      hittable: false,
    });
    zone.properties.set('isZone', true);
    zone.properties.set('onEnter', opts.onEnter);
    return zone;
  }

  /** A soul-proxy body that represents an external SoulArena soul inside the world. */
  static soulProxy(opts: {
    soulId: string;
    name: string;
    element: string;
    position?: IVector3;
  }): GameObject {
    const proxy = new GameObject({
      id: `soul_${opts.soulId}`,
      name: opts.name,
      type: 'soul-proxy',
      position: opts.position ?? { x: 0, y: 1, z: 0 },
      mass: 5,
      material: `soul:${opts.element}`,
      halfExtents: { x: 0.4, y: 0.8, z: 0.4 },
      interactable: true,
      hittable: true,
    });
    proxy.properties.set('soulId', opts.soulId);
    proxy.properties.set('element', opts.element);
    proxy.state.set('insideWorld', true);
    return proxy;
  }

  /** Convenience: distance from an entity to a point. */
  static distance(a: IVector3, b: IVector3): number {
    return Vector3.from(a).distance(b);
  }
}
