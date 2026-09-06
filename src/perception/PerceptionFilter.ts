// PerceptionFilter: filters perception events and entities by distance,
// type, severity, and optional FOV (vision cone).
//
// Seed provides the filtering framework. Application layer configures filter
// rules. Ember handles cognitive processing of filtered perceptions.
//
// Filtering pipeline:
//   1. Distance filter (if maxDistance > 0 and event has position)
//   2. Type filter (allowedTypes + excludedTypes)
//   3. Severity filter (minSeverity)
//   4. FOV filter (if enableFovFilter and visionCone provided)

import {
  PerceptionEvent,
  PerceptibleEntity,
  FilterConfig,
  DEFAULT_FILTER_CONFIG,
  FilterResult,
  PerceptionSeverity,
  SEVERITY_PRIORITY,
} from "./PerceptionFilterTypes.js";

export class PerceptionFilter {
  readonly name = "perceptionfilter";
  /** Filter configuration. */
  config: FilterConfig;

  constructor(config?: Partial<FilterConfig>) {
    this.config = { ...DEFAULT_FILTER_CONFIG, ...config };
  }

  // --- Configuration ---

  /** Update filter configuration. */
  setConfig(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Add an allowed event type. */
  addAllowedType(type: string): void {
    if (!this.config.allowedTypes.includes(type)) {
      this.config.allowedTypes.push(type);
    }
  }

  /** Remove an allowed event type. */
  removeAllowedType(type: string): void {
    this.config.allowedTypes = this.config.allowedTypes.filter((t) => t !== type);
  }

  /** Add an excluded event type. */
  addExcludedType(type: string): void {
    if (!this.config.excludedTypes.includes(type)) {
      this.config.excludedTypes.push(type);
    }
  }

  /** Set minimum severity threshold. */
  setMinSeverity(severity: PerceptionSeverity): void {
    this.config.minSeverity = severity;
  }

  /** Set maximum perception distance. */
  setMaxDistance(distance: number): void {
    this.config.maxDistance = distance;
  }

  // --- Event filtering ---

  /**
   * Check if a single event passes the filter.
   * @param event The event to check.
   * @param observerPosition Observer position (for distance filter).
   * @returns True if event passes the filter (should be included).
   */
  passesEventFilter(event: PerceptionEvent, observerPosition?: { x: number; z: number }): boolean {
    // 1. Excluded types always filtered out.
    if (this.config.excludedTypes.length > 0 && this.config.excludedTypes.includes(event.type)) {
      return false;
    }

    // 2. Allowed types (if non-empty, only these pass).
    if (this.config.allowedTypes.length > 0 && !this.config.allowedTypes.includes(event.type)) {
      return false;
    }

    // 3. Severity filter.
    const eventPriority = SEVERITY_PRIORITY[event.severity] ?? 1;
    const minPriority = SEVERITY_PRIORITY[this.config.minSeverity] ?? 1;
    if (eventPriority < minPriority) {
      return false;
    }

    // 4. Distance filter (if maxDistance > 0 and event has position).
    if (this.config.maxDistance > 0 && event.position && observerPosition) {
      const dx = event.position.x - observerPosition.x;
      const dz = event.position.z - observerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > this.config.maxDistance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filter a list of perception events.
   * @param events Events to filter.
   * @param observerPosition Observer position (for distance filter).
   * @returns Filtered events + filter result stats.
   */
  filterEvents(
    events: PerceptionEvent[],
    observerPosition?: { x: number; z: number },
  ): { events: PerceptionEvent[]; result: FilterResult } {
    const filtered = events.filter((e) => this.passesEventFilter(e, observerPosition));
    return {
      events: filtered,
      result: {
        inputCount: events.length,
        outputCount: filtered.length,
        filteredCount: events.length - filtered.length,
      },
    };
  }

  // --- Entity filtering ---

  /**
   * Check if a single entity passes the filter.
   * @param entity The entity to check.
   * @param observerPosition Observer position (for distance filter).
   * @param isVisibleInFov Optional FOV visibility check (if enableFovFilter).
   * @returns True if entity passes the filter.
   */
  passesEntityFilter(
    entity: PerceptibleEntity,
    observerPosition?: { x: number; z: number },
    isVisibleInFov?: boolean,
  ): boolean {
    // 1. Allowed entity types (if non-empty).
    if (this.config.allowedEntityTypes.length > 0 && !this.config.allowedEntityTypes.includes(entity.type)) {
      return false;
    }

    // 2. Distance filter.
    if (this.config.maxDistance > 0 && observerPosition) {
      const dx = entity.position.x - observerPosition.x;
      const dz = entity.position.z - observerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > this.config.maxDistance) {
        return false;
      }
    }

    // 3. FOV filter (if enabled and FOV check provided).
    if (this.config.enableFovFilter && isVisibleInFov !== undefined && !isVisibleInFov) {
      return false;
    }

    return true;
  }

  /**
   * Filter a list of perceptible entities.
   * @param entities Entities to filter.
   * @param observerPosition Observer position.
   * @param fovVisibilityMap Optional map of entityId -> isVisibleInFov.
   * @returns Filtered entities + filter result stats.
   */
  filterEntities(
    entities: PerceptibleEntity[],
    observerPosition?: { x: number; z: number },
    fovVisibilityMap?: Map<string, boolean>,
  ): { entities: PerceptibleEntity[]; result: FilterResult } {
    const filtered = entities.filter((e) => {
      const isVisible = fovVisibilityMap ? fovVisibilityMap.get(e.id) : undefined;
      return this.passesEntityFilter(e, observerPosition, isVisible);
    });
    return {
      entities: filtered,
      result: {
        inputCount: entities.length,
        outputCount: filtered.length,
        filteredCount: entities.length - filtered.length,
      },
    };
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return { config: this.config };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_FILTER_CONFIG, ...(data.config as Partial<FilterConfig>) };
    }
  }
}
