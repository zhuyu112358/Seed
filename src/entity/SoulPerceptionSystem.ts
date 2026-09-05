// SoulPerceptionSystem: generates PerceptionFrame for every soul each tick.
//
// This is the core bridge between the virtual world and the souls inhabiting
// it. Every tick it gathers what each soul can perceive: visible entities,
// nearby souls, environmental conditions, recent world events, and audible
// communications. Frames are stored in a ring buffer and can be retrieved
// by soul ID for delivery to the SoulArena backend.
//
// Corresponds to SOUL_INTERFACE.md section 6.1 (PerceptionFrame).
// Future improvements: field-of-view cone, occlusion by obstacles, attention
// filtering, sensory modality-specific thresholds.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { WeatherSimulator } from "../event/WeatherSimulator.js";
import { Vector3 } from "../entity/Vector3.js";
import type { GameObject } from "../entity/Entity.js";
import type {
  CommunicationMessage,
  EntityType,
  PerceptionFrame,
  WeatherState,
} from "../types/index.js";

export interface SoulPerceptionConfig {
  /** Maximum distance for entity visibility. Default 30. */
  viewDistance?: number;
  /** Maximum visible entities returned per frame. Default 20. */
  maxVisibleEntities?: number;
  /** How many ticks a communication stays perceivable. Default 300 (5s @60fps). */
  commRetentionTicks?: number;
  /** How many ticks an event stays perceivable. Default 600 (10s @60fps). */
  eventRetentionTicks?: number;
}

const DEFAULT_CONFIG: Required<SoulPerceptionConfig> = {
  viewDistance: 30,
  maxVisibleEntities: 20,
  commRetentionTicks: 300,
  eventRetentionTicks: 600,
};

interface BufferedEvent {
  id: string;
  type: string;
  name: string;
  severity: string;
  position: { x: number; y: number; z: number };
  bornTick: number;
  affectsSoul: boolean;
}

interface BufferedCommunication {
  message: CommunicationMessage;
  bornTick: number;
}

export class SoulPerceptionSystem implements WorldSystem {
  readonly name = "soul-perception";
  enabled = true;

  private readonly config: Required<SoulPerceptionConfig>;
  private weather: WeatherSimulator | null = null;
  private readonly frames = new Map<string, PerceptionFrame>();
  private readonly eventBuffer: BufferedEvent[] = [];
  private readonly commBuffer: BufferedCommunication[] = [];
  private currentTick = 0;
  private soulsPerceived = 0;

