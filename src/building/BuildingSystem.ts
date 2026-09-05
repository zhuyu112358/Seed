// BuildingSystem: manages buildings in the world.
// All building content (types, effects, costs) is defined by application layer.
// Seed only manages building state, placement, lifecycle, and event emission.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  Building,
  BuildingType,
  BuildingPosition,
  BuildingSize,
  BuildingResult,
  BuildingProductionHandler,
  BuildingDefenseHandler,
} from "./BuildingTypes.js";
import {
  BuildingPlacedEvent,
  BuildingUpgradedEvent,
  BuildingDestroyedEvent,
  BuildingDamagedEvent,
  BuildingRepairedEvent,
} from "./BuildingEvents.js";

export class BuildingSystem {
  readonly name = "building";
  enabled = true;
  private buildings = new Map<string, Building>();
  private buildingCounter = 0;

  /** Optional production handler (application layer). */
  productionHandler: BuildingProductionHandler | null = null;
  /** Optional defense handler (application layer). */
  defenseHandler: BuildingDefenseHandler | null = null;

  /** Generate a unique building ID. */
  private generateId(): string {
    this.buildingCounter++;
    return `building_${Date.now()}_${this.buildingCounter}`;
  }

  /** Check if a position overlaps with any existing building. */
  private isPositionOccupied(position: BuildingPosition, size: BuildingSize, excludeId?: string): boolean {
    for (const building of this.buildings.values()) {
      if (excludeId && building.id === excludeId) continue;
      // AABB overlap check on x/z plane.
      const aMinX = position.x - size.width / 2;
      const aMaxX = position.x + size.width / 2;
      const aMinZ = position.z - size.depth / 2;
      const aMaxZ = position.z + size.depth / 2;
      const bMinX = building.position.x - building.size.width / 2;
      const bMaxX = building.position.x + building.size.width / 2;
      const bMinZ = building.position.z - building.size.depth / 2;
      const bMaxZ = building.position.z + building.size.depth / 2;
      if (aMinX < bMaxX && aMaxX > bMinX && aMinZ < bMaxZ && aMaxZ > bMinZ) {
        return true;
      }
    }
    return false;
  }

  /** Place a new building. */
  placeBuilding(
    type: BuildingType,
    position: BuildingPosition,
    size: BuildingSize,
    ownerId: string,
    events: EventSystem,
    worldTick: number,
    name?: string,
    maxHealth = 100,
  ): BuildingResult {
    if (this.isPositionOccupied(position, size)) {
      return { success: false, error: "Position is occupied by another building" };
    }
    const id = this.generateId();
    const building: Building = {
      id,
      type,
      name: name ?? `${type}_${id}`,
      position: { ...position },
      size: { ...size },
      ownerId,
      health: maxHealth,
      maxHealth,
      level: 1,
      active: true,
      createdTick: worldTick,
    };
    this.buildings.set(id, building);
    events.emit(new BuildingPlacedEvent(id, type, building.name, ownerId));
    return { success: true, buildingId: id };
  }

  /** Upgrade a building's level. */
  upgradeBuilding(buildingId: string, events: EventSystem): BuildingResult {
    const building = this.buildings.get(buildingId);
    if (!building) return { success: false, error: "Building not found" };
    const oldLevel = building.level;
    building.level++;
    building.maxHealth += 25; // Each upgrade increases max health.
    building.health = building.maxHealth; // Full heal on upgrade.
    events.emit(new BuildingUpgradedEvent(buildingId, building.type, oldLevel, building.level));
    return { success: true, buildingId };
  }

  /** Destroy a building. */
  destroyBuilding(buildingId: string, events: EventSystem, reason?: string): BuildingResult {
    const building = this.buildings.get(buildingId);
    if (!building) return { success: false, error: "Building not found" };
    this.buildings.delete(buildingId);
    events.emit(new BuildingDestroyedEvent(buildingId, building.type, building.ownerId, reason));
    return { success: true, buildingId };
  }

