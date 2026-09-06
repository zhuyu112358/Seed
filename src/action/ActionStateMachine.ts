// ActionStateMachine: per-entity action state machine with casting, duration,
// cooldown, and interruption support.
//
// State flow:
//   idle → casting → active → cooling → idle
//           ↓          ↓
//       interrupted  interrupted (if cancellable)
//
// Seed provides the state machine and timing. Ember decides which actions to take.
// Application layer configures action definitions.

import {
  ActionDefinition,
  ActionInstance,
  ActionState,
  ActionStartResult,
  ActionEventPayload,
  DEFAULT_ACTION_DEFINITION,
} from "./ActionTypes.js";

export class ActionStateMachine {
  private readonly entityId: string;
  private readonly definitions = new Map<string, ActionDefinition>();
  private current: ActionInstance | null = null;
  private readonly cooldowns = new Map<string, number>(); // actionType → remaining cooldown ticks
  private currentTick = 0;
  /** Event callback invoked on state changes. */
  onStateChange?: (payload: ActionEventPayload) => void;

  constructor(entityId: string) {
    this.entityId = entityId;
  }

  // --- Action definition management ---

  /** Register an action definition. */
  registerDefinition(definition: Partial<ActionDefinition> & { type: string; name: string; category: ActionDefinition["category"] }): void {
    const full: ActionDefinition = { ...DEFAULT_ACTION_DEFINITION, ...definition };
    this.definitions.set(full.type, full);
  }

  /** Get an action definition by type. */
  getDefinition(type: string): ActionDefinition | undefined {
    return this.definitions.get(type);
  }

  /** Get all registered definitions. */
  getDefinitions(): ActionDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** Check if an action type is registered. */
  hasDefinition(type: string): boolean {
    return this.definitions.has(type);
  }

  // --- State queries ---

  /** Get current action instance (null if idle). */
  getCurrentAction(): ActionInstance | null {
    return this.current;
  }

  /** Get current state. */
  getState(): ActionState {
    return this.current?.state ?? "idle";
  }

  /** Check if the entity is idle (ready to start a new action). */
  isIdle(): boolean {
    return this.current === null;
  }

  /** Check if an action type is on cooldown. */
  isOnCooldown(type: string): boolean {
    return (this.cooldowns.get(type) ?? 0) > 0;
  }

  /** Get remaining cooldown ticks for an action type. */
  getCooldownRemaining(type: string): number {
    return this.cooldowns.get(type) ?? 0;
  }

  /** Check if an action can be started (idle + not on cooldown + definition exists). */
  canStartAction(type: string): boolean {
    if (!this.isIdle()) return false;
    if (!this.hasDefinition(type)) return false;
    if (this.isOnCooldown(type)) return false;
    return true;
  }

  // --- Action execution ---

  /**
   * Start an action.
   * @param type Action type identifier.
   * @param targetId Optional target entity ID.
   * @returns ActionStartResult with success/failure and instance.
   */
  startAction(type: string, targetId?: string): ActionStartResult {
    if (!this.hasDefinition(type)) {
      return { success: false, reason: `Action type '${type}' not registered` };
    }
    if (!this.isIdle()) {
      return { success: false, reason: `Entity is busy (state: ${this.getState()})` };
    }
    if (this.isOnCooldown(type)) {
      return { success: false, reason: `Action '${type}' on cooldown (${this.getCooldownRemaining(type)} ticks remaining)` };
    }

    const definition = this.getDefinition(type)!;
    const initialState: ActionState = definition.castTime > 0 ? "casting" : "active";

    this.current = {
      definition,
      state: initialState,
      elapsedTicks: 0,
      progress: 0,
      targetId,
      startedTick: this.currentTick,
      stateEnteredTick: this.currentTick,
    };

    this.emitStateChange();
    return { success: true, instance: this.current };
  }

