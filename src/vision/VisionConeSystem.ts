// VisionConeSystem: Field-of-view (FOV) based visibility perception.
//
// Provides cone-shaped visibility checks for observers. Each observer has
// a position, facing direction, FOV angle, and view distance. The system
// can check whether a target is within an observer's vision cone, and
// filter a list of entities to only those visible.
//
// Seed only provides the visibility calculation framework. Application layer
// configures observers and decides responses; Ember handles cognitive processing.
//
// Coordinate system: x/z plane (top-down). Direction 0 = +x axis,
// positive angles = counterclockwise (standard math convention).

import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  VisionConeConfig,
  DEFAULT_VISION_CONE_CONFIG,
  VisionObserver,
  VisibleEntity,
  VisionResult,
} from "./VisionConeTypes.js";

export class VisionConeSystem {
  readonly name = "visioncone";
  enabled = true;
  private observers = new Map<string, VisionObserver>();
  private observerCounter = 0;

  constructor() {
    // Default config is applied per-observer on creation.
  }

  private generateId(): string {
    this.observerCounter++;
    return `vision_${Date.now()}_${this.observerCounter}`;
  }

  // --- Observer management ---

  /**
   * Add a vision cone observer.
   * @param position Initial position of the observer.
   * @param direction Initial facing direction in radians (0 = +x).
   * @param config Optional vision cone configuration.
   * @param observerId Optional specific ID (auto-generated if not provided).
   */
  addObserver(
    position: { x: number; z: number },
    direction = 0,
    config?: Partial<VisionConeConfig>,
    observerId?: string,
  ): VisionResult {
    const id = observerId || this.generateId();
    if (this.observers.has(id)) {
      return { success: false, error: `Observer ${id} already exists` };
    }
    const observer: VisionObserver = {
      id,
      position: { ...position },
      direction,
      config: { ...DEFAULT_VISION_CONE_CONFIG, ...config },
      active: true,
    };
    this.observers.set(id, observer);
    return { success: true, observerId: id };
  }

  /** Remove an observer. */
  removeObserver(observerId: string): VisionResult {
    if (!this.observers.has(observerId)) {
      return { success: false, error: "Observer not found" };
    }
    this.observers.delete(observerId);
    return { success: true, observerId };
  }

  /** Get an observer by ID. */
  getObserver(observerId: string): VisionObserver | undefined {
    return this.observers.get(observerId);
  }

  /** Get all observers. */
  getObservers(): VisionObserver[] {
    return Array.from(this.observers.values());
  }

  /** Get active observers only. */
  getActiveObservers(): VisionObserver[] {
    return Array.from(this.observers.values()).filter((o) => o.active);
  }

  /** Set observer position. */
  setObserverPosition(observerId: string, position: { x: number; z: number }): VisionResult {
    const observer = this.observers.get(observerId);
    if (!observer) return { success: false, error: "Observer not found" };
    observer.position = { ...position };
    return { success: true, observerId };
  }

  /** Set observer facing direction in radians. */
  setObserverDirection(observerId: string, direction: number): VisionResult {
    const observer = this.observers.get(observerId);
    if (!observer) return { success: false, error: "Observer not found" };
    observer.direction = direction;
    return { success: true, observerId };
  }

  /** Update observer configuration. */
  setObserverConfig(observerId: string, config: Partial<VisionConeConfig>): VisionResult {
    const observer = this.observers.get(observerId);
    if (!observer) return { success: false, error: "Observer not found" };
    observer.config = { ...observer.config, ...config };
    return { success: true, observerId };
  }

  /** Set observer active state. */
  setObserverActive(observerId: string, active: boolean): VisionResult {
    const observer = this.observers.get(observerId);
    if (!observer) return { success: false, error: "Observer not found" };
    observer.active = active;
    return { success: true, observerId };
  }

  /** Number of observers. */
  get observerCount(): number {
    return this.observers.size;
  }

  // --- Visibility calculations ---

