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
import {
  CollisionEvent,
  CollisionEnterEvent,
  CollisionStayEvent,
  CollisionExitEvent,
  TriggerEnterEvent,
  TriggerStayEvent,
  TriggerExitEvent,
} from '../event/Event.js';
import { Logger } from '../reliability/Logger.js';
import { SpatialHash } from './SpatialHash.js';
import { combineMaterials } from './PhysicsMaterial.js';

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
  /** Enable trigger volume detection. Entities with state.isTrigger === true
   *  overlap without physical response (no separation, no bounce) and emit
   *  TriggerEnter/Stay/Exit events. Default true. */
  enableTriggers?: boolean;
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
  enableTriggers: true,
};

/** Statistics for CollisionSystem. */
export interface CollisionSystemStats {
  pairsChecked: number;
  collisionsDetected: number;
  collisionsResolved: number;
}

/** Info about a collision pair, used for lifecycle event tracking. */
interface CollisionPairInfo {
  aId: string;
  bId: string;
  point: { x: number; y: number; z: number };
  relativeSpeed: number;
  normal: { x: number; z: number };
  penetration: number;
  /** How many ticks this pair has been in continuous contact. */
  contactDurationTicks: number;
}

/** Info about a trigger overlap pair, used for trigger lifecycle tracking. */
interface TriggerPairInfo {
  triggerId: string;
  otherId: string;
  point: { x: number; y: number; z: number };
  /** How many ticks this pair has been in continuous overlap. */
  contactDurationTicks: number;
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

  /**
   * Collision pair state for lifecycle events (Enter/Stay/Exit).
   * Key = normalized pair key "idA|idB" (idA < idB lexicographically).
   * Value = collision info from the previous tick.
   */
  private previousCollisions = new Map<string, CollisionPairInfo>();
  private currentCollisions = new Map<string, CollisionPairInfo>();

  /** Trigger overlap state for lifecycle events (Enter/Stay/Exit). */
  private previousTriggers = new Map<string, TriggerPairInfo>();
  private currentTriggers = new Map<string, TriggerPairInfo>();

  constructor(config?: CollisionSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = true;
  }

  /** Create a normalized pair key for collision state tracking. */
  private pairKey(aId: string, bId: string): string {
    return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
  }

  tick(_dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;

    // Clear current tick's collision and trigger state.
    this.currentCollisions.clear();
    this.currentTriggers.clear();

    // Collect collidable bodies (including trigger volumes).
    const bodies: GameObject[] = [];
    for (const entity of world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;
      if (!entity.active) continue;
      const isTrigger = this.config.enableTriggers && entity.state.get('isTrigger') === true;
      if (!isTrigger && !this.config.collidableTypes.includes(entity.type)) continue;
      if (this.config.respectCollidesFlag && entity.state.get('collides') === false) continue;
      bodies.push(entity);
    }

    if (bodies.length < 2) {
      // No bodies — detect exits for both collisions and triggers.
      this.detectExits(events);
      this.detectTriggerExits(events);
      this.swapCollisionState();
      this.swapTriggerState();
      return;
    }

    if (this.config.broadPhase === 'spatial-hash') {
      this.tickSpatialHash(bodies, events);
    } else {
      this.tickBruteForce(bodies, events);
    }

    // Detect collisions and triggers that ended this tick.
    this.detectExits(events);
    this.detectTriggerExits(events);

    // Swap state for next tick.
    this.swapCollisionState();
    this.swapTriggerState();
  }

  /** Emit CollisionExitEvent for pairs that were colliding last tick but not this tick. */
  private detectExits(events: EventSystem): void {
    for (const [key, info] of this.previousCollisions) {
      if (!this.currentCollisions.has(key)) {
        events.emit(new CollisionExitEvent(
          info.aId, info.bId,
          info.point,
          info.contactDurationTicks,
        ));
        log.debug({ a: info.aId, b: info.bId, duration: info.contactDurationTicks }, 'collision exit');
      }
    }
  }

  /** Swap previous and current collision state maps. */
  private swapCollisionState(): void {
    const temp = this.previousCollisions;
    this.previousCollisions = this.currentCollisions;
    this.currentCollisions = temp;
    // currentCollisions now points to the old previous map — clear it for next tick.
    this.currentCollisions.clear();
  }

  /** Emit TriggerExitEvent for pairs that were overlapping last tick but not this tick. */
  private detectTriggerExits(events: EventSystem): void {
    for (const [key, info] of this.previousTriggers) {
      if (!this.currentTriggers.has(key)) {
        events.emit(new TriggerExitEvent(
          info.triggerId, info.otherId,
          info.point,
          info.contactDurationTicks,
        ));
        log.debug({ trigger: info.triggerId, other: info.otherId, duration: info.contactDurationTicks }, 'trigger exit');
      }
    }
  }

