// Task objective types. Extensible via custom callback.
export type ObjectiveType = "collect" | "reach" | "interact" | "kill" | "custom";

/** A single objective within a task. */
export interface TaskObjective {
  id: string;
  type: ObjectiveType;
  /** Target identifier (resource type id, location id, entity id, etc.). */
  target: string;
  /** Required amount to complete this objective. */
  requiredAmount: number;
  /** Human-readable description. */
  description?: string;
  /** For custom objectives: evaluation callback. */
  evaluate?: (context: TaskObjectiveContext) => number;
}

/** Context passed to custom objective evaluators. */
export interface TaskObjectiveContext {
  agentId: string;
  world: unknown;
  blackboard?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Progress state for a single objective within a task instance. */
export interface ObjectiveProgress {
  objectiveId: string;
  currentAmount: number;
  completed: boolean;
}

/** Task status lifecycle. */
export type TaskStatus = "locked" | "available" | "active" | "completed" | "failed";

/** Definition of a task (template, registered at runtime by application). */
export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  objectives: TaskObjective[];
  /** Rewards granted on completion (opaque, application-defined). */
  rewards?: Record<string, unknown>;
  /** Conditions that must be met for task to become available. */
  acceptConditions?: TaskCondition[];
  /** If true, task is auto-accepted when available. */
  autoAccept?: boolean;
  /** Whether task can be repeated after completion. */
  repeatable?: boolean;
}

/** Condition for task availability. */
export interface TaskCondition {
  type: "task_completed" | "task_active" | "custom" | "level" | "resource";
  /** Target for the condition (task id, level threshold, resource type, etc.). */
  target: string;
  /** Comparison value. */
  value?: unknown;
  /** For custom conditions. */
  evaluate?: (context: TaskConditionContext) => boolean;
}

/** Context for task condition evaluation. */
export interface TaskConditionContext {
  agentId: string;
  completedTasks: string[];
  activeTasks: string[];
  [key: string]: unknown;
}

/** An instance of a task accepted by an agent. */
export class TaskInstance {
  readonly taskId: string;
  readonly agentId: string;
  status: TaskStatus;
  objectiveProgress: Map<string, ObjectiveProgress>;
  acceptedAt: number;
  completedAt?: number;
  failedAt?: number;

  constructor(taskId: string, agentId: string, objectives: TaskObjective[], tick: number) {
    this.taskId = taskId;
    this.agentId = agentId;
    this.status = "active";
    this.acceptedAt = tick;
    this.objectiveProgress = new Map();
    for (const obj of objectives) {
      this.objectiveProgress.set(obj.id, {
        objectiveId: obj.id,
        currentAmount: 0,
        completed: false,
      });
    }
  }

  /** Update progress for an objective. Returns true if objective just completed. */
  updateObjective(objectiveId: string, amount: number, required: number): boolean {
    const prog = this.objectiveProgress.get(objectiveId);
    if (!prog || prog.completed) return false;
    prog.currentAmount = Math.min(prog.currentAmount + amount, required);
    if (prog.currentAmount >= required) {
      prog.completed = true;
      return true;
    }
    return false;
  }

  /** Check if all objectives are completed. */
  allObjectivesCompleted(): boolean {
    for (const prog of this.objectiveProgress.values()) {
      if (!prog.completed) return false;
    }
    return true;
  }

  /** Get completion percentage (0-1). */
  getProgress(): number {
    let total = 0;
    let completed = 0;
    for (const prog of this.objectiveProgress.values()) {
      total++;
      if (prog.completed) completed++;
    }
    return total === 0 ? 1 : completed / total;
  }

  /** Serialize to plain object. */
  serialize(): Record<string, unknown> {
    const objectives: Record<string, unknown> = {};
    for (const [id, prog] of this.objectiveProgress) {
      objectives[id] = prog;
    }
    return {
      taskId: this.taskId,
      agentId: this.agentId,
      status: this.status,
      objectives,
      acceptedAt: this.acceptedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
    };
  }
}
