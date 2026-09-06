// NarrativeIntegration: World state narrative + NPC-narrative bridge for M12 Phase 8.
//
// WorldStateNarrativeSystem: monitors world state changes and generates narrative events.
// NpcNarrativeBridge: connects NPC behavior (schedule, actions) to narrative events,
//   and allows narrative events to influence NPC behavior.
//
// Seed provides the integration framework; application layer defines specific rules.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";

// ============================================================================
// World State Narrative
// ============================================================================

/** A rule that maps a world state condition to a narrative event. */
export interface WorldStateNarrativeRule {
  /** Unique rule ID. */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** Condition evaluator: receives world state snapshot, returns true if rule triggers. */
  condition: (state: WorldStateSnapshot) => boolean;
  /** Narrative event to generate when condition is met. */
  narrative: {
    type: "plot" | "world" | "character" | "climax" | "resolution";
    title: string;
    description: string;
    severity?: "low" | "medium" | "high";
  };
  /** Cooldown in ticks before this rule can trigger again. Default 0 (no cooldown). */
  cooldown?: number;
  /** Whether this rule is enabled. Default true. */
  enabled?: boolean;
}

/** Snapshot of world state for narrative rule evaluation. */
export interface WorldStateSnapshot {
  /** Current tick count. */
  tick: number;
  /** World time. */
  worldTime: number;
  /** Number of entities in the world. */
  entityCount: number;
  /** Number of souls in the world. */
  soulCount: number;
  /** Current weather state (if WeatherSimulator available). */
  weather?: string;
  /** Time of day (if WorldClock available). */
  timeOfDay?: number;
  /** Custom state values set by application layer. */
  custom: Record<string, unknown>;
}

/** Configuration for WorldStateNarrativeSystem. */
export interface WorldStateNarrativeConfig {
  /** Whether to emit narrative events. Default true. */
  emitEvents: boolean;
  /** Maximum rules to evaluate per tick (performance). Default 100. */
  maxRulesPerTick: number;
}

/** Default configuration. */
export const DEFAULT_WORLD_STATE_NARRATIVE_CONFIG: WorldStateNarrativeConfig = {
  emitEvents: true,
  maxRulesPerTick: 100,
};

/**
 * WorldStateNarrativeSystem: monitors world state and generates narrative events.
 * Application layer registers rules that map world conditions to narrative output.
 */
export class WorldStateNarrativeSystem implements WorldSystem {
  readonly name = "world-state-narrative";
  enabled = true;

  private config: WorldStateNarrativeConfig;
  private readonly rules = new Map<string, WorldStateNarrativeRule>();
  private readonly lastTriggered = new Map<string, number>(); // ruleId → tick
  private readonly customState = new Map<string, unknown>();
  private currentTick = 0;
  private eventSystem: EventSystem | null = null;

  constructor(config?: Partial<WorldStateNarrativeConfig>) {
    this.config = { ...DEFAULT_WORLD_STATE_NARRATIVE_CONFIG, ...config };
  }

  /** Register a narrative rule. */
  addRule(rule: WorldStateNarrativeRule): void {
    this.rules.set(rule.id, rule);
  }

  /** Remove a narrative rule. */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /** Get all registered rules. */
  getRules(): WorldStateNarrativeRule[] {
    return Array.from(this.rules.values());
  }

  /** Enable or disable a rule. */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /** Set a custom state value. */
  setCustomState(key: string, value: unknown): void {
    this.customState.set(key, value);
  }

  /** Get a custom state value. */
  getCustomState<T = unknown>(key: string): T | undefined {
    return this.customState.get(key) as T | undefined;
  }

  /** Build a world state snapshot. */
  buildSnapshot(world: World): WorldStateSnapshot {
    const custom: Record<string, unknown> = {};
    for (const [key, value] of this.customState) custom[key] = value;

    let weather: string | undefined;
    let timeOfDay: number | undefined;

    // Try to get weather from WeatherSimulator.
    const weatherSys = world.systems.find(s => s.name === "weather");
    if (weatherSys) {
      const ws = weatherSys as unknown as { getCurrentWeather?: () => string };
      if (typeof ws.getCurrentWeather === "function") {
        weather = ws.getCurrentWeather();
      }
    }

    // Try to get time of day from WorldClock.
    const clock = world.systems.find(s => s.name === "world-clock");
    if (clock) {
      const c = clock as unknown as { getTimeOfDay?: () => number };
      if (typeof c.getTimeOfDay === "function") {
        timeOfDay = c.getTimeOfDay();
      }
    }

    return {
      tick: this.currentTick,
      worldTime: world.worldTime,
      entityCount: world.entities.size,
      soulCount: world.queryByType("soul").length,
      weather,
      timeOfDay,
      custom,
    };
  }