  /** Swap previous and current trigger state maps. */
  private swapTriggerState(): void {
    const temp = this.previousTriggers;
    this.previousTriggers = this.currentTriggers;
    this.currentTriggers = temp;
    this.currentTriggers.clear();
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
   * Handle trigger volume overlap — no physical response, only events.
   * Returns true if overlap was processed.
   */
  private handleTriggerOverlap(
    a: GameObject, b: GameObject,
    aIsTrigger: boolean,
    events: EventSystem,
  ): boolean {
    // Determine trigger and other (if both are triggers, use a as trigger).
    const trigger = aIsTrigger ? a : b;
    const other = aIsTrigger ? b : a;

    // Compute overlap point (midpoint).
    const point = {
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2,
      z: (a.position.z + b.position.z) / 2,
    };

    // Track trigger state for lifecycle events.
    const key = this.pairKey(trigger.id, other.id);
    const prevInfo = this.previousTriggers.get(key);
    const contactDuration = prevInfo ? prevInfo.contactDurationTicks + 1 : 1;

    const pairInfo: TriggerPairInfo = {
      triggerId: trigger.id,
      otherId: other.id,
      point,
      contactDurationTicks: contactDuration,
    };
    this.currentTriggers.set(key, pairInfo);

    // Emit lifecycle events: Enter (first overlap) or Stay (continuing).
    if (!prevInfo) {
      events.emit(new TriggerEnterEvent(trigger.id, other.id, point));
      log.debug({ trigger: trigger.id, other: other.id }, 'trigger enter');
    } else {
      events.emit(new TriggerStayEvent(trigger.id, other.id, point, contactDuration));
    }

    return true;
  }

  /**
   * Check AABB overlap between two bodies and resolve collision if detected.
   * Returns true if a collision was detected and resolved.
   */
  private checkAndResolve(a: GameObject, b: GameObject, events: EventSystem): boolean {
    // Collision layer/mask filter: skip if layers don't overlap.
    // Default both to 0xFFFF so existing behavior is unchanged.
    if (!a.canCollideWith(b)) return false;

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

    // Check if this is a trigger overlap (at least one entity is a trigger).
    // Triggers have no physical response — no separation, no bounce.
    const aIsTrigger = this.config.enableTriggers && a.state.get('isTrigger') === true;
    const bIsTrigger = this.config.enableTriggers && b.state.get('isTrigger') === true;
    if (aIsTrigger || bIsTrigger) {
      return this.handleTriggerOverlap(a, b, aIsTrigger, events);
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
    // Use combined restitution from both entities' physics materials (averaged).
    const combinedRestitution = combineMaterials(a.physicsMaterial, b.physicsMaterial).restitution;
    if (combinedRestitution > 0) {
      const relVelX = a.velocity.x - b.velocity.x;
      const relVelZ = a.velocity.z - b.velocity.z;
      const relVelAlongNormal = relVelX * normalX + relVelZ * normalZ;

      // Only respond if A is moving toward B (relative velocity along normal > 0).
      if (relVelAlongNormal > 0) {
        const impulse = (1 + combinedRestitution) * relVelAlongNormal / 2;
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

    // Compute collision point and relative speed.
    const collisionPoint = {
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2,
      z: (a.position.z + b.position.z) / 2,
    };
    const relSpeed = Math.sqrt(
      Math.pow(a.velocity.x - b.velocity.x, 2) +
      Math.pow(a.velocity.z - b.velocity.z, 2),
    );
    const collisionNormal = { x: normalX, z: normalZ };

    // Track collision state for lifecycle events (Enter/Stay/Exit).
    const key = this.pairKey(a.id, b.id);
    const prevInfo = this.previousCollisions.get(key);
    const contactDuration = prevInfo ? prevInfo.contactDurationTicks + 1 : 1;

    const pairInfo: CollisionPairInfo = {
      aId: a.id, bId: b.id, point: collisionPoint,
      relativeSpeed: relSpeed, normal: collisionNormal,
      penetration, contactDurationTicks: contactDuration,
    };
    this.currentCollisions.set(key, pairInfo);

    // Emit lifecycle events: Enter (first contact) or Stay (continuing).
    if (!prevInfo) {
      events.emit(new CollisionEnterEvent(a.id, b.id, collisionPoint, relSpeed, collisionNormal, penetration));
    } else {
      events.emit(new CollisionStayEvent(a.id, b.id, collisionPoint, relSpeed, collisionNormal, penetration, contactDuration));
    }

    // Emit generic collision event for backward compatibility.
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
