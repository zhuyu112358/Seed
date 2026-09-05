// Task system events.
import { Event } from "../event/Event.js";
import type { TaskStatus } from "./TaskTypes.js";

/** Emitted when a task becomes available to an agent. */
export class TaskAvailableEvent extends Event<{
  taskId: string;
  agentId: string;
}> {
  constructor(taskId: string, agentId: string) {
    super({
      type: "task.available",
      payload: { taskId, agentId },
      sourceId: "task-system",
    });
  }
}

/** Emitted when an agent accepts a task. */
export class TaskAcceptedEvent extends Event<{
  taskId: string;
  agentId: string;
}> {
  constructor(taskId: string, agentId: string) {
    super({
      type: "task.accepted",
      payload: { taskId, agentId },
      sourceId: "task-system",
    });
  }
}

/** Emitted when task objective progress changes. */
export class TaskProgressEvent extends Event<{
  taskId: string;
  agentId: string;
  objectiveId: string;
  currentAmount: number;
  requiredAmount: number;
  objectiveCompleted: boolean;
}> {
  constructor(
    taskId: string,
    agentId: string,
    objectiveId: string,
    currentAmount: number,
    requiredAmount: number,
    objectiveCompleted: boolean,
  ) {
    super({
      type: "task.progress",
      payload: { taskId, agentId, objectiveId, currentAmount, requiredAmount, objectiveCompleted },
      sourceId: "task-system",
    });
  }
}

/** Emitted when a task is completed. */
export class TaskCompletedEvent extends Event<{
  taskId: string;
  agentId: string;
  rewards?: Record<string, unknown>;
}> {
  constructor(taskId: string, agentId: string, rewards?: Record<string, unknown>) {
    super({
      type: "task.completed",
      payload: { taskId, agentId, rewards },
      sourceId: "task-system",
    });
  }
}

/** Emitted when a task fails. */
export class TaskFailedEvent extends Event<{
  taskId: string;
  agentId: string;
  reason: string;
}> {
  constructor(taskId: string, agentId: string, reason: string) {
    super({
      type: "task.failed",
      payload: { taskId, agentId, reason },
      sourceId: "task-system",
    });
  }
}

/** Emitted when task status changes. */
export class TaskStatusChangedEvent extends Event<{
  taskId: string;
  agentId: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
}> {
  constructor(taskId: string, agentId: string, oldStatus: TaskStatus, newStatus: TaskStatus) {
    super({
      type: "task.status_changed",
      payload: { taskId, agentId, oldStatus, newStatus },
      sourceId: "task-system",
    });
  }
}