  /**
   * Interrupt the current action (only if cancellable or in casting state).
   * @returns True if action was interrupted.
   */
  interrupt(): boolean {
    if (!this.current) return false;
    if (this.current.state === "cooling") return false;
    if (this.current.state === "active" && !this.current.definition.cancellable) return false;

    this.current.state = "interrupted";
    this.current.elapsedTicks = 0;
    this.current.progress = 0;
    this.emitStateChange();

    // Interrupted actions do not trigger cooldown (unless definition specifies).
    this.current = null;
    return true;
  }

  /**
   * Cancel the current action immediately (always succeeds, no cooldown).
   * @returns True if action was cancelled.
   */
  cancel(): boolean {
    if (!this.current) return false;
    this.current = null;
    return true;
  }

  // --- Update ---

  /**
   * Update the state machine by one tick.
   * Progresses casting/active/cooling states and handles state transitions.
   */
  update(): void {
    this.currentTick++;

    // Tick down all cooldowns.
    for (const [type, remaining] of this.cooldowns) {
      if (remaining <= 1) {
        this.cooldowns.delete(type);
      } else {
        this.cooldowns.set(type, remaining - 1);
      }
    }

    if (!this.current) return;

    this.current.elapsedTicks++;
    const action = this.current;

    switch (action.state) {
      case "casting": {
        action.progress = action.definition.castTime > 0
          ? Math.min(1, action.elapsedTicks / action.definition.castTime)
          : 1;
        if (action.elapsedTicks >= action.definition.castTime) {
          this.transitionTo("active");
        }
        break;
      }
      case "active": {
        action.progress = action.definition.duration > 0
          ? Math.min(1, action.elapsedTicks / action.definition.duration)
          : 1;
        if (action.definition.duration === 0 || action.elapsedTicks >= action.definition.duration) {
          if (action.definition.cooldown > 0) {
            this.cooldowns.set(action.definition.type, action.definition.cooldown);
            this.transitionTo("cooling");
          } else {
            this.completeAction();
          }
        }
        break;
      }
      case "cooling": {
        const remaining = this.cooldowns.get(action.definition.type) ?? 0;
        action.progress = action.definition.cooldown > 0
          ? 1 - remaining / action.definition.cooldown
          : 1;
        if (remaining <= 0) {
          this.completeAction();
        }
        break;
      }
      case "interrupted":
        // Should not reach here (interrupted clears current immediately).
        this.current = null;
        break;
    }
  }

  // --- Internal helpers ---

  private transitionTo(newState: ActionState): void {
    if (!this.current) return;
    this.current.state = newState;
    this.current.elapsedTicks = 0;
    this.current.progress = 0;
    this.current.stateEnteredTick = this.currentTick;
    this.emitStateChange();
  }

  private completeAction(): void {
    if (!this.current) return;
    this.current = null;
  }

  private emitStateChange(): void {
    if (!this.current || !this.onStateChange) return;
    const action = this.current;
    this.onStateChange({
      entityId: this.entityId,
      actionType: action.definition.type,
      actionName: action.definition.name,
      category: action.definition.category,
      state: action.state,
      progress: action.progress,
      targetId: action.targetId,
    });
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const definitions: Record<string, ActionDefinition> = {};
    for (const [type, def] of this.definitions) definitions[type] = def;
    const cooldowns: Record<string, number> = {};
    for (const [type, remaining] of this.cooldowns) cooldowns[type] = remaining;
    return {
      entityId: this.entityId,
      definitions,
      cooldowns,
      current: this.current,
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.definitions && typeof data.definitions === "object") {
      for (const [type, def] of Object.entries(data.definitions as Record<string, ActionDefinition>)) {
        this.definitions.set(type, def);
      }
    }
    if (data.cooldowns && typeof data.cooldowns === "object") {
      for (const [type, remaining] of Object.entries(data.cooldowns as Record<string, number>)) {
        this.cooldowns.set(type, remaining);
      }
    }
    if (data.current && typeof data.current === "object") {
      this.current = data.current as ActionInstance;
    }
    if (typeof data.currentTick === "number") {
      this.currentTick = data.currentTick;
    }
  }
}
