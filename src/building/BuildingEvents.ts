// Building system events.
import { Event } from "../event/Event.js";
import type { BuildingType } from "./BuildingTypes.js";

/** Emitted when a building is placed. */
export class BuildingPlacedEvent extends Event<{
  buildingId: string;
  buildingType: BuildingType;
  buildingName: string;
  ownerId: string;
}> {
  constructor(buildingId: string, buildingType: BuildingType, buildingName: string, ownerId: string) {
    super({
      type: "building.placed",
      payload: { buildingId, buildingType, buildingName, ownerId },
      sourceId: "building-system",
    });
  }
}

/** Emitted when a building is upgraded. */
export class BuildingUpgradedEvent extends Event<{
  buildingId: string;
  buildingType: BuildingType;
  oldLevel: number;
  newLevel: number;
}> {
  constructor(buildingId: string, buildingType: BuildingType, oldLevel: number, newLevel: number) {
    super({
      type: "building.upgraded",
      payload: { buildingId, buildingType, oldLevel, newLevel },
      sourceId: "building-system",
    });
  }
}

/** Emitted when a building is destroyed. */
export class BuildingDestroyedEvent extends Event<{
  buildingId: string;
  buildingType: BuildingType;
  ownerId: string;
  reason?: string;
}> {
  constructor(buildingId: string, buildingType: BuildingType, ownerId: string, reason?: string) {
    super({
      type: "building.destroyed",
      payload: { buildingId, buildingType, ownerId, reason },
      sourceId: "building-system",
    });
  }
}

/** Emitted when a building takes damage. */
export class BuildingDamagedEvent extends Event<{
  buildingId: string;
  buildingType: BuildingType;
  damage: number;
  oldHealth: number;
  newHealth: number;
}> {
  constructor(buildingId: string, buildingType: BuildingType, damage: number, oldHealth: number, newHealth: number) {
    super({
      type: "building.damaged",
      payload: { buildingId, buildingType, damage, oldHealth, newHealth },
      sourceId: "building-system",
    });
  }
}

/** Emitted when a building is repaired. */
export class BuildingRepairedEvent extends Event<{
  buildingId: string;
  buildingType: BuildingType;
  repairAmount: number;
  oldHealth: number;
  newHealth: number;
}> {
  constructor(buildingId: string, buildingType: BuildingType, repairAmount: number, oldHealth: number, newHealth: number) {
    super({
      type: "building.repaired",
      payload: { buildingId, buildingType, repairAmount, oldHealth, newHealth },
      sourceId: "building-system",
    });
  }
}

/** Emitted when a production building produces output. */
export class BuildingProductionEvent extends Event<{
  buildingId: string;
  buildingType: BuildingType;
  buildingName: string;
  ownerId: string;
  level: number;
  output: Record<string, number>;
}> {
  constructor(
    buildingId: string,
    buildingType: BuildingType,
    buildingName: string,
    ownerId: string,
    level: number,
    output: Record<string, number>,
  ) {
    super({
      type: "building.production",
      payload: { buildingId, buildingType, buildingName, ownerId, level, output },
      sourceId: "building-system",
    });
  }
}
