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

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Vector3 } from "../entity/Vector3.js";
import { GameObject } from "../entity/Entity.js";

export interface PathFollowerConfig {
  /** Movement speed (m/s) when following path. Default 5. */
  moveSpeed?: number;
  /** If true, emit a custom event when path is completed. Default true. */
  emitCompletionEvent?: boolean;
  /** If true, recalculate velocity direction toward the current moveTarget every
   *  tick (dynamic aiming). This prevents overshooting at high speeds or with
   *  widely-spaced waypoints. Default false (backward compatible). */
  enableDynamicAiming?: boolean;
}

export class PathFollowerSystem implements WorldSystem {
  readonly name = "path-follower";
  enabled = true;

  private readonly config: Required<PathFollowerConfig>;

  constructor(config?: PathFollowerConfig) {
    this.config = {
      moveSpeed: config?.moveSpeed ?? 5,
      emitCompletionEvent: config?.emitCompletionEvent ?? true,
      enableDynamicAiming: config?.enableDynamicAiming ?? false,
    };
  }

  tick(_dt: number, world: World, events: EventSystem): void {
    for (const entity of world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;

      const movePath = entity.state.get("movePath") as Array<{ x: number; z: number }> | undefined;
      if (!movePath || movePath.length === 0) continue;

      const moveTarget = entity.state.get("moveTarget") as { x: number; y: number; z: number } | undefined;

      if (moveTarget) {
        // MovementController is still navigating to current waypoint.
        // If dynamic aiming is enabled, re-aim velocity toward target each tick
        // to prevent overshooting at high speeds or with widely-spaced waypoints.
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