  /**
   * Compute the signed angle from observer's facing direction to target.
   * @param observerPos Observer position.
   * @param observerDir Observer facing direction in radians.
   * @param targetPos Target position.
   * @returns Signed angle in degrees (-180 to 180), positive = counterclockwise from facing.
   */
  computeAngleToTarget(
    observerPos: { x: number; z: number },
    observerDir: number,
    targetPos: { x: number; z: number },
  ): number {
    const dx = targetPos.x - observerPos.x;
    const dz = targetPos.z - observerPos.z;
    if (dx === 0 && dz === 0) return 0;

    // Angle to target (atan2 uses y,x; in our plane z is "y").
    const angleToTarget = Math.atan2(dz, dx);
    // Signed difference, normalized to [-PI, PI].
    let diff = angleToTarget - observerDir;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return (diff * 180) / Math.PI;
  }

  /**
   * Compute distance from observer to target.
   */
  computeDistance(
    observerPos: { x: number; z: number },
    targetPos: { x: number; z: number },
  ): number {
    const dx = targetPos.x - observerPos.x;
    const dz = targetPos.z - observerPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check if a target position is within an observer's vision cone.
   * @param observerId The observer to check.
   * @param targetPos Target position to test.
   * @returns True if target is within FOV angle and view distance.
   */
  isTargetVisible(observerId: string, targetPos: { x: number; z: number }): boolean {
    const observer = this.observers.get(observerId);
    if (!observer || !observer.active) return false;

    const distance = this.computeDistance(observer.position, targetPos);
    if (distance > observer.config.viewDistance) return false;
    if (distance === 0) return true; // Target at observer position is always visible.

    const angle = this.computeAngleToTarget(observer.position, observer.direction, targetPos);
    const halfFov = observer.config.fovAngle / 2;
    return Math.abs(angle) <= halfFov;
  }

  /**
   * Get detailed visibility info for a target (distance, angle, line-of-sight).
   * @param observerId The observer.
   * @param targetId ID of the target entity.
   * @param targetPos Position of the target.
   * @returns VisibleEntity info if visible, null if not visible.
   */
  getTargetVisibility(
    observerId: string,
    targetId: string,
    targetPos: { x: number; z: number },
  ): VisibleEntity | null {
    const observer = this.observers.get(observerId);
    if (!observer || !observer.active) return null;

    const distance = this.computeDistance(observer.position, targetPos);
    if (distance > observer.config.viewDistance) return null;

    const angle = distance === 0 ? 0 : this.computeAngleToTarget(observer.position, observer.direction, targetPos);
    const halfFov = observer.config.fovAngle / 2;
    if (Math.abs(angle) > halfFov) return null;

    return {
      entityId: targetId,
      position: { ...targetPos },
      distance,
      angleToEntity: angle,
      lineOfSight: true, // Occlusion check not yet implemented (Phase 2).
    };
  }

  /**
   * Filter a list of entities to only those visible to the observer.
   * @param observerId The observer.
   * @param entities Array of {id, position} entities to filter.
   * @returns Array of VisibleEntity for all visible entities, sorted by distance.
   */
  getVisibleEntities(
    observerId: string,
    entities: Array<{ id: string; position: { x: number; z: number } }>,
  ): VisibleEntity[] {
    const result: VisibleEntity[] = [];
    for (const entity of entities) {
      const visibility = this.getTargetVisibility(observerId, entity.id, entity.position);
      if (visibility) {
        result.push(visibility);
      }
    }
    // Sort by distance (closest first).
    result.sort((a, b) => a.distance - b.distance);
    return result;
  }

  /**
   * Find all observers that can see a target position.
   * @param targetPos Target position.
   * @returns Array of observer IDs that can see the target.
   */
  findObserversSeeingTarget(targetPos: { x: number; z: number }): string[] {
    const result: string[] = [];
    for (const observer of this.observers.values()) {
      if (!observer.active) continue;
      if (this.isTargetVisible(observer.id, targetPos)) {
        result.push(observer.id);
      }
    }
    return result;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    // VisionConeSystem is stateless per-tick; visibility is computed on demand.
  }

  stop(): void {
    this.observers.clear();
    this.observerCounter = 0;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const observers: Record<string, VisionObserver> = {};
    for (const [id, o] of this.observers) {
      observers[id] = o;
    }
    return { observers, observerCounter: this.observerCounter };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.observers && typeof data.observers === "object") {
      for (const [id, o] of Object.entries(data.observers as Record<string, VisionObserver>)) {
        this.observers.set(id, o);
      }
    }
    if (typeof data.observerCounter === "number") {
      this.observerCounter = data.observerCounter;
    }
  }
}