  constructor(config?: SoulPerceptionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get the latest perception frame for a soul. */
  getPerception(soulId: string): PerceptionFrame | undefined {
    return this.frames.get(soulId);
  }

  /** Get all latest perception frames. */
  getAllPerceptions(): ReadonlyMap<string, PerceptionFrame> {
    return this.frames;
  }

  /** Record a communication message for perception. */
  recordCommunication(message: CommunicationMessage): void {
    this.commBuffer.push({ message, bornTick: this.currentTick });
    if (this.commBuffer.length > 100) this.commBuffer.shift();
  }

  /** Record a world event for perception. */
  recordEvent(
    id: string,
    type: string,
    name: string,
    severity: string,
    position: { x: number; y: number; z: number },
    affectsSoul = true,
  ): void {
    this.eventBuffer.push({ id, type, name, severity, position, bornTick: this.currentTick, affectsSoul });
    if (this.eventBuffer.length > 100) this.eventBuffer.shift();
  }

  /** Number of souls perceived in the last tick. */
  get perceivedSoulCount(): number { return this.soulsPerceived; }

  tick(dt: number, world: World, _events: EventSystem): void {
    this.currentTick = world.tick;

    // Lazy-locate WeatherSimulator.
    if (!this.weather || !world.systems.includes(this.weather)) {
      this.weather = world.systems.find(s => s instanceof WeatherSimulator) as WeatherSimulator | null ?? null;
    }

    // Expire old buffers.
    this.expireBuffers();

    // Gather environment data once for all souls.
    const env = this.gatherEnvironment();

    // Find all soul entities.
    const souls: GameObject[] = [];
    const allEntities: GameObject[] = [];
    for (const entity of world.entities.values()) {
      const body = entity as GameObject;
      if (!body.active) continue;
      allEntities.push(body);
      if (body.type === "soul") souls.push(body);
    }

    this.soulsPerceived = souls.length;

    // Generate a frame for each soul.
    for (const soul of souls) {
      const soulId = soul.id.replace(/^soul_/, "");
      const frame = this.buildFrame(soulId, soul, allEntities, souls, env, world);
      this.frames.set(soul.id, frame);
    }
  }

  private buildFrame(
    soulId: string,
    soul: GameObject,
    allEntities: GameObject[],
    allSouls: GameObject[],
    env: PerceptionFrame["environment"],
    world: World,
  ): PerceptionFrame {
    const pos = soul.position;

    // Visible entities: within view distance, sorted by distance, capped.
    const visible = allEntities
      .filter(e => e.id !== soul.id && e.type !== "soul")
      .map(e => ({ entity: e, dist: pos.distance(e.position) }))
      .filter(x => x.dist <= this.config.viewDistance)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, this.config.maxVisibleEntities)
      .map(x => ({
        id: x.entity.id,
        name: x.entity.name,
        type: x.entity.type as EntityType,
        position: { x: x.entity.position.x, y: x.entity.position.y, z: x.entity.position.z },
        distance: Math.round(x.dist * 100) / 100,
        visible: true,
      }));

    // Nearby souls: other souls within view distance.
    const nearbySouls = allSouls
      .filter(s => s.id !== soul.id)
      .map(s => ({ soul: s, dist: pos.distance(s.position) }))
      .filter(x => x.dist <= this.config.viewDistance)
      .sort((a, b) => a.dist - b.dist)
      .map(x => ({
        id: x.soul.id.replace(/^soul_/, ""),
        name: x.soul.name,
        element: (x.soul.material ?? "unknown") as string,
        position: { x: x.soul.position.x, y: x.soul.position.y, z: x.soul.position.z },
        distance: Math.round(x.dist * 100) / 100,
      }));

    // Recent events within range.
    const events = this.eventBuffer
      .map(e => ({ ...e, dist: pos.distance(e.position) }))
      .filter(e => e.dist <= this.config.viewDistance * 2)
      .slice(-10)
      .map(e => ({
        id: e.id,
        type: e.type,
        name: e.name,
        severity: e.severity,
        distance: Math.round(e.dist * 100) / 100,
        affectsSoul: e.affectsSoul,
      }));

    // Recent communications (audible within range).
    const communications = this.commBuffer
      .map(c => ({ ...c, dist: pos.distance(c.message.position) }))
      .filter(c => c.dist <= this.config.viewDistance * 1.5)
      .slice(-10)
      .map(c => c.message);

    return {
      soulId,
      timestamp: Date.now(),
      worldTime: world.worldTime,
      position: { x: pos.x, y: pos.y, z: pos.z },
      visibleEntities: visible,
      nearbySouls,
      environment: env,
      events,
      communications,
    };
  }

  private gatherEnvironment(): PerceptionFrame["environment"] {
    if (this.weather) {
      const w = this.weather.getWeather();
      return {
        temperature: Math.round(w.temperature * 10) / 10,
        pressure: Math.round(w.pressure),
        humidity: Math.round(w.humidity),
        windSpeed: Math.round(w.windSpeed * 10) / 10,
        windDirection: { x: w.windDirection.x, y: w.windDirection.y, z: w.windDirection.z },
        lightLevel: Math.round(w.lightLevel * 100) / 100,
        weather: w.state as WeatherState,
        timeOfDay: 0,
      };
    }
    return {
      temperature: 20, pressure: 1013, humidity: 50, windSpeed: 0,
      windDirection: { x: 1, y: 0, z: 0 }, lightLevel: 0.8,
      weather: "clear" as WeatherState, timeOfDay: 0,
    };
  }

  private expireBuffers(): void {
    const cutoffComm = this.currentTick - this.config.commRetentionTicks;
    const cutoffEvent = this.currentTick - this.config.eventRetentionTicks;
    while (this.commBuffer.length > 0 && this.commBuffer[0].bornTick < cutoffComm) {
      this.commBuffer.shift();
    }
    while (this.eventBuffer.length > 0 && this.eventBuffer[0].bornTick < cutoffEvent) {
      this.eventBuffer.shift();
    }
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}