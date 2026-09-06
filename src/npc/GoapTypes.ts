// GOAP (Goal-Oriented Action Planning) types for M12 Phase 3.
//
// Seed provides the GOAP framework (goals, actions, planner, world state).
// Ember defines specific goals, actions, and state keys. The planner is
// deterministic A* search over a discrete state space.

/** World state as a flat key-value map. Values are strings for discrete states. */
export type WorldState = Record<string, string>;

/** A goal that an NPC wants to achieve. */
export interface GoapGoal {
  /** Unique goal ID. */
  id: string;
  /** Human-readable goal name. */
  name: string;
  /** Priority (higher = more important). Used for goal selection. */
  priority: number;
  /** Target state that satisfies this goal (partial state match). */
  targetState: WorldState;
  /** Whether this goal is currently relevant/active. */
  relevant: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** An action that can be planned and executed. */
export interface GoapAction {
  /** Unique action ID. */
  id: string;
  /** Human-readable action name. */
  name: string;
  /** Preconditions that must be met before this action can be taken (partial state match). */
  preconditions: WorldState;
  /** Effects that this action has on the world state after execution. */
  effects: WorldState;
  /** Base cost of this action (higher = less preferred). */
  cost: number;
  /** Duration in ticks to execute this action. Default 1. */
  duration?: number;
  /** Whether this action is currently available. Default true. */
  available?: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A single node in the GOAP search graph. */
export interface GoapNode {
  /** Current world state at this node. */
  state: WorldState;
  /** Action taken to reach this node (null for start node). */
  action: GoapAction | null;
  /** Parent node (null for start node). */
  parent: GoapNode | null;
  /** Accumulated cost from start to this node (g-score). */
  gScore: number;
  /** Heuristic estimate from this node to goal (h-score). */
  hScore: number;
  /** Total f-score = g + h. */
  fScore: number;
  /** Depth of this node in the search tree. */
  depth: number;
}

/** Result of a GOAP planning attempt. */
export interface GoapPlanResult {
  /** Whether a valid plan was found. */
  success: boolean;
  /** The planned action sequence (empty if no plan found). */
  actions: GoapAction[];
  /** Total cost of the plan. */
  totalCost: number;
  /** The goal that was planned for. */
  goal: GoapGoal | null;
  /** Number of nodes explored during search. */
  nodesExplored: number;
  /** Reason why planning failed (if success=false). */
  failureReason?: string;
}

/** Configuration for the GOAP planner. */
export interface GoapConfig {
  /** Maximum search depth. Default 20. */
  maxSearchDepth: number;
  /** Maximum number of nodes to explore. Default 1000. */
  maxNodesExplored: number;
  /** Whether to use A* heuristic. Default true. */
  useHeuristic: boolean;
  /** Heuristic weight (higher = more greedy). Default 1.0. */
  heuristicWeight: number;
}

/** Default GOAP configuration. */
export const DEFAULT_GOAP_CONFIG: GoapConfig = {
  maxSearchDepth: 20,
  maxNodesExplored: 1000,
  useHeuristic: true,
  heuristicWeight: 1.0,
};

/** Status of a GOAP plan executor. */
export type PlanExecutionStatus = "idle" | "executing" | "completed" | "failed" | "interrupted";

/** A running plan execution instance. */
export interface PlanExecution {
  /** Unique execution ID. */
  id: string;
  /** Entity ID this plan belongs to. */
  entityId: string;
  /** The planned action sequence. */
  actions: GoapAction[];
  /** Index of the currently executing action. */
  currentIndex: number;
  /** Ticks remaining for the current action. */
  currentActionTicksRemaining: number;
  /** Execution status. */
  status: PlanExecutionStatus;
  /** The goal this plan was created for. */
  goal: GoapGoal | null;
  /** Total cost of the plan. */
  totalCost: number;
  /** When execution started (tick count). */
  startedAt: number;
}
