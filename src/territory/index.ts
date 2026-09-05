// Territory system module exports.
export type {
  TerritoryBoundary,
  Territory,
  TerritoryResult,
  TerritoryPosition,
} from "./TerritoryTypes.js";
export {
  TerritoryClaimedEvent,
  TerritoryAbandonedEvent,
  TerritoryExpandedEvent,
  TerritoryEnteredEvent,
  TerritoryLeftEvent,
} from "./TerritoryEvents.js";
export { TerritorySystem } from "./TerritorySystem.js";
