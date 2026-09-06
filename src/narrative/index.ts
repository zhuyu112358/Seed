// Narrative system module exports.
export type {
  NarrativeStatus,
  NarrativeContext,
  NarrativeNode,
  NarrativeChainDefinition,
} from "./NarrativeTypes.js";
export { NarrativeChainInstance } from "./NarrativeTypes.js";
export {
  NarrativeStartedEvent,
  NarrativeNodeEnteredEvent,
  NarrativeNodeExitedEvent,
  NarrativeBranchEvent,
  NarrativeCompletedEvent,
} from "./NarrativeEvents.js";
export { NarrativeSystem } from "./NarrativeSystem.js";

// --- Dynamic Narrative (M12 Phase 6) ---
export type {
  DynamicNarrativeArc,
  DynamicNarrativeArcStatus,
  NarrativePhase,
  DynamicNarrativeEvent,
  DynamicNarrativeEventType,
  DynamicNarrativeBranch,
  DynamicNarrativeChoice,
  DynamicNarrativeConfig,
  DynamicArcAdvancementResult,
} from "./DynamicNarrativeTypes.js";
export { DEFAULT_DYNAMIC_NARRATIVE_CONFIG } from "./DynamicNarrativeTypes.js";
export { DynamicNarrativeSystem } from "./DynamicNarrativeSystem.js";
