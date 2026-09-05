// PhysicsSystem: a lifecycle system that drives the chosen backend every tick
// and publishes CollisionEvent / zone-enter events onto the event bus.

import { GameObject } from '../entity/Entity.js';
import { Vector3 } from '../entity/Vector3.js';
import type { World } from '../engine/World.js';
import { CollisionEvent, EntityEnterZone } from '../event/Event.js';
import type { EventSystem } from '../event/EventSystem.js';
import { PhysicsConfig } from './PhysicsConfig.js';
import type { IPhysicsBackend } from './IPhysicsBackend.js';
import { SimplePhysics2D } from './SimplePhysics2D.js';

export interface PhysicsSystemCounters {
  collisions: number;
  moved: number;
}

export class PhysicsSystem {
  public readonly name = 'physics';
  public enabled: boolean;
  public readonly config: PhysicsConfig;
  public readonly backend: IPhysicsBackend;
  public readonly counters: PhysicsSystemCounters = { collisions: 0, moved: 0 };
  private readonly zoneSeen = new Map<string, Set<string>>();

  constructor(opts?: { config?: PhysicsConfig; backend?: IPhysicsBackend }) {
    this.config = opts?.config ?? PhysicsConfig.defaults();
    this.backend = opts?.backend ?? new SimplePhysics2D();
    this.enabled = this.config.enabled;
  }

  start(): void {
    this.enabled = true;
  }

  stop(): void {
    this.enabled = false;
  }

  /** Run one fixed-step. Bodies are pulled from the world. */
  tick(dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;
    const bodies = world.bodies();
    const before = new Map<string, number>();
    for (const b of bodies) {
      before.set(b.id, b.position.length());
      // Save previous position for continuous collision detection (CCD).
      b.prevPosition = new Vector3(b.position.x, b.position.y, b.position.z);
    }

    const { collisions } = this.backend.step(dt, bodies, this.config);
    for (const c of collisions) {
      this.counters.collisions++;
      events.emit(new CollisionEvent(c.a.id, c.b.id, c.point, c.relativeSpeed));
    }

    // Zone triggers: detect entry and publish EntityEnterZone.
    const zones = bodies.filter((b) => b.type === 'trigger');
    for (const z of zones) {
      const seen = this.zoneSeen.get(z.id) ?? new Set<string>();
      for (const b of bodies) {
        if (b.type === 'trigger' || !b.active) continue;
        const inside =
          Math.abs(b.position.x - z.position.x) <= z.halfExtents.x &&
          Math.abs(b.position.y - z.position.y) <= z.halfExtents.y &&
          Math.abs(b.position.z - z.position.z) <= z.halfExtents.z;
        if (inside && !seen.has(b.id)) {
          seen.add(b.id);
          events.emit(
            new EntityEnterZone(z.id, b.id, {
              x: z.position.x,
              y: z.position.y,
              z: z.position.z,
            }),
          );
          const cb = z.properties.get('onEnter') as ((id: string) => void) | undefined;
          if (cb) cb(b.id);
        } else if (!inside && seen.has(b.id)) {
          seen.delete(b.id);
        }
      }
      this.zoneSeen.set(z.id, seen);
    }

    // Count moved entities for the evaluator.
    this.counters.moved = 0;
    for (const b of bodies) {
      const prev = before.get(b.id) ?? 0;
      if (Math.abs(b.position.length() - prev) > 1e-4) this.counters.moved++;
    }
  }

  /** Apply an impulse through the backend (e.g. a soul "push" action). */
  applyImpulse(body: GameObject, ix: number, iy: number, iz: number): void {
    this.backend.applyImpulse(body, ix, iy, iz);
  }
}
