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
  /** Enable diffraction (bending around occluder edges). When direct path is
   *  blocked, sound can reach the listener via the nearest occluder corner with
   *  additional attenuation. Default false (backward compatible). */
  diffractionEnabled?: boolean;
  /** Diffraction loss coefficient per radian of deflection angle.
   *  Higher = more muffled sound around corners. Default 0.3. */
  diffractionCoefficient?: number;
  /** Maximum diffraction angle (radians) beyond which sound is fully blocked.
   *  Default PI (180 degrees — sound can bend fully around). */
  maxDiffractionAngle?: number;
}

export class AcousticPropagation implements CommunicationStrategy {
  public readonly medium = 'acoustic';
  private readonly attenuation: number;
  private readonly absorption: number;
  private readonly maxRadius: number;
  private readonly minAudible: number;
  private readonly occlusionEnabled: boolean;
  private readonly occlusionAttenuation: number;
  private readonly diffractionEnabled: boolean;
  private readonly diffractionCoefficient: number;
  private readonly maxDiffractionAngle: number;

  constructor(cfg: AcousticConfig = {}) {
    this.attenuation = cfg.attenuation ?? 0.02;
    this.absorption = cfg.absorption ?? 0.01;
    this.maxRadius = cfg.maxRadius ?? 50;
    this.minAudible = cfg.minAudible ?? 0.05;
    this.occlusionEnabled = cfg.occlusionEnabled ?? true;
    this.occlusionAttenuation = cfg.occlusionAttenuation ?? 0.85;
    this.diffractionEnabled = cfg.diffractionEnabled ?? false;
    this.diffractionCoefficient = cfg.diffractionCoefficient ?? 0.3;
    this.maxDiffractionAngle = cfg.maxDiffractionAngle ?? Math.PI;
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
          if (this.diffractionEnabled) {
            // Direct path blocked — try diffraction around nearest corner.
            const diff = this.computeDiffraction(source, listener, occluder);
            if (diff && diff.deflectionAngle <= this.maxDiffractionAngle) {
              // Diffraction path goes AROUND the occluder, not through it.
              // Apply diffraction loss based on deflection angle + extra distance.
              const diffractionLoss = Math.min(1, this.diffractionCoefficient * diff.deflectionAngle);
              const extraDistance = diff.pathLength - distance;
              const distanceFactor = 1 / (1 + this.attenuation * extraDistance * extraDistance);
              intensity *= (1 - diffractionLoss) * distanceFactor;
            } else {
              // Diffraction not possible — sound leaks through the occluder.
              intensity *= (1 - this.occlusionAttenuation);
            }
          } else {
            // Diffraction disabled — standard occlusion (sound leaks through).
            intensity *= (1 - this.occlusionAttenuation);
          }
          if (intensity <= this.minAudible) return 0;
        }
      }
    }

    return intensity;
  }

  /**
   * Compute the shortest diffraction path around an occluder's corners.
   * Works in the top-down x/z plane (y is height, ignored for corner calculation).
   *
   * @param source Sound source position.
   * @param listener Listener position.
   * @param occluder The blocking entity.
   * @returns Diffraction path info (corner, pathLength, deflectionAngle) or null.
   */
  private computeDiffraction(
    source: { x: number; y: number; z: number },
    listener: { x: number; y: number; z: number },
    occluder: GameObject,
  ): { cornerX: number; cornerZ: number; pathLength: number; deflectionAngle: number } | null {
    const hx = occluder.halfExtents.x;
    const hz = occluder.halfExtents.z;
    const cx = occluder.position.x;
    const cz = occluder.position.z;

    // Four corners of the AABB in top-down x/z plane.
    const corners = [
      { x: cx - hx, z: cz - hz },
      { x: cx + hx, z: cz - hz },
      { x: cx - hx, z: cz + hz },
      { x: cx + hx, z: cz + hz },
    ];

    let bestPath = Infinity;
    let bestCorner = corners[0];

    for (const corner of corners) {
      const d1 = Math.sqrt(
        (source.x - corner.x) ** 2 + (source.z - corner.z) ** 2
      );
      const d2 = Math.sqrt(
        (listener.x - corner.x) ** 2 + (listener.z - corner.z) ** 2
      );
      const pathLength = d1 + d2;
      if (pathLength < bestPath) {
        bestPath = pathLength;
        bestCorner = corner;
      }
    }

    // Calculate deflection angle at the corner.
    // v1 = source - corner (from corner to source), v2 = listener - corner (from corner to listener).
    // When source and listener are on opposite sides (straight path around corner),
    // v1 and v2 point in opposite directions (cornerAngle = PI), deflection = 0.
    // When the path bends sharply, cornerAngle decreases, deflection increases.
    const v1x = source.x - bestCorner.x;
    const v1z = source.z - bestCorner.z;
    const v2x = listener.x - bestCorner.x;
    const v2z = listener.z - bestCorner.z;

    const len1 = Math.sqrt(v1x * v1x + v1z * v1z);
    const len2 = Math.sqrt(v2x * v2x + v2z * v2z);

    if (len1 < 1e-6 || len2 < 1e-6) return null;

    const dot = (v1x * v2x + v1z * v2z) / (len1 * len2);
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const cornerAngle = Math.acos(clampedDot);
    // Deflection = how much the path bends from a straight line through the corner.
    const deflectionAngle = Math.PI - cornerAngle;

    return {
      cornerX: bestCorner.x,
      cornerZ: bestCorner.z,
      pathLength: bestPath,
      deflectionAngle,
    };
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
