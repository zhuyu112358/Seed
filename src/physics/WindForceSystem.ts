// WindForceSystem: applies wind forces from WeatherSimulator to dynamic bodies.
//
// This system bridges the weather simulation (event layer) with the physics
// simulation (physics layer). Every tick it reads the current wind speed and
// direction from an attached WeatherSimulator and applies a proportional force
// to each dynamic, non-static body. Force magnitude scales with wind speed and
// the body's approximate cross-sectional area (AABB x-z footprint), and is
// inversely proportional to mass.
//
// This is a v0.1 reference implementation. Future improvements: turbulence,
// gusts, wind shadowing by obstacles, lift/aerodynamic shapes.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { WeatherSimulator } from "../event/WeatherSimulator.js";
import { Vector3 } from "../entity/Vector3.js";
import type { GameObject } from "../entity/Entity.js";

export interface WindForceConfig {
  /** Global multiplier for wind force. Default 0.5. */
  forceCoefficient?: number;
  /** Minimum wind speed (m/s) that produces any force. Default 0.5. */
  minEffectiveSpeed?: number;
  /** If true, soul-type bodies are also affected. Default false. */
  affectSouls?: boolean;
}

const DEFAULT_CONFIG: Required<WindForceConfig> = {
  forceCoefficient: 0.5,
  minEffectiveSpeed: 0.5,
  affectSouls: false,
};

export class WindForceSystem implements WorldSystem {
  readonly name = "wind-force";
  enabled = true;

  private readonly config: Required<WindForceConfig>;
  private weather: WeatherSimulator | null = null;
  private lastWindSpeed = 0;
  private bodiesAffected = 0;

  constructor(config?: WindForceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Total bodies affected by wind in the last tick. */
  get affectedCount(): number { return this.bodiesAffected; }
  /** Wind speed read in the last tick. */
  get currentWindSpeed(): number { return this.lastWindSpeed; }

  tick(dt: number, world: World, _events: EventSystem): void {
    // Locate WeatherSimulator among world systems (lazy cache).
    if (!this.weather || !world.systems.includes(this.weather)) {
      this.weather = world.systems.find(s => s instanceof WeatherSimulator) as WeatherSimulator | null ?? null;
    }
    if (!this.weather) return;

    const weather = this.weather.getWeather();
    this.lastWindSpeed = weather.windSpeed;
    if (weather.windSpeed < this.config.minEffectiveSpeed) {
      this.bodiesAffected = 0;
      return;
    }

    // Normalize wind direction (should already be unit, but guard).
    const dir = weather.windDirection;
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (len < 0.001) { this.bodiesAffected = 0; return; }
    const nx = dir.x / len, ny = dir.y / len, nz = dir.z / len;

    let affected = 0;
    for (const entity of world.entities.values()) {
      const body = entity as GameObject;
      if (!body.active) continue;
      if (body.type === "static" || body.type === "trigger" || body.type === "area") continue;
      if (body.type === "soul" && !this.config.affectSouls) continue;
      if (!body.mass || body.mass <= 0 || !Number.isFinite(body.mass)) continue;

      // Approximate cross-sectional area from AABB x-z footprint.
      const mn = body.aabbMin(), mx = body.aabbMax();
      const area = Math.max(0.1, (mx.x - mn.x) * (mx.z - mn.z));

      // Force = windSpeed^2 * coefficient * area / mass (simplified drag model).
      const forceMag = weather.windSpeed * weather.windSpeed * this.config.forceCoefficient * area / body.mass;
      const dvx = nx * forceMag * dt;
      const dvy = ny * forceMag * dt;
      const dvz = nz * forceMag * dt;

      body.velocity = new Vector3(
        body.velocity.x + dvx,
        body.velocity.y + dvy,
        body.velocity.z + dvz,
      );
      affected++;
    }
    this.bodiesAffected = affected;
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}