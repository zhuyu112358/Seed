// Perception filter system types.
// Seed provides the filtering framework; application layer configures filter rules
// and decides what to do with filtered perceptions. Ember handles cognitive
// processing of filtered perceptual information.

/** Severity levels for perception events. */
export type PerceptionSeverity = "low" | "medium" | "high" | "critical";

/** A perception event (simplified interface for filtering). */
export interface PerceptionEvent {
  /** Unique event ID. */
  id: string;
  /** Event type (e.g., "collision.enter", "navigation.path_blocked"). */
  type: string;
  /** Event name/description. */
  name: string;
  /** Severity level. */
  severity: PerceptionSeverity;
  /** Event position in world (x/z plane). */
  position?: { x: number; z: number };
  /** Tick when event occurred. */
  tick?: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A perceptible entity (simplified interface for filtering). */
export interface PerceptibleEntity {
  /** Entity ID. */
  id: string;
  /** Entity type. */
  type: string;
  /** Entity position. */
  position: { x: number; z: number };
  /** Optional entity name. */
  name?: string;
}

/** Configuration for perception filtering. */
export interface FilterConfig {
  /** Maximum distance for events/entities to be perceived (0 = no limit). Default 0. */
  maxDistance: number;
  /** Minimum severity to include (events below this are filtered out). Default "low". */
  minSeverity: PerceptionSeverity;
  /** Allowed event types (empty = all allowed). */
  allowedTypes: string[];
  /** Excluded event types (always filtered out, even if in allowedTypes). */
  excludedTypes: string[];
  /** Allowed entity types (empty = all allowed). */
  allowedEntityTypes: string[];
  /** Whether to enable FOV-based entity filtering (requires visionCone). Default false. */
  enableFovFilter: boolean;
}

/** Default filter configuration. */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  maxDistance: 0,
  minSeverity: "low",
  allowedTypes: [],
  excludedTypes: [],
  allowedEntityTypes: [],
  enableFovFilter: false,
};

/** Result of a filter operation. */
export interface FilterResult {
  /** Number of items before filtering. */
  inputCount: number;
  /** Number of items after filtering. */
  outputCount: number;
  /** Number of items filtered out. */
  filteredCount: number;
}

/** Numeric priority for severity levels (higher = more important). */
export const SEVERITY_PRIORITY: Record<PerceptionSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
