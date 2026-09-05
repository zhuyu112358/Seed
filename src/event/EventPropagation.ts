// EventPropagation: models how an event decays as it spreads through space.
// This is a lightweight spatial-decay helper; the communication module provides
// the full medium/absorption model for messages.

import type { Event } from './Event.js';

export interface PropagationConfig {
  /** Intensity lost per metre travelled. */
  attenuationPerMetre: number;
  /** Hard cap on how far the event propagates. */
  maxRadius: number;
}

export class EventPropagation {
  constructor(private readonly config: PropagationConfig) {}

  /** Distance from the event origin to a target point. */
  distanceTo(event: Event, target: { x: number; y: number; z: number }): number {
    if (!event.propagation.origin) return Infinity;
    const o = event.propagation.origin;
    const dx = o.x - target.x;
    const dy = o.y - target.y;
    const dz = o.z - target.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Compute the residual intensity when the event reaches a target point.
   * Returns 0 if the point is beyond maxRadius or after attenuation.
   */
  intensityAt(event: Event, target: { x: number; y: number; z: number }): number {
    const d = this.distanceTo(event, target);
    if (!Number.isFinite(d)) return 0;
    if (d > this.config.maxRadius) return 0;
    const residual = event.propagation.intensity - d * this.config.attenuationPerMetre;
    return Math.max(0, residual);
  }

  /** Filter a list of entities to those within the audible/visible radius. */
  filterByRadius<T extends { id: string; position: { x: number; y: number; z: number } }>(
    event: Event,
    entities: T[],
  ): T[] {
    return entities.filter((e) => this.intensityAt(event, e.position) > 0);
  }
}
