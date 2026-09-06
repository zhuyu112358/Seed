// Flocking system types. All behavior parameters are configurable.
/** Configuration for flocking behavior weights and limits. */
export interface FlockConfig {
  /** Weight for separation (avoid crowding). Default 1.5. */
  separationWeight: number;
  /** Weight for alignment (match heading). Default 1.0. */
  alignmentWeight: number;
  /** Weight for cohesion (move toward center). Default 1.0. */
  cohesionWeight: number;
  /** Maximum speed of an agent. Default 5.0. */
  maxSpeed: number;
  /** Maximum acceleration (steering force). Default 2.0. */
  maxForce: number;
  /** Radius for perceiving neighbors. Default 8.0. */
  perceptionRadius: number;
  /** Radius for separation (smaller than perception). Default 4.0. */
  separationRadius: number;
}

/** Default flocking configuration. */
export const DEFAULT_FLOCK_CONFIG: FlockConfig = {
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  maxSpeed: 5.0,
  maxForce: 2.0,
  perceptionRadius: 8.0,
  separationRadius: 4.0,
};

/** 2D vector for flocking calculations (x/z plane). */
export interface FlockVector2 {
  x: number;
  z: number;
}

/** An agent in the flocking system. */
export interface FlockAgent {
  id: string;
  position: FlockVector2;
  velocity: FlockVector2;
  acceleration: FlockVector2;
  /** Optional target position the agent steers toward. */
  target: FlockVector2 | null;
  /** Whether the agent is active (participates in flocking). */
  active: boolean;
}

/** Result of a flocking operation. */
export interface FlockResult {
  success: boolean;
  agentId?: string;
  error?: string;
}
