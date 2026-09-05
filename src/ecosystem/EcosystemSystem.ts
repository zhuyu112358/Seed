// EcosystemSystem: manages dynamic resource node lifecycle (spawn/despawn/regenerate).
// Abstract and configurable — no hardcoded resource types or world content.
// Applications define ecosystem zones and allowed resource types via config.
//
// This is a WORLD-level system (environmental dynamics), NOT soul cognition/decision.
// Soul cognition/decision remains in SoulArena.

import type { World } from "../engine/World.js";
import { GameObject } from "../entity/Entity.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import type { ResourceNode } from "../resource/ResourceNode.js";
import type { SeededRandom } from "../generation/SeededRandom.js";

/** Configuration for an ecosystem zone. */
export interface EcosystemZoneConfig {
  /** Unique zone ID. */
  id: string;
  /** Zone center position. */
  position: { x: number; z: number };
  /** Zone radius in world units. */
  radius: number;
  /** Allowed resource type IDs that can spawn in this zone. */
  resourceTypeIds: string[];
  /** Spawn rate (0-1): probability of a spawn check succeeding per interval. Default 0.1. */
  spawnRate?: number;
  /** Maximum number of resource nodes in this zone. Default 10. */
  maxNodes?: number;
  /** Minimum number of resource nodes to maintain (spawns if below). Default 0. */
  minNodes?: number;
  /** Ticks between spawn checks. Default 100. */
  spawnIntervalTicks?: number;
  /** Fertility (0-1): modifies spawn rate and regen speed. Default 0.5. */
  fertility?: number;
  /** Whether depleted nodes can regrow (vs being removed). Default true. */
  allowRegrowth?: boolean;
  /** Ticks before a depleted node is removed (if allowRegrowth false). Default 500. */
  depletionRemovalTicks?: number;
}

/** Internal zone state. */
interface ZoneState {
  config: EcosystemZoneConfig;
  lastSpawnCheck: number;
  /** entityId -> ticks since depletion (for removal tracking). */
  depletedNodes: Map<string, number>;
}

/** Event emitted when a resource node spawns in an ecosystem zone. */
export class EcosystemSpawnEvent extends Event<{
  zoneId: string;
  entityId: string;
  resourceTypeId: string;
  position: { x: number; z: number };
}> {
  constructor(
    zoneId: string,
    entityId: string,
    resourceTypeId: string,
    position: { x: number; z: number },
  ) {
    super({
      type: "ecosystem.resource_spawned",
      payload: { zoneId, entityId, resourceTypeId, position },
      sourceId: "ecosystem",
    });
  }
}

/** Event emitted when a resource node is depleted. */
export class EcosystemDepletedEvent extends Event<{
  zoneId: string;
  entityId: string;
  resourceTypeId: string;
}> {
  constructor(
    zoneId: string,
    entityId: string,
    resourceTypeId: string,
  ) {
    super({
      type: "ecosystem.resource_depleted",
      payload: { zoneId, entityId, resourceTypeId },
      sourceId: "ecosystem",
    });
  }
}

/** Event emitted when a depleted resource node is removed. */
export class EcosystemRemovedEvent extends Event<{
  zoneId: string;
  entityId: string;
  resourceTypeId: string;
}> {
  constructor(
    zoneId: string,
    entityId: string,
    resourceTypeId: string,
  ) {
    super({
      type: "ecosystem.resource_removed",
      payload: { zoneId, entityId, resourceTypeId },
      sourceId: "ecosystem",
    });
  }
}

/** Event emitted when ecosystem zone fertility changes. */
export class EcosystemZoneChangedEvent extends Event<{
  zoneId: string;
  fertility: number;
}> {
  constructor(
    zoneId: string,
    fertility: number,
  ) {
    super({
      type: "ecosystem.zone_changed",
      payload: { zoneId, fertility },
      sourceId: "ecosystem",
    });
  }
}

/**
 * EcosystemSystem: manages dynamic resource node lifecycle.
 *
 * Features:
 * - Configurable ecosystem zones with position/radius/allowed resource types
 * - Periodic spawn checks: spawns new resource nodes in zones based on fertility
 * - Depletion tracking: monitors nodes that reach 0 amount
 * - Regrowth/removal: depleted nodes either regrow or are removed after timeout
 * - Min/max node enforcement: maintains node count within zone bounds
 * - Events: spawned/depleted/removed/zone_changed for perception and rule triggers
 *
 * Architecture:
 * - No hardcoded resource types — all types provided via zone config
 * - No hardcoded world layout — zones defined by application
 * - Deterministic with optional SeededRandom for reproducible ecosystems
 * - Integrates with existing ResourceNode (from HarvestSystem)
 */
