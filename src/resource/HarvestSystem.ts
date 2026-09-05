// HarvestSystem: manages resource nodes and harvest operations in the world.
// Tracks all resource node entities, processes harvest countdowns, regenerates
// depleted nodes, and emits harvest events. Integrates with SoulActionSystem
// for harvest action execution.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { GameObject } from "../entity/Entity.js";
import { ResourceNode } from "./ResourceNode.js";
import { ResourceInventory } from "./ResourceInventory.js";
import {
  HarvestStartEvent,
  HarvestCompleteEvent,
  ResourceDepletedEvent,
  ResourceRegeneratedEvent,
} from "../event/Event.js";

/** Configuration for HarvestSystem. */
export interface HarvestSystemConfig {
  /** Maximum distance (in world units) for harvesting. Default 3. */
  harvestRange?: number;
  /** Whether to emit harvest events. Default true. */
  emitEvents?: boolean;
}

const DEFAULT_CONFIG: Required<HarvestSystemConfig> = {
  harvestRange: 3,
  emitEvents: true,
};

/** A registered resource node in the world. */
interface RegisteredNode {
  entity: GameObject;
  node: ResourceNode;
  /** Whether this node was depleted before regeneration (for event emission). */
  wasDepleted: boolean;
}

/**
 * HarvestSystem: manages resource nodes and harvest operations.
 *
 * Resource nodes are registered by attaching a ResourceNode component to
 * a GameObject. HarvestSystem discovers them automatically on tick.
 */
export class HarvestSystem implements WorldSystem {
  readonly name = "harvest";
  enabled = true;

  private readonly config: Required<HarvestSystemConfig>;
  private nodes = new Map<string, RegisteredNode>();
  private inventories = new Map<string, ResourceInventory>();

  constructor(config?: HarvestSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get the harvest range. */
  get harvestRange(): number {
    return this.config.harvestRange;
  }

  /**
   * Register a resource node entity. Called automatically on tick,
   * but can also be called manually for immediate registration.
   */
  registerNode(entity: GameObject, node: ResourceNode): void {
    this.nodes.set(entity.id, { entity, node, wasDepleted: !node.isAvailable });
  }

  /** Get a registered resource node by entity ID. */
  getNode(entityId: string): ResourceNode | undefined {
    return this.nodes.get(entityId)?.node;
  }

  /** Get all registered resource nodes. */
  getAllNodes(): Array<{ entity: GameObject; node: ResourceNode }> {
    return Array.from(this.nodes.values()).map(r => ({ entity: r.entity, node: r.node }));
  }

  /** Get or create a resource inventory for an entity. */
  getOrCreateInventory(entity: GameObject, maxCapacity = 0): ResourceInventory {
    let inv = this.inventories.get(entity.id);
    if (!inv) {
      inv = new ResourceInventory({ maxCapacity });
      this.inventories.set(entity.id, inv);
    }
    return inv;
  }

  /** Get an entity's resource inventory (or undefined if none). */
  getInventory(entityId: string): ResourceInventory | undefined {
    return this.inventories.get(entityId);
  }

  /**
   * Start harvesting a resource node.
   * Returns true if harvesting started, false if unavailable/too far/already harvesting.
   */
  startHarvest(harvester: GameObject, nodeEntity: GameObject): boolean {
    const registered = this.nodes.get(nodeEntity.id);
    if (!registered) return false;
    const node = registered.node;
    if (!node.isAvailable) return false;
    if (node.isBeingHarvested) return false;

    // Check distance (2D x/z plane).
    const dx = harvester.position.x - nodeEntity.position.x;
    const dz = harvester.position.z - nodeEntity.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.config.harvestRange) return false;

    const started = node.startHarvest(harvester.id);
    if (started && this.config.emitEvents) {
      // Event emission deferred to tick() to avoid emitting during action processing.
      this.pendingStartEvents.push({ harvesterId: harvester.id, nodeId: nodeEntity.id, node });
    }
    return started;
  }

