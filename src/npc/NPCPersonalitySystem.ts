// NPCPersonalitySystem: manages Big Five (OCEAN) personality profiles for NPC entities.
//
// This system provides trait storage, behavioral tendency derivation,
// decision style derivation, and personality-based behavior modifiers.
// It is a generic framework - Ember decides how personality affects decisions.
//
// M12 Phase 2: NPC Personality System.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import {
  BigFiveTraits,
  BehavioralTendencies,
  DecisionStyle,
  PersonalityProfile,
  PersonalityConfig,
  DEFAULT_PERSONALITY_CONFIG,
  NEUTRAL_PERSONALITY,
  PERSONALITY_ARCHETYPES,
} from "./PersonalityTypes.js";

export class NPCPersonalitySystem implements WorldSystem {
  readonly name = "npc-personality";
  enabled = true;

  private config: PersonalityConfig;
  private readonly profiles = new Map<string, PersonalityProfile>();
  private events: EventSystem | null = null;

  constructor(config?: Partial<PersonalityConfig>) {
    this.config = { ...DEFAULT_PERSONALITY_CONFIG, ...config };
  }

  // --- Profile management ---

  /**
   * Set a personality profile for an entity.
   * If auto-derive is enabled, tendencies and decision style are computed from traits.
   */
  setPersonality(
    entityId: string,
    traits: Partial<BigFiveTraits>,
    options?: { archetype?: string; metadata?: Record<string, unknown> },
  ): PersonalityProfile {
    const fullTraits: BigFiveTraits = { ...NEUTRAL_PERSONALITY, ...traits };
    // Clamp trait values.
    fullTraits.openness = this.clampTrait(fullTraits.openness);
    fullTraits.conscientiousness = this.clampTrait(fullTraits.conscientiousness);
    fullTraits.extraversion = this.clampTrait(fullTraits.extraversion);
    fullTraits.agreeableness = this.clampTrait(fullTraits.agreeableness);
    fullTraits.neuroticism = this.clampTrait(fullTraits.neuroticism);

    const profile: PersonalityProfile = {
      entityId,
      traits: fullTraits,
      tendencies: this.config.autoDeriveTendencies ? this.deriveTendencies(fullTraits) : this.neutralTendencies(),
      decisionStyle: this.config.autoDeriveDecisionStyle ? this.deriveDecisionStyle(fullTraits) : this.neutralDecisionStyle(),
      archetype: options?.archetype,
      metadata: options?.metadata,
    };

    this.profiles.set(entityId, profile);
    this.emitEvent(entityId, "personality.changed", profile);
    return profile;
  }

  /** Set personality from a named archetype. */
  setPersonalityFromArchetype(entityId: string, archetypeName: string): PersonalityProfile | null {
    const archetype = PERSONALITY_ARCHETYPES[archetypeName];
    if (!archetype) return null;
    return this.setPersonality(entityId, archetype, { archetype: archetypeName });
  }

  /** Get a personality profile for an entity. */
  getPersonality(entityId: string): PersonalityProfile | undefined {
    return this.profiles.get(entityId);
  }

  /** Get or create a default neutral personality for an entity. */
  getOrCreatePersonality(entityId: string): PersonalityProfile {
    let profile = this.profiles.get(entityId);
    if (!profile) {
      profile = this.setPersonality(entityId, NEUTRAL_PERSONALITY);
    }
    return profile;
  }

  /** Check if an entity has a personality profile. */
  hasPersonality(entityId: string): boolean {
    return this.profiles.has(entityId);
  }

  /** Remove a personality profile. */
  removePersonality(entityId: string): boolean {
    return this.profiles.delete(entityId);
  }

  // --- Trait modification ---

