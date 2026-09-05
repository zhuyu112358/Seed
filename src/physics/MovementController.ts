// MovementController: monitors entities with a pending moveTarget and stops
// them when they arrive. This is the companion to physics-based movement in
// SoulActionSystem: when a soul is given a velocity toward a target, friction
// will eventually slow it, but it may overshoot or crawl. MovementController
// checks arrival each tick and zeroes velocity precisely at the target.
//
// Design:
//   - Generic WorldSystem, not bound to souls or any specific world.
//   - Reads moveTarget from entity.state (set by SoulActionSystem physics mode).
//   - Zeroes velocity and clears moveTarget when distance < arrivalThreshold.
//   - Optional early-stop when velocity is very low (avoids friction-induced crawling).
//   - Emits no events by default (keep it simple); can be extended later.

import type { World, WorldSystem } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Vector3 } from '../entity/Vector3.js';
import type { GameObject } from '../entity/Entity.js';
import { EntityArrivedEvent } from '../event/Event.js';
import { Logger } from '../reliability/Logger.js';

const log = Logger.for('movement-controller');

/** Configuration for MovementController. */
export interface MovementControllerConfig {
  /** Distance threshold (meters) at which an entity is considered "arrived". Default 0.15. */
  arrivalThreshold?: number;
  /** If true, stop entities whose speed drops below minSpeed even if not at target.
   *  This prevents friction-induced crawling. Default true. */
  enableEarlyStop?: boolean;
  /** Minimum speed (m/s) below which early-stop triggers. Default 0.05. */
  minSpeed?: number;
  /** Maximum number of entities to process per tick (safety cap). Default 1000. */
  maxEntitiesPerTick?: number;
  /** Distance calculation mode: '2d' ignores y (planar movement), '3d' includes all axes.
   *  Default '3d'. Use '2d' for top-down / platformer worlds where y is height. */
  distanceMode?: '2d' | '3d';
  /** If true, MovementController actively controls velocity with acceleration/deceleration
   *  curves instead of relying on one-shot velocity + friction. Default false (backward
   *  compatible with existing behavior). */
  enableAcceleration?: boolean;
  /** Maximum acceleration (m/s²) when speeding up. Default 10. */
  maxAcceleration?: number;
  /** Maximum deceleration (m/s²) when slowing down (stronger than acceleration for
   *  responsive stopping). Default 15. */
  maxDeceleration?: number;
  /** Cruise speed (m/s) — maximum speed during controlled movement. Default 5. */
  cruiseSpeed?: number;
}

const DEFAULT_CONFIG: Required<MovementControllerConfig> = {
  arrivalThreshold: 0.15,
  enableEarlyStop: true,
  minSpeed: 0.05,
  maxEntitiesPerTick: 1000,
  distanceMode: '3d',
  enableAcceleration: false,
  maxAcceleration: 10,
  maxDeceleration: 15,
  cruiseSpeed: 5,
};

/** Statistics for MovementController. */
export interface MovementControllerStats {
  entitiesChecked: number;
  arrivalsStopped: number;
  earlyStops: number;
}

/**
 * MovementController: stops moving entities when they reach their moveTarget.
 *
 * Usage:
 *   const controller = new MovementController();
 *   world.addSystem(controller);
 *   // When SoulActionSystem runs in physics mode, it sets entity.state.moveTarget.
 *   // MovementController will zero velocity and clear moveTarget on arrival.
 */
export class MovementController implements WorldSystem {
  public readonly name = 'movement-controller';
  public enabled: boolean;
  public readonly config: Required<MovementControllerConfig>;
  private stats: MovementControllerStats = {
    entitiesChecked: 0,
    arrivalsStopped: 0,
    earlyStops: 0,
  };

  constructor(config?: MovementControllerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = true;
  }

  tick(dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;

    const bodies = world.bodies();
    const limit = Math.min(bodies.length, this.config.maxEntitiesPerTick);

    for (let i = 0; i < limit; i++) {
      const body = bodies[i];
      this.checkAndStop(body, events, dt);
    }
  }