  /** Pending harvest start events to emit on next tick. */
  private pendingStartEvents: Array<{ harvesterId: string; nodeId: string; node: ResourceNode }> = [];

  tick(_dt: number, _world: World, events: EventSystem): void {
    // Emit pending start events.
    for (const pending of this.pendingStartEvents) {
      events.emit(new HarvestStartEvent(
        pending.harvesterId, pending.nodeId, pending.node.resourceTypeId, pending.node.harvestTime,
      ));
    }
    this.pendingStartEvents = [];

    // Process all registered nodes.
    for (const [entityId, registered] of this.nodes) {
      const { node, wasDepleted } = registered;

      // Tick harvest operation.
      if (node.isBeingHarvested) {
        // Read harvesterId BEFORE tickHarvest (it nulls harvestState on completion).
        const harvesterId = node.harvestState!.harvesterId;
        const harvested = node.tickHarvest();
        if (harvested > 0) {
          // Harvest complete — add to harvester's inventory and emit event.
          let inv = this.inventories.get(harvesterId);
          if (!inv) {
            inv = new ResourceInventory();
            this.inventories.set(harvesterId, inv);
          }
          const actualAdded = inv.add(node.resourceTypeId, harvested);

          if (this.config.emitEvents) {
            events.emit(new HarvestCompleteEvent(
              harvesterId, entityId, node.resourceTypeId, actualAdded, node.currentAmount,
            ));
          }

          // Check if node just became depleted.
          if (!node.isAvailable && !wasDepleted) {
            registered.wasDepleted = true;
            if (this.config.emitEvents) {
              events.emit(new ResourceDepletedEvent(entityId, node.resourceTypeId));
            }
          }
        }
      }

      // Regenerate node.
      if (node.renewable && !node.isBeingHarvested) {
        const wasEmpty = node.currentAmount <= 0;
        const regenAmount = node.regenerate();
        if (regenAmount > 0 && wasEmpty && this.config.emitEvents) {
          registered.wasDepleted = false;
          events.emit(new ResourceRegeneratedEvent(entityId, node.resourceTypeId, regenAmount));
        }
      }
    }
  }

  start(): void { /* no-op */ }

  stop(): void {
    // Cancel all active harvests.
    for (const registered of this.nodes.values()) {
      registered.node.cancelHarvest();
    }
  }

  /** Serialize harvest system state (inventories + node amounts). */
  serialize(): unknown {
    const inventories: Record<string, { items: Record<string, number>; maxCapacity: number }> = {};
    for (const [id, inv] of this.inventories) {
      inventories[id] = { items: inv.getAll(), maxCapacity: inv.maxCapacity };
    }
    const nodeStates: Record<string, number> = {};
    for (const [id, registered] of this.nodes) {
      nodeStates[id] = registered.node.currentAmount;
    }
    return { inventories, nodeStates };
  }

  /** Deserialize harvest system state. Nodes must already be registered. */
  deserialize(data: unknown): void {
    const d = data as {
      inventories?: Record<string, { items: Record<string, number>; maxCapacity: number }>;
      nodeStates?: Record<string, number>;
    };
    // Restore inventories.
    this.inventories.clear();
    if (d.inventories) {
      for (const [id, invData] of Object.entries(d.inventories)) {
        const inv = new ResourceInventory({ maxCapacity: invData.maxCapacity });
        for (const [typeId, amount] of Object.entries(invData.items)) {
          inv.add(typeId, amount);
        }
        this.inventories.set(id, inv);
      }
    }
    // Restore node current amounts.
    if (d.nodeStates) {
      for (const [id, amount] of Object.entries(d.nodeStates)) {
        const registered = this.nodes.get(id);
        if (registered) {
          registered.node.currentAmount = amount;
          registered.wasDepleted = amount <= 0;
        }
      }
    }
  }
}
