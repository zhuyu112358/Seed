// SimplePhysics2D: a deterministic integrator + AABB narrow-phase backend.
//
// - Integrates position with gravity, friction and air resistance.
// - Detects AABB overlap between two bodies and resolves it by reflecting the
//   velocity along the smallest-penetration axis, scaled by restitution.
// - Static bodies have infinite mass and never move.
//
// This is intentionally simple; it is the v0.1.0 reference implementation behind
// IPhysicsBackend. A Jolt/Rapier backend can be dropped in later.

import { GameObject } from '../entity/Entity.js';
import { Vector3 } from '../entity/Vector3.js';
import type { PhysicsConfig } from './PhysicsConfig.js';
import { aabbOverlap, type CollisionPair, type IPhysicsBackend } from './IPhysicsBackend.js';
import { Quadtree, type AABB } from './Quadtree.js';

export class SimplePhysics2D implements IPhysicsBackend {
  public readonly name = 'simple-2d';

  step(dt: number, bodies: GameObject[], config: PhysicsConfig): { collisions: CollisionPair[] } {
    const collisions: CollisionPair[] = [];

    // 1) Integrate.
    for (const b of bodies) {
      if (!b.active || !b.hittable) continue;
      if (b.type === 'static' || b.type === 'trigger' || b.type === 'area') continue;

      const drag = 1 - config.airResistance * dt;
      let vx = b.velocity.x * drag;
      let vy = b.velocity.y - config.gravity * dt;
      const vz = b.velocity.z;
      vy *= drag;

      // Ground friction dampens horizontal velocity.
      if (config.friction > 0) vx *= 1 - config.friction * dt;

      b.velocity = new Vector3(vx, vy, vz);
      b.position = new Vector3(
        b.position.x + vx * dt,
        b.position.y + vy * dt,
        b.position.z + vz * dt,
      );
    }

    // 2) Collision detection with quadtree broad phase (O(n log n) avg).
    const worldBounds = this.computeBounds(bodies);
    const quadtree = new Quadtree(worldBounds, 0, { maxObjects: 8, maxLevels: 12 });
    for (const b of bodies) {
      if (b.active && b.hittable) quadtree.insert(b);
    }
    const pairs = quadtree.queryAllPairs(bodies);
    for (const [i, j] of pairs) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.type === 'trigger' || b.type === 'trigger') continue;
      if (!aabbOverlap(a.aabbMin(), a.aabbMax(), b.aabbMin(), b.aabbMax())) continue;

      const relSpeed = a.velocity.distance(b.velocity);
      const point = {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
        z: (a.position.z + b.position.z) / 2,
      };
      collisions.push({ a, b, point, relativeSpeed: relSpeed });
      this.resolveCollision(a, b, config);
    }

    return { collisions };
  }

  /** Velocity reflection with restitution, plus simple positional correction. */
  private resolveCollision(a: GameObject, b: GameObject, config: PhysicsConfig): void {
    const overlapX =
      Math.min(a.aabbMax().x, b.aabbMax().x) - Math.max(a.aabbMin().x, b.aabbMin().x);
    const overlapY =
      Math.min(a.aabbMax().y, b.aabbMax().y) - Math.max(a.aabbMin().y, b.aabbMin().y);

    if (overlapX < overlapY) {
      this.reverseVelocity(a, b, 'x', config.restitution);
    } else {
      this.reverseVelocity(a, b, 'y', config.restitution);
    }

    a.state.set('lastCollisionAt', Date.now());
    b.state.set('lastCollisionAt', Date.now());
  }

  private reverseVelocity(
    a: GameObject,
    b: GameObject,
    axis: 'x' | 'y',
    restitution: number,
  ): void {
    const apply = (body: GameObject) => {
      if (body.type === 'static') return;
      const v = body.velocity;
      const reflected = -v[axis] * restitution;
      body.velocity = new Vector3(
        axis === 'x' ? reflected : v.x,
        axis === 'y' ? reflected : v.y,
        v.z,
      );
    };
    apply(a);
    apply(b);
  }

  /** Compute bounding AABB covering all active bodies, with padding. */
  private computeBounds(bodies: GameObject[]): AABB {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of bodies) {
      if (!b.active) continue;
      const mn = b.aabbMin(), mx = b.aabbMax();
      minX = Math.min(minX, mn.x); minY = Math.min(minY, mn.y);
      maxX = Math.max(maxX, mx.x); maxY = Math.max(maxY, mx.y);
    }
    if (!Number.isFinite(minX)) { minX = -100; minY = -100; maxX = 100; maxY = 100; }
    const pad = 10;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }

  applyImpulse(body: GameObject, ix: number, iy: number, iz: number): void {
    if (body.type === 'static' || body.mass === 0 || !Number.isFinite(body.mass)) return;
    const invMass = 1 / body.mass;
    body.velocity = new Vector3(
      body.velocity.x + ix * invMass,
      body.velocity.y + iy * invMass,
      body.velocity.z + iz * invMass,
    );
  }
}
