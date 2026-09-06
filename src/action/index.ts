// Action system module exports (M11).
export type {
  ActionCategory,
  ActionState,
  ActionDefinition,
  ActionInstance,
  ActionStartResult,
  ActionEventPayload,
} from "./ActionTypes.js";
export { DEFAULT_ACTION_DEFINITION } from "./ActionTypes.js";
export { ActionStateMachine } from "./ActionStateMachine.js";
export { ActionSystem } from "./ActionSystem.js";
export type { PresetOptions } from "./ActionPresets.js";
export {
  createAttackPreset,
  createDefendPreset,
  createInteractPreset,
  createHarvestPreset,
  createBuildPreset,
  createMovePreset,
  createCommunicatePreset,
  getAllPresets,
} from "./ActionPresets.js";
