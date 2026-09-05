// PathFollowerSystem: WorldSystem that advances entities along a precomputed
// movePath (set by SoulActionSystem in pathfinding mode). Works together with
// MovementController: when MovementController detects arrival at the current
// moveTarget and clears it, PathFollowerSystem picks the next waypoint.
//
// Flow:
//   1. SoulActionSystem (pathfinding mode) sets movePath + movePathIndex=0 + moveTarget=wp[0]
//   2. MovementController moves entity toward moveTarget, detects arrival, clears moveTarget
//   3. PathFollowerSystem sees moveTarget is null but movePath exists, advances index,
//      sets moveTarget=wp[index+1], applies velocity
//   4. Repeat until path exhausted, then clear movePath
//
// Dynamic replanning (optional):
//   If enableReplanning is true and a PathfinderSystem is present, the system
//   periodically checks whether the segment from the entity's current position
//   to the next waypoint is blocked by a newly appeared obstacle. If blocked,
//   it calls PathfinderSystem.findPath() to compute a new route from the
//   current position to the original goal, replacing movePath in place.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Vector3 } from "../entity/Vector3.js";
import { GameObject } from "../entity/Entity.js";
import type { PathfinderSystem } from "./PathfinderSystem.js";

export interface PathFollowerConfig {
  /** Movement speed (m/s) when following path. Default 5. */
  moveSpeed?: number;
  /** If true, emit a custom event when path is completed. Default true. */
  emitCompletionEvent?: boolean;
  /** If true, recalculate velocity direction toward the current moveTarget every
   *  tick (dynamic aiming). This prevents overshooting at high speeds or with
   *  widely-spaced waypoints. Default false (backward compatible). */
  enableDynamicAiming?: boolean;
  /** If true, periodically check for obstacles blocking the current path segment
   *  and replan via PathfinderSystem when blocked. Requires a PathfinderSystem
   *  in the world. Default false (backward compatible). */
  enableReplanning?: boolean;
  /** How often (in ticks) to check for obstacles blocking the path. Default 5. */
  replanningCheckInterval?: number;
  /** Maximum number of replanning attempts per entity per path. Prevents infinite
   *  replanning loops when the goal itself is unreachable. Default 5. */
  maxReplanningAttempts?: number;
}

export class PathFollowerSystem implements WorldSystem {
  readonly name = "path-follower";
  enabled = true;

  private readonly config: Required<PathFollowerConfig>;
  private pathfinder: PathfinderSystem | null = null;
  private tickCount = 0;

  constructor(config?: PathFollowerConfig) {
    this.config = {
      moveSpeed: config?.moveSpeed ?? 5,
      emitCompletionEvent: config?.emitCompletionEvent ?? true,
      enableDynamicAiming: config?.enableDynamicAiming ?? false,
      enableReplanning: config?.enableReplanning ?? false,
      replanningCheckInterval: config?.replanningCheckInterval ?? 5,
      maxReplanningAttempts: config?.maxReplanningAttempts ?? 5,
    };
  }

