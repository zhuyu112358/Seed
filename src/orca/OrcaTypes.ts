// ORCA (Optimal Reciprocal Collision Avoidance) system types.
// All parameters are configurable. Seed only provides the avoidance
// calculation framework; target velocities and high-level decisions
// are handled by the application layer/SoulArena.

/** Configuration for ORCA avoidance. */
export interface OrcaConfig {
  /** Time horizon for collision prediction (seconds). Default 5.0. */
  timeHorizon: number;
  /** Maximum speed of an agent. Default 5.0. */
  maxSpeed: number;
  /** Maximum acceleration (steering force). Default 2.0. */
  maxForce: number;
  /** Distance to consider neighbors. Default 10.0. */
  neighborDist: number;
  /** Maximum number of neighbors to consider. Default 10. */
  maxNeighbors: number;
  /** Default agent radius if not specified. Default 0.5. */
  defaultRadius: number;
}

/** Default ORCA configuration. */
export const DEFAULT_ORCA_CONFIG: OrcaConfig = {
  timeHorizon: 5.0,
  maxSpeed: 5.0,
  maxForce: 2.0,
  neighborDist: 10.0,
  maxNeighbors: 10,
  defaultRadius: 0.5,
};

/** 2D vector for ORCA calculations (x/z plane). */
export interface OrcaVector2 {
  x: number;
  z: number;
}

/** An agent in the ORCA system. */
export interface OrcaAgent {
  id: string;
  position: OrcaVector2;
  velocity: OrcaVector2;
  /** Preferred velocity (where the agent wants to go). */
  preferredVelocity: OrcaVector2;
  /** Agent radius for collision. */
  radius: number;
  /** Whether the agent is active (participates in avoidance). */
  active: boolean;
}

/** A half-plane constraint from ORCA. */
export interface OrcaHalfPlane {
  /** Point on the line. */
  point: OrcaVector2;
  /** Normal pointing into the feasible half-plane. */
  normal: OrcaVector2;
}

/** Result of an ORCA operation. */
export interface OrcaResult {
  success: boolean;
  agentId?: string;
  error?: string;
}
