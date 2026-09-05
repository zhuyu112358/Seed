// GrowthSystem: tracks experience and levels for souls based on GrowthRules.
// Listens to trigger events (e.g., harvest complete, craft complete) and grants XP.
// Emits XPGainedEvent and LevelUpEvent. Level-up consequences are handled by the
// application layer — Seed only tracks XP/levels and emits events.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { Event } from "../event/Event.js";
import { GrowthRule, GrowthRuleRegistry } from "./GrowthRule.js";
import {
  XPGainedEvent,
  LevelUpEvent,
} from "../event/Event.js";

/** Configuration for GrowthSystem. */
export interface GrowthSystemConfig {
  /** Whether growth is enabled by default. */
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<GrowthSystemConfig> = {
  enabled: true,
};

/** Per-soul per-rule growth state. */
interface SoulGrowthState {
  /** Total XP accumulated for this rule. */
  totalXP: number;
  /** Current level. */
  level: number;
}

/**
 * GrowthSystem: tracks XP and levels for souls.
 *
 * Rules are registered via the rule registry. Each rule defines a trigger event type
 * and XP amount. The system listens to those events and grants XP to the soul
 * identified in the event payload (soulId field).
 */
export class GrowthSystem implements WorldSystem {
  readonly name = "growth";
  enabled = true;

  private readonly config: Required<GrowthSystemConfig>;
  readonly rules = new GrowthRuleRegistry();
  /** soulId -> ruleId -> growth state */
  private soulGrowth = new Map<string, Map<string, SoulGrowthState>>();
  /** Event unsubscribe functions for trigger events */
  private unsubscribes: Array<() => void> = [];
  private events: EventSystem | null = null;

  constructor(config?: GrowthSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = this.config.enabled;
  }

  /** Register a soul for growth tracking. */
  registerSoul(soulId: string): void {
    if (!this.soulGrowth.has(soulId)) {
      this.soulGrowth.set(soulId, new Map());
    }
  }

  /** Unregister a soul from growth tracking. */
  unregisterSoul(soulId: string): void {
    this.soulGrowth.delete(soulId);
  }

  /** Check if a soul is registered. */
  isRegistered(soulId: string): boolean {
    return this.soulGrowth.has(soulId);
  }

  /** Get a soul's XP for a specific rule. */
  getXP(soulId: string, ruleId: string): number {
    return this.soulGrowth.get(soulId)?.get(ruleId)?.totalXP ?? 0;
  }

  /** Get a soul's level for a specific rule. */
  getLevel(soulId: string, ruleId: string): number {
    const state = this.soulGrowth.get(soulId)?.get(ruleId);
    if (!state) return 1;
    return state.level;
  }

  /** Get all growth states for a soul. */
  getSoulGrowth(soulId: string): Map<string, SoulGrowthState> | undefined {
    return this.soulGrowth.get(soulId);
  }

  /**
   * Grant XP to a soul for a specific rule.
   * Returns true if XP was granted, false if soul not registered or max level reached.
   */
  grantXP(soulId: string, ruleId: string, amount: number, events?: EventSystem): boolean {
    if (!this.enabled) return false;

    const soulStates = this.soulGrowth.get(soulId);
    if (!soulStates) return false;

    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    let state = soulStates.get(ruleId);
    if (!state) {
      state = { totalXP: 0, level: 1 };
      soulStates.set(ruleId, state);
    }

    if (state.level >= rule.maxLevel) return false;

    const oldLevel = state.level;
    state.totalXP += amount;
    const newLevel = rule.levelFromXP(state.totalXP);
    state.level = newLevel;

    const evt = events ?? this.events;
    if (evt) {
      evt.emit(new XPGainedEvent(soulId, ruleId, rule.name, amount, state.totalXP, state.level));

      if (newLevel > oldLevel) {
        evt.emit(new LevelUpEvent(soulId, ruleId, rule.name, oldLevel, newLevel, state.totalXP));
      }
    }

    return true;
  }

  /** Set up event listeners for all registered trigger event types. */
  private setupListeners(events: EventSystem): void {
    // Clear existing listeners
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];

    // Get unique trigger event types
    const triggerTypes = new Set(this.rules.getAll().map((r) => r.triggerEventType));

    for (const eventType of triggerTypes) {
      const unsub = events.on(eventType, (evt: Event<Record<string, unknown>>) => {
        if (!this.enabled) return;

        // Grant XP for all rules that trigger on this event type.
        // Each rule may use a different payload field for the soul ID.
        const matchingRules = this.rules.getByTriggerEventType(eventType);
        for (const rule of matchingRules) {
          const soulId = evt.payload?.[rule.soulIdField] as string | undefined;
          if (!soulId) continue;
          this.grantXP(soulId, rule.id, rule.xpPerEvent, events);
        }
      });
      this.unsubscribes.push(unsub);
    }
  }

  tick(_dt: number, _world: World, events: EventSystem): void {
    if (!this.enabled) return;
    // Re-setup listeners if rules changed (simple approach: check count)
    if (!this.events || this.events !== events) {
      this.events = events;
      this.setupListeners(events);
    }
  }

  start(): void { /* no-op */ }

  stop(): void {
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
    this.soulGrowth.clear();
    this.events = null;
  }
}
