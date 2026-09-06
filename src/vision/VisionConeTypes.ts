// Vision cone (FOV) perception system types.
// Seed provides the visibility calculation framework; application layer
// configures observer parameters and decides what to do with visible entities.
// Ember (soul engine) handles cognitive processing of visual information.

/** Configuration for a vision cone observer. */
export interface VisionConeConfig {
  /** Field of view angle in degrees (e.g., 90 = 90-degree cone). Default 90. */
  fovAngle: number;
  /** Maximum view distance. Default 10. */
  viewDistance: number;
  /** Whether to check line-of-sight occlusion (requires obstacles). Default false. */
  checkOcclusion: boolean;
}

/** Default vision cone configuration. */
export const DEFAULT_VISION_CONE_CONFIG: VisionConeConfig = {
  fovAngle: 90,
  viewDistance: 10,
  checkOcclusion: false,
};

/** An observer with a vision cone. */
export interface VisionObserver {
  id: string;
  /** Current position of the observer. */
  position: { x: number; z: number };
  /** Facing direction in radians (0 = +x axis, positive = counterclockwise). */
  direction: number;
  /** Vision cone configuration. */
  config: VisionConeConfig;
  /** Whether this observer is active. */
  active: boolean;
}

/** A visible entity detected by a vision cone. */
export interface VisibleEntity {
  /** ID of the visible entity. */
  entityId: string;
  /** Position of the visible entity. */
  position: { x: number; z: number };
  /** Distance from observer to entity. */
  distance: number;
  /** Angle from observer's facing direction to entity (in degrees, signed). */
  angleToEntity: number;
  /** Whether line-of-sight is clear (only meaningful if checkOcclusion enabled). */
  lineOfSight: boolean;
}

/** Result of a vision operation. */
export interface VisionResult {
  success: boolean;
  observerId?: string;
  visibleCount?: number;
  error?: string;
}
