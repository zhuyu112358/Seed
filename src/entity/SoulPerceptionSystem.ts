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
import { LightSystem } from "../event/LightSystem.js";
import { ThermalSystem } from "../event/ThermalSystem.js";
import type { HarvestSystem } from "../resource/HarvestSystem.js";
import {
  EcosystemSpawnEvent,
  EcosystemDepletedEvent,
  EcosystemRemovedEvent,
  EcosystemZoneChangedEvent,
} from "../ecosystem/EcosystemSystem.js";
import {
  TaskAvailableEvent,
  TaskAcceptedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskStatusChangedEvent,
} from "../task/TaskEvents.js";
import {
  NarrativeStartedEvent,
  NarrativeNodeEnteredEvent,
  NarrativeNodeExitedEvent,
  NarrativeBranchEvent,
  NarrativeCompletedEvent,
} from "../narrative/NarrativeEvents.js";
import {
  EntityArrivedEvent,
  CollisionEvent,
  CollisionEnterEvent,
  CollisionExitEvent,
  TriggerEnterEvent,
  TriggerExitEvent,
  PathReplannedEvent,
  WeatherEvent,
  HarvestCompleteEvent,
  ResourceDepletedEvent,
  CraftCompleteEvent,
} from "../event/Event.js";
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
  /** Maximum distance for perceiving nearby heat sources and lights. Default 15. */
  sensoryRange?: number;
  /** Maximum nearby heat sources/lights returned per frame. Default 8. */
  maxNearbySensory?: number;
}

