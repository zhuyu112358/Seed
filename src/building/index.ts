// Building system module exports.
export type {
  BuildingType,
  BuildingPosition,
  BuildingSize,
  Building,
  BuildingResult,
  BuildingProductionHandler,
  BuildingDefenseHandler,
} from "./BuildingTypes.js";
export {
  BuildingPlacedEvent,
  BuildingUpgradedEvent,
  BuildingDestroyedEvent,
  BuildingDamagedEvent,
  BuildingRepairedEvent,
  BuildingProductionEvent,
} from "./BuildingEvents.js";
export { BuildingSystem } from "./BuildingSystem.js";
