// InteractionSystem: manages state machines for interactive objects.
// This is a generic system - no specific world properties or soul logic.
// Objects register their state machine (e.g. door: open<->closed, switch: on<->off),
// and interactions trigger state transitions + event emission.
//
// Corresponds to requirement 5: virtual physical world, object definitions and interactions.

import type { World, WorldSystem } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Event } from '../event/Event.js';
import { Logger } from '../reliability/Logger.js';

const log = Logger.for('interaction-system');

/** Type of interactive object. Determines default state machine behavior. */
export type InteractableType = 'toggle' | 'door' | 'button' | 'lever' | 'container' | 'custom';

/** A state transition rule: from state A to state B when interacted. */
export interface StateTransition {
  from: string;
  to: string;
  /** Optional condition function name (evaluated externally). If not met, transition is blocked. */
  condition?: string;
  /** Optional message emitted when transition is blocked. */
  blockedMessage?: string;
}

/** Definition of an interactive object's state machine. */
export interface InteractableDef {
  /** Unique entity ID this definition applies to. */
  entityId: string;
  /** Type of interactive object. */
  type: InteractableType;
  /** Human-readable name. */
  name: string;
  /** Initial state. */
  initialState: string;
  /** All valid states. */
  states: string[];
  /** State transition rules. Order matters - first matching rule wins. */
  transitions: StateTransition[];
  /** Whether this object can be used (consumed/activated) in addition to interacted. */
  usable?: boolean;
  /** Maximum use count before depletion (0 = infinite). */
  maxUses?: number;
}

/** Runtime state of an interactive object. */
export interface InteractableRuntime {
  def: InteractableDef;
  currentState: string;
  useCount: number;
  interactCount: number;
  lastInteractedBy: string | null;
  lastInteractedAt: number;
  lastUsedBy: string | null;
  lastUsedAt: number;
}

/** Result of an interaction attempt. */
export interface InteractionResult {
  success: boolean;
  entityId: string;
  entityName: string;
  previousState: string;
  newState: string;
  actorId: string | null;
  message: string;
  transitioned: boolean;
}

/** Configuration for InteractionSystem. */
export interface InteractionSystemConfig {
  /** Whether to emit events on state transitions. Default: true */
  emitEvents?: boolean;
  /** Maximum interactive objects tracked. Default: 1000 */
  maxInteractables?: number;
}

const DEFAULT_CONFIG: Required<InteractionSystemConfig> = {
  emitEvents: true,
  maxInteractables: 1000,
};

/**
 * InteractionSystem manages state machines for interactive objects.
 *
 * Usage:
 *   const system = new InteractionSystem();
 *   world.addSystem(system);
 *   system.register({ entityId: 'door1', type: 'door', name: 'Wooden Door',
 *     initialState: 'closed', states: ['open', 'closed'],
 *     transitions: [{ from: 'closed', to: 'open' }, { from: 'open', to: 'closed' }] });
 *   const result = system.interact('door1', 'soul_vex');
 *   // result: { success: true, previousState: 'closed', newState: 'open', ... }
 */
export class InteractionSystem implements WorldSystem {
  readonly name = 'interaction';
  enabled = true;

  private config: Required<InteractionSystemConfig>;
  private interactables = new Map<string, InteractableRuntime>();