  /**
   * Modify a single trait by a delta amount.
   * Re-derives tendencies and decision style if auto-derive is enabled.
   */
  modifyTrait(entityId: string, trait: keyof BigFiveTraits, delta: number): PersonalityProfile | null {
    const profile = this.profiles.get(entityId);
    if (!profile) return null;

    profile.traits[trait] = this.clampTrait(profile.traits[trait] + delta);

    if (this.config.autoDeriveTendencies) {
      profile.tendencies = this.deriveTendencies(profile.traits);
    }
    if (this.config.autoDeriveDecisionStyle) {
      profile.decisionStyle = this.deriveDecisionStyle(profile.traits);
    }

    this.emitEvent(entityId, "personality.trait_changed", profile);
    return profile;
  }

  // --- Derivation ---

  /** Derive behavioral tendencies from Big Five traits. */
  deriveTendencies(traits: BigFiveTraits): BehavioralTendencies {
    const t = traits;
    return {
      // Social: primarily extraversion, secondarily agreeableness.
      socialTendency: this.normalize(t.extraversion * 0.7 + t.agreeableness * 0.3),
      // Risk: low conscientiousness + high openness + low neuroticism.
      riskTendency: this.normalize((100 - t.conscientiousness) * 0.4 + t.openness * 0.3 + (100 - t.neuroticism) * 0.3),
      // Aggression: low agreeableness + high extraversion + high neuroticism.
      aggressionTendency: this.normalize((100 - t.agreeableness) * 0.5 + t.extraversion * 0.25 + t.neuroticism * 0.25),
      // Cooperation: high agreeableness + high conscientiousness.
      cooperationTendency: this.normalize(t.agreeableness * 0.6 + t.conscientiousness * 0.4),
      // Curiosity: high openness + low conscientiousness.
      curiosityTendency: this.normalize(t.openness * 0.7 + (100 - t.conscientiousness) * 0.3),
      // Patience: high conscientiousness + low neuroticism.
      patienceTendency: this.normalize(t.conscientiousness * 0.6 + (100 - t.neuroticism) * 0.4),
      // Anxiety: high neuroticism.
      anxietyTendency: this.normalize(t.neuroticism),
      // Leadership: high extraversion + high conscientiousness + low agreeableness.
      leadershipTendency: this.normalize(t.extraversion * 0.5 + t.conscientiousness * 0.3 + (100 - t.agreeableness) * 0.2),
    };
  }

  /** Derive decision style from Big Five traits. */
  deriveDecisionStyle(traits: BigFiveTraits): DecisionStyle {
    const tendencies = this.deriveTendencies(traits);
    return {
      riskPreference: this.bucket(tendencies.riskTendency, ["risk_averse", "cautious", "neutral", "risk_seeking", "reckless"]),
      patienceLevel: this.bucket(tendencies.patienceTendency, ["impatient", "short", "moderate", "long", "very_patient"]),
      socialPreference: this.bucket(tendencies.socialTendency, ["solitary", "reserved", "balanced", "social", "gregarious"]),
      conflictStyle: this.deriveConflictStyle(tendencies),
      learningStyle: this.bucket(tendencies.curiosityTendency, ["conservative", "practical", "balanced", "experimental", "innovative"]),
    };
  }

  // --- Personality-based modifiers ---

  /**
   * Get a behavior modifier for a given action type based on personality.
   * Returns a multiplier (0-2) that can be used to adjust action priority,
   * duration, or success chance. 1.0 = neutral, >1 = more likely/easier, <1 = less likely/harder.
   */
  getBehaviorModifier(entityId: string, actionType: string): number {
    const profile = this.profiles.get(entityId);
    if (!profile) return 1.0;
    const t = profile.tendencies;

    switch (actionType) {
      case "attack":
      case "combat":
        return 0.5 + t.aggressionTendency * 1.0;
      case "talk":
      case "dialogue":
      case "social":
        return 0.5 + t.socialTendency * 1.0;
      case "trade":
      case "barter":
        return 0.5 + t.cooperationTendency * 0.8 + t.socialTendency * 0.2;
      case "explore":
      case "travel":
        return 0.5 + t.curiosityTendency * 1.0;
      case "gather":
      case "harvest":
      case "craft":
        return 0.5 + t.patienceTendency * 0.7 + (1 - t.anxietyTendency) * 0.3;
      case "flee":
      case "retreat":
        return 0.5 + t.anxietyTendency * 1.0;
      case "lead":
      case "command":
        return 0.5 + t.leadershipTendency * 1.0;
      case "follow":
      case "obey":
        return 0.5 + (1 - t.leadershipTendency) * 0.7 + t.cooperationTendency * 0.3;
      default:
        return 1.0;
    }
  }

