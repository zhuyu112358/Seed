import type { WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { World } from "../engine/World.js";

/** Configuration for the world clock / day-night cycle. */
export interface ClockConfig {
  dayLengthSeconds?: number;
  startTime?: number;
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<ClockConfig> = {
  dayLengthSeconds: 120,
  startTime: 0.25,
  enabled: true,
};

/**
 * Simulates day-night cycle. Tracks time of day (0-1), calculates
 * light level, and emits sunrise/sunset/noon/midnight events.
 */
export class WorldClock implements WorldSystem {
  readonly name = "clock";
  enabled = true;

  private timeOfDay: number;
  private readonly dayLength: number;
  private lastPhase: "dawn" | "day" | "dusk" | "night" = "day";

  constructor(config?: ClockConfig) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.dayLength = cfg.dayLengthSeconds;
    this.timeOfDay = cfg.startTime % 1;
    this.enabled = cfg.enabled;
  }

  getTimeOfDay(): number { return this.timeOfDay; }
  getDayLength(): number { return this.dayLength; }

  /** Calculate light level (0-1) based on time of day. */
  getLightLevel(): number {
    // Sin curve: peak at 0.25 (noon), minimum at 0.75 (midnight)
    const angle = this.timeOfDay * Math.PI * 2;
    const raw = Math.sin(angle) * 0.5 + 0.5;
    // Add ambient minimum light
    return Math.max(0.05, raw * 0.95 + 0.05);
  }

  getPhase(): "dawn" | "day" | "dusk" | "night" {
    if (this.timeOfDay >= 0.2 && this.timeOfDay < 0.3) return "dawn";
    if (this.timeOfDay >= 0.3 && this.timeOfDay < 0.7) return "day";
    if (this.timeOfDay >= 0.7 && this.timeOfDay < 0.8) return "dusk";
    return "night";
  }

  tick(dt: number, _world: World, events: EventSystem): void {
    if (!this.enabled) return;
    this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1;

    const phase = this.getPhase();
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      events.emit({
        id: "clock-phase-" + Date.now(),
        type: "clock.phaseChange",
        timestamp: Date.now(),
        data: { phase, timeOfDay: this.timeOfDay, lightLevel: this.getLightLevel() },
      } as never);
    }
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}