  // --- WorldSystem interface ---

  tick(_dt: number, world: World, events: EventSystem): void {
    this.eventSystem = events;
    this.currentTick++;

    const snapshot = this.buildSnapshot(world);
    let evaluated = 0;

    for (const rule of this.rules.values()) {
      if (evaluated >= this.config.maxRulesPerTick) break;
      if (rule.enabled === false) continue;

      // Check cooldown.
      const lastTick = this.lastTriggered.get(rule.id);
      if (lastTick !== undefined && rule.cooldown && (this.currentTick - lastTick) < rule.cooldown) {
        continue;
      }

      try {
        if (rule.condition(snapshot)) {
          this.lastTriggered.set(rule.id, this.currentTick);
          this.emitNarrativeEvent(rule, snapshot);
        }
      } catch {
        // Skip rules that throw during evaluation.
      }
      evaluated++;
    }
  }

  stop(): void {
    this.eventSystem = null;
  }

  private emitNarrativeEvent(rule: WorldStateNarrativeRule, snapshot: WorldStateSnapshot): void {
    if (!this.eventSystem || !this.config.emitEvents) return;
    this.eventSystem.emit(new Event({
      type: "narrative.world_state",
      payload: {
        ruleId: rule.id,
        ruleName: rule.name,
        narrativeType: rule.narrative.type,
        title: rule.narrative.title,
        description: rule.narrative.description,
        severity: rule.narrative.severity ?? "medium",
        tick: snapshot.tick,
        worldTime: snapshot.worldTime,
      },
      sourceId: "world-state-narrative",
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const rules: Record<string, WorldStateNarrativeRule> = {};
    for (const [id, rule] of this.rules) rules[id] = rule;
    const custom: Record<string, unknown> = {};
    for (const [key, value] of this.customState) custom[key] = value;
    const lastTriggered: Record<string, number> = {};
    for (const [id, tick] of this.lastTriggered) lastTriggered[id] = tick;
    return { rules, custom, lastTriggered, currentTick: this.currentTick };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.custom && typeof data.custom === "object") {
      for (const [key, value] of Object.entries(data.custom as Record<string, unknown>)) {
        this.customState.set(key, value);
      }
    }
    if (data.lastTriggered && typeof data.lastTriggered === "object") {
      for (const [id, tick] of Object.entries(data.lastTriggered as Record<string, number>)) {
        this.lastTriggered.set(id, tick);
      }
    }
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
    // Note: rules are not serialized (they contain functions); re-register after deserialize.
  }
}

// ============================================================================
// NPC Narrative Bridge
// ============================================================================

/** A mapping from NPC behavior to narrative event generation. */
export interface NpcNarrativeMapping {
  /** Unique mapping ID. */
  id: string;
  /** NPC entity ID this mapping applies to (or "*" for all). */
  npcId: string;
  /** Behavior pattern to watch for (e.g., "schedule.activity_started", "action.completed"). */
  behaviorType: string;
  /** Narrative event template to generate. */
  narrativeTemplate: {
    type: "character" | "plot" | "world";
    title: string;
    description: string;
    severity?: "low" | "medium" | "high";
  };
  /** Whether this mapping is enabled. Default true. */
  enabled?: boolean;
}

/** A narrative influence that affects NPC behavior. */
export interface NarrativeInfluence {
  /** Unique influence ID. */
  id: string;
  /** Narrative event type that triggers this influence. */
  narrativeEventType: string;
  /** NPC entity ID to affect (or "*" for all). */
  npcId: string;
  /** Behavior modifier to apply (application layer interprets). */
  modifier: Record<string, unknown>;
  /** Duration in ticks. Default 100. */
  duration?: number;
  /** Whether this influence is active. */
  active: boolean;
  /** Tick when this influence expires. */
  expiresAt?: number;
}

/** Configuration for NpcNarrativeBridge. */
export interface NpcNarrativeBridgeConfig {
  /** Whether to emit narrative events from NPC behavior. Default true. */
  emitNarrativeFromNpc: boolean;
  /** Whether to apply narrative influences to NPCs. Default true. */
  applyInfluences: boolean;
}

/** Default configuration. */
export const DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG: NpcNarrativeBridgeConfig = {
  emitNarrativeFromNpc: true,
  applyInfluences: true,
};

/**
 * NpcNarrativeBridge: connects NPC behavior to narrative, and narrative to NPC behavior.
 *
 * Two-way integration:
 * 1. NPC behavior → narrative: watches for NPC behavior events and generates narrative events.
 * 2. Narrative → NPC behavior: applies narrative influences that modify NPC behavior.
 *
 * Application layer defines specific mappings and interprets modifiers.
 */
export class NpcNarrativeBridge implements WorldSystem {
  readonly name = "npc-narrative-bridge";
  enabled = true;

  private config: NpcNarrativeBridgeConfig;
  private readonly mappings = new Map<string, NpcNarrativeMapping>();
  private readonly influences = new Map<string, NarrativeInfluence>();
  private currentTick = 0;
  private eventSystem: EventSystem | null = null;

  constructor(config?: Partial<NpcNarrativeBridgeConfig>) {
    this.config = { ...DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG, ...config };
  }

  // --- NPC → Narrative mappings ---

  /** Register a behavior-to-narrative mapping. */
  addMapping(mapping: NpcNarrativeMapping): void {
    this.mappings.set(mapping.id, mapping);
  }

  /** Remove a mapping. */
  removeMapping(mappingId: string): boolean {
    return this.mappings.delete(mappingId);
  }

  /** Get all mappings. */
  getMappings(): NpcNarrativeMapping[] {
    return Array.from(this.mappings.values());
  }

  /** Manually trigger a narrative event from an NPC behavior event. */
  triggerNarrativeFromBehavior(behaviorType: string, npcId: string, payload: Record<string, unknown>): void {
    if (!this.config.emitNarrativeFromNpc || !this.eventSystem) return;

    for (const mapping of this.mappings.values()) {
      if (mapping.enabled === false) continue;
      if (mapping.npcId !== "*" && mapping.npcId !== npcId) continue;
      if (mapping.behaviorType !== behaviorType) continue;

      this.eventSystem.emit(new Event({
        type: "narrative.npc_behavior",
        payload: {
          mappingId: mapping.id,
          npcId,
          behaviorType,
          narrativeType: mapping.narrativeTemplate.type,
          title: mapping.narrativeTemplate.title,
          description: mapping.narrativeTemplate.description,
          severity: mapping.narrativeTemplate.severity ?? "low",
          behaviorPayload: payload,
        },
        sourceId: npcId,
      }));
    }
  }

  // --- Narrative → NPC influences ---

  /** Apply a narrative influence to NPC behavior. */
  applyInfluence(influence: NarrativeInfluence): void {
    influence.active = true;
    if (influence.duration) {
      influence.expiresAt = this.currentTick + influence.duration;
    }
    this.influences.set(influence.id, influence);
  }

  /** Remove an influence. */
  removeInfluence(influenceId: string): boolean {
    const influence = this.influences.get(influenceId);
    if (influence) influence.active = false;
    return this.influences.delete(influenceId);
  }

  /** Get active influences for an NPC. */
  getActiveInfluences(npcId: string): NarrativeInfluence[] {
    return Array.from(this.influences.values()).filter(
      i => i.active && (i.npcId === "*" || i.npcId === npcId),
    );
  }

  /** Get all influences. */
  getAllInfluences(): NarrativeInfluence[] {
    return Array.from(this.influences.values());
  }

  /** Get combined modifier for an NPC from all active influences. */
  getCombinedModifier(npcId: string): Record<string, unknown> {
    const combined: Record<string, unknown> = {};
    for (const influence of this.getActiveInfluences(npcId)) {
      Object.assign(combined, influence.modifier);
    }
    return combined;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.eventSystem = events;
    this.currentTick++;

    // Expire old influences.
    if (this.config.applyInfluences) {
      for (const [id, influence] of this.influences) {
        if (influence.expiresAt !== undefined && this.currentTick >= influence.expiresAt) {
          influence.active = false;
          this.influences.delete(id);
        }
      }
    }
  }

  stop(): void {
    this.eventSystem = null;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const influences: Record<string, NarrativeInfluence> = {};
    for (const [id, inf] of this.influences) influences[id] = inf;
    // Note: mappings are not serialized (they are configuration); re-register after deserialize.
    return { influences, currentTick: this.currentTick };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.influences && typeof data.influences === "object") {
      for (const [id, inf] of Object.entries(data.influences as Record<string, NarrativeInfluence>)) {
        this.influences.set(id, inf);
      }
    }
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
  }
}
