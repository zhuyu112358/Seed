// Navigation system types. All parameters are configurable.
// Seed only provides the path cost calculation and event framework;
// terrain definitions, danger zones, and high-level navigation decisions
// are handled by the application layer/SoulArena (Ember).

/** Type of path cost modifier. */
export type CostModifierType = "terrain" | "danger" | "building" | "zone" | "custom";

/** A circular area that modifies pathfinding cost. */
export interface PathCostModifier {
  id: string;
  type: CostModifierType;
  name: string;
  /** Center position of the modifier area. */
  position: { x: number; z: number };
  /** Radius of the affected area. */
  radius: number;
  /** Cost multiplier applied to path cost within this area (1.0 = no change). */
  costMultiplier: number;
  /** Whether this modifier is active. */
  active: boolean;
  /** Optional metadata for application layer use. */
  metadata?: Record<string, unknown>;
}

/** Configuration for path cost system. */
export interface PathCostConfig {
  /** Base path cost per unit distance. Default 1.0. */
  baseCost: number;
  /** Maximum cost multiplier cap (prevents infinite costs). Default 100.0. */
  maxCostMultiplier: number;
}

/** Default path cost configuration. */
export const DEFAULT_PATH_COST_CONFIG: PathCostConfig = {
  baseCost: 1.0,
  maxCostMultiplier: 100.0,
};

/** Navigation event types. */
export type NavigationEventType = "path_changed" | "path_blocked" | "arrived" | "waypoint_reached";

/** Payload for navigation events. */
export interface NavigationEventPayload {
  /** Allow index signature for EventPayload compatibility. */
  [key: string]: unknown;
  /** ID of the entity/soul navigating. */
  entityId: string;
  /** Type of navigation event. */
  eventType: NavigationEventType;
  /** Current position of the entity. */
  position: { x: number; z: number };
  /** Target/destination position (if applicable). */
  target?: { x: number; z: number };
  /** Waypoint index (for waypoint_reached). */
  waypointIndex?: number;
  /** Total path cost (for path_changed). */
  pathCost?: number;
  /** Reason for the event (optional). */
  reason?: string;
}

/** Result of a navigation operation. */
export interface NavigationResult {
  success: boolean;
  modifierId?: string;
  error?: string;
}
