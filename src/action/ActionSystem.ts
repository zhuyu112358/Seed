// ActionSystem: WorldSystem that manages ActionStateMachine instances for multiple
// entities, emits action events to the world EventSystem, and provides a unified
// API for starting/interrupting/cancelling actions.
//
// Seed provides the action execution framework. Ember decides which actions to take.
// Application layer configures action definitions per entity type.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import { ActionStateMachine } from "./ActionStateMachine.js";
import type {
  ActionDefinition,
  ActionEventPayload,
  ActionStartResult,
  ActionState,
} from "./ActionTypes.js";

export class ActionSystem implements WorldSystem {
  readonly name = "action-system";
  enabled = true;

  private readonly machines = new Map<string, ActionStateMachine>();
  private readonly defaultDefinitions = new Map<string, ActionDefinition>();
  private readonly previousStates = new Map<string, ActionState>();
  private events: EventSystem | null = null;

  // --- Entity state machine management ---

  /**
   * Register an entity with the action system, creating a state machine.
   * @param entityId Entity ID.
   * @param definitions Optional action definitions to register for this entity.
   */
  registerEntity(entityId: string, definitions?: ActionDefinition[]): ActionStateMachine {
    let machine = this.machines.get(entityId);
    if (!machine) {
      machine = new ActionStateMachine(entityId);
      machine.onStateChange = (payload) => this.handleStateChange(payload);
      this.machines.set(entityId, machine);
    }
    if (definitions) {
      for (const def of definitions) {
        machine.registerDefinition(def);
      }
    }
    // Also register default definitions.
    for (const def of this.defaultDefinitions.values()) {
      if (!machine.hasDefinition(def.type)) {
        machine.registerDefinition(def);
      }
    }
    return machine;
  }

  /** Unregister an entity and remove its state machine. */
  unregisterEntity(entityId: string): void {
    this.machines.delete(entityId);
  }

  /** Get the state machine for an entity. */
  getMachine(entityId: string): ActionStateMachine | undefined {
    return this.machines.get(entityId);
  }

  /** Check if an entity is registered. */
  isRegistered(entityId: string): boolean {
    return this.machines.has(entityId);
  }

  /** Get all registered entity IDs. */
  getRegisteredEntities(): string[] {
    return Array.from(this.machines.keys());
  }

  // --- Default definitions ---

  /** Register a default action definition applied to all entities. */
  registerDefaultDefinition(definition: ActionDefinition): void {
    this.defaultDefinitions.set(definition.type, definition);
    // Apply to existing machines that don't have it.
    for (const machine of this.machines.values()) {
      if (!machine.hasDefinition(definition.type)) {
        machine.registerDefinition(definition);
      }
    }
  }

  /** Get all default definitions. */
  getDefaultDefinitions(): ActionDefinition[] {
    return Array.from(this.defaultDefinitions.values());
  }

  // --- Action execution API ---

  /**
   * Start an action for an entity.
   * @param entityId Entity ID.
   * @param actionType Action type identifier.
   * @param targetId Optional target entity ID.
   */
  startAction(entityId: string, actionType: string, targetId?: string): ActionStartResult {
    const machine = this.machines.get(entityId);
    if (!machine) {
      return { success: false, reason: `Entity '${entityId}' not registered` };
    }
    return machine.startAction(actionType, targetId);
  }

  /** Interrupt the current action for an entity. */
  interruptAction(entityId: string): boolean {
    return this.machines.get(entityId)?.interrupt() ?? false;
  }

  /** Cancel the current action for an entity (no cooldown). */
  cancelAction(entityId: string): boolean {
    return this.machines.get(entityId)?.cancel() ?? false;
  }

  /** Get current action state for an entity. */
  getActionState(entityId: string): ActionState {
    return this.machines.get(entityId)?.getState() ?? "idle";
  }

  /** Get current action instance for an entity. */
  getCurrentAction(entityId: string) {
    return this.machines.get(entityId)?.getCurrentAction();
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.events = events;
    for (const machine of this.machines.values()) {
      machine.update();
    }
  }

  stop(): void {
    this.machines.clear();
    this.events = null;
  }

  // --- Event handling ---

  private handleStateChange(payload: ActionEventPayload): void {
    if (!this.events) return;
    const entityId = payload.entityId;
    const prevState = this.previousStates.get(entityId) ?? "idle";
    const newState = payload.state;

    // Emit generic action state change event.
    this.events.emit(new Event({
      type: `action.${newState}`,
      payload,
      sourceId: entityId,
    }));

    // Emit semantic events based on state transitions.
    if ((prevState === "idle" || prevState === undefined) && (newState === "casting" || newState === "active")) {
      this.events.emit(new Event({
        type: "action.started",
        payload,
        sourceId: entityId,
      }));
    }
    if (newState === "interrupted") {
      this.events.emit(new Event({
        type: "action.interrupted",
        payload,
        sourceId: entityId,
      }));
    }
    if (prevState === "cooling" && newState === "idle") {
      this.events.emit(new Event({
        type: "action.completed",
        payload,
        sourceId: entityId,
      }));
    }
    // Also emit completed for instant actions (active → idle with no cooling).
    if (prevState === "active" && newState === "idle" && payload.progress >= 1) {
      this.events.emit(new Event({
        type: "action.completed",
        payload,
        sourceId: entityId,
      }));
    }

    this.previousStates.set(entityId, newState);
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const machines: Record<string, unknown> = {};
    for (const [id, machine] of this.machines) {
      machines[id] = machine.serialize();
    }
    const defaultDefinitions: Record<string, ActionDefinition> = {};
    for (const [type, def] of this.defaultDefinitions) {
      defaultDefinitions[type] = def;
    }
    return { machines, defaultDefinitions };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.machines && typeof data.machines === "object") {
      for (const [id, machineData] of Object.entries(data.machines as Record<string, Record<string, unknown>>)) {
        const machine = new ActionStateMachine(id);
        machine.deserialize(machineData);
        machine.onStateChange = (payload) => this.handleStateChange(payload);
        this.machines.set(id, machine);
      }
    }
    if (data.defaultDefinitions && typeof data.defaultDefinitions === "object") {
      for (const [type, def] of Object.entries(data.defaultDefinitions as Record<string, ActionDefinition>)) {
        this.defaultDefinitions.set(type, def);
      }
    }
  }
}