  tick(_dt: number, world: World, events: EventSystem): void {
    this.tickCount++;

    // Lazy-locate PathfinderSystem if replanning is enabled.
    if (this.config.enableReplanning && (!this.pathfinder || !world.systems.includes(this.pathfinder as unknown as WorldSystem))) {
      this.pathfinder = world.systems.find(s => (s as unknown as { name?: string }).name === "pathfinder") as PathfinderSystem | null ?? null;
    }

    const shouldCheckObstacles = this.config.enableReplanning
      && this.pathfinder !== null
      && this.tickCount % this.config.replanningCheckInterval === 0;

    for (const entity of world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;

      const movePath = entity.state.get("movePath") as Array<{ x: number; z: number }> | undefined;
      if (!movePath || movePath.length === 0) continue;

      const moveTarget = entity.state.get("moveTarget") as { x: number; y: number; z: number } | undefined;

      // Dynamic obstacle check: if the segment to the next waypoint is blocked,
      // replan from current position to the final goal.
      if (shouldCheckObstacles && moveTarget) {
        this.checkAndReplanning(entity, movePath, moveTarget, world);
      }

      if (moveTarget) {
        // MovementController is still navigating to current waypoint.
        if (this.config.enableDynamicAiming) {
          this.aimVelocity(entity, moveTarget.x, moveTarget.z);
        }
        continue;
      }

      // Advance to next waypoint.
      let index = (entity.state.get("movePathIndex") as number) ?? 0;
      index++;

      if (index >= movePath.length) {
        // Path completed.
        entity.state.delete("movePath");
        entity.state.delete("movePathIndex");
        entity.state.delete("movementMode");
        entity.state.delete("replanningCount");
        if (this.config.emitCompletionEvent) {
          events.emit({
            type: "movement.path_completed",
            payload: { entityId: entity.id, waypoints: movePath.length },
            timestamp: Date.now(),
          } as never);
        }
        continue;
      }

      // Set next waypoint as target and apply velocity.
      entity.state.set("movePathIndex", index);
      const wp = movePath[index];
      entity.state.set("moveTarget", { x: wp.x, y: entity.position.y, z: wp.z });
      entity.state.set("movementMode", "physics");
      this.aimVelocity(entity, wp.x, wp.z);
    }
  }

  /**
   * Check whether the straight-line segment from the entity's current position
   * to the next waypoint is blocked. If blocked, attempt to replan from the
   * current position to the final goal.
   */
  private checkAndReplanning(
    entity: GameObject,
    movePath: Array<{ x: number; z: number }>,
    moveTarget: { x: number; y: number; z: number },
    world: World,
  ): void {
    if (!this.pathfinder) return;

    // Check if the segment from current position to next waypoint is blocked.
    const blocked = this.isSegmentBlocked(
      entity.position.x, entity.position.z,
      moveTarget.x, moveTarget.z,
    );
    if (!blocked) return;

    // Check replanning attempt limit.
    const attempts = (entity.state.get("replanningCount") as number) ?? 0;
    if (attempts >= this.config.maxReplanningAttempts) return;

    // Replan from current position to the final goal (last waypoint).
    const goal = movePath[movePath.length - 1];
    const result = this.pathfinder.findPath(
      entity.position.x, entity.position.z,
      goal.x, goal.z,
      world,
    );

    if (!result || result.waypoints.length === 0) return;

    // Replace the path. Keep the current waypoint (index 0 of new path) as
    // the immediate target; MovementController will handle the transition.
    entity.state.set("movePath", result.waypoints);
    entity.state.set("movePathIndex", 0);
    entity.state.set("moveTarget", {
      x: result.waypoints[0].x,
      y: entity.position.y,
      z: result.waypoints[0].z,
    });
    entity.state.set("replanningCount", attempts + 1);
    this.aimVelocity(entity, result.waypoints[0].x, result.waypoints[0].z);
  }

  /**
   * Check whether a straight-line segment from (x1,z1) to (x2,z2) passes
   * through any blocked cell in the navigation grid. Uses DDA ray casting
   * with a step size of half a cell.
   */
  private isSegmentBlocked(x1: number, z1: number, x2: number, z2: number): boolean {
    if (!this.pathfinder) return false;
    const grid = this.pathfinder.grid;
    const cellSize = grid.cellSize;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < cellSize * 0.5) return false;

    // Sample points along the segment at half-cell intervals.
    const steps = Math.max(2, Math.ceil(dist / (cellSize * 0.5)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      if (!grid.isWalkable(px, pz)) return true;
    }
    return false;
  }

  /** Set entity velocity toward a target point at configured moveSpeed. */
  private aimVelocity(entity: GameObject, targetX: number, targetZ: number): void {
    const dx = targetX - entity.position.x;
    const dz = targetZ - entity.position.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const speed = this.config.moveSpeed;
    entity.velocity = new Vector3((dx / len) * speed, 0, (dz / len) * speed);
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}
