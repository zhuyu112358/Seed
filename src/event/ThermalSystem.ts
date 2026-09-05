// ThermalSystem: heat simulation with heat sources, environmental temperature,
// Newton's law of cooling, inter-entity heat conduction, and temperature events.
// Integrates with WeatherSimulator for ambient temperature. Requirement 11 (realism).

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { Entity } from "../entity/Entity.js";
import { Vector3 } from "../entity/Vector3.js";
import { Event } from "./Event.js";
import { Logger } from "../reliability/Logger.js";

/** Configuration for a heat source. */
export interface HeatSourceConfig {
  id: string;
  position: { x: number; y: number; z: number };
  /** Heat intensity in arbitrary units (temperature contribution at distance 0). Default 50. */
  intensity?: number;
  /** Effective radius in metres. Heat falls off to zero at this distance. Default 8. */
  radius?: number;
  /** Whether the source is initially enabled. Default true. */
  enabled?: boolean;
}

/** A heat source with position, intensity, radius, and enabled state. */
export class HeatSource {
  readonly id: string;
  position: Vector3;
  intensity: number;
  radius: number;
  enabled: boolean;

  constructor(config: HeatSourceConfig) {
    this.id = config.id;
    this.position = new Vector3(config.position.x, config.position.y, config.position.z);
    this.intensity = config.intensity ?? 50;
    this.radius = config.radius ?? 8;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Calculate heat contribution at a point.
   * Inverse-square normalized falloff: (1 - dist/radius)^2 * intensity.
   */
  contributionAt(point: Vector3): number {
    if (!this.enabled || this.intensity <= 0) return 0;
    const dist = this.position.distance(point);
    if (dist >= this.radius) return 0;
    const t = 1 - dist / this.radius;
    return t * t * this.intensity;
  }
}

/** Configuration for the ThermalSystem. */
export interface ThermalSystemConfig {
  /** Default environmental temperature in Celsius if WeatherSimulator is not bound. Default 20. */
  defaultAmbientTemperature?: number;
  /** Heat transfer coefficient for Newton's law of cooling (higher = faster equilibration). Default 0.02. */
  coolingCoefficient?: number;
  /** Whether to simulate inter-entity heat conduction. Default true. */
  enableConduction?: boolean;
  /** Maximum distance for inter-entity heat conduction in metres. Default 2. */
  conductionRange?: number;
  /** Thermal conductivity factor for inter-entity conduction. Default 0.01. */
  conductionFactor?: number;
  /** Maximum number of heat sources. Default 64. */
  maxHeatSources?: number;
  /** Hot threshold in Celsius for thermal.hot events. Default 60. */
  hotThreshold?: number;
  /** Cold threshold in Celsius for thermal.cold events. Default 0. */
  coldThreshold?: number;
  /** Minimum simulation timestep in seconds (clamps dt to avoid instability). Default 0.1. */
  maxDt?: number;
}

const DEFAULT_CONFIG: Required<ThermalSystemConfig> = {
  defaultAmbientTemperature: 20,
  coolingCoefficient: 0.02,
  enableConduction: true,
  conductionRange: 2,
  conductionFactor: 0.01,
  maxHeatSources: 64,
  hotThreshold: 60,
  coldThreshold: 0,
  maxDt: 0.1,
};

/**
 * Simulates heat and temperature in the world. Manages heat sources,
 * environmental temperature (from WeatherSimulator), Newton's law of cooling
 * for entity-environment heat exchange, and inter-entity heat conduction.
 *
 * Entity temperature is stored in entity.state as "temperature" (Celsius).
 * Material properties are read from entity.properties:
 *   - thermalConductivity: how well the entity conducts heat (default 0.1)
 *   - heatCapacity: how much heat is needed to change temperature (default 1.0)
 *
 * Emits thermal.hot / thermal.cold / thermal.normalized events when entity
 * temperatures cross thresholds.
 */
export class ThermalSystem implements WorldSystem {
  readonly name = "thermal";
  enabled = true;