const DEFAULT_CONFIG: Required<SoulPerceptionConfig> = {
  viewDistance: 30,
  maxVisibleEntities: 20,
  commRetentionTicks: 300,
  eventRetentionTicks: 600,
  sensoryRange: 15,
  maxNearbySensory: 8,
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
  private light: LightSystem | null = null;
  private thermal: ThermalSystem | null = null;
  private harvest: HarvestSystem | null = null;
  private readonly frames = new Map<string, PerceptionFrame>();
  private readonly eventBuffer: BufferedEvent[] = [];
  private readonly commBuffer: BufferedCommunication[] = [];
  private currentTick = 0;
  private soulsPerceived = 0;
  /** Unsubscribe function for movement.arrived event, set on first tick. */
  private arrivedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for physics.collision event, set on first tick. */
  private collisionUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for physics.collision.enter event, set on first tick. */
  private collisionEnterUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for physics.collision.exit event, set on first tick. */
  private collisionExitUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for physics.trigger.enter event, set on first tick. */
  private triggerEnterUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for physics.trigger.exit event, set on first tick. */
  private triggerExitUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for movement.path_replanned event, set on first tick. */
  private pathReplannedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for world.weather event, set on first tick. */
  private weatherUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for resource.harvest.complete event, set on first tick. */
  private harvestCompleteUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for resource.node.depleted event, set on first tick. */
  private resourceDepletedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for crafting.complete event, set on first tick. */
  private craftCompleteUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for ecosystem.resource_spawned event, set on first tick. */
  private ecoSpawnUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for ecosystem.resource_depleted event, set on first tick. */
  private ecoDepletedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for ecosystem.resource_removed event, set on first tick. */
  private ecoRemovedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for ecosystem.zone_changed event, set on first tick. */
  private ecoZoneChangedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for task.available event, set on first tick. */
  private taskAvailableUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for task.accepted event, set on first tick. */
  private taskAcceptedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for task.progress event, set on first tick. */
  private taskProgressUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for task.completed event, set on first tick. */
  private taskCompletedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for task.failed event, set on first tick. */
  private taskFailedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for task.status_changed event, set on first tick. */
  private taskStatusChangedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for narrative.started event, set on first tick. */
  private narrativeStartedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for narrative.node_entered event, set on first tick. */
  private narrativeNodeEnteredUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for narrative.node_exited event, set on first tick. */
  private narrativeNodeExitedUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for narrative.branch event, set on first tick. */
  private narrativeBranchUnsubscribe: (() => void) | null = null;
  /** Unsubscribe function for narrative.completed event, set on first tick. */
  private narrativeCompletedUnsubscribe: (() => void) | null = null;

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

  /** Map weather kind and strength to perception severity. */
  private weatherSeverity(kind: string, strength: number): string {
    if (kind === "storm" || (kind === "wind_gust" && strength > 20)) return "high";
    if (kind === "rain" || kind === "snow" || kind === "windy" || (kind === "wind_gust" && strength > 10)) return "medium";
    return "low";
  }

  /** Number of souls perceived in the last tick. */
  get perceivedSoulCount(): number { return this.soulsPerceived; }

  tick(dt: number, world: World, events: EventSystem): void {
    this.currentTick = world.tick;

    // Lazily subscribe to EntityArrivedEvent on first tick.
    if (!this.arrivedUnsubscribe) {
      this.arrivedUnsubscribe = events.on("movement.arrived", (evt: EntityArrivedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `${p.entityId}_arrived_${evt.timestamp}`,
          "movement.arrived",
          `Arrived at target (${p.stopReason})`,
          "low",
          p.actualPosition,
          true,
        );
      });
    }

    // Lazily subscribe to CollisionEvent (generic, backward compat) on first tick.
    if (!this.collisionUnsubscribe) {
      this.collisionUnsubscribe = events.on("physics.collision", (evt: CollisionEvent) => {
        const p = evt.payload;
        // Severity based on impact speed: gentle < 1 m/s, harder >= 1 m/s.
        const severity = p.relativeSpeed >= 1.0 ? "medium" : "low";
        this.recordEvent(
          `collision_${p.a}_${p.b}_${evt.timestamp}`,
          "physics.collision",
          `Collision between ${p.a} and ${p.b} (impact: ${p.relativeSpeed.toFixed(2)} m/s)`,
          severity,
          p.point,
          true,
        );
      });
    }

    // Lazily subscribe to CollisionEnterEvent (lifecycle: first contact).
    if (!this.collisionEnterUnsubscribe) {
      this.collisionEnterUnsubscribe = events.on("physics.collision.enter", (evt: CollisionEnterEvent) => {
        const p = evt.payload;
        const severity = p.relativeSpeed >= 2.0 ? "high" : p.relativeSpeed >= 1.0 ? "medium" : "low";
        this.recordEvent(
          `collision_enter_${p.a}_${p.b}_${evt.timestamp}`,
          "physics.collision.enter",
          `Collision started: ${p.a} hit ${p.b} (${p.relativeSpeed.toFixed(2)} m/s)`,
          severity,
          p.point,
          true,
        );
      });
    }

    // Lazily subscribe to CollisionExitEvent (lifecycle: contact ended).
    if (!this.collisionExitUnsubscribe) {
      this.collisionExitUnsubscribe = events.on("physics.collision.exit", (evt: CollisionExitEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `collision_exit_${p.a}_${p.b}_${evt.timestamp}`,
          "physics.collision.exit",
          `Collision ended: ${p.a} separated from ${p.b} (${p.contactDurationTicks} ticks)`,
          "low",
          p.lastContactPoint,
          true,
        );
      });
    }

    // Lazily subscribe to TriggerEnterEvent (soul entered a trigger volume).
    if (!this.triggerEnterUnsubscribe) {
      this.triggerEnterUnsubscribe = events.on("physics.trigger.enter", (evt: TriggerEnterEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `trigger_enter_${p.triggerId}_${p.otherId}_${evt.timestamp}`,
          "physics.trigger.enter",
          `Entered zone: ${p.triggerId}`,
          "medium",
          p.point,
          true,
        );
      });
    }

    // Lazily subscribe to TriggerExitEvent (soul exited a trigger volume).
    if (!this.triggerExitUnsubscribe) {
      this.triggerExitUnsubscribe = events.on("physics.trigger.exit", (evt: TriggerExitEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `trigger_exit_${p.triggerId}_${p.otherId}_${evt.timestamp}`,
          "physics.trigger.exit",
          `Exited zone: ${p.triggerId} (${p.contactDurationTicks} ticks)`,
          "low",
          p.lastContactPoint,
          true,
        );
      });
    }

    // Lazily subscribe to path replanned event (dynamic obstacle replanning).
    if (!this.pathReplannedUnsubscribe) {
      this.pathReplannedUnsubscribe = events.on("movement.path_replanned", (evt: PathReplannedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `path_replanned_${p.entityId}_${evt.timestamp}`,
          "movement.path_replanned",
          `Path replanned: ${p.oldPathLength}→${p.newPathLength} waypoints (attempt ${p.attempt})`,
          "medium",
          { x: p.goal.x, y: 0, z: p.goal.z },
          true,
        );
      });
    }

    // Lazily subscribe to weather change events (state transitions and wind gusts).
    if (!this.weatherUnsubscribe) {
      this.weatherUnsubscribe = events.on("world.weather", (evt: WeatherEvent) => {
        const p = evt.payload;
        const severity = this.weatherSeverity(p.kind, p.strength);
        const label = p.kind === "wind_gust" ? "Wind gust" : `Weather changed: ${p.kind}`;
        this.recordEvent(
          `weather_${p.kind}_${evt.timestamp}`,
          "world.weather",
          `${label} (strength: ${p.strength.toFixed(2)})`,
          severity,
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for harvest completion events.
    if (!this.harvestCompleteUnsubscribe) {
      this.harvestCompleteUnsubscribe = events.on("resource.harvest.complete", (evt: HarvestCompleteEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `harvest_complete_${p.nodeId}_${evt.timestamp}`,
          "resource.harvest.complete",
          `Harvested ${p.amount} ${p.resourceTypeId} (${p.remaining} remaining)`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for resource node depletion events.
    if (!this.resourceDepletedUnsubscribe) {
      this.resourceDepletedUnsubscribe = events.on("resource.node.depleted", (evt: ResourceDepletedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `resource_depleted_${p.nodeId}_${evt.timestamp}`,
          "resource.node.depleted",
          `Resource node depleted: ${p.resourceTypeId}`,
          "medium",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for crafting completion events.
    if (!this.craftCompleteUnsubscribe) {
      this.craftCompleteUnsubscribe = events.on("crafting.complete", (evt: CraftCompleteEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `craft_complete_${p.recipeId}_${evt.timestamp}`,
          "crafting.complete",
          `Crafted ${p.outputAmount} ${p.outputResourceTypeId} (${p.recipeName})`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for ecosystem resource spawned events.
    if (!this.ecoSpawnUnsubscribe) {
      this.ecoSpawnUnsubscribe = events.on("ecosystem.resource_spawned", (evt: EcosystemSpawnEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `eco_spawn_${p.entityId}_${evt.timestamp}`,
          "ecosystem.resource_spawned",
          `Resource spawned: ${p.resourceTypeId} at (${p.position.x.toFixed(1)}, ${p.position.z.toFixed(1)})`,
          "low",
          { x: p.position.x, y: 0, z: p.position.z },
          true,
        );
      });
    }

    // Listen for ecosystem resource depleted events.
    if (!this.ecoDepletedUnsubscribe) {
      this.ecoDepletedUnsubscribe = events.on("ecosystem.resource_depleted", (evt: EcosystemDepletedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `eco_depleted_${p.entityId}_${evt.timestamp}`,
          "ecosystem.resource_depleted",
          `Resource depleted: ${p.resourceTypeId} (zone: ${p.zoneId})`,
          "medium",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for ecosystem resource removed events.
    if (!this.ecoRemovedUnsubscribe) {
      this.ecoRemovedUnsubscribe = events.on("ecosystem.resource_removed", (evt: EcosystemRemovedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `eco_removed_${p.entityId}_${evt.timestamp}`,
          "ecosystem.resource_removed",
          `Resource removed: ${p.resourceTypeId} (zone: ${p.zoneId})`,
          "medium",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for ecosystem zone changed events.
    if (!this.ecoZoneChangedUnsubscribe) {
      this.ecoZoneChangedUnsubscribe = events.on("ecosystem.zone_changed", (evt: EcosystemZoneChangedEvent) => {
        const p = evt.payload;
        const severity = p.fertility < 0.2 ? "high" : p.fertility < 0.5 ? "medium" : "low";
        this.recordEvent(
          `eco_zone_${p.zoneId}_${evt.timestamp}`,
          "ecosystem.zone_changed",
          `Zone ${p.zoneId} fertility changed: ${(p.fertility * 100).toFixed(0)}%`,
          severity,
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for task available events.
    if (!this.taskAvailableUnsubscribe) {
      this.taskAvailableUnsubscribe = events.on("task.available", (evt: TaskAvailableEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `task_available_${p.taskId}_${evt.timestamp}`,
          "task.available",
          `Task available: ${p.taskId}`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for task accepted events.
    if (!this.taskAcceptedUnsubscribe) {
      this.taskAcceptedUnsubscribe = events.on("task.accepted", (evt: TaskAcceptedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `task_accepted_${p.taskId}_${evt.timestamp}`,
          "task.accepted",
          `Task accepted: ${p.taskId}`,
          "medium",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for task progress events.
    if (!this.taskProgressUnsubscribe) {
      this.taskProgressUnsubscribe = events.on("task.progress", (evt: TaskProgressEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `task_progress_${p.taskId}_${p.objectiveId}_${evt.timestamp}`,
          "task.progress",
          `Task progress: ${p.taskId} objective ${p.objectiveId} (${p.currentAmount}/${p.requiredAmount})`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for task completed events.
    if (!this.taskCompletedUnsubscribe) {
      this.taskCompletedUnsubscribe = events.on("task.completed", (evt: TaskCompletedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `task_completed_${p.taskId}_${evt.timestamp}`,
          "task.completed",
          `Task completed: ${p.taskId}`,
          "high",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for task failed events.
    if (!this.taskFailedUnsubscribe) {
      this.taskFailedUnsubscribe = events.on("task.failed", (evt: TaskFailedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `task_failed_${p.taskId}_${evt.timestamp}`,
          "task.failed",
          `Task failed: ${p.taskId} (${p.reason})`,
          "high",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for task status changed events.
    if (!this.taskStatusChangedUnsubscribe) {
      this.taskStatusChangedUnsubscribe = events.on("task.status_changed", (evt: TaskStatusChangedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `task_status_${p.taskId}_${evt.timestamp}`,
          "task.status_changed",
          `Task status: ${p.taskId} ${p.oldStatus} -> ${p.newStatus}`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for narrative started events.
    if (!this.narrativeStartedUnsubscribe) {
      this.narrativeStartedUnsubscribe = events.on("narrative.started", (evt: NarrativeStartedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `narrative_started_${p.chainId}_${evt.timestamp}`,
          "narrative.started",
          `Narrative started: ${p.chainName}`,
          "medium",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for narrative node entered events.
    if (!this.narrativeNodeEnteredUnsubscribe) {
      this.narrativeNodeEnteredUnsubscribe = events.on("narrative.node_entered", (evt: NarrativeNodeEnteredEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `narrative_node_entered_${p.chainId}_${p.nodeId}_${evt.timestamp}`,
          "narrative.node_entered",
          `Narrative node: ${p.nodeName}`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for narrative node exited events.
    if (!this.narrativeNodeExitedUnsubscribe) {
      this.narrativeNodeExitedUnsubscribe = events.on("narrative.node_exited", (evt: NarrativeNodeExitedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `narrative_node_exited_${p.chainId}_${p.nodeId}_${evt.timestamp}`,
          "narrative.node_exited",
          `Narrative node left: ${p.nodeName}`,
          "low",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for narrative branch events.
    if (!this.narrativeBranchUnsubscribe) {
      this.narrativeBranchUnsubscribe = events.on("narrative.branch", (evt: NarrativeBranchEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `narrative_branch_${p.chainId}_${p.fromNodeId}_${p.toNodeId}_${evt.timestamp}`,
          "narrative.branch",
          `Narrative branch: ${p.fromNodeId} -> ${p.toNodeId}`,
          "medium",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Listen for narrative completed events.
    if (!this.narrativeCompletedUnsubscribe) {
      this.narrativeCompletedUnsubscribe = events.on("narrative.completed", (evt: NarrativeCompletedEvent) => {
        const p = evt.payload;
        this.recordEvent(
          `narrative_completed_${p.chainId}_${evt.timestamp}`,
          "narrative.completed",
          `Narrative completed: ${p.chainName} (${p.nodesEntered} nodes)`,
          "high",
          { x: 0, y: 0, z: 0 },
          true,
        );
      });
    }

    // Lazy-locate WeatherSimulator.
    if (!this.weather || !world.systems.includes(this.weather)) {
      this.weather = world.systems.find(s => s instanceof WeatherSimulator) as WeatherSimulator | null ?? null;
    }
    // Lazy-locate LightSystem for local illumination.
    if (!this.light || !world.systems.includes(this.light)) {
      this.light = world.systems.find(s => s instanceof LightSystem) as LightSystem | null ?? null;
    }
    // Lazy-locate ThermalSystem for local temperature.
    if (!this.thermal || !world.systems.includes(this.thermal)) {
      this.thermal = world.systems.find(s => s instanceof ThermalSystem) as ThermalSystem | null ?? null;
    }
    // Lazy-locate HarvestSystem for nearby resource nodes.
    if (!this.harvest || !world.systems.includes(this.harvest as unknown as WorldSystem)) {
      this.harvest = world.systems.find(s => s.name === 'harvest') as unknown as HarvestSystem | null ?? null;
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

    // Local sensory data: illumination and temperature at the soul's exact position.
    const localLightLevel = this.light ? this.light.getIlluminationAt(pos) : undefined;
    const localTemperature = this.thermal ? this.thermal.getTemperatureAt(pos) : undefined;

    // Nearby heat sources within sensory range.
    const nearbyHeatSources = this.thermal
      ? this.thermal.getAllHeatSources()
          .filter(s => s.enabled)
          .map(s => ({ source: s, dist: pos.distance(s.position) }))
          .filter(x => x.dist <= this.config.sensoryRange)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, this.config.maxNearbySensory)
          .map(x => ({ id: x.source.id, distance: Math.round(x.dist * 100) / 100, intensity: x.source.intensity }))
      : undefined;

    // Nearby light sources within sensory range.
    const nearbyLights = this.light
      ? this.light.getEnabledLights()
          .map(l => ({ light: l, dist: pos.distance(l.position) }))
          .filter(x => x.dist <= this.config.sensoryRange)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, this.config.maxNearbySensory)
          .map(x => ({ id: x.light.id, distance: Math.round(x.dist * 100) / 100, intensity: x.light.intensity }))
      : undefined;

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

    // Nearby harvestable resource nodes within view distance.
    const nearbyResources = this.harvest
      ? this.harvest.getAllNodes()
          .map(({ entity, node }) => ({ entity, node, dist: pos.distance(entity.position) }))
          .filter(x => x.dist <= this.config.viewDistance)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, this.config.maxVisibleEntities)
          .map(x => ({
            id: x.entity.id,
            name: x.entity.name,
            resourceType: x.node.resourceTypeId,
            currentAmount: Math.round(x.node.currentAmount * 100) / 100,
            maxAmount: x.node.maxAmount,
            position: { x: x.entity.position.x, y: x.entity.position.y, z: x.entity.position.z },
            distance: Math.round(x.dist * 100) / 100,
            isAvailable: x.node.isAvailable,
            isBeingHarvested: x.node.isBeingHarvested,
          }))
      : undefined;

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
      nearbyResources,
      environment: {
        ...env,
        localTemperature: localTemperature !== undefined ? Math.round(localTemperature * 10) / 10 : undefined,
        localLightLevel: localLightLevel !== undefined ? Math.round(localLightLevel * 100) / 100 : undefined,
        nearbyHeatSources,
        nearbyLights,
      },
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
  stop(): void {
    if (this.arrivedUnsubscribe) {
      this.arrivedUnsubscribe();
      this.arrivedUnsubscribe = null;
    }
    if (this.collisionUnsubscribe) {
      this.collisionUnsubscribe();
      this.collisionUnsubscribe = null;
    }
    if (this.collisionEnterUnsubscribe) {
      this.collisionEnterUnsubscribe();
      this.collisionEnterUnsubscribe = null;
    }
    if (this.collisionExitUnsubscribe) {
      this.collisionExitUnsubscribe();
      this.collisionExitUnsubscribe = null;
    }
    if (this.triggerEnterUnsubscribe) {
      this.triggerEnterUnsubscribe();
      this.triggerEnterUnsubscribe = null;
    }
    if (this.triggerExitUnsubscribe) {
      this.triggerExitUnsubscribe();
      this.triggerExitUnsubscribe = null;
    }
    if (this.pathReplannedUnsubscribe) {
      this.pathReplannedUnsubscribe();
      this.pathReplannedUnsubscribe = null;
    }
    if (this.weatherUnsubscribe) {
      this.weatherUnsubscribe();
      this.weatherUnsubscribe = null;
    }

    if (this.harvestCompleteUnsubscribe) {
      this.harvestCompleteUnsubscribe();
      this.harvestCompleteUnsubscribe = null;
    }

    if (this.resourceDepletedUnsubscribe) {
      this.resourceDepletedUnsubscribe();
      this.resourceDepletedUnsubscribe = null;
    }

    if (this.craftCompleteUnsubscribe) {
      this.craftCompleteUnsubscribe();
      this.craftCompleteUnsubscribe = null;
    }

    if (this.ecoSpawnUnsubscribe) {
      this.ecoSpawnUnsubscribe();
      this.ecoSpawnUnsubscribe = null;
    }

    if (this.ecoDepletedUnsubscribe) {
      this.ecoDepletedUnsubscribe();
      this.ecoDepletedUnsubscribe = null;
    }

    if (this.ecoRemovedUnsubscribe) {
      this.ecoRemovedUnsubscribe();
      this.ecoRemovedUnsubscribe = null;
    }

    if (this.ecoZoneChangedUnsubscribe) {
      this.ecoZoneChangedUnsubscribe();
      this.ecoZoneChangedUnsubscribe = null;
    }

    if (this.taskAvailableUnsubscribe) {
      this.taskAvailableUnsubscribe();
      this.taskAvailableUnsubscribe = null;
    }

    if (this.taskAcceptedUnsubscribe) {
      this.taskAcceptedUnsubscribe();
      this.taskAcceptedUnsubscribe = null;
    }

    if (this.taskProgressUnsubscribe) {
      this.taskProgressUnsubscribe();
      this.taskProgressUnsubscribe = null;
    }

    if (this.taskCompletedUnsubscribe) {
      this.taskCompletedUnsubscribe();
      this.taskCompletedUnsubscribe = null;
    }

    if (this.taskFailedUnsubscribe) {
      this.taskFailedUnsubscribe();
      this.taskFailedUnsubscribe = null;
    }

    if (this.taskStatusChangedUnsubscribe) {
      this.taskStatusChangedUnsubscribe();
      this.taskStatusChangedUnsubscribe = null;
    }

    if (this.narrativeStartedUnsubscribe) {
      this.narrativeStartedUnsubscribe();
      this.narrativeStartedUnsubscribe = null;
    }

    if (this.narrativeNodeEnteredUnsubscribe) {
      this.narrativeNodeEnteredUnsubscribe();
      this.narrativeNodeEnteredUnsubscribe = null;
    }

    if (this.narrativeNodeExitedUnsubscribe) {
      this.narrativeNodeExitedUnsubscribe();
      this.narrativeNodeExitedUnsubscribe = null;
    }

    if (this.narrativeBranchUnsubscribe) {
      this.narrativeBranchUnsubscribe();
      this.narrativeBranchUnsubscribe = null;
    }

    if (this.narrativeCompletedUnsubscribe) {
      this.narrativeCompletedUnsubscribe();
      this.narrativeCompletedUnsubscribe = null;
    }
  }
}
