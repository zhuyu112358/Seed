// ConsumptionSystem: manages resource consumption for souls.
// Souls consume resources over time according to registered ConsumptionRules.
// If a soul lacks sufficient resources, a ResourceConsumptionFailedEvent is emitted.
// The application layer decides consequences (death, debuff, etc.) — Seed only
// executes consumption and emits events.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { ConsumptionRule, ConsumptionRuleRegistry } from "./ConsumptionRule.js";
import type { ResourceInventory } from "./ResourceInventory.js";
import {
  ResourceConsumedEvent,
  ResourceConsumptionFailedEvent,
} from "../event/Event.js";

/** Configuration for ConsumptionSystem. */
export interface ConsumptionSystemConfig {
  /** Whether consumption is enabled by default for registered souls. */
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<ConsumptionSystemConfig> = {
  enabled: true,
};

/** Per-soul consumption state. */
interface SoulConsumptionState {
  /** Soul ID. */
  soulId: string;
  /** Inventory to consume from. */
  inventory: ResourceInventory;
  /** Tick counters per rule ID (tracks time since last consumption). */
  tickCounters: Map<string, number>;
}

/**
 * ConsumptionSystem: processes resource consumption rules for registered souls.
 *
 * Rules are registered via the rule registry. Souls are registered with their
 * inventory. Each tick, the system checks if any rule's interval has elapsed,
 * and if so, consumes the specified amount from the soul's inventory.
 */
export class ConsumptionSystem implements WorldSystem {
  readonly name = "consumption";
  enabled = true;

  private readonly config: Required<ConsumptionSystemConfig>;
  readonly rules = new ConsumptionRuleRegistry();
  private souls = new Map<string, SoulConsumptionState>();

  constructor(config?: ConsumptionSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = this.config.enabled;
  }

  /** Register a soul for consumption tracking. */
  registerSoul(soulId: string, inventory: ResourceInventory): void {
    if (this.souls.has(soulId)) return;
    this.souls.set(soulId, {
      soulId,
      inventory,
      tickCounters: new Map(),
    });
  }

  /** Unregister a soul from consumption tracking. */
  unregisterSoul(soulId: string): void {
    this.souls.delete(soulId);
  }

  /** Check if a soul is registered. */
  isRegistered(soulId: string): boolean {
    return this.souls.has(soulId);
  }

  /** Get a soul's consumption state. */
  getSoulState(soulId: string): SoulConsumptionState | undefined {
    return this.souls.get(soulId);
  }

  /** Get the number of registered souls. */
  get registeredSoulCount(): number {
    return this.souls.size;
  }

  tick(_dt: number, _world: World, events: EventSystem): void {
    if (!this.enabled) return;

    for (const state of this.souls.values()) {
      for (const rule of this.rules.getAll()) {
        const counter = state.tickCounters.get(rule.id) ?? 0;
        const newCounter = counter + 1;

        if (newCounter >= rule.intervalTicks) {
          // Time to consume.
          state.tickCounters.set(rule.id, 0);
          this.consume(state, rule, events);
        } else {
          state.tickCounters.set(rule.id, newCounter);
        }
      }
    }
  }

  /** Consume resources for a rule. Emits success or failure event. */
  private consume(state: SoulConsumptionState, rule: ConsumptionRule, events: EventSystem): void {
    const available = state.inventory.getAmount(rule.resourceTypeId);

    if (available >= rule.amount) {
      state.inventory.remove(rule.resourceTypeId, rule.amount);
      events.emit(new ResourceConsumedEvent(
        state.soulId,
        rule.id,
        rule.resourceTypeId,
        rule.amount,
        state.inventory.getAmount(rule.resourceTypeId),
      ));
    } else {
      // Insufficient resources — consume what's available, emit failure.
      if (available > 0) {
        state.inventory.remove(rule.resourceTypeId, available);
      }
      events.emit(new ResourceConsumptionFailedEvent(
        state.soulId,
        rule.id,
        rule.resourceTypeId,
        rule.amount,
        available,
      ));
    }
  }

  start(): void { /* no-op */ }

  stop(): void {
    this.souls.clear();
  }
}
