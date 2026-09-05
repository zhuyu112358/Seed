// IPhysicsBackend: pluggable physics backends. The shipped implementation is a
// deterministic 2D integrator; the interface leaves room for cannon-es / rapier
// in later iterations (see docs/ROADMAP.md).

import type { GameObject } from '../entity/Entity.js';
import type { PhysicsConfig } from './PhysicsConfig.js';

export interface CollisionPair {
  a: GameObject;
  b: GameObject;
  point: { x: number; y: number; z: number };
  relativeSpeed: number;
}

/**
 * Minimal physics backend contract. A backend owns integration + broad/narrow
 * phase collision for the bodies it is given each tick.
 */
export interface IPhysicsBackend {
  readonly name: string;
  step(dt: number, bodies: GameObject[], config: PhysicsConfig): { collisions: CollisionPair[] };
  applyImpulse(body: GameObject, ix: number, iy: number, iz: number): void;
}

export function aabbOverlap(
  aMin: { x: number; y: number; z: number },
  aMax: { x: number; y: number; z: number },
  bMin: { x: number; y: number; z: number },
  bMax: { x: number; y: number; z: number },
): boolean {
  return (
    aMin.x <= bMax.x && aMax.x >= bMin.x &&
    aMin.y <= bMax.y && aMax.y >= bMin.y &&
    aMin.z <= bMax.z && aMax.z >= bMin.z
  );
}
