// GoapSystem: WorldSystem for Goal-Oriented Action Planning.
//
// Manages goals, actions, world state, and plan execution for NPC entities.
// The planner is deterministic A* search. Ember defines specific goals,
// actions, and state keys. Seed provides the framework.
//
// M12 Phase 3: GOAP Goal-Oriented Action Planning.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import {
  WorldState,
  GoapGoal,
  GoapAction,
  GoapPlanResult,
  GoapConfig,
  DEFAULT_GOAP_CONFIG,
  PlanExecution,
  PlanExecutionStatus,
} from "./GoapTypes.js";
import { GoapPlanner } from "./GoapPlanner.js";

export class GoapSystem implements WorldSystem {
  readonly name = "goap";
  enabled = true;

  private config: GoapConfig;
  private planner: GoapPlanner;
  private readonly goals = new Map<string, GoapGoal[]>(); // entityId → goals
  private readonly actions = new Map<string, GoapAction[]>(); // entityId → actions
  private readonly worldStates = new Map<string, WorldState>(); // entityId → world state
  private readonly executions = new Map<string, PlanExecution>(); // entityId → current execution
  private currentTick = 0;
  private executionCounter = 0;
  private events: EventSystem | null = null;

  constructor(config?: Partial<GoapConfig>) {
    this.config = { ...DEFAULT_GOAP_CONFIG, ...config };
    this.planner = new GoapPlanner(this.config);
  }

  // --- Goal management ---

  /** Add a goal for an entity. */
  addGoal(entityId: string, goal: GoapGoal): void {
    let goals = this.goals.get(entityId);
    if (!goals) {
      goals = [];
      this.goals.set(entityId, goals);
    }
    goals.push(goal);
  }

  /** Get all goals for an entity. */
  getGoals(entityId: string): GoapGoal[] {
    return this.goals.get(entityId) ?? [];
  }

  /** Get the highest-priority relevant goal for an entity. */
  getCurrentGoal(entityId: string): GoapGoal | null {
    const goals = this.goals.get(entityId);
    if (!goals) return null;
    return this.planner.selectGoal(goals);
  }

  /** Update a goal's relevance or priority. */
  updateGoal(entityId: string, goalId: string, updates: Partial<GoapGoal>): boolean {
    const goals = this.goals.get(entityId);
    if (!goals) return false;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return false;
    Object.assign(goal, updates);
    return true;
  }

  /** Remove a goal from an entity. */
  removeGoal(entityId: string, goalId: string): boolean {
    const goals = this.goals.get(entityId);
    if (!goals) return false;
    const index = goals.findIndex(g => g.id === goalId);
    if (index < 0) return false;
    goals.splice(index, 1);
    return true;
  }

  // --- Action management ---

  /** Register an action for an entity. */
  addAction(entityId: string, action: GoapAction): void {
    let actions = this.actions.get(entityId);
    if (!actions) {
      actions = [];
      this.actions.set(entityId, actions);
    }
    actions.push(action);
  }

  /** Get all actions for an entity. */
  getActions(entityId: string): GoapAction[] {
    return this.actions.get(entityId) ?? [];
  }

  /** Update an action's availability or cost. */
  updateAction(entityId: string, actionId: string, updates: Partial<GoapAction>): boolean {
    const actions = this.actions.get(entityId);
    if (!actions) return false;
    const action = actions.find(a => a.id === actionId);
    if (!action) return false;
    Object.assign(action, updates);
    return true;
  }

  // --- World state management ---

  /** Set the world state for an entity. */
  setWorldState(entityId: string, state: WorldState): void {
    this.worldStates.set(entityId, { ...state });
  }

  /** Get the world state for an entity. */
  getWorldState(entityId: string): WorldState {
    return { ...(this.worldStates.get(entityId) ?? {}) };
  }

  /** Update a single state key for an entity. */
  updateWorldState(entityId: string, key: string, value: string): void {
    let state = this.worldStates.get(entityId);
    if (!state) {
      state = {};
      this.worldStates.set(entityId, state);
    }
    state[key] = value;
  }

  // --- Planning ---

  /**
   * Plan for an entity's highest-priority relevant goal.
   * Returns the plan result but does not start execution.
   */
  plan(entityId: string): GoapPlanResult {
    const goal = this.getCurrentGoal(entityId);
    if (!goal) {
      return {
        success: false,
        actions: [],
        totalCost: 0,
        goal: null,
        nodesExplored: 0,
        failureReason: "No relevant goals",
      };
    }
    const state = this.getWorldState(entityId);
    const actions = this.getActions(entityId);
    return this.planner.plan(state, goal, actions);
  }

  /**
   * Plan for a specific goal.
   */
  planForGoal(entityId: string, goalId: string): GoapPlanResult {
    const goals = this.goals.get(entityId);
    const goal = goals?.find(g => g.id === goalId);
    if (!goal) {
      return {
        success: false,
        actions: [],
        totalCost: 0,
        goal: null,
        nodesExplored: 0,
        failureReason: "Goal not found",
      };
    }
    const state = this.getWorldState(entityId);
    const actions = this.getActions(entityId);
    return this.planner.plan(state, goal, actions);
  }