  /** Apply damage to a building. Destroys if health reaches 0. */
  damageBuilding(buildingId: string, damage: number, events: EventSystem): BuildingResult {
    const building = this.buildings.get(buildingId);
    if (!building) return { success: false, error: "Building not found" };
    const oldHealth = building.health;
    building.health = Math.max(0, building.health - damage);
    events.emit(new BuildingDamagedEvent(buildingId, building.type, damage, oldHealth, building.health));
    if (building.health <= 0) {
      this.destroyBuilding(buildingId, events, "destroyed by damage");
    }
    return { success: true, buildingId };
  }

  /** Repair a building. */
  repairBuilding(buildingId: string, amount: number, events: EventSystem): BuildingResult {
    const building = this.buildings.get(buildingId);
    if (!building) return { success: false, error: "Building not found" };
    const oldHealth = building.health;
    building.health = Math.min(building.maxHealth, building.health + amount);
    events.emit(new BuildingRepairedEvent(buildingId, building.type, amount, oldHealth, building.health));
    return { success: true, buildingId };
  }

  /** Toggle building active state. */
  setBuildingActive(buildingId: string, active: boolean): BuildingResult {
    const building = this.buildings.get(buildingId);
    if (!building) return { success: false, error: "Building not found" };
    building.active = active;
    return { success: true, buildingId };
  }

  /** Get a building by ID. */
  getBuilding(buildingId: string): Building | undefined {
    return this.buildings.get(buildingId);
  }

  /** Get all buildings owned by an entity. */
  getBuildingsByOwner(ownerId: string): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.ownerId === ownerId);
  }

  /** Get all buildings of a specific type. */
  getBuildingsByType(type: BuildingType): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.type === type);
  }

  /** Get building at a specific position (if any). */
  getBuildingAtPosition(position: BuildingPosition): Building | undefined {
    for (const building of this.buildings.values()) {
      const minX = building.position.x - building.size.width / 2;
      const maxX = building.position.x + building.size.width / 2;
      const minZ = building.position.z - building.size.depth / 2;
      const maxZ = building.position.z + building.size.depth / 2;
      if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ) {
        return building;
      }
    }
    return undefined;
  }

  /** Get all buildings. */
  getBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  /** Number of buildings. */
  get buildingCount(): number {
    return this.buildings.size;
  }

  /** Get total production from all active production buildings (if handler set). */
  getTotalProduction(): Record<string, number> {
    if (!this.productionHandler) return {};
    const total: Record<string, number> = {};
    for (const building of this.buildings.values()) {
      if (!building.active || building.type !== "production") continue;
      const output = this.productionHandler(building.id, building.type, building.level, building.ownerId);
      for (const [item, amount] of Object.entries(output)) {
        total[item] = (total[item] ?? 0) + amount;
      }
    }
    return total;
  }

  /** Get total defense from all active defense buildings (if handler set). */
  getTotalDefense(): number {
    if (!this.defenseHandler) return 0;
    let total = 0;
    for (const building of this.buildings.values()) {
      if (!building.active || building.type !== "defense") continue;
      total += this.defenseHandler(building.id, building.type, building.level);
    }
    return total;
  }

  /** WorldSystem interface: called each tick. Production buildings produce output. */
  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    // Future: periodic production, building decay, etc.
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.buildings.clear();
    this.buildingCounter = 0;
  }

  /** Serialize all buildings. */
  serialize(): Record<string, unknown> {
    const buildings: Record<string, Building> = {};
    for (const [id, building] of this.buildings) {
      buildings[id] = building;
    }
    return { buildings, buildingCounter: this.buildingCounter };
  }

  /** Deserialize buildings. */
  deserialize(data: Record<string, unknown>): void {
    if (data.buildings && typeof data.buildings === "object") {
      for (const [id, building] of Object.entries(data.buildings as Record<string, Building>)) {
        this.buildings.set(id, building);
      }
    }
    if (typeof data.buildingCounter === "number") {
      this.buildingCounter = data.buildingCounter;
    }
  }
}
