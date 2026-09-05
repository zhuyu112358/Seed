// TerritorySystem: manages territories claimed by entities.
// All territory content (names, boundaries, rules) is defined by application layer.
// Seed only manages territory state, boundary overlap detection, and event emission.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  Territory,
  TerritoryBoundary,
  TerritoryResult,
  TerritoryPosition,
} from "./TerritoryTypes.js";
import {
  TerritoryClaimedEvent,
  TerritoryAbandonedEvent,
  TerritoryExpandedEvent,
  TerritoryEnteredEvent,
  TerritoryLeftEvent,
} from "./TerritoryEvents.js";

export class TerritorySystem {
  readonly name = "territory";
  enabled = true;
  private territories = new Map<string, Territory>();
  private territoryCounter = 0;
  /** Track which territory each entity is currently in (for enter/leave events). */
  private entityTerritory = new Map<string, string>();

  /** Generate a unique territory ID. */
  private generateId(): string {
    this.territoryCounter++;
    return `territory_${Date.now()}_${this.territoryCounter}`;
  }

  /** Check if two boundaries overlap on the x/z plane. */
  private boundariesOverlap(a: TerritoryBoundary, b: TerritoryBoundary): boolean {
    return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  }

  /** Check if a boundary overlaps with any existing territory. */
  private isBoundaryOccupied(boundary: TerritoryBoundary, excludeId?: string): boolean {
    for (const territory of this.territories.values()) {
      if (excludeId && territory.id === excludeId) continue;
      if (this.boundariesOverlap(boundary, territory.boundary)) {
        return true;
      }
    }
    return false;
  }

  /** Check if a position is inside a boundary. */
  private isPositionInBoundary(position: TerritoryPosition, boundary: TerritoryBoundary): boolean {
    return (
      position.x >= boundary.minX &&
      position.x <= boundary.maxX &&
      position.z >= boundary.minZ &&
      position.z <= boundary.maxZ
    );
  }

  /** Claim a new territory. */
  claimTerritory(
    ownerId: string,
    boundary: TerritoryBoundary,
    events: EventSystem,
    worldTick: number,
    name?: string,
  ): TerritoryResult {
    // Validate boundary.
    if (boundary.minX >= boundary.maxX || boundary.minZ >= boundary.maxZ) {
      return { success: false, error: "Invalid boundary: min must be less than max" };
    }
    if (this.isBoundaryOccupied(boundary)) {
      return { success: false, error: "Boundary overlaps with existing territory" };
    }
    const id = this.generateId();
    const territory: Territory = {
      id,
      name: name ?? `Territory of ${ownerId}`,
      ownerId,
      boundary: { ...boundary },
      claimedTick: worldTick,
    };
    this.territories.set(id, territory);
    events.emit(new TerritoryClaimedEvent(id, territory.name, ownerId, boundary));
    return { success: true, territoryId: id };
  }

  /** Abandon a territory. Only the owner can abandon. */
  abandonTerritory(territoryId: string, ownerId: string, events: EventSystem): TerritoryResult {
    const territory = this.territories.get(territoryId);
    if (!territory) return { success: false, error: "Territory not found" };
    if (territory.ownerId !== ownerId) return { success: false, error: "Only the owner can abandon" };

    this.territories.delete(territoryId);
    // Clear entity territory tracking for this territory.
    for (const [entityId, tId] of this.entityTerritory) {
      if (tId === territoryId) this.entityTerritory.delete(entityId);
    }
    events.emit(new TerritoryAbandonedEvent(territoryId, territory.name, ownerId));
    return { success: true, territoryId };
  }

  /** Expand (or shrink) a territory's boundary. Only the owner can expand. */
  expandTerritory(
    territoryId: string,
    ownerId: string,
    newBoundary: TerritoryBoundary,
    events: EventSystem,
  ): TerritoryResult {
    const territory = this.territories.get(territoryId);
    if (!territory) return { success: false, error: "Territory not found" };
    if (territory.ownerId !== ownerId) return { success: false, error: "Only the owner can expand" };
    if (newBoundary.minX >= newBoundary.maxX || newBoundary.minZ >= newBoundary.maxZ) {
      return { success: false, error: "Invalid boundary: min must be less than max" };
    }
    if (this.isBoundaryOccupied(newBoundary, territoryId)) {
      return { success: false, error: "New boundary overlaps with existing territory" };
    }
    const oldBoundary = { ...territory.boundary };
    territory.boundary = { ...newBoundary };
    events.emit(new TerritoryExpandedEvent(territoryId, territory.name, ownerId, oldBoundary, newBoundary));
    return { success: true, territoryId };
  }

