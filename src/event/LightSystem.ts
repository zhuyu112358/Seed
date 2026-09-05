// LightSystem: dynamic lighting with point lights, directional sun/moon light,
// illumination calculation, and entity visibility. Integrates with WorldClock
// for day-night cycle. Requirement 11 (realism approximation).

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { Entity } from "../entity/Entity.js";
import { Vector3 } from "../entity/Vector3.js";
import { Event } from "./Event.js";
import { Logger } from "../reliability/Logger.js";

/** RGB color, each channel 0-1. */
export interface LightColor {
  r: number;
  g: number;
  b: number;
}

/** Configuration for a point light source. */
export interface PointLightConfig {
  id: string;
  position: { x: number; y: number; z: number };
  /** Light intensity 0-1. Default 1. */
  intensity?: number;
  /** Light color RGB 0-1. Default white. */
  color?: LightColor;
  /** Attenuation radius in metres. Light falls off to zero at this distance. Default 10. */
  radius?: number;
  /** Whether the light is initially enabled. Default true. */
  enabled?: boolean;
}

/** A point light source with position, intensity, color, and attenuation radius. */
export class PointLight {
  readonly id: string;
  position: Vector3;
  intensity: number;
  color: LightColor;
  radius: number;
  enabled: boolean;

  constructor(config: PointLightConfig) {
    this.id = config.id;
    this.position = new Vector3(config.position.x, config.position.y, config.position.z);
    this.intensity = config.intensity ?? 1;
    this.color = config.color ?? { r: 1, g: 1, b: 1 };
    this.radius = config.radius ?? 10;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Calculate light contribution at a given point.
   * Uses inverse-square falloff clamped to [0, radius], normalized so that
   * at distance 0 contribution = intensity, at distance = radius contribution = 0.
   */
  contributionAt(point: Vector3): number {
    if (!this.enabled || this.intensity <= 0) return 0;
    const dist = this.position.distance(point);
    if (dist >= this.radius) return 0;
    // Smooth falloff: (1 - dist/radius)^2 * intensity
    const t = 1 - dist / this.radius;
    return t * t * this.intensity;
  }

  /** Get light color contribution (RGB) at a point, scaled by contribution. */
  colorAt(point: Vector3): LightColor {
    const c = this.contributionAt(point);
    return {
      r: this.color.r * c,
      g: this.color.g * c,
      b: this.color.b * c,
    };
  }
}

/** Configuration for the LightSystem. */
export interface LightSystemConfig {
  /** Base ambient light intensity 0-1, independent of time of day. Default 0.08. */
  ambientIntensity?: number;
  /** Whether to use WorldClock for directional sun/moon light. Default true. */
  useClockDirectionalLight?: boolean;
  /** Maximum number of point lights. Default 128. */
  maxLights?: number;
  /** Minimum illumination threshold for an entity to be considered "visible". Default 0.05. */
  visibilityThreshold?: number;
}

const DEFAULT_CONFIG: Required<LightSystemConfig> = {
  ambientIntensity: 0.08,
  useClockDirectionalLight: true,
  maxLights: 128,
  visibilityThreshold: 0.05,
};

/**
 * Manages dynamic lighting in the world. Supports point lights with attenuation,
 * directional sun/moon light tied to WorldClock, ambient light, illumination
 * calculation at arbitrary points, and entity visibility computation.
 *
 * Emits `light.changed` events when lights are added, removed, or modified.
 */
export class LightSystem implements WorldSystem {
  readonly name = "light";
  enabled = true;

  private readonly config: Required<LightSystemConfig>;
  private readonly lights = new Map<string, PointLight>();
  private clock: { getLightLevel: () => number; getTimeOfDay: () => number } | null = null;
  private readonly logger = Logger.for("LightSystem");
  private lightsAdded = 0;
  private lightsRemoved = 0;

