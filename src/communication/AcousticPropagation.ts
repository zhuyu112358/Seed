// AcousticPropagation: sound travels through a medium with distance decay
// and optional occlusion by solid objects.
//
// Model (without occlusion):
//   receivedIntensity = sourceIntensity
//                       * (1 / (1 + attenuation * distance^2))   [inverse-square-ish]
//                       * (1 - absorption * distance)            [medium absorption]
//
// With occlusion enabled:
//   For each occluding entity (entity.state.blocksSound === true) whose
//   AABB intersects the line segment from source to listener, multiply
//   receivedIntensity by (1 - occlusionAttenuation). Multiple occluders
//   stack multiplicatively.
//
// A listener receives the message only if receivedIntensity > minAudible
// and distance <= maxRadius.

import type { GameObject } from '../entity/Entity.js';
import type { Message, ReceivedMessage } from './Message.js';
import type { CommunicationStrategy, WorldView } from './CommunicationStrategy.js';

export interface AcousticConfig {
  /** Decay coefficient in the inverse-square term (0 = no decay). */
  attenuation?: number;
  /** Linear absorption per metre, in [0, 1]. */
  absorption?: number;
  /** Hard cap on propagation radius in metres. */
  maxRadius?: number;
  /** Minimum intensity required for a listener to hear the message. */
  minAudible?: number;
  /** Enable occlusion by entities with state.blocksSound === true. Default true. */
  occlusionEnabled?: boolean;
  /** Intensity attenuation per occluding entity intersected, in [0, 1].
   *  0 = no attenuation (sound passes through), 1 = full block (silence).
   *  Default 0.85 (sound is mostly blocked but a faint amount leaks through). */
  occlusionAttenuation?: number;
}

export class AcousticPropagation implements CommunicationStrategy {
  public readonly medium = 'acoustic';
  private readonly attenuation: number;
  private readonly absorption: number;
  private readonly maxRadius: number;
  private readonly minAudible: number;
  private readonly occlusionEnabled: boolean;
  private readonly occlusionAttenuation: number;

  constructor(cfg: AcousticConfig = {}) {
    this.attenuation = cfg.attenuation ?? 0.02;
    this.absorption = cfg.absorption ?? 0.01;
    this.maxRadius = cfg.maxRadius ?? 50;
    this.minAudible = cfg.minAudible ?? 0.05;
    this.occlusionEnabled = cfg.occlusionEnabled ?? true;
    this.occlusionAttenuation = cfg.occlusionAttenuation ?? 0.85;
  }

  /** Public so tests can probe the attenuation curve without a world. */
  intensityAt(sourceIntensity: number, distance: number): number {
    if (distance > this.maxRadius) return 0;
    const inverseSquare = 1 / (1 + this.attenuation * distance * distance);
    const mediumAbsorption = Math.max(0, 1 - this.absorption * distance);
    return Math.max(0, sourceIntensity * inverseSquare * mediumAbsorption);
  }

  /**
   * Compute intensity at a point with occlusion from world entities.
   * This is the occlusion-aware version of intensityAt().
   * @param sourceIntensity Original sound intensity.
   * @param source Position of the sound source.
   * @param listener Position of the listener.
   * @param occluders Array of entities that can block sound.
   * @returns Received intensity after distance decay and occlusion.
   */
  intensityAtWithOcclusion(
    sourceIntensity: number,
    source: { x: number; y: number; z: number },
    listener: { x: number; y: number; z: number },
    occluders: GameObject[],
  ): number {
    const dx = listener.x - source.x;
    const dy = listener.y - source.y;
    const dz = listener.z - source.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let intensity = this.intensityAt(sourceIntensity, distance);
    if (intensity <= 0) return 0;

    if (this.occlusionEnabled && occluders.length > 0 && distance > 1e-6) {
      const dirX = dx / distance;
      const dirY = dy / distance;
      const dirZ = dz / distance;

      for (const occluder of occluders) {
        // Skip if the occluder is the source or listener (handled by caller).
        if (this.segmentIntersectsAABB(
          source.x, source.y, source.z,
          dirX, dirY, dirZ,
          distance,
          occluder,
        )) {
          intensity *= (1 - this.occlusionAttenuation);
          if (intensity <= this.minAudible) return 0;
        }
      }
    }

    return intensity;
  }

  /**
   * Test whether a line segment intersects an entity's AABB.
   * Uses the slab method (Kay-Kajiya) for axis-aligned boxes.
   * @param ox, oy, oz Segment origin.
   * @param dx, dy, dz Normalized segment direction.
   * @param tMax Segment length (max parametric t).
   * @param entity Entity with position and halfExtents defining the AABB.
   * @returns true if the segment intersects the AABB.
   */
  private segmentIntersectsAABB(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    tMax: number,
    entity: GameObject,
  ): boolean {
    const hx = entity.halfExtents.x;
    const hy = entity.halfExtents.y;
    const hz = entity.halfExtents.z;
    const minX = entity.position.x - hx;
    const maxX = entity.position.x + hx;
    const minY = entity.position.y - hy;
    const maxY = entity.position.y + hy;
    const minZ = entity.position.z - hz;
    const maxZ = entity.position.z + hz;

    let tMin = 0;
    let tMaxLocal = tMax;

    // X slab.
    if (Math.abs(dx) < 1e-8) {
      if (ox < minX || ox > maxX) return false;
    } else {
      let t1 = (minX - ox) / dx;
      let t2 = (maxX - ox) / dx;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMaxLocal = Math.min(tMaxLocal, t2);
      if (tMin > tMaxLocal) return false;
    }

    // Y slab.
    if (Math.abs(dy) < 1e-8) {
      if (oy < minY || oy > maxY) return false;
    } else {
      let t1 = (minY - oy) / dy;
      let t2 = (maxY - oy) / dy;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMaxLocal = Math.min(tMaxLocal, t2);
      if (tMin > tMaxLocal) return false;
    }

    // Z slab.
    if (Math.abs(dz) < 1e-8) {
      if (oz < minZ || oz > maxZ) return false;
    } else {
      let t1 = (minZ - oz) / dz;
      let t2 = (maxZ - oz) / dz;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tMin = Math.max(tMin, t1);
      tMaxLocal = Math.min(tMaxLocal, t2);
      if (tMin > tMaxLocal) return false;
    }

    return true;
  }

  transmit(message: Message, source: GameObject, world: WorldView): ReceivedMessage[] {
    const received: ReceivedMessage[] = [];

    // Collect occluding entities once per transmission (entities marked blocksSound).
    const occluders: GameObject[] = [];
    if (this.occlusionEnabled) {
      for (const e of world.entities) {
        if (e.id === source.id) continue;
        if (e.state.get('blocksSound') === true) {
          occluders.push(e);
        }
      }
    }

    for (const e of world.entities) {
      if (e.id === source.id) continue;
      if (!e.active) continue;

      const d = source.position.distance(e.position);
      let intensity: number;

      if (this.occlusionEnabled && occluders.length > 0) {
        // Exclude the listener itself from occluders (it can't block itself).
        const effectiveOccluders = occluders.filter((o) => o.id !== e.id);
        intensity = this.intensityAtWithOcclusion(
          message.intensity,
          source.position,
          e.position,
          effectiveOccluders,
        );
      } else {
        intensity = this.intensityAt(message.intensity, d);
      }

      if (intensity <= this.minAudible) continue;
      received.push({ original: message, receivedIntensity: intensity, distance: d });
    }
    return received;
  }
}
