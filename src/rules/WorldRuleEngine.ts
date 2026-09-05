// WorldRuleEngine: generic, configurable condition->action rule system.
// This is a WORLD-level rule engine (like game engine triggers), NOT soul cognition/decision.
// Soul cognition/decision remains in SoulArena. Seed only provides perception and action execution.
//
// Rules are abstract and configurable — no hardcoded world content.
// Applications register their own rules via config or functions.

import type { World } from "../engine/World.js";
import type { GameObject } from "../entity/Entity.js";
import type { Event } from "../event/Event.js";
import type { EventSystem } from "../event/EventSystem.js";

/** Context passed to rule conditions and actions. */
export interface RuleContext {
  /** The world instance. */
  world: World;
  /** Optional entity that triggered the rule (for event-driven rules). */
  entity?: GameObject;
  /** Optional event that triggered the rule. */
  event?: Event;
  /** Shared data map for rules to communicate. */
  data: Map<string, unknown>;
}

/** A rule condition — returns true if the rule should fire. */
export type RuleCondition = (ctx: RuleContext) => boolean;

/** A rule action — executed when the condition is met. */
export type RuleAction = (ctx: RuleContext) => void;

/** Configuration for a declarative rule. */
export interface RuleConfig {
  /** Unique rule ID. */
  id: string;
  /** Human-readable name. */
  name?: string;
  /** Whether the rule is enabled. Default true. */
  enabled?: boolean;
  /** Priority — higher priority rules evaluated first. Default 0. */
  priority?: number;
  /** Minimum ticks between rule firings (cooldown). Default 0 (no cooldown). */
  cooldownTicks?: number;
  /** Maximum number of times the rule can fire. Default 0 (unlimited). */
  maxFires?: number;
  /** The condition function. */
  condition: RuleCondition;
  /** The action function. */
  action: RuleAction;
}

/** Internal rule state. */
interface RuleState {
  config: RuleConfig;
  enabled: boolean;
  lastFireTick: number;
  fireCount: number;
}

/**
 * WorldRuleEngine: evaluates and executes world rules.
 *
 * Rules are condition->action pairs evaluated each tick (or on events).
 * This is a generic, abstract system — applications define their own rules.
 *
 * Usage:
 *   const engine = new WorldRuleEngine();
 *   engine.registerRule({
 *     id: "night-spawn",
 *     condition: (ctx) => ctx.world.getTimeOfDay() > 0.7,
 *     action: (ctx) => { /* spawn enemies *\/ },
 *   });
 *   world.addSystem(engine);
 *
 * Architecture:
 * - No hardcoded world content — all rules provided by application
 * - No soul cognition/decision — rules are world-level triggers
 * - Rules can be serialized for persistence (declarative config only)
 */
export class WorldRuleEngine {
  readonly name = "rule-engine";
  enabled = true;

  private rules = new Map<string, RuleState>();
  private world: World | null = null;
  private currentTick = 0;
  private sharedData = new Map<string, unknown>();
  /** Unsubscribe functions for event-driven rule evaluation. */
  private eventUnsubscribes: Array<() => void> = [];

  /** Register a new rule. Throws if ID already exists. */
  registerRule(config: RuleConfig): void {
    if (this.rules.has(config.id)) {
      throw new Error(`Rule with id '${config.id}' already exists`);
    }
    this.rules.set(config.id, {
      config,
      enabled: config.enabled ?? true,
      lastFireTick: -1,
      fireCount: 0,
    });
  }

  /** Remove a rule by ID. Returns true if found and removed. */
  unregisterRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /** Enable a rule. */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = true;
  }

  /** Disable a rule. */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = false;
  }

  /** Check if a rule is enabled. */
  isRuleEnabled(ruleId: string): boolean {
    return this.rules.get(ruleId)?.enabled ?? false;
  }

  /** Get all registered rule IDs. */
  getRuleIds(): string[] {
    return Array.from(this.rules.keys());
  }

  /** Get rule config by ID. */
  getRule(ruleId: string): RuleConfig | undefined {
    return this.rules.get(ruleId)?.config;
  }

  /** Get fire count for a rule. */
  getFireCount(ruleId: string): number {
    return this.rules.get(ruleId)?.fireCount ?? 0;
  }

  /** Number of registered rules. */
  get size(): number {
    return this.rules.size;
  }

  /**
   * Bind to an event bus for event-driven rule evaluation.
   * Subscribes to the specified event types and evaluates rules with event context.
   */
  bindEventBus(events: EventSystem, eventTypes: string[]): void {
    for (const type of eventTypes) {
      const unsub = events.on(type, (event: Event) => {
        this.evaluate(undefined, event);
      });
      this.eventUnsubscribes.push(unsub);
    }
  }

  /**
   * Evaluate all enabled rules and fire those whose conditions are met.
   * Rules evaluated in priority order (highest first).
   * Called automatically each tick when added to a World.
   */
  evaluate(entity?: GameObject, event?: Event): void {
    if (!this.world) return;
    const ctx: RuleContext = {
      world: this.world,
      entity,
      event,
      data: this.sharedData,
    };

    // Sort by priority (highest first), then by registration order.
    const sorted = Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => (b.config.priority ?? 0) - (a.config.priority ?? 0));

    for (const rule of sorted) {
      // Check cooldown.
      const cooldown = rule.config.cooldownTicks ?? 0;
      if (cooldown > 0 && rule.lastFireTick >= 0) {
        if (this.currentTick - rule.lastFireTick < cooldown) continue;
      }

      // Check max fires.
      const maxFires = rule.config.maxFires ?? 0;
      if (maxFires > 0 && rule.fireCount >= maxFires) continue;

      // Evaluate condition.
      try {
        if (rule.config.condition(ctx)) {
          rule.config.action(ctx);
          rule.lastFireTick = this.currentTick;
          rule.fireCount++;
        }
      } catch (err) {
        // Rule errors are non-fatal — log and continue.
        console.error(`Rule '${rule.config.id}' error:`, err);
      }
    }
  }

  /** WorldSystem interface: called each tick. */
  tick(_dt: number, world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    this.world = world;
    this.currentTick = world.tick;
    this.evaluate();
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.rules.clear();
    this.sharedData.clear();
    for (const unsub of this.eventUnsubscribes) {
      unsub();
    }
    this.eventUnsubscribes = [];
  }

  /** Serialize rule engine state (fire counts, enabled states). */
  serialize(): Record<string, unknown> {
    const rules: Record<string, { enabled: boolean; fireCount: number; lastFireTick: number }> = {};
    for (const [id, state] of this.rules) {
      rules[id] = {
        enabled: state.enabled,
        fireCount: state.fireCount,
        lastFireTick: state.lastFireTick,
      };
    }
    return { rules, currentTick: this.currentTick };
  }

  /** Deserialize rule engine state. Rules must be re-registered by app first. */
  deserialize(data: Record<string, unknown>): void {
    const rulesData = data.rules as Record<string, { enabled: boolean; fireCount: number; lastFireTick: number }>;
    if (!rulesData) return;
    for (const [id, state] of Object.entries(rulesData)) {
      const rule = this.rules.get(id);
      if (rule) {
        rule.enabled = state.enabled;
        rule.fireCount = state.fireCount;
        rule.lastFireTick = state.lastFireTick;
      }
    }
    if (typeof data.currentTick === "number") {
      this.currentTick = data.currentTick;
    }
  }
}
