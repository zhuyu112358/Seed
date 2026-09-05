// CollisionSystem: AABB collision detection and response for top-down (x/z plane) worlds.
//
// The existing SimplePhysics2D backend is designed for side-scroller (x/y plane with
// gravity in y). Seed worlds are top-down (x/z plane, y is height), so collisions in
// the z axis were not handled, and there was no positional correction (entities could
// overlap and stay overlapping).
//
// CollisionSystem provides:
//   - AABB collision detection in the x/z plane (with optional y-axis overlap check)
//   - Positional correction (separation along minimum penetration axis)
//   - Velocity response (configurable restitution / damping)
//   - Collision filtering (by entity type or state.collidesWith flag)
//   - Collision events for perception and other systems
//
// Design: generic WorldSystem, not bound to souls. Configurable which entity types
// participate in collisions. Works alongside PhysicsSystem (which handles gravity,
// friction, velocity integration).

import type { World, WorldSystem } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Vector3 } from '../entity/Vector3.js';
import { GameObject } from '../entity/Entity.js';
import { CollisionEvent } from '../event/Event.js';
import { Logger } from '../reliability/Logger.js';
import { SpatialHash } from './SpatialHash.js';

const log = Logger.for('collision-system');

/** Configuration for CollisionSystem. */
export interface CollisionSystemConfig {
  /** Entity types that participate in collisions. Default ['soul', 'dynamic']. */
  collidableTypes?: string[];
  /** If true, entities with state.collides === false are skipped. Default true. */
  respectCollidesFlag?: boolean;
  /** Restitution coefficient (0 = no bounce, 1 = full bounce). Default 0.2. */
  restitution?: number;
  /** Positional correction strength (0-1, how aggressively to separate overlapping bodies).
   *  Default 0.8. */
  positionalCorrection?: number;
  /** Allow small overlap without correction (meters, prevents jitter). Default 0.01. */
  slop?: number;
  /** If true, also check y-axis overlap (for 3D worlds). Default false (top-down 2D). */
  checkYAxis?: boolean;
  /** Maximum number of collision pairs to process per tick (safety cap). Default 500. */
  maxPairsPerTick?: number;
  /** Broad-phase strategy: 'brute-force' (O(n²), simple) or 'spatial-hash' (O(n*k), scalable).
   *  Default 'brute-force' for backward compatibility. Use 'spatial-hash' for worlds with >50 entities. */
  broadPhase?: 'brute-force' | 'spatial-hash';
  /** Cell size for spatial hash broad phase, in world units. Default 5.
   *  Should be roughly 1-2x the average entity size for optimal performance. */
  spatialHashCellSize?: number;
}

const DEFAULT_CONFIG: Required<CollisionSystemConfig> = {
  collidableTypes: ['soul', 'dynamic'],
  respectCollidesFlag: true,
  restitution: 0.2,
  positionalCorrection: 0.8,
  slop: 0.01,
  checkYAxis: false,
  maxPairsPerTick: 500,
  broadPhase: 'brute-force',
  spatialHashCellSize: 5,
};

/** Statistics for CollisionSystem. */
export interface CollisionSystemStats {
  pairsChecked: number;
  collisionsDetected: number;
  collisionsResolved: number;
}

/**
 * CollisionSystem: AABB collision detection and response for top-down worlds.
 *
 * Usage:
 *   const collisions = new CollisionSystem();
 *   world.addSystem(collisions);
 *   // Souls (type 'soul') will now collide with each other and be separated.
 */
export class CollisionSystem implements WorldSystem {
  public readonly name = 'collision-system';
  public enabled: boolean;
  public readonly config: Required<CollisionSystemConfig>;
  private stats: CollisionSystemStats = {
    pairsChecked: 0,
    collisionsDetected: 0,
    collisionsResolved: 0,
  };
  /** Spatial hash for broad-phase collision detection (lazy-initialized). */
  private spatialHash: SpatialHash | null = null;

  constructor(config?: CollisionSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = true;
  }

  tick(_dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;

    // Collect collidable bodies.
    const bodies: GameObject[] = [];
    for (const entity of world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;
      if (!entity.active) continue;
      if (!this.config.collidableTypes.includes(entity.type)) continue;
      if (this.config.respectCollidesFlag && entity.state.get('collides') === false) continue;
      bodies.push(entity);
    }

    if (bodies.length < 2) return;

    if (this.config.broadPhase === 'spatial-hash') {
      this.tickSpatialHash(bodies, events);
    } else {
      this.tickBruteForce(bodies, events);
    }
  }

  /** Brute-force pair check (O(n²)) — default for backward compatibility. */
  private tickBruteForce(bodies: GameObject[], events: EventSystem): void {
    let pairsProcessed = 0;
    for (let i = 0; i < bodies.length && pairsProcessed < this.config.maxPairsPerTick; i++) {
      for (let j = i + 1; j < bodies.length && pairsProcessed < this.config.maxPairsPerTick; j++) {
        pairsProcessed++;
        this.stats.pairsChecked++;
        this.checkAndResolve(bodies[i], bodies[j], events);
      }
    }
  }

