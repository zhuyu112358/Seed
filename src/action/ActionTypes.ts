// Action system types for M11: enhanced action system with state machine,
// durations, cooldowns, and animation events.
//
// Seed provides the action execution framework (state machine, timing, events).
// Ember (soul engine) decides which actions to take and when. Application layer
// configures action definitions (durations, cooldowns, ranges).

/** High-level action categories. */
export type ActionCategory =
  | "idle"
  | "move"
  | "attack"
  | "defend"
  | "interact"
  | "harvest"
  | "build"
  | "communicate"
  | "use"
  | "custom";

/** States of an action in the state machine. */
export type ActionState =
  | "idle"        // No active action, ready to start.
  | "casting"     // Action is being prepared (cast time), can be interrupted.
  | "active"      // Action is executing (duration), may be cancellable.
  | "cooling"     // Action completed, waiting for cooldown to expire.
  | "interrupted"; // Action was interrupted during casting/active.

/** Definition of an action type (configurable, no hardcoded world-specific values). */
export interface ActionDefinition {
  /** Unique action type identifier. */
  type: string;
  /** Human-readable action name. */
  name: string;
  /** Action category for grouping and filtering. */
  category: ActionCategory;
  /** Cast time in ticks (preparation before active phase). Default 0. */
  castTime: number;
  /** Active duration in ticks (how long the action effect lasts). Default 0 (instant). */
  duration: number;
  /** Cooldown in ticks after completion before action can be used again. Default 0. */
  cooldown: number;
  /** Maximum range to target (0 = no range check). Default 0. */
  range: number;
  /** Whether this action can be interrupted during casting. Default true. */
  cancellable: boolean;
  /** Animation event name emitted on action start (for client animation). */
  animationEvent?: string;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Default action definition values. */
export const DEFAULT_ACTION_DEFINITION: Omit<ActionDefinition, "type" | "name" | "category"> = {
  castTime: 0,
  duration: 0,
  cooldown: 0,
  range: 0,
  cancellable: true,
};

/** An active action instance with progress tracking. */
export interface ActionInstance {
  /** The action definition being executed. */
  definition: ActionDefinition;
  /** Current state. */
  state: ActionState;
  /** Elapsed ticks in current state. */
  elapsedTicks: number;
  /** Progress in current state (0-1). */
  progress: number;
  /** Target entity ID (optional). */
  targetId?: string;
  /** Tick when action was started. */
  startedTick: number;
  /** Tick when action entered current state. */
  stateEnteredTick: number;
}

/** Result of attempting to start an action. */
export interface ActionStartResult {
  success: boolean;
  /** Reason for failure (if any). */
  reason?: string;
  /** The action instance (if started successfully). */
  instance?: ActionInstance;
}

/** Event payload for action state changes. */
export interface ActionEventPayload {
  entityId: string;
  actionType: string;
  actionName: string;
  category: ActionCategory;
  state: ActionState;
  progress: number;
  targetId?: string;
  [key: string]: unknown;
}
