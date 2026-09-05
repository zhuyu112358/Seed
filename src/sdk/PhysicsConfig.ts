/**
 * Seed SDK - Physics configuration presets and material property tables.
 */

import type { MaterialType, PhysicsConfig } from '../types/index.js';

/** Earth-like default physics tuning. */
export const defaultPhysicsConfig: PhysicsConfig = {
  gravity: { x: 0, y: -9.8, z: 0 },
  airDensity: 1.225,
  frictionCoefficient: 0.3,
  restitutionCoefficient: 0.2,
  timeScale: 1,
  maxVelocity: 100,
  collisionEnabled: true,
  substeps: 2,
};

/** Zero-G environment (space / void chambers). */
export const zeroGravityConfig: PhysicsConfig = {
  ...defaultPhysicsConfig,
  gravity: { x: 0, y: 0, z: 0 },
  airDensity: 0,
};

/** Lunar gravity (~1.62 m/s^2) with near-vacuum air density. */
export const moonGravityConfig: PhysicsConfig = {
  ...defaultPhysicsConfig,
  gravity: { x: 0, y: -1.62, z: 0 },
  airDensity: 0.2,
  frictionCoefficient: 0.5,
};

/** Underwater simulation: heavy drag, buoyancy expected from the solver. */
export const waterPhysicsConfig: PhysicsConfig = {
  ...defaultPhysicsConfig,
  gravity: { x: 0, y: -3.5, z: 0 },
  airDensity: 1000,
  frictionCoefficient: 0.8,
  restitutionCoefficient: 0.05,
};

/** Merge caller overrides onto the default config. */
export function createPhysicsConfig(overrides: Partial<PhysicsConfig> = {}): PhysicsConfig {
  return {
    gravity: { ...defaultPhysicsConfig.gravity, ...(overrides.gravity ?? {}) },
    airDensity: overrides.airDensity ?? defaultPhysicsConfig.airDensity,
    frictionCoefficient: overrides.frictionCoefficient ?? defaultPhysicsConfig.frictionCoefficient,
    restitutionCoefficient: overrides.restitutionCoefficient ?? defaultPhysicsConfig.restitutionCoefficient,
    timeScale: overrides.timeScale ?? defaultPhysicsConfig.timeScale,
    maxVelocity: overrides.maxVelocity ?? defaultPhysicsConfig.maxVelocity,
    collisionEnabled: overrides.collisionEnabled ?? defaultPhysicsConfig.collisionEnabled,
    substeps: overrides.substeps ?? defaultPhysicsConfig.substeps,
  };
}

/** Approximate material density in kg/m^3. */
export const materialDensity: Record<MaterialType, number> = {
  wood: 600, stone: 2400, metal: 7800, glass: 2500, water: 1000,
  fire: 0.2, earth: 1600, air: 1.225, organic: 950, energy: 0.01, custom: 1000,
};

/** Friction coefficients per material. */
export const materialFriction: Record<MaterialType, number> = {
  wood: 0.5, stone: 0.7, metal: 0.3, glass: 0.15, water: 0.05,
  fire: 0, earth: 0.9, air: 0, organic: 0.6, energy: 0, custom: 0.3,
};

/** Restitution (bounciness) per material. */
export const materialRestitution: Record<MaterialType, number> = {
  wood: 0.2, stone: 0.1, metal: 0.25, glass: 0.4, water: 0.05,
  fire: 0, earth: 0.05, air: 0, organic: 0.3, energy: 0.5, custom: 0.2,
};