export class EcosystemSystem {
  readonly name = "ecosystem";
  enabled = true;

  private zones = new Map<string, ZoneState>();
  private world: World | null = null;
  private rng: SeededRandom | null = null;
  /** Counter for generating unique entity IDs for spawned nodes. */
  private spawnCounter = 0;

  /** Set the RNG for deterministic spawning. Optional. */
  setRandom(rng: SeededRandom): void {
    this.rng = rng;
  }

  /** Register an ecosystem zone. Throws if ID already exists. */
  addZone(config: EcosystemZoneConfig): void {
    if (this.zones.has(config.id)) {
      throw new Error(`Ecosystem zone with id '${config.id}' already exists`);
    }
    this.zones.set(config.id, {
      config,
      lastSpawnCheck: -1, // -1 ensures first tick triggers a spawn check
      depletedNodes: new Map(),
    });
  }

  /** Remove an ecosystem zone. Returns true if found. */
  removeZone(zoneId: string): boolean {
    return this.zones.delete(zoneId);
  }

  /** Get zone config by ID. */
  getZone(zoneId: string): EcosystemZoneConfig | undefined {
    return this.zones.get(zoneId)?.config;
  }

  /** Get all zone IDs. */
  getZoneIds(): string[] {
    return Array.from(this.zones.keys());
  }