  /** Update an entity's position, triggering enter/leave events. */
  updateEntityPosition(entityId: string, position: TerritoryPosition, events: EventSystem): void {
    const currentTerritoryId = this.entityTerritory.get(entityId);
    let newTerritory: Territory | undefined;

    for (const territory of this.territories.values()) {
      if (this.isPositionInBoundary(position, territory.boundary)) {
        newTerritory = territory;
        break;
      }
    }

    if (newTerritory && newTerritory.id !== currentTerritoryId) {
      // Entered a new territory.
      if (currentTerritoryId) {
        const oldTerritory = this.territories.get(currentTerritoryId);
        if (oldTerritory) {
          events.emit(new TerritoryLeftEvent(currentTerritoryId, oldTerritory.name, oldTerritory.ownerId, entityId));
        }
      }
      this.entityTerritory.set(entityId, newTerritory.id);
      events.emit(new TerritoryEnteredEvent(newTerritory.id, newTerritory.name, newTerritory.ownerId, entityId));
    } else if (!newTerritory && currentTerritoryId) {
      // Left the current territory.
      const oldTerritory = this.territories.get(currentTerritoryId);
      if (oldTerritory) {
        events.emit(new TerritoryLeftEvent(currentTerritoryId, oldTerritory.name, oldTerritory.ownerId, entityId));
      }
      this.entityTerritory.delete(entityId);
    }
  }

  /** Get a territory by ID. */
  getTerritory(territoryId: string): Territory | undefined {
    return this.territories.get(territoryId);
  }

  /** Get all territories owned by an entity. */
  getTerritoriesByOwner(ownerId: string): Territory[] {
    return Array.from(this.territories.values()).filter((t) => t.ownerId === ownerId);
  }

  /** Get territory at a specific position. */
  getTerritoryAtPosition(position: TerritoryPosition): Territory | undefined {
    for (const territory of this.territories.values()) {
      if (this.isPositionInBoundary(position, territory.boundary)) {
        return territory;
      }
    }
    return undefined;
  }

  /** Get all territories. */
  getTerritories(): Territory[] {
    return Array.from(this.territories.values());
  }

  /** Check if a position is in any territory. */
  isPositionInTerritory(position: TerritoryPosition): boolean {
    return this.getTerritoryAtPosition(position) !== undefined;
  }

  /** Check if a position is in a specific territory. */
  isPositionInSpecificTerritory(position: TerritoryPosition, territoryId: string): boolean {
    const territory = this.territories.get(territoryId);
    if (!territory) return false;
    return this.isPositionInBoundary(position, territory.boundary);
  }

  /** Number of territories. */
  get territoryCount(): number {
    return this.territories.size;
  }

  /** WorldSystem interface: called each tick. Currently no per-tick logic. */
  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    // Future: territory decay, tax collection, etc.
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.territories.clear();
    this.entityTerritory.clear();
    this.territoryCounter = 0;
  }

  /** Serialize all territories. */
  serialize(): Record<string, unknown> {
    const territories: Record<string, Territory> = {};
    for (const [id, territory] of this.territories) {
      territories[id] = territory;
    }
    const entityTerritory: Record<string, string> = {};
    for (const [entityId, territoryId] of this.entityTerritory) {
      entityTerritory[entityId] = territoryId;
    }
    return { territories, entityTerritory, territoryCounter: this.territoryCounter };
  }

  /** Deserialize territories. */
  deserialize(data: Record<string, unknown>): void {
    if (data.territories && typeof data.territories === "object") {
      for (const [id, territory] of Object.entries(data.territories as Record<string, Territory>)) {
        this.territories.set(id, territory);
      }
    }
    if (data.entityTerritory && typeof data.entityTerritory === "object") {
      for (const [entityId, territoryId] of Object.entries(data.entityTerritory as Record<string, string>)) {
        this.entityTerritory.set(entityId, territoryId);
      }
    }
    if (typeof data.territoryCounter === "number") {
      this.territoryCounter = data.territoryCounter;
    }
  }
}
