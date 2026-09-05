// Building system types. All building content is defined by application layer.
/** Types of buildings. */
export type BuildingType = "structure" | "defense" | "production" | "residential" | "storage" | "custom";

/** Position in world space (x, z plane for top-down world). */
export interface BuildingPosition {
  x: number;
  z: number;
}

/** Size of a building in world units. */
export interface BuildingSize {
  width: number;
  depth: number;
}

/** A building in the world. */
export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  position: BuildingPosition;
  size: BuildingSize;
  ownerId: string;
  health: number;
  maxHealth: number;
  level: number;
  /** Whether the building is active (producing, defending, etc.). */
  active: boolean;
  createdTick: number;
  metadata?: Record<string, unknown>;
}

/** Result of a building operation. */
export interface BuildingResult {
  success: boolean;
  buildingId?: string;
  error?: string;
}

/** Callback for building production (application layer defines output). */
export type BuildingProductionHandler = (
  buildingId: string,
  buildingType: BuildingType,
  level: number,
  ownerId: string,
) => Record<string, number>;

/** Callback for building defense (application layer defines defense value). */
export type BuildingDefenseHandler = (
  buildingId: string,
  buildingType: BuildingType,
  level: number,
) => number;