  /** Update zone fertility. Emits zone_changed event. */
  setFertility(zoneId: string, fertility: number, events?: EventSystem): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;
    const clamped = Math.max(0, Math.min(1, fertility));
    zone.config.fertility = clamped;
    if (events) {
      events.emit(new EcosystemZoneChangedEvent(zoneId, clamped));
    }
  }

  /** Count resource nodes in a zone (by position distance). */
  private countNodesInZone(zone: EcosystemZoneConfig): number {
    if (!this.world) return 0;
    let count = 0;
    for (const entity of this.world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;
      const node = (entity as any).resourceNode as ResourceNode | undefined;
      if (!node) continue;
      const dx = entity.position.x - zone.position.x;
      const dz = entity.position.z - zone.position.z;
      if (dx * dx + dz * dz <= zone.radius * zone.radius) {
        count++;
      }
    }
    return count;
  }

  /** Find depleted nodes in a zone and track them. */
  private trackDepletedNodes(zone: ZoneState, events: EventSystem): void {
    if (!this.world) return;
    const config = zone.config;
    for (const entity of this.world.entities.values()) {
      if (!(entity instanceof GameObject)) continue;
      const node = (entity as any).resourceNode as ResourceNode | undefined;
      if (!node) continue;
      const dx = entity.position.x - config.position.x;
      const dz = entity.position.z - config.position.z;
      if (dx * dx + dz * dz > config.radius * config.radius) continue;

      if (node.currentAmount <= 0) {
        if (!zone.depletedNodes.has(entity.id)) {
          zone.depletedNodes.set(entity.id, 0);
          events.emit(new EcosystemDepletedEvent(config.id, entity.id, node.resourceTypeId));
        }
      } else {
        // Node regenerated, remove from depleted tracking.
        zone.depletedNodes.delete(entity.id);
      }
    }
  }

  /** Process depleted nodes: regrow or remove. */
  private processDepletedNodes(zone: ZoneState, events: EventSystem): void {
    const config = zone.config;
    const allowRegrowth = config.allowRegrowth ?? true;
    const removalTicks = config.depletionRemovalTicks ?? 500;

    for (const [entityId, ticksDepleted] of Array.from(zone.depletedNodes.entries())) {
      zone.depletedNodes.set(entityId, ticksDepleted + 1);

      if (!allowRegrowth && ticksDepleted + 1 >= removalTicks) {
        // Remove the node entity.
        if (this.world) {
          const entity = this.world.getEntity(entityId);
          if (entity) {
            const node = (entity as any).resourceNode as ResourceNode | undefined;
            this.world.removeEntity(entityId);
            zone.depletedNodes.delete(entityId);
            events.emit(new EcosystemRemovedEvent(config.id, entityId, node?.resourceTypeId ?? "unknown"));
          }
        }
      }
    }
  }

  /** Spawn a new resource node in a zone. */
  private spawnNode(zone: EcosystemZoneConfig, events: EventSystem): void {
    if (!this.world) return;
    if (zone.resourceTypeIds.length === 0) return;

    // Pick a random resource type from allowed types.
    const typeIndex = this.rng
      ? this.rng.nextInt(0, zone.resourceTypeIds.length - 1)
      : Math.floor(Math.random() * zone.resourceTypeIds.length);
    const resourceTypeId = zone.resourceTypeIds[typeIndex];

    // Pick a random position within the zone radius.
    const angle = this.rng ? this.rng.next() * Math.PI * 2 : Math.random() * Math.PI * 2;
    const dist = this.rng
      ? Math.sqrt(this.rng.next()) * zone.radius
      : Math.sqrt(Math.random()) * zone.radius;
    const x = zone.position.x + Math.cos(angle) * dist;
    const z = zone.position.z + Math.sin(angle) * dist;

    // Create entity with ResourceNode component.
    this.spawnCounter++;
    const entityId = `eco_${zone.id}_${this.spawnCounter}`;
    const entity = new GameObject({
      id: entityId,
      type: "interactive",
      name: `${resourceTypeId}_node`,
      position: { x, y: 0, z },
    });

    // Attach a ResourceNode-like component. The actual ResourceNode creation
    // is deferred to the application via event, or we create a minimal one.
    // For now, we emit the spawn event and let HarvestSystem register the node.
    this.world.addEntity(entity);
    events.emit(new EcosystemSpawnEvent(zone.id, entityId, resourceTypeId, { x, z }));
  }

  /** WorldSystem interface: called each tick. */
  tick(_dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;
    this.world = world;

    for (const zone of this.zones.values()) {
      const config = zone.config;
      const interval = config.spawnIntervalTicks ?? 100;

      // Track depleted nodes every tick.
      this.trackDepletedNodes(zone, events);
      this.processDepletedNodes(zone, events);

      // Periodic spawn check.
      if (world.tick - zone.lastSpawnCheck >= interval) {
        zone.lastSpawnCheck = world.tick;

        const nodeCount = this.countNodesInZone(config);
        const maxNodes = config.maxNodes ?? 10;
        const minNodes = config.minNodes ?? 0;

        // Spawn if below min, or probabilistically if below max.
        const shouldSpawn =
          nodeCount < minNodes ||
          (nodeCount < maxNodes && this.rollSpawn(config));

        if (shouldSpawn) {
          this.spawnNode(config, events);
        }
      }
    }
  }

  /** Roll for spawn success, modified by fertility. */
  private rollSpawn(config: EcosystemZoneConfig): boolean {
    const baseRate = config.spawnRate ?? 0.1;
    const fertility = config.fertility ?? 0.5;
    const effectiveRate = baseRate * (0.5 + fertility); // fertility 0→0.5x, 1→1.5x
    const roll = this.rng ? this.rng.next() : Math.random();
    return roll < effectiveRate;
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.zones.clear();
  }

  /** Serialize ecosystem state (zone configs + depleted tracking). */
  serialize(): Record<string, unknown> {
    const zones: Record<string, unknown> = {};
    for (const [id, state] of this.zones) {
      zones[id] = {
        config: state.config,
        lastSpawnCheck: state.lastSpawnCheck,
        depletedNodes: Array.from(state.depletedNodes.entries()),
      };
    }
    return { zones, spawnCounter: this.spawnCounter };
  }

  /** Deserialize ecosystem state. Zones must be re-added first. */
  deserialize(data: Record<string, unknown>): void {
    const zonesData = data.zones as Record<string, { config: EcosystemZoneConfig; lastSpawnCheck: number; depletedNodes: Array<[string, number]> }>;
    if (!zonesData) return;
    for (const [id, zoneData] of Object.entries(zonesData)) {
      const zone = this.zones.get(id);
      if (zone) {
        zone.lastSpawnCheck = zoneData.lastSpawnCheck;
        zone.depletedNodes = new Map(zoneData.depletedNodes);
      }
    }
    if (typeof data.spawnCounter === "number") {
      this.spawnCounter = data.spawnCounter;
    }
  }
}
