// Formation system types. All formation parameters are configurable.
// Seed only provides the formation calculation framework; formation
// assignment and high-level decisions are handled by the application layer.

/** Formation shape types. */
export type FormationType = "line" | "column" | "wedge" | "circle" | "v" | "custom";

/** A slot in a formation, defined as an offset from the leader position. */
export interface FormationSlot {
  /** Slot index (0 = leader). */
  index: number;
  /** Offset from leader position (x = forward/back, z = left/right). */
  offset: { x: number; z: number };
  /** Member ID occupying this slot, or null if empty. */
  memberId: string | null;
}

/** Configuration for formation behavior. */
export interface FormationConfig {
  /** Spacing between formation slots. Default 2.0. */
  spacing: number;
  /** Position tolerance - member is "in position" within this distance. Default 0.5. */
  positionTolerance: number;
  /** Circle formation radius. Default 3.0. */
  circleRadius: number;
}

/** Default formation configuration. */
export const DEFAULT_FORMATION_CONFIG: FormationConfig = {
  spacing: 2.0,
  positionTolerance: 0.5,
  circleRadius: 3.0,
};

/** A formation instance. */
export interface Formation {
  id: string;
  type: FormationType;
  leaderId: string;
  name: string;
  slots: FormationSlot[];
  /** Custom slot offsets for "custom" formation type. */
  customOffsets?: { x: number; z: number }[];
  active: boolean;
  createdTick: number;
}

/** Result of a formation operation. */
export interface FormationResult {
  success: boolean;
  formationId?: string;
  slotIndex?: number;
  error?: string;
}

/** Position of a formation slot in world coordinates. */
export interface FormationSlotPosition {
  slotIndex: number;
  memberId: string | null;
  position: { x: number; z: number };
  /** Whether the member is within position tolerance of the slot. */
  inPosition: boolean;
}