  /** Spatial hash broad phase — reduces pair checks for large worlds. */
  private tickSpatialHash(bodies: GameObject[], events: EventSystem): void {
    // Lazy-initialize spatial hash.
    if (!this.spatialHash) {
      this.spatialHash = new SpatialHash(this.config.spatialHashCellSize);
    }

    const hash = this.spatialHash;
    hash.clear();

    // Insert all bodies into the hash.
    for (const body of bodies) {
      hash.insert(body);
    }

    // Get unique collision pairs from the hash and resolve them.
    const pairs = hash.getCollisionPairs();
    let pairsProcessed = 0;
    for (const [a, b] of pairs) {
      if (pairsProcessed >= this.config.maxPairsPerTick) break;
      pairsProcessed++;
      this.stats.pairsChecked++;
      this.checkAndResolve(a, b, events);
    }
  }

  /**
   * Check AABB overlap between two bodies and resolve collision if detected.
   * Returns true if a collision was detected and resolved.
   */
  private checkAndResolve(a: GameObject, b: GameObject, events: EventSystem): boolean {
    const aMin = a.aabbMin();
    const aMax = a.aabbMax();
    const bMin = b.aabbMin();
    const bMax = b.aabbMax();

    // AABB overlap test (x and z always, y optional).
    const overlapX = aMin.x <= bMax.x && aMax.x >= bMin.x;
    const overlapZ = aMin.z <= bMax.z && aMax.z >= bMin.z;
    if (!overlapX || !overlapZ) return false;

    if (this.config.checkYAxis) {
      const overlapY = aMin.y <= bMax.y && aMax.y >= bMin.y;
      if (!overlapY) return false;
    }

    this.stats.collisionsDetected++;

    // Compute penetration depths on x and z axes.
    const penX = Math.min(aMax.x - bMin.x, bMax.x - aMin.x);
    const penZ = Math.min(aMax.z - bMin.z, bMax.z - aMin.z);

    // Resolve along axis of minimum penetration.
    let normalX = 0;
    let normalZ = 0;
    let penetration: number;

    if (penX < penZ) {
      penetration = penX;
      // Normal points from A to B (A is left of B → normal = +x).
      normalX = a.position.x < b.position.x ? 1 : -1;
    } else {
      penetration = penZ;
      // Normal points from A to B (A is behind B → normal = +z).
      normalZ = a.position.z < b.position.z ? 1 : -1;
    }

    // Apply positional correction (separation).
    const correction = Math.max(0, penetration - this.config.slop) * this.config.positionalCorrection;
    if (correction > 0) {
      // Split correction equally between both bodies (equal mass assumption).
      // Static bodies (mass=0 or type 'static') don't move.
      const aStatic = a.type === 'static' || a.mass === 0;
      const bStatic = b.type === 'static' || b.mass === 0;

      if (aStatic && bStatic) {
        // Both static — no positional correction.
      } else if (aStatic) {
        b.position = new Vector3(
          b.position.x + normalX * correction,
          b.position.y,
          b.position.z + normalZ * correction,
        );
      } else if (bStatic) {
        a.position = new Vector3(
          a.position.x - normalX * correction,
          a.position.y,
          a.position.z - normalZ * correction,
        );
      } else {
        // Both dynamic — split equally.
        const half = correction / 2;
        a.position = new Vector3(
          a.position.x - normalX * half,
          a.position.y,
          a.position.z - normalZ * half,
        );
        b.position = new Vector3(
          b.position.x + normalX * half,
          b.position.y,
          b.position.z + normalZ * half,
        );
      }
    }

    // Apply velocity response (impulse-based reflection along collision normal).
    // Normal points from A to B. If A's relative velocity along normal > 0,
    // A is moving toward B and needs response.
    if (this.config.restitution > 0) {
      const relVelX = a.velocity.x - b.velocity.x;
      const relVelZ = a.velocity.z - b.velocity.z;
      const relVelAlongNormal = relVelX * normalX + relVelZ * normalZ;

      // Only respond if A is moving toward B (relative velocity along normal > 0).
      if (relVelAlongNormal > 0) {
        const impulse = (1 + this.config.restitution) * relVelAlongNormal / 2;
        if (a.type !== 'static' && a.mass > 0) {
          a.velocity = new Vector3(
            a.velocity.x - impulse * normalX,
            a.velocity.y,
            a.velocity.z - impulse * normalZ,
          );
        }
        if (b.type !== 'static' && b.mass > 0) {
          b.velocity = new Vector3(
            b.velocity.x + impulse * normalX,
            b.velocity.y,
            b.velocity.z + impulse * normalZ,
          );
        }
      }
    }

    this.stats.collisionsResolved++;

    // Record collision state on both bodies.
    const now = Date.now();
    a.state.set('lastCollisionAt', now);
    b.state.set('lastCollisionAt', now);
    a.state.set('lastCollidedWith', b.id);
    b.state.set('lastCollidedWith', a.id);

    // Emit collision event so perception and other systems can react.
    const collisionPoint = {
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2,
      z: (a.position.z + b.position.z) / 2,
    };
    const relSpeed = Math.sqrt(
      Math.pow(a.velocity.x - b.velocity.x, 2) +
      Math.pow(a.velocity.z - b.velocity.z, 2),
    );
    events.emit(new CollisionEvent(a.id, b.id, collisionPoint, relSpeed));

    log.debug({ a: a.id, b: b.id, penetration: penetration.toFixed(3) }, 'collision resolved');

    return true;
  }

  /** Get collision system statistics. */
  getStats(): CollisionSystemStats {
    return { ...this.stats };
  }

  /** Reset statistics counters. */
  resetStats(): void {
    this.stats = { pairsChecked: 0, collisionsDetected: 0, collisionsResolved: 0 };
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}
