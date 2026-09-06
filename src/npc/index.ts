// NPC module exports (M12).
export type {
  MemoryType,
  MemoryImportance,
  MemoryEntry,
  NPCMemoryConfig,
  MemoryQueryResult,
} from "./MemoryTypes.js";
export { DEFAULT_NPC_MEMORY_CONFIG, IMPORTANCE_WEIGHT } from "./MemoryTypes.js";
export { NPCMemorySystem } from "./NPCMemorySystem.js";

export type {
  BigFiveTraits,
  BehavioralTendencies,
  DecisionStyle,
  PersonalityProfile,
  PersonalityConfig,
} from "./PersonalityTypes.js";
export {
  NEUTRAL_PERSONALITY,
  PERSONALITY_ARCHETYPES,
  DEFAULT_PERSONALITY_CONFIG,
} from "./PersonalityTypes.js";
export { NPCPersonalitySystem } from "./NPCPersonalitySystem.js";

export type {
  WorldState,
  GoapGoal,
  GoapAction,
  GoapNode,
  GoapPlanResult,
  GoapConfig,
  PlanExecution,
  PlanExecutionStatus,
} from "./GoapTypes.js";
export { DEFAULT_GOAP_CONFIG } from "./GoapTypes.js";
export { GoapPlanner } from "./GoapPlanner.js";
export { GoapSystem } from "./GoapSystem.js";
