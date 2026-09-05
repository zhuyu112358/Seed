// TaskSystem: manages task definitions, instances, and lifecycle for multiple agents.
// All task content (definitions, objectives, rewards) is registered by the application layer.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  TaskDefinition,
  TaskInstance,
  TaskStatus,
  TaskConditionContext,
} from "./TaskTypes.js";
import {
  TaskAvailableEvent,
  TaskAcceptedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskStatusChangedEvent,
} from "./TaskEvents.js";

export class TaskSystem {
  readonly name = "task";
  enabled = true;
  private definitions = new Map<string, TaskDefinition>();
  /** agentId -> taskId -> TaskInstance */
  private instances = new Map<string, Map<string, TaskInstance>>();
  /** agentId -> Set of completed taskIds */
  private completedTasks = new Map<string, Set<string>>();

  /** Register a task definition. Throws if ID already exists. */
  registerTask(definition: TaskDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Task definition already exists: ${definition.id}`);
    }
    this.definitions.set(definition.id, definition);
  }

  /** Remove a task definition. */
  unregisterTask(taskId: string): boolean {
    return this.definitions.delete(taskId);
  }

  /** Get a task definition by ID. */
  getTaskDefinition(taskId: string): TaskDefinition | undefined {
    return this.definitions.get(taskId);
  }

  /** Get all registered task IDs. */
  getTaskIds(): string[] {
    return Array.from(this.definitions.keys());
  }

  /** Check if conditions are met for a task to become available. */
  private checkConditions(def: TaskDefinition, agentId: string): boolean {
    if (!def.acceptConditions || def.acceptConditions.length === 0) return true;
    const completed = this.completedTasks.get(agentId) ?? new Set();
    const active = this.instances.get(agentId) ?? new Map();
    const ctx: TaskConditionContext = {
      agentId,
      completedTasks: Array.from(completed),
      activeTasks: Array.from(active.keys()),
    };
    for (const condition of def.acceptConditions) {
      if (condition.type === "task_completed") {
        if (!completed.has(condition.target)) return false;
      } else if (condition.type === "task_active") {
        if (!active.has(condition.target)) return false;
      } else if (condition.type === "custom" && condition.evaluate) {
        if (!condition.evaluate(ctx)) return false;
      }
    }
    return true;
  }

  /** Get available tasks for an agent (conditions met, not already active/completed unless repeatable). */
  getAvailableTasks(agentId: string): TaskDefinition[] {
    const active = this.instances.get(agentId) ?? new Map();
    const completed = this.completedTasks.get(agentId) ?? new Set();
    const available: TaskDefinition[] = [];
    for (const def of this.definitions.values()) {
      const instance = active.get(def.id);
      if (instance && instance.status === "active") continue;
      if (completed.has(def.id) && !def.repeatable) continue;
      if (this.checkConditions(def, agentId)) {
        available.push(def);
      }
    }
    return available;
  }

  /** Accept a task for an agent. Returns the TaskInstance or null if not available. */
  acceptTask(taskId: string, agentId: string, events: EventSystem, tick: number): TaskInstance | null {
    const def = this.definitions.get(taskId);
    if (!def) return null;
    const active = this.instances.get(agentId) ?? new Map();
    const existing = active.get(taskId);
    if (existing && existing.status === "active") return null;
    const completed = this.completedTasks.get(agentId) ?? new Set();
    if (completed.has(taskId) && !def.repeatable) return null;
    if (!this.checkConditions(def, agentId)) return null;

    const instance = new TaskInstance(taskId, agentId, def.objectives, tick);
    if (!this.instances.has(agentId)) {
      this.instances.set(agentId, new Map());
    }
    this.instances.get(agentId)!.set(taskId, instance);

    events.emit(new TaskAcceptedEvent(taskId, agentId));
    events.emit(new TaskStatusChangedEvent(taskId, agentId, "available", "active"));
    return instance;
  }

  /** Get active task instance for an agent. */
  getActiveTask(taskId: string, agentId: string): TaskInstance | undefined {
    return this.instances.get(agentId)?.get(taskId);
  }

  /** Get all active tasks for an agent. */
  getActiveTasks(agentId: string): TaskInstance[] {
    const active = this.instances.get(agentId);
    if (!active) return [];
    return Array.from(active.values());
  }

  /** Update objective progress. Returns true if task just completed. */
  updateObjectiveProgress(
    taskId: string,
    agentId: string,
    objectiveId: string,
    amount: number,
    events: EventSystem,
  ): boolean {
    const instance = this.instances.get(agentId)?.get(taskId);
    if (!instance || instance.status !== "active") return false;
    const def = this.definitions.get(taskId);
    if (!def) return false;
    const objective = def.objectives.find((o) => o.id === objectiveId);
    if (!objective) return false;

    const justCompleted = instance.updateObjective(objectiveId, amount, objective.requiredAmount);
    const prog = instance.objectiveProgress.get(objectiveId)!;
    events.emit(new TaskProgressEvent(
      taskId, agentId, objectiveId, prog.currentAmount, objective.requiredAmount, justCompleted,
    ));

    if (instance.allObjectivesCompleted()) {
      return this.completeTask(taskId, agentId, events);
    }
    return false;
  }

  /** Complete a task manually (or when all objectives done). Returns true if just completed. */
  completeTask(taskId: string, agentId: string, events: EventSystem): boolean {
    const instance = this.instances.get(agentId)?.get(taskId);
    if (!instance || instance.status !== "active") return false;
    const def = this.definitions.get(taskId);
    if (!def) return false;

    instance.status = "completed";
    instance.completedAt = Date.now();
    if (!this.completedTasks.has(agentId)) {
      this.completedTasks.set(agentId, new Set());
    }
    this.completedTasks.get(agentId)!.add(taskId);

    events.emit(new TaskCompletedEvent(taskId, agentId, def.rewards));
    events.emit(new TaskStatusChangedEvent(taskId, agentId, "active", "completed"));
    return true;
  }

  /** Fail a task. */
  failTask(taskId: string, agentId: string, reason: string, events: EventSystem): boolean {
    const instance = this.instances.get(agentId)?.get(taskId);
    if (!instance || instance.status !== "active") return false;

    instance.status = "failed";
    instance.failedAt = Date.now();
    events.emit(new TaskFailedEvent(taskId, agentId, reason));
    events.emit(new TaskStatusChangedEvent(taskId, agentId, "active", "failed"));
    return true;
  }

  /** Abandon an active task (removes it, can be re-accepted). */
  abandonTask(taskId: string, agentId: string): boolean {
    const active = this.instances.get(agentId);
    if (!active) return false;
    return active.delete(taskId);
  }

  /** Check if an agent has completed a task. */
  hasCompletedTask(taskId: string, agentId: string): boolean {
    return this.completedTasks.get(agentId)?.has(taskId) ?? false;
  }

  /** WorldSystem interface: called each tick. Checks auto-accept for available tasks. */
  tick(_dt: number, _world: World, events: EventSystem): void {
    if (!this.enabled) return;
    // Auto-accept tasks with autoAccept=true for all agents with active tasks.
    for (const [agentId] of this.instances) {
      const available = this.getAvailableTasks(agentId);
      for (const def of available) {
        if (def.autoAccept) {
          this.acceptTask(def.id, agentId, events, _world.tick);
        }
      }
    }
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.definitions.clear();
    this.instances.clear();
    this.completedTasks.clear();
  }

  /** Number of registered task definitions. */
  get definitionCount(): number {
    return this.definitions.size;
  }

  /** Serialize all task state. */
  serialize(): Record<string, unknown> {
    const instances: Record<string, unknown> = {};
    for (const [agentId, tasks] of this.instances) {
      const agentTasks: Record<string, unknown> = {};
      for (const [taskId, instance] of tasks) {
        agentTasks[taskId] = instance.serialize();
      }
      instances[agentId] = agentTasks;
    }
    const completed: Record<string, string[]> = {};
    for (const [agentId, tasks] of this.completedTasks) {
      completed[agentId] = Array.from(tasks);
    }
    return { instances, completed };
  }

  /** Deserialize task state. Definitions must be re-registered by application first. */
  deserialize(data: Record<string, unknown>): void {
    // Note: TaskInstance reconstruction requires definitions to be present.
    // State is preserved but instances need definitions for objective progress.
    if (data.completed && typeof data.completed === "object") {
      for (const [agentId, tasks] of Object.entries(data.completed as Record<string, string[]>)) {
        this.completedTasks.set(agentId, new Set(tasks));
      }
    }
  }
}