  private readonly config: Required<ThermalSystemConfig>;
  private readonly heatSources = new Map<string, HeatSource>();
  private weather: { temperature: number } | null = null;
  private readonly logger = Logger.for("ThermalSystem");
  private readonly previousStates = new Map<string, "cold" | "normal" | "hot">();
  private heatSourcesAdded = 0;
  private heatSourcesRemoved = 0;
  private entitiesHeated = 0;

  constructor(config?: ThermalSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Bind to WeatherSimulator for environmental temperature. */
  bindWeather(weather: { temperature: number }): void {
    this.weather = weather;
  }

  // ---- Heat source management ----

  /** Add a heat source. Returns null if capacity reached or ID already exists. */
  addHeatSource(config: HeatSourceConfig, events?: EventSystem): HeatSource | null {
    if (this.heatSources.has(config.id)) {
      this.logger.warn(`heat source id already exists: ${config.id}`);
      return null;
    }
    if (this.heatSources.size >= this.config.maxHeatSources) {
      this.logger.warn(`max heat sources reached (${this.config.maxHeatSources}), cannot add ${config.id}`);
      return null;
    }
    const source = new HeatSource(config);
    this.heatSources.set(source.id, source);
    this.heatSourcesAdded++;
    if (events) this.emitChanged(events, "add", source.id);
    return source;
  }

  /** Remove a heat source by ID. Returns true if found and removed. */
  removeHeatSource(id: string, events?: EventSystem): boolean {
    const source = this.heatSources.get(id);
    if (!source) return false;
    this.heatSources.delete(id);
    this.heatSourcesRemoved++;
    if (events) this.emitChanged(events, "remove", id);
    return true;
  }

  /** Get a heat source by ID. */
  getHeatSource(id: string): HeatSource | undefined {
    return this.heatSources.get(id);
  }

  /** Get all heat sources. */
  getAllHeatSources(): HeatSource[] {
    return [...this.heatSources.values()];
  }

  // ---- Temperature queries ----

  /**
   * Get ambient temperature at a point (Celsius).
   * = environmental temperature + sum of heat source contributions.
   */
  getTemperatureAt(point: Vector3): number {
    let temp = this.getAmbientTemperature();
    for (const source of this.heatSources.values()) {
      temp += source.contributionAt(point);
    }
    return temp;
  }

  /** Get current environmental (ambient) temperature from WeatherSimulator or default. */
  getAmbientTemperature(): number {
    return this.weather?.temperature ?? this.config.defaultAmbientTemperature;
  }

  /** Get an entity's current temperature from its state. Returns undefined if not yet simulated. */
  getEntityTemperature(entity: Entity): number | undefined {
    const t = entity.state.get("temperature");
    return typeof t === "number" ? t : undefined;
  }

  /**
   * Set an entity's temperature directly (e.g., for initialization or external effects).
   * Does not trigger threshold events; use during setup.
   */
  setEntityTemperature(entity: Entity, temperature: number): void {
    entity.state.set("temperature", temperature);
  }

  // ---- WorldSystem interface ----

  tick(dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;
    // Clamp dt to avoid numerical instability.
    const step = Math.min(dt, this.config.maxDt);
    const ambient = this.getAmbientTemperature();

    // Collect all entities with positions.
    const entities = [...world.entities.values()].filter(e => e.position && e.active);

    // Phase 1: heat source radiation + Newton cooling for each entity.
    for (const entity of entities) {
      const currentTemp = this.getEntityTemperature(entity) ?? ambient;
      const heatAtPoint = this.getTemperatureAt(entity.position);

      // Newton's law of cooling: dT/dt = -k * (T - T_env)
      // T_env here includes heat sources (local ambient at entity position).
      // Conductivity is not applied here (surface exchange); it applies to inter-entity conduction.
      const delta = heatAtPoint - currentTemp;
      const heatCapacity = this.getHeatCapacity(entity);
      const rate = this.config.coolingCoefficient / heatCapacity;
      const newTemp = currentTemp + delta * rate * step;

      entity.state.set("temperature", newTemp);
      this.entitiesHeated++;

      // Check threshold events.
      this.checkThresholdEvents(entity, newTemp, events);
    }

    // Phase 2: inter-entity heat conduction (nearby entities exchange heat).
    if (this.config.enableConduction && entities.length > 1) {
      this.applyConduction(entities, step);
    }
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }

  // ---- Stats ----

  getStats(): {
    totalHeatSources: number;
    enabledHeatSources: number;
    ambientTemperature: number;
    maxHeatSources: number;
    heatSourcesAdded: number;
    heatSourcesRemoved: number;
    entitiesHeated: number;
    coolingCoefficient: number;
    conductionEnabled: boolean;
  } {
    return {
      totalHeatSources: this.heatSources.size,
      enabledHeatSources: [...this.heatSources.values()].filter(s => s.enabled).length,
      ambientTemperature: this.getAmbientTemperature(),
      maxHeatSources: this.config.maxHeatSources,
      heatSourcesAdded: this.heatSourcesAdded,
      heatSourcesRemoved: this.heatSourcesRemoved,
      entitiesHeated: this.entitiesHeated,
      coolingCoefficient: this.config.coolingCoefficient,
      conductionEnabled: this.config.enableConduction,
    };
  }

  // ---- Internal ----

  /** Get thermal conductivity from entity properties, default 0.1. */
  private getThermalConductivity(entity: Entity): number {
    const v = entity.properties.get("thermalConductivity");
    return typeof v === "number" ? v : 0.1;
  }

  /** Get heat capacity from entity properties, default 1.0. */
  private getHeatCapacity(entity: Entity): number {
    const v = entity.properties.get("heatCapacity");
    return typeof v === "number" ? v : 1.0;
  }

  /** Apply inter-entity heat conduction between nearby entities. */
  private applyConduction(entities: Entity[], step: number): void {
    const range = this.config.conductionRange;
    const factor = this.config.conductionFactor;
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        const dist = a.position.distance(b.position);
        if (dist >= range) continue;

        const tempA = this.getEntityTemperature(a) ?? this.getAmbientTemperature();
        const tempB = this.getEntityTemperature(b) ?? this.getAmbientTemperature();
        const delta = tempB - tempA;
        if (Math.abs(delta) < 0.001) continue;

        // Heat flows from hot to cold; rate proportional to conductivity of both and inverse distance.
        const condA = this.getThermalConductivity(a);
        const condB = this.getThermalConductivity(b);
        const capA = this.getHeatCapacity(a);
        const capB = this.getHeatCapacity(b);
        const distanceFactor = 1 - dist / range; // linear falloff within range
        const transfer = delta * factor * Math.min(condA, condB) * distanceFactor * step;

        const newA = tempA + transfer / capA;
        const newB = tempB - transfer / capB;
        a.state.set("temperature", newA);
        b.state.set("temperature", newB);
      }
    }
  }

  /** Check and emit thermal threshold events for an entity. */
  private checkThresholdEvents(entity: Entity, temp: number, events: EventSystem): void {
    let current: "cold" | "normal" | "hot";
    if (temp >= this.config.hotThreshold) current = "hot";
    else if (temp <= this.config.coldThreshold) current = "cold";
    else current = "normal";

    const previous = this.previousStates.get(entity.id);
    if (previous !== current) {
      this.previousStates.set(entity.id, current);
      const eventType = current === "hot" ? "thermal.hot" : current === "cold" ? "thermal.cold" : "thermal.normalized";
      events.emit(new Event({
        type: eventType,
        payload: { entityId: entity.id, temperature: temp, previousState: previous ?? "normal" },
        sourceId: entity.id,
      }));
    }
  }

  private emitChanged(events: EventSystem, action: "add" | "remove", sourceId: string): void {
    events.emit(new Event({
      type: "thermal.source-changed",
      payload: { action, sourceId, totalSources: this.heatSources.size },
      sourceId,
    }));
  }
}
