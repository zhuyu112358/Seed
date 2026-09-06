// Task system module exports.
export type {
  ObjectiveType,
  TaskObjective,
  TaskObjectiveContext,
  ObjectiveProgress,
  TaskStatus,
  TaskDefinition,
  TaskCondition,
  TaskConditionContext,
} from "./TaskTypes.js";
export { TaskInstance } from "./TaskTypes.js";
export {
  TaskAvailableEvent,
  TaskAcceptedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskStatusChangedEvent,
} from "./TaskEvents.js";
export { TaskSystem } from "./TaskSystem.js";

// --- Task Chain (M12 Phase 7) ---
export type {
  TaskChain,
  TaskChainStatus,
  TaskChainStep,
  ChainStepStatus,
  TaskChainConfig,
  StepProgressionResult,
  DependencyCheckResult,
} from "./TaskChainTypes.js";
export { DEFAULT_TASK_CHAIN_CONFIG } from "./TaskChainTypes.js";
export { TaskChainSystem } from "./TaskChainSystem.js";