  /**
   * Get memory importance modifier based on personality.
   * Returns a multiplier (0.5-1.5) for memory importance.
   */
  getMemoryImportanceModifier(entityId: string, memoryType: string): number {
    const profile = this.profiles.get(entityId);
    if (!profile) return 1.0;
    const t = profile.tendencies;

    switch (memoryType) {
      case "interaction":
      case "social":
        return 0.7 + t.socialTendency * 0.6;
      case "emotion":
        return 0.7 + t.anxietyTendency * 0.6;
      case "knowledge":
      case "observation":
        return 0.7 + t.curiosityTendency * 0.6;
      case "action":
      case "combat":
        return 0.7 + t.aggressionTendency * 0.6;
      case "location":
        return 0.7 + t.curiosityTendency * 0.4 + t.patienceTendency * 0.2;
      default:
        return 1.0;
    }
  }

  // --- Archetypes ---

  /** Get all available archetype names. */
  getArchetypeNames(): string[] {
    return Object.keys(PERSONALITY_ARCHETYPES);
  }

  /** Get an archetype's trait values by name. */
  getArchetype(name: string): BigFiveTraits | undefined {
    return PERSONALITY_ARCHETYPES[name];
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.events = events;
    // Personality is static per tick - no per-tick updates needed.
  }

  stop(): void {
    this.events = null;
  }

  // --- Internal helpers ---

  private clampTrait(value: number): number {
    return Math.max(this.config.minTrait, Math.min(this.config.maxTrait, value));
  }

  private normalize(value: number): number {
    return Math.max(0, Math.min(1, value / 100));
  }

  private bucket<T extends string>(value: number, labels: T[]): T {
    const index = Math.min(labels.length - 1, Math.floor(value * labels.length));
    return labels[index];
  }

  private deriveConflictStyle(t: BehavioralTendencies): DecisionStyle["conflictStyle"] {
    // High cooperation + low aggression = collaborative/avoidant.
    // Low cooperation + high aggression = competitive.
    if (t.cooperationTendency > 0.7 && t.aggressionTendency < 0.3) return "collaborative";
    if (t.cooperationTendency > 0.6 && t.aggressionTendency < 0.4) return "compromising";
    if (t.aggressionTendency > 0.7) return "competitive";
    if (t.cooperationTendency > 0.5 && t.anxietyTendency > 0.5) return "accommodating";
    if (t.anxietyTendency > 0.6) return "avoidant";
    return "compromising";
  }

  private neutralTendencies(): BehavioralTendencies {
    return {
      socialTendency: 0.5,
      riskTendency: 0.5,
      aggressionTendency: 0.5,
      cooperationTendency: 0.5,
      curiosityTendency: 0.5,
      patienceTendency: 0.5,
      anxietyTendency: 0.5,
      leadershipTendency: 0.5,
    };
  }

  private neutralDecisionStyle(): DecisionStyle {
    return {
      riskPreference: "neutral",
      patienceLevel: "moderate",
      socialPreference: "balanced",
      conflictStyle: "compromising",
      learningStyle: "balanced",
    };
  }

  private emitEvent(entityId: string, eventType: string, profile: PersonalityProfile): void {
    if (!this.events) return;
    this.events.emit(new Event({
      type: eventType,
      payload: {
        entityId,
        traits: profile.traits,
        archetype: profile.archetype,
      },
      sourceId: entityId,
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const profiles: Record<string, PersonalityProfile> = {};
    for (const [id, profile] of this.profiles) profiles[id] = profile;
    return { profiles };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.profiles && typeof data.profiles === "object") {
      for (const [id, profile] of Object.entries(data.profiles as Record<string, PersonalityProfile>)) {
        this.profiles.set(id, profile);
      }
    }
  }
}
