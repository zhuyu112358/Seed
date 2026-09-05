import type { WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { World } from "../engine/World.js";
import type { WeatherState } from "../types/index.js";
import type { WeatherSimulator } from "./WeatherSimulator.js";
import type { WorldClock } from "./WorldClock.js";
import { Event } from "./Event.js";

/** Condition that must be met for an event to trigger. */
export interface EventCondition {
  type: "temperature" | "humidity" | "windSpeed" | "pressure" | "weather" | "timeOfDay" | "lightLevel" | "entityCount" | "custom";
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between";
  value: number | string;
  value2?: number;
}

/** Effect applied by an active world event. */
export interface EventEffect {
  type: "applyForce" | "modifyProperty" | "damage" | "heal" | "emitEvent" | "custom";
  target: "all" | "souls" | "dynamicEntities" | "staticEntities";
  parameters: Record<string, unknown>;
}

/** Definition of a world event that can trigger based on conditions. */
export interface WorldEventDefinition {
  id: string;
  type: "weather" | "disaster" | "seasonal" | "biological" | "custom";
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "extreme";
  minDuration: number;
  maxDuration: number;
  cooldown: number;
  conditions: EventCondition[];
  effects: EventEffect[];
}

/** An actively running world event. */
export interface ActiveWorldEvent {
  id: string;
  definitionId: string;
  name: string;
  type: string;
  severity: string;
  startTime: number;
  endTime: number;
  tickCount: number;
  effectsApplied: number;
}

/**
 * Manages world event definitions, condition evaluation, triggering,
 * and active event lifecycle. Events can affect entities and souls at scale.
 */
export class WorldEventSystem implements WorldSystem {
  readonly name = "world-events";
  enabled = true;

  private definitions = new Map<string, WorldEventDefinition>();
  private activeEvents = new Map<string, ActiveWorldEvent>();
  private cooldowns = new Map<string, number>();
  private weather: WeatherSimulator | null = null;
  private clock: WorldClock | null = null;
  private eventsTriggered = 0;

  registerDefinition(def: WorldEventDefinition): void {
    this.definitions.set(def.id, def);
  }

  /** Register all built-in event definitions (wind gust, rain storm, typhoon, cold snap). */
  registerBuiltinEvents(): void {
    this.registerDefinition(WIND_GUST_EVENT);
    this.registerDefinition(RAIN_STORM_EVENT);
    this.registerDefinition(TYPHOON_EVENT);
    this.registerDefinition(COLD_SNAP_EVENT);
  }

  removeDefinition(id: string): boolean { return this.definitions.delete(id); }
  getDefinitions(): WorldEventDefinition[] { return [...this.definitions.values()]; }
  getActiveEvents(): ActiveWorldEvent[] { return [...this.activeEvents.values()]; }
  getEventsTriggered(): number { return this.eventsTriggered; }

  /** Bind to weather and clock systems for condition evaluation. */
  bindSystems(weather: WeatherSimulator, clock: WorldClock): void {
    this.weather = weather;
    this.clock = clock;
  }

  tick(dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;
    const now = world.worldTime;

    // Check trigger conditions for all definitions
    for (const def of this.definitions.values()) {
      if (this.activeEvents.has(def.id)) continue;
      const cooldownEnd = this.cooldowns.get(def.id) ?? 0;
      if (now < cooldownEnd) continue;
      if (this.evaluateConditions(def.conditions, world)) {
        this.triggerEvent(def, now, events, world);
      }
    }

    // Update active events
    for (const [id, active] of this.activeEvents) {
      active.tickCount++;
      if (now >= active.endTime) {
        this.endEvent(id, events);
      } else {
        this.applyEventEffects(active, world, events, dt);
      }
    }
  }

  private evaluateConditions(conditions: EventCondition[], world: World): boolean {
    for (const cond of conditions) {
      const actual = this.getConditionValue(cond.type, world);
      if (actual === null) return false;
      if (!this.compare(actual, cond)) return false;
    }
    return true;
  }

  private getConditionValue(type: EventCondition["type"], world: World): number | string | null {
    switch (type) {
      case "temperature": return this.weather?.temperature ?? null;
      case "humidity": return this.weather?.humidity ?? null;
      case "windSpeed": return this.weather?.windSpeed ?? null;
      case "pressure": return this.weather?.getWeather().pressure ?? null;
      case "weather": return this.weather?.state ?? null;
      case "timeOfDay": return this.clock?.getTimeOfDay() ?? null;
      case "lightLevel": return this.clock?.getLightLevel() ?? null;
      case "entityCount": return world.entities.size;
      default: return null;
    }
  }

  private compare(actual: number | string, cond: EventCondition): boolean {
    const a = typeof actual === "string" ? actual : actual;
    const v = cond.value;
    switch (cond.operator) {
      case "gt": return typeof a === "number" && typeof v === "number" && a > v;
      case "gte": return typeof a === "number" && typeof v === "number" && a >= v;
      case "lt": return typeof a === "number" && typeof v === "number" && a < v;
      case "lte": return typeof a === "number" && typeof v === "number" && a <= v;
      case "eq": return a === v;
      case "neq": return a !== v;
      case "between": return typeof a === "number" && typeof v === "number" && cond.value2 !== undefined && a >= v && a <= cond.value2;
      default: return false;
    }
  }

  private triggerEvent(def: WorldEventDefinition, now: number, events: EventSystem, world: World): void {
    const duration = def.minDuration + Math.random() * (def.maxDuration - def.minDuration);
    const active: ActiveWorldEvent = {
      id: def.id + "-" + Date.now(),
      definitionId: def.id,
      name: def.name,
      type: def.type,
      severity: def.severity,
      startTime: now,
      endTime: now + duration,
      tickCount: 0,
      effectsApplied: 0,
    };
    this.activeEvents.set(def.id, active);
    this.eventsTriggered++;
    events.emit(new Event({
      type: "world.event.start",
      payload: { eventId: active.id, name: def.name, severity: def.severity, duration },
      sourceId: active.id,
    }));

    // Notify SoulPerceptionSystem so nearby souls perceive the event.
    for (const sys of world.systems) {
      if (sys.name === "soul-perception") {
        const perception = sys as unknown as { recordEvent: (id: string, type: string, name: string, severity: string, position: { x: number; y: number; z: number }, affectsSoul?: boolean) => void };
        perception.recordEvent(active.id, def.type, def.name, def.severity, { x: 0, y: 0, z: 0 }, true);
        break;
      }
    }
  }

  private endEvent(id: string, events: EventSystem): void {
    const active = this.activeEvents.get(id);
    if (!active) return;
    const def = this.definitions.get(active.definitionId);
    if (def) this.cooldowns.set(active.definitionId, active.endTime + def.cooldown);
    this.activeEvents.delete(id);
    events.emit(new Event({
      type: "world.event.end",
      payload: { eventId: active.id, name: active.name, tickCount: active.tickCount, effectsApplied: active.effectsApplied },
      sourceId: active.id,
    }));
  }

  private applyEventEffects(active: ActiveWorldEvent, world: World, events: EventSystem, dt: number): void {
    const def = this.definitions.get(active.definitionId);
    if (!def) return;
    for (const effect of def.effects) {
      if (effect.type === "applyForce" && this.weather) {
        const wind = this.weather.windSpeed;
        const dir = this.weather.getWeather().windDirection;
        for (const entity of world.entities.values()) {
          if (effect.target === "staticEntities" && entity.type === "static") continue;
          if (effect.target === "souls" && entity.type !== "soul") continue;
          const force = wind * 0.1 * dt * 60;
          entity.position = entity.position.add({ x: dir.x * force * 0.01, y: 0, z: 0 });
          entity.position = entity.position.add({ x: 0, y: 0, z: dir.z * force * 0.01 });
        }
        active.effectsApplied++;
      } else if (effect.type === "emitEvent") {
        events.emit(new Event({
          type: (effect.parameters.eventType as string) ?? "world.effect",
          payload: { sourceEvent: active.id, ...effect.parameters },
          sourceId: active.id,
        }));
        active.effectsApplied++;
      } else if (effect.type === "modifyProperty") {
        const propKey = effect.parameters.property as string;
        const propValue = effect.parameters.value;
        for (const entity of world.entities.values()) {
          if (effect.target === "souls" && entity.type !== "soul") continue;
          if (effect.target === "dynamicEntities" && entity.type === "static") continue;
          if (effect.target === "staticEntities" && entity.type !== "static") continue;
          entity.state.set(propKey, propValue);
        }
        active.effectsApplied++;
      }
    }
  }

  start(): void { /* no-op */ }
  stop(): void { this.activeEvents.clear(); }
}

// ============================================================================
// Built-in event definitions
// ============================================================================

/** Wind gust event: triggers when wind speed exceeds threshold. */
export const WIND_GUST_EVENT: WorldEventDefinition = {
  id: "wind-gust",
  type: "weather",
  name: "Wind Gust",
  description: "Strong wind gusts push dynamic entities and reduce visibility.",
  severity: "medium",
  minDuration: 10,
  maxDuration: 30,
  cooldown: 60,
  conditions: [{ type: "windSpeed", operator: "gt", value: 10 }],
  effects: [{ type: "applyForce", target: "dynamicEntities", parameters: { forceMultiplier: 1.5 } }],
};

/** Rain storm event: triggers with high humidity and low pressure. */
export const RAIN_STORM_EVENT: WorldEventDefinition = {
  id: "rain-storm",
  type: "weather",
  name: "Rain Storm",
  description: "Heavy rain reduces light, increases humidity, and creates puddles.",
  severity: "medium",
  minDuration: 20,
  maxDuration: 60,
  cooldown: 120,
  conditions: [
    { type: "humidity", operator: "gt", value: 70 },
    { type: "pressure", operator: "lt", value: 1005 },
  ],
  effects: [{ type: "emitEvent", target: "all", parameters: { eventType: "weather.rain", intensity: "heavy" } }],
};

/** Extreme wind event (typhoon-like): very high wind with major force. */
export const TYPHOON_EVENT: WorldEventDefinition = {
  id: "typhoon",
  type: "disaster",
  name: "Typhoon",
  description: "Extreme wind event that violently pushes all entities and can damage structures.",
  severity: "extreme",
  minDuration: 30,
  maxDuration: 90,
  cooldown: 300,
  conditions: [
    { type: "windSpeed", operator: "gt", value: 25 },
    { type: "humidity", operator: "gt", value: 80 },
  ],
  effects: [
    { type: "applyForce", target: "all", parameters: { forceMultiplier: 3.0 } },
    { type: "emitEvent", target: "all", parameters: { eventType: "disaster.typhoon", warning: true } },
  ],
};

/** Cold snap: temperature drops below zero. */
export const COLD_SNAP_EVENT: WorldEventDefinition = {
  id: "cold-snap",
  type: "seasonal",
  name: "Cold Snap",
  description: "Sudden temperature drop below freezing, may cause snow and ice.",
  severity: "high",
  minDuration: 30,
  maxDuration: 120,
  cooldown: 180,
  conditions: [{ type: "temperature", operator: "lt", value: 0 }],
  effects: [{ type: "emitEvent", target: "all", parameters: { eventType: "weather.cold", frost: true } }],
};