  // --- Plan execution ---

  /**
   * Start executing a plan for an entity.
   * Selects the highest-priority goal, plans, and starts execution.
   */
  startPlan(entityId: string): GoapPlanResult {
    const result = this.plan(entityId);
    if (!result.success) return result;

    // If goal already satisfied (empty plan), mark as completed.
    if (result.actions.length === 0) {
      this.emitEvent(entityId, "goap.plan_completed", { goalId: result.goal?.id, reason: "already_satisfied" });
      return result;
    }

    this.executionCounter++;
    const execution: PlanExecution = {
      id: `plan_${this.executionCounter}`,
      entityId,
      actions: result.actions,
      currentIndex: 0,
      currentActionTicksRemaining: result.actions[0].duration ?? 1,
      status: "executing",
      goal: result.goal,
      totalCost: result.totalCost,
      startedAt: this.currentTick,
    };
    this.executions.set(entityId, execution);
    this.emitEvent(entityId, "goap.plan_started", {
      planId: execution.id,
      goalId: result.goal?.id,
      actionCount: result.actions.length,
      totalCost: result.totalCost,
    });
    this.emitEvent(entityId, "goap.action_started", {
      planId: execution.id,
      actionId: result.actions[0].id,
      actionName: result.actions[0].name,
      index: 0,
    });

    return result;
  }

  /** Get the current plan execution for an entity. */
  getExecution(entityId: string): PlanExecution | undefined {
    return this.executions.get(entityId);
  }

  /** Interrupt the current plan for an entity. */
  interruptPlan(entityId: string): boolean {
    const execution = this.executions.get(entityId);
    if (!execution || execution.status !== "executing") return false;
    execution.status = "interrupted";
    this.emitEvent(entityId, "goap.plan_interrupted", {
      planId: execution.id,
      goalId: execution.goal?.id,
      interruptedAtAction: execution.currentIndex,
    });
    this.executions.delete(entityId);
    return true;
  }

  /**
   * Force completion of the current action (called by external systems
   * when an action's effects have been applied to the world).
   */
  completeCurrentAction(entityId: string): boolean {
    const execution = this.executions.get(entityId);
    if (!execution || execution.status !== "executing") return false;

    const action = execution.actions[execution.currentIndex];
    // Apply action effects to world state.
    const state = this.worldStates.get(entityId) ?? {};
    Object.assign(state, action.effects);
    this.worldStates.set(entityId, state);

    this.emitEvent(entityId, "goap.action_completed", {
      planId: execution.id,
      actionId: action.id,
      actionName: action.name,
      index: execution.currentIndex,
    });

    execution.currentIndex++;
    if (execution.currentIndex >= execution.actions.length) {
      execution.status = "completed";
      this.emitEvent(entityId, "goap.plan_completed", {
        planId: execution.id,
        goalId: execution.goal?.id,
        actionCount: execution.actions.length,
        totalCost: execution.totalCost,
      });
      this.executions.delete(entityId);
    } else {
      const nextAction = execution.actions[execution.currentIndex];
      execution.currentActionTicksRemaining = nextAction.duration ?? 1;
      this.emitEvent(entityId, "goap.action_started", {
        planId: execution.id,
        actionId: nextAction.id,
        actionName: nextAction.name,
        index: execution.currentIndex,
      });
    }
    return true;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.events = events;
    this.currentTick++;

    // Update executing plans (tick-based duration).
    for (const [entityId, execution] of this.executions) {
      if (execution.status !== "executing") continue;
      execution.currentActionTicksRemaining--;
      if (execution.currentActionTicksRemaining <= 0) {
        this.completeCurrentAction(entityId);
      }
    }
  }

  stop(): void {
    this.events = null;
  }

  // --- Internal helpers ---

  private emitEvent(entityId: string, eventType: string, payload: Record<string, unknown>): void {
    if (!this.events) return;
    this.events.emit(new Event({
      type: eventType,
      payload,
      sourceId: entityId,
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const goals: Record<string, GoapGoal[]> = {};
    for (const [id, g] of this.goals) goals[id] = g;
    const actions: Record<string, GoapAction[]> = {};
    for (const [id, a] of this.actions) actions[id] = a;
    const worldStates: Record<string, WorldState> = {};
    for (const [id, s] of this.worldStates) worldStates[id] = s;
    return { goals, actions, worldStates, currentTick: this.currentTick, executionCounter: this.executionCounter };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.goals && typeof data.goals === "object") {
      for (const [id, g] of Object.entries(data.goals as Record<string, GoapGoal[]>)) {
        this.goals.set(id, g);
      }
    }
    if (data.actions && typeof data.actions === "object") {
      for (const [id, a] of Object.entries(data.actions as Record<string, GoapAction[]>)) {
        this.actions.set(id, a);
      }
    }
    if (data.worldStates && typeof data.worldStates === "object") {
      for (const [id, s] of Object.entries(data.worldStates as Record<string, WorldState>)) {
        this.worldStates.set(id, s);
      }
    }
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
    if (typeof data.executionCounter === "number") this.executionCounter = data.executionCounter;
  }
}