  constructor(config?: LightSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Bind to WorldClock for directional sun/moon light intensity. */
  bindClock(clock: { getLightLevel: () => number; getTimeOfDay: () => number }): void {
    this.clock = clock;
  }

  // ---- Point light management ----

  /** Add a point light. Returns false if capacity reached or ID already exists. */
  addLight(config: PointLightConfig, events?: EventSystem): PointLight | null {
    if (this.lights.has(config.id)) {
      this.logger.warn(`light id already exists: ${config.id}`);
      return null;
    }
    if (this.lights.size >= this.config.maxLights) {
      this.logger.warn(`max lights reached (${this.config.maxLights}), cannot add ${config.id}`);
      return null;
    }
    const light = new PointLight(config);
    this.lights.set(light.id, light);
    this.lightsAdded++;
    if (events) this.emitChanged(events, "add", light.id);
    return light;
  }

  /** Remove a point light by ID. Returns true if found and removed. */
  removeLight(id: string, events?: EventSystem): boolean {
    const light = this.lights.get(id);
    if (!light) return false;
    this.lights.delete(id);
    this.lightsRemoved++;
    if (events) this.emitChanged(events, "remove", id);
    return true;
  }

  /** Get a point light by ID. */
  getLight(id: string): PointLight | undefined {
    return this.lights.get(id);
  }

  /** Get all point lights. */
  getAllLights(): PointLight[] {
    return [...this.lights.values()];
  }

  /** Get enabled point lights only. */
  getEnabledLights(): PointLight[] {
    return [...this.lights.values()].filter(l => l.enabled);
  }

  // ---- Illumination calculation ----

  /**
   * Calculate total illumination at a point (0-1).
   * Total = ambient + directional (sun/moon) + sum of point light contributions.
   * Clamped to [0, 1].
   */
  getIlluminationAt(point: Vector3): number {
    let total = this.config.ambientIntensity;

    // Directional light from WorldClock (sun/moon).
    if (this.config.useClockDirectionalLight && this.clock) {
      total += this.clock.getLightLevel();
    }

    // Point light contributions.
    for (const light of this.lights.values()) {
      total += light.contributionAt(point);
    }

    return Math.min(1, Math.max(0, total));
  }

  /**
   * Calculate total colored illumination (RGB) at a point.
   * Each channel 0-1. Ambient and directional light are white.
   */
  getColoredIlluminationAt(point: Vector3): LightColor {
    let r = this.config.ambientIntensity;
    let g = this.config.ambientIntensity;
    let b = this.config.ambientIntensity;

    // Directional light is white.
    if (this.config.useClockDirectionalLight && this.clock) {
      const dl = this.clock.getLightLevel();
      r += dl; g += dl; b += dl;
    }

    // Point light colored contributions.
    for (const light of this.lights.values()) {
      if (!light.enabled) continue;
      const c = light.colorAt(point);
      r += c.r; g += c.g; b += c.b;
    }

    return {
      r: Math.min(1, Math.max(0, r)),
      g: Math.min(1, Math.max(0, g)),
      b: Math.min(1, Math.max(0, b)),
    };
  }

  /**
   * Calculate visibility of an entity (0-1) based on illumination at its position.
   * Returns 0 if illumination is below visibilityThreshold, 1 if fully lit.
   */
  getEntityVisibility(entity: Entity): number {
    const illum = this.getIlluminationAt(entity.position);
    if (illum <= this.config.visibilityThreshold) return 0;
    // Linear ramp from threshold to 1.
    const range = 1 - this.config.visibilityThreshold;
    return Math.min(1, (illum - this.config.visibilityThreshold) / range);
  }

  /** Get directional (sun/moon) light intensity from WorldClock, or 0 if not bound. */
  getDirectionalIntensity(): number {
    if (this.config.useClockDirectionalLight && this.clock) {
      return this.clock.getLightLevel();
    }
    return 0;
  }

  // ---- WorldSystem interface ----

  tick(_dt: number, _world: World, _events: EventSystem): void {
    // LightSystem is primarily query-driven; no per-tick state changes needed.
    // Directional light is computed on-demand from WorldClock.
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }

  // ---- Stats ----

  getStats(): {
    totalLights: number;
    enabledLights: number;
    ambientIntensity: number;
    directionalIntensity: number;
    maxLights: number;
    lightsAdded: number;
    lightsRemoved: number;
    visibilityThreshold: number;
  } {
    return {
      totalLights: this.lights.size,
      enabledLights: this.getEnabledLights().length,
      ambientIntensity: this.config.ambientIntensity,
      directionalIntensity: this.getDirectionalIntensity(),
      maxLights: this.config.maxLights,
      lightsAdded: this.lightsAdded,
      lightsRemoved: this.lightsRemoved,
      visibilityThreshold: this.config.visibilityThreshold,
    };
  }

  // ---- Internal ----

  private emitChanged(events: EventSystem, action: "add" | "remove" | "modify", lightId: string): void {
    events.emit(new Event({
      type: "light.changed",
      payload: { action, lightId, totalLights: this.lights.size },
      sourceId: lightId,
    }));
  }
}
