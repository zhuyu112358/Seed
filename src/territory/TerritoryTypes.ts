// Territory system types. All territory content is defined by application layer.
/** Axis-aligned boundary on the x/z plane. */
export interface TerritoryBoundary {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A territory claimed by an entity. */
export interface Territory {
  id: string;
  name: string;
  ownerId: string;
  boundary: TerritoryBoundary;
  claimedTick: number;
  metadata?: Record<string, unknown>;
}

/** Result of a territory operation. */
export interface TerritoryResult {
  success: boolean;
  territoryId?: string;
  error?: string;
}

/** Position in world space (x, z plane). */
export interface TerritoryPosition {
  x: number;
  z: number;
}
