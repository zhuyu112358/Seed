// Task Chain types for M12 Phase 7: Task chain deepening.
//
// Extends the M6 TaskSystem with multi-step chains, dependency resolution,
// task state machines, and task narrative integration.
// Seed provides the chain framework; application layer defines specific tasks.

/** Status of a task chain step. */
export type ChainStepStatus = "locked" | "available" | "active" | "completed" | "failed" | "skipped";

/** A single step in a task chain. */
export interface TaskChainStep {
  /** Unique step ID within the chain. */
  id: string;
  /** Step name. */
  name: string;
  /** Step description. */
  description: string;
  /** IDs of steps that must be completed before this step becomes available. */
  dependencies: string[];
  /** Current status. */
  status: ChainStepStatus;
  /** Task definition ID this step maps to (optional, links to M6 TaskSystem). */
  taskDefinitionId?: string;
  /** Narrative text for this step. */
  narrative?: string;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
  /** When the step was started (tick count). */
  startedAt?: number;
  /** When the step was completed (tick count). */
  completedAt?: number;
}

/** Status of a task chain. */
export type TaskChainStatus = "locked" | "available" | "active" | "completed" | "failed";

/** A multi-step task chain with dependency resolution. */
export interface TaskChain {
  /** Unique chain ID. */
  id: string;
  /** Chain name. */
  name: string;
  /** Chain description. */
  description: string;
  /** Ordered list of steps. */
  steps: TaskChainStep[];
  /** Current status. */
  status: TaskChainStatus;
  /** Participants (entity IDs). */
  participants: string[];
  /** Priority (higher = more important). */
  priority: number;
  /** Overall narrative arc for this chain. */
  narrative?: string;
  /** When the chain was started (tick count). */
  startedAt?: number;
  /** When the chain was completed (tick count). */
  completedAt?: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Configuration for the task chain system. */
export interface TaskChainConfig {
  /** Whether to auto-unlock steps when dependencies are met. Default true. */
  autoUnlockSteps: boolean;
  /** Whether to auto-complete chain when all steps are done. Default true. */
  autoCompleteChain: boolean;
  /** Whether to emit events on chain/step changes. Default true. */
  emitEvents: boolean;
  /** Whether failed steps fail the entire chain. Default false. */
  failChainOnStepFailure: boolean;
}

/** Default task chain configuration. */
export const DEFAULT_TASK_CHAIN_CONFIG: TaskChainConfig = {
  autoUnlockSteps: true,
  autoCompleteChain: true,
  emitEvents: true,
  failChainOnStepFailure: false,
};

/** Result of a step progression check. */
export interface StepProgressionResult {
  /** Whether the step was progressed. */
  progressed: boolean;
  /** The step ID. */
  stepId: string;
  /** Previous status. */
  previousStatus: ChainStepStatus;
  /** New status. */
  newStatus: ChainStepStatus;
  /** Reason for the change. */
  reason: string;
}

/** Result of a dependency check. */
export interface DependencyCheckResult {
  /** Whether all dependencies are met. */
  satisfied: boolean;
  /** IDs of dependencies that are not yet completed. */
  missingDependencies: string[];
  /** IDs of dependencies that are completed. */
  completedDependencies: string[];
}