  /**
   * Check a single body for arrival and stop it if conditions are met.
   * When acceleration control is enabled, also adjusts velocity with
   * acceleration/deceleration curves.
   * Returns true if the body was stopped, false otherwise.
   */
  private checkAndStop(body: GameObject, events: EventSystem, dt: number): boolean {
    this.stats.entitiesChecked++;

    // Only process bodies with a pending moveTarget.
    const moveTarget = body.state.get('moveTarget') as { x: number; y: number; z: number } | undefined;
    if (!moveTarget) return false;

    const dx = moveTarget.x - body.position.x;
    const dy = moveTarget.y - body.position.y;
    const dz = moveTarget.z - body.position.z;

    // Distance calculation: 2d mode ignores y (planar movement), 3d includes all axes.
    const distance = this.config.distanceMode === '2d'
      ? Math.sqrt(dx * dx + dz * dz)
      : Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Acceleration control: adjust velocity with smooth acceleration/deceleration.
    if (this.config.enableAcceleration && distance > this.config.arrivalThreshold) {
      this.controlVelocity(body, dx, dy, dz, distance, dt);
    }

    // Arrival check: within threshold of target.
    if (distance <= this.config.arrivalThreshold) {
      this.stopBody(body, 'arrived', moveTarget, distance, events);
      this.stats.arrivalsStopped++;
      return true;
    }

    // Early stop: speed very low (friction has nearly stopped the body,
    // but it hasn't reached target due to threshold or deceleration).
    if (this.config.enableEarlyStop) {
      const speed = body.velocity.length();
      if (speed < this.config.minSpeed) {
        this.stopBody(body, 'early-stop', moveTarget, distance, events);
        this.stats.earlyStops++;
        return true;
      }
    }

    return false;
  }

  /**
   * Control entity velocity with acceleration/deceleration curves.
   *
   * Strategy:
   *   - Compute desired speed based on distance to target:
   *     - If distance > braking distance: cruise at cruiseSpeed
   *     - Else: decelerate so v = sqrt(2 * a * d), ensuring stop at target
   *   - Move current velocity toward desired velocity at maxAcceleration
   *     (speeding up) or maxDeceleration (slowing down).
   *   - Frame-rate independent via dt.
   */
  private controlVelocity(
    body: GameObject,
    dx: number, dy: number, dz: number,
    distance: number,
    dt: number,
  ): void {
    // Direction toward target (normalized).
    const invDist = 1 / (distance || 1);
    const dirX = dx * invDist;
    const dirY = this.config.distanceMode === '2d' ? 0 : dy * invDist;
    const dirZ = dz * invDist;

    // Current speed projected onto movement direction.
    const currentSpeed = body.velocity.x * dirX + body.velocity.y * dirY + body.velocity.z * dirZ;

    // Braking distance needed to stop at current deceleration.
    const brakingDistance = (currentSpeed * currentSpeed) / (2 * this.config.maxDeceleration);

    // Desired speed: cruise if far enough, else decelerate to stop at target.
    let desiredSpeed: number;
    if (distance > brakingDistance + 0.01) {
      desiredSpeed = this.config.cruiseSpeed;
    } else {
      desiredSpeed = Math.sqrt(2 * this.config.maxDeceleration * Math.max(0, distance));
    }

    // Determine acceleration magnitude: use maxAcceleration when speeding up,
    // maxDeceleration when slowing down.
    const speedDiff = desiredSpeed - currentSpeed;
    const accel = speedDiff >= 0 ? this.config.maxAcceleration : this.config.maxDeceleration;
    const maxDelta = accel * dt;

    // Clamp speed change to max acceleration/deceleration.
    let newSpeed = currentSpeed;
    if (Math.abs(speedDiff) <= maxDelta) {
      newSpeed = desiredSpeed;
    } else {
      newSpeed = currentSpeed + Math.sign(speedDiff) * maxDelta;
    }

    // Clamp to cruise speed (don't overshoot).
    newSpeed = Math.min(newSpeed, this.config.cruiseSpeed);
    if (newSpeed < 0) newSpeed = 0;

    // Apply velocity in movement direction.
    body.velocity = new Vector3(dirX * newSpeed, dirY * newSpeed, dirZ * newSpeed);
  }

  /** Zero velocity, clear moveTarget state, and emit EntityArrivedEvent. */
  private stopBody(
    body: GameObject,
    reason: string,
    moveTarget: { x: number; y: number; z: number },
    distanceToTarget: number,
    events: EventSystem,
  ): void {
    const actualPosition = { x: body.position.x, y: body.position.y, z: body.position.z };
    body.velocity = new Vector3(0, 0, 0);
    body.state.delete('moveTarget');
    body.state.set('movementMode', 'stopped');
    body.state.set('stopReason', reason);
    log.debug({ entityId: body.id, reason, position: actualPosition }, 'entity stopped by movement controller');

    // Emit arrival event so other systems (perception, logging, world events) can react.
    events.emit(new EntityArrivedEvent(
      body.id,
      moveTarget,
      actualPosition,
      reason,
      Math.round(distanceToTarget * 1000) / 1000,
    ));
  }

  /** Get controller statistics. */
  getStats(): MovementControllerStats {
    return { ...this.stats };
  }

  /** Reset statistics counters. */
  resetStats(): void {
    this.stats = { entitiesChecked: 0, arrivalsStopped: 0, earlyStops: 0 };
  }
}
