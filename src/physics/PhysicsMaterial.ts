// PhysicsMaterial: per-entity physical properties for collision response.
//
// Different materials have different restitution (bounciness) and friction
// (resistance to sliding). When two entities collide, their materials are
// combined (typically averaged) to determine the collision response.

export interface PhysicsMaterial {
  /** Coefficient of restitution (bounciness), in [0, 1].
   *  0 = perfectly inelastic (no bounce), 1 = perfectly elastic (full bounce).
   *  Default 0.2 (slightly bouncy). */
  restitution: number;
  /** Coefficient of friction, in [0, 1].
   *  0 = frictionless (ice), 1 = high friction (rubber).
   *  Default 0.5 (moderate friction). */
  friction: number;
  /** Human-readable name for debugging and serialization. */
  name: string;
}

/** Predefined physics materials for common surface types. */
export const PhysicsMaterials = {
  /** Default material: moderate restitution and friction. */
  DEFAULT: { restitution: 0.2, friction: 0.5, name: 'default' } as PhysicsMaterial,

  /** Ice: very low friction, low restitution. */
  ICE: { restitution: 0.05, friction: 0.05, name: 'ice' } as PhysicsMaterial,

  /** Rubber: high restitution, high friction. */
  RUBBER: { restitution: 0.9, friction: 0.8, name: 'rubber' } as PhysicsMaterial,

  /** Stone: low restitution, high friction. */
  STONE: { restitution: 0.1, friction: 0.7, name: 'stone' } as PhysicsMaterial,

  /** Wood: low restitution, moderate friction. */
  WOOD: { restitution: 0.15, friction: 0.6, name: 'wood' } as PhysicsMaterial,

  /** Metal: low restitution, moderate-high friction. */
  METAL: { restitution: 0.12, friction: 0.65, name: 'metal' } as PhysicsMaterial,

  /** Flesh/organic: moderate restitution, moderate friction. */
  FLESH: { restitution: 0.3, friction: 0.5, name: 'flesh' } as PhysicsMaterial,

  /** Glass: high restitution, low friction (smooth). */
  GLASS: { restitution: 0.8, friction: 0.2, name: 'glass' } as PhysicsMaterial,

  /** Bouncy ball: very high restitution, moderate friction. */
  BOUNCY: { restitution: 0.95, friction: 0.4, name: 'bouncy' } as PhysicsMaterial,

  /** Frictionless: zero friction, zero restitution (ideal test material). */
  FRICTIONLESS: { restitution: 0, friction: 0, name: 'frictionless' } as PhysicsMaterial,
} as const;

/**
 * Combine two physics materials for collision response.
 * Uses averaging for both restitution and friction.
 * @param a First material.
 * @param b Second material.
 * @returns Combined material.
 */
export function combineMaterials(a: PhysicsMaterial, b: PhysicsMaterial): PhysicsMaterial {
  return {
    restitution: (a.restitution + b.restitution) / 2,
    friction: (a.friction + b.friction) / 2,
    name: `${a.name}+${b.name}`,
  };
}