  constructor(config?: InteractionSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register an interactive object with its state machine definition. */
  register(def: InteractableDef): boolean {
    if (this.interactables.size >= this.config.maxInteractables) {
      log.warn({ entityId: def.entityId }, 'max interactables reached, registration rejected');
      return false;
    }
    if (!def.states.includes(def.initialState)) {
      log.warn({ entityId: def.entityId, initialState: def.initialState }, 'initialState not in states list');
      return false;
    }
    this.interactables.set(def.entityId, {
      def,
      currentState: def.initialState,
      useCount: 0,
      interactCount: 0,
      lastInteractedBy: null,
      lastInteractedAt: 0,
      lastUsedBy: null,
      lastUsedAt: 0,
    });
    return true;
  }

  /** Unregister an interactive object. */
  unregister(entityId: string): boolean {
    return this.interactables.delete(entityId);
  }

  /** Check if an entity is registered as interactive. */
  isRegistered(entityId: string): boolean {
    return this.interactables.has(entityId);
  }

  /** Get current state of an interactive object. */
  getState(entityId: string): string | null {
    return this.interactables.get(entityId)?.currentState ?? null;
  }

  /** Get full runtime info for an interactive object. */
  getRuntime(entityId: string): InteractableRuntime | null {
    return this.interactables.get(entityId) ?? null;
  }

  /** Get all registered interactive object IDs. */
  getAllIds(): string[] {
    return [...this.interactables.keys()];
  }

  /** Get count of registered interactive objects. */
  get count(): number {
    return this.interactables.size;
  }

  /**
   * Interact with an object - triggers state transition based on current state.
   * @param entityId - The interactive object's ID.
   * @param actorId - Optional ID of the actor (soul/player) initiating the interaction.
   * @param events - Optional EventSystem to emit transition events.
   */
  interact(entityId: string, actorId?: string, events?: EventSystem): InteractionResult {
    const runtime = this.interactables.get(entityId);
    if (!runtime) {
      return this.failResult(entityId, 'unknown', '', actorId ?? null, `entity not registered as interactive: ${entityId}`);
    }

    const previousState = runtime.currentState;
    const transition = runtime.def.transitions.find((t) => t.from === previousState);

    if (!transition) {
      return this.failResult(entityId, runtime.def.name, previousState, actorId ?? null, `no transition from state '${previousState}'`);
    }

    // Apply transition.
    runtime.currentState = transition.to;
    runtime.interactCount++;
    runtime.lastInteractedBy = actorId ?? null;
    runtime.lastInteractedAt = Date.now();

    // Emit event if requested.
    if (this.config.emitEvents && events) {
      events.emit(new Event({
        type: 'interaction.state-change',
        payload: {
          entityId,
          entityName: runtime.def.name,
          interactableType: runtime.def.type,
          previousState,
          newState: transition.to,
          actorId: actorId ?? null,
          interactCount: runtime.interactCount,
        },
        sourceId: entityId,
      }));
    }

    log.info(
      { entityId, name: runtime.def.name, from: previousState, to: transition.to, actor: actorId ?? 'unknown' },
      'interaction state transition',
    );

    return {
      success: true,
      entityId,
      entityName: runtime.def.name,
      previousState,
      newState: transition.to,
      actorId: actorId ?? null,
      message: `${runtime.def.name}: ${previousState} -> ${transition.to}`,
      transitioned: true,
    };
  }

  /**
   * Use an object - for consumable/activatable objects (e.g. torch, lever).
   * Increments use count; if maxUses is set and reached, object becomes depleted.
   */
  use(entityId: string, actorId?: string, events?: EventSystem): InteractionResult {
    const runtime = this.interactables.get(entityId);
    if (!runtime) {
      return this.failResult(entityId, 'unknown', '', actorId ?? null, `entity not registered: ${entityId}`);
    }
    if (!runtime.def.usable) {
      return this.failResult(entityId, runtime.def.name, runtime.currentState, actorId ?? null, `${runtime.def.name} is not usable`);
    }
    if (runtime.def.maxUses && runtime.def.maxUses > 0 && runtime.useCount >= runtime.def.maxUses) {
      return this.failResult(entityId, runtime.def.name, runtime.currentState, actorId ?? null, `${runtime.def.name} is depleted (${runtime.useCount}/${runtime.def.maxUses} uses)`);
    }

    runtime.useCount++;
    runtime.lastUsedBy = actorId ?? null;
    runtime.lastUsedAt = Date.now();
    const depleted = runtime.def.maxUses ? runtime.useCount >= runtime.def.maxUses : false;

    if (this.config.emitEvents && events) {
      events.emit(new Event({
        type: 'interaction.use',
        payload: {
          entityId,
          entityName: runtime.def.name,
          useCount: runtime.useCount,
          maxUses: runtime.def.maxUses ?? 0,
          depleted,
          actorId: actorId ?? null,
        },
        sourceId: entityId,
      }));
    }

    return {
      success: true,
      entityId,
      entityName: runtime.def.name,
      previousState: runtime.currentState,
      newState: runtime.currentState,
      actorId: actorId ?? null,
      message: `used ${runtime.def.name} (${runtime.useCount}${runtime.def.maxUses ? `/${runtime.def.maxUses}` : ''} uses)${depleted ? ' - now depleted' : ''}`,
      transitioned: false,
    };
  }

  /** Reset an interactive object to its initial state. */
  reset(entityId: string): boolean {
    const runtime = this.interactables.get(entityId);
    if (!runtime) return false;
    runtime.currentState = runtime.def.initialState;
    runtime.useCount = 0;
    runtime.interactCount = 0;
    runtime.lastInteractedBy = null;
    runtime.lastInteractedAt = 0;
    runtime.lastUsedBy = null;
    runtime.lastUsedAt = 0;
    return true;
  }

  /** WorldSystem tick - no-op (interactions are event-driven, not tick-driven). */
  tick(_dt: number, _world: World, _events: EventSystem): void {
    // Interactions are triggered via interact()/use() calls, not per-tick.
    // This method exists for WorldSystem interface compliance.
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }

  /** Get statistics about all interactive objects. */
  getStats(): {
    totalRegistered: number;
    totalInteractions: number;
    totalUses: number;
    byType: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    let totalInteractions = 0;
    let totalUses = 0;
    for (const runtime of this.interactables.values()) {
      byType[runtime.def.type] = (byType[runtime.def.type] ?? 0) + 1;
      totalInteractions += runtime.interactCount;
      totalUses += runtime.useCount;
    }
    return { totalRegistered: this.interactables.size, totalInteractions, totalUses, byType };
  }

  private failResult(
    entityId: string,
    entityName: string,
    previousState: string,
    actorId: string | null,
    message: string,
  ): InteractionResult {
    return {
      success: false,
      entityId,
      entityName,
      previousState,
      newState: previousState,
      actorId,
      message,
      transitioned: false,
    };
  }
}

// ============================================================================
// Built-in interactive object definitions (factory helpers)
// ============================================================================

/** Create a door definition (open <-> closed). */
export function createDoorDef(entityId: string, name = 'Door', initialState = 'closed'): InteractableDef {
  return {
    entityId,
    type: 'door',
    name,
    initialState,
    states: ['open', 'closed'],
    transitions: [
      { from: 'closed', to: 'open' },
      { from: 'open', to: 'closed' },
    ],
    usable: false,
  };
}

/** Create a toggle/switch definition (on <-> off). */
export function createToggleDef(entityId: string, name = 'Switch', initialState = 'off'): InteractableDef {
  return {
    entityId,
    type: 'toggle',
    name,
    initialState,
    states: ['on', 'off'],
    transitions: [
      { from: 'off', to: 'on' },
      { from: 'on', to: 'off' },
    ],
    usable: true,
  };
}

/** Create a button definition (pressed -> returns to released after interaction). */
export function createButtonDef(entityId: string, name = 'Button'): InteractableDef {
  return {
    entityId,
    type: 'button',
    name,
    initialState: 'released',
    states: ['released', 'pressed'],
    transitions: [
      { from: 'released', to: 'pressed' },
      { from: 'pressed', to: 'released' },
    ],
    usable: true,
    maxUses: 0,
  };
}

/** Create a container definition (open <-> closed, usable for taking items). */
export function createContainerDef(entityId: string, name = 'Container', initialState = 'closed'): InteractableDef {
  return {
    entityId,
    type: 'container',
    name,
    initialState,
    states: ['open', 'closed'],
    transitions: [
      { from: 'closed', to: 'open' },
      { from: 'open', to: 'closed' },
    ],
    usable: true,
  };
}

/** Create a lever definition (up <-> down). */
export function createLeverDef(entityId: string, name = 'Lever', initialState = 'down'): InteractableDef {
  return {
    entityId,
    type: 'lever',
    name,
    initialState,
    states: ['up', 'down'],
    transitions: [
      { from: 'down', to: 'up' },
      { from: 'up', to: 'down' },
    ],
    usable: false,
  };
}
