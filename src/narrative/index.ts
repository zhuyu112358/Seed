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

// --- Narrative Integration (M12 Phase 8) ---
export type {
  WorldStateNarrativeRule,
  WorldStateSnapshot,
  WorldStateNarrativeConfig,
  NpcNarrativeMapping,
  NarrativeInfluence,
  NpcNarrativeBridgeConfig,
} from "./NarrativeIntegration.js";
export {
  DEFAULT_WORLD_STATE_NARRATIVE_CONFIG,
  DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG,
  WorldStateNarrativeSystem,
  NpcNarrativeBridge,
} from "./NarrativeIntegration.js";
