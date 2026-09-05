// Territory system events.
import { Event } from "../event/Event.js";
import type { TerritoryBoundary } from "./TerritoryTypes.js";

/** Emitted when a territory is claimed. */
export class TerritoryClaimedEvent extends Event<{
  territoryId: string;
  territoryName: string;
  ownerId: string;
  boundary: TerritoryBoundary;
}> {
  constructor(territoryId: string, territoryName: string, ownerId: string, boundary: TerritoryBoundary) {
    super({
      type: "territory.claimed",
      payload: { territoryId, territoryName, ownerId, boundary },
      sourceId: "territory-system",
    });
  }
}

/** Emitted when a territory is abandoned. */
export class TerritoryAbandonedEvent extends Event<{
  territoryId: string;
  territoryName: string;
  ownerId: string;
}> {
  constructor(territoryId: string, territoryName: string, ownerId: string) {
    super({
      type: "territory.abandoned",
      payload: { territoryId, territoryName, ownerId },
      sourceId: "territory-system",
    });
  }
}

/** Emitted when a territory boundary is expanded. */
export class TerritoryExpandedEvent extends Event<{
  territoryId: string;
  territoryName: string;
  ownerId: string;
  oldBoundary: TerritoryBoundary;
  newBoundary: TerritoryBoundary;
}> {
  constructor(
    territoryId: string,
    territoryName: string,
    ownerId: string,
    oldBoundary: TerritoryBoundary,
    newBoundary: TerritoryBoundary,
  ) {
    super({
      type: "territory.expanded",
      payload: { territoryId, territoryName, ownerId, oldBoundary, newBoundary },
      sourceId: "territory-system",
    });
  }
}

/** Emitted when an entity enters a territory. */
export class TerritoryEnteredEvent extends Event<{
  territoryId: string;
  territoryName: string;
  ownerId: string;
  entityId: string;
}> {
  constructor(territoryId: string, territoryName: string, ownerId: string, entityId: string) {
    super({
      type: "territory.entered",
      payload: { territoryId, territoryName, ownerId, entityId },
      sourceId: "territory-system",
    });
  }
}

/** Emitted when an entity leaves a territory. */
export class TerritoryLeftEvent extends Event<{
  territoryId: string;
  territoryName: string;
  ownerId: string;
  entityId: string;
}> {
  constructor(territoryId: string, territoryName: string, ownerId: string, entityId: string) {
    super({
      type: "territory.left",
      payload: { territoryId, territoryName, ownerId, entityId },
      sourceId: "territory-system",
    });
  }
}
