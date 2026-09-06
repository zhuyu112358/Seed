// M13 Social-Cultural Integration System.
// Bridges M13 social simulation systems with M12 NPC AI and narrative systems.
// All content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type {
  SocialCulturalIntegrationConfig,
  SocialInfluenceResult,
  SocialNarrativeBridgeResult,
  CulturalInfluenceResult,
  IntegrationEventType,
  IntegrationEvent,
  SocialCulturalIntegrationStats,
} from "./SocialCulturalIntegrationTypes.js";
import { DEFAULT_SOCIAL_CULTURAL_INTEGRATION_CONFIG } from "./SocialCulturalIntegrationTypes.js";

// M13 social systems.
import type { SocialRelationGraph } from "./SocialRelationGraph.js";
import type { SocialEventSystem } from "./SocialEventSystem.js";
import type { CulturalEvolutionSystem } from "./CulturalEvolutionSystem.js";

// M12 NPC and narrative systems.
import type { NPCPersonalitySystem } from "../npc/NPCPersonalitySystem.js";
import type { DynamicNarrativeSystem } from "../narrative/DynamicNarrativeSystem.js";

/** System that bridges M13 social simulation with M12 NPC AI and narrative. */
export class SocialCulturalIntegrationSystem {
  readonly name = "social-cultural-integration-system";
  enabled = true;

  private config: SocialCulturalIntegrationConfig;
  private eventHistory: IntegrationEvent[] = [];
  private currentTick = 0;
  private syncCounter = 0;

  // M13 system references.
  private socialRelationGraph: SocialRelationGraph | null = null;
  private socialEventSystem: SocialEventSystem | null = null;
  private culturalEvolutionSystem: CulturalEvolutionSystem | null = null;

  // M12 system references.
  private npcPersonalitySystem: NPCPersonalitySystem | null = null;
  private dynamicNarrativeSystem: DynamicNarrativeSystem | null = null;

  // Track bridged social events to avoid duplicate bridging.
  private bridgedSocialEvents: Set<string> = new Set();

  // Stats accumulators.
  private totalSocialInfluences = 0;
  private totalSocialEventBridges = 0;
  private totalCulturalInfluences = 0;
  private socialInfluenceSum = 0;
  private culturalInfluenceSum = 0;

  constructor(config?: Partial<SocialCulturalIntegrationConfig>) {
    this.config = { ...DEFAULT_SOCIAL_CULTURAL_INTEGRATION_CONFIG, ...config };
  }

  // --- System Registration ---

  /** Register M13 social systems for bridging. */
  registerSocialSystems(
    socialRelationGraph: SocialRelationGraph,
    socialEventSystem: SocialEventSystem,
    culturalEvolutionSystem: CulturalEvolutionSystem,
  ): void {
    this.socialRelationGraph = socialRelationGraph;
    this.socialEventSystem = socialEventSystem;
    this.culturalEvolutionSystem = culturalEvolutionSystem;
  }

  /** Register M12 NPC and narrative systems for bridging. */
  registerM12Systems(
    npcPersonalitySystem: NPCPersonalitySystem,
    dynamicNarrativeSystem: DynamicNarrativeSystem,
  ): void {
    this.npcPersonalitySystem = npcPersonalitySystem;
    this.dynamicNarrativeSystem = dynamicNarrativeSystem;
  }

  // --- Social Relation -> NPC Behavior Bridge ---

  /** Apply social relation influence to an NPC's behavior modifiers. */
  applySocialInfluence(entityId: string): SocialInfluenceResult | null {
    if (!this.config.socialInfluenceEnabled || !this.socialRelationGraph) {
      return null;
    }

    const relations = this.socialRelationGraph.getRelations(entityId);
    if (relations.length === 0) {
      return {
        entityId,
        relationsConsidered: 0,
        socialInfluence: 0,
        behaviorModifier: 1.0,
        dominantRelationType: null,
        description: `${entityId} has no social relations`,
      };
    }

    // Calculate aggregate social influence based on relation strength.
    let totalInfluence = 0;
    const typeCounts: Record<string, number> = {};
    const positiveCategories = ["friendship", "family", "romance", "partnership", "mentorship"];
    const negativeCategories = ["enmity"];
    for (const relation of relations) {
      const strength = relation.strength;
      // Calculate overall strength from components (trust, intimacy, respect, influence).
      const overallStrength = strength
        ? (strength.trust + strength.intimacy + strength.respect + strength.influence) / 4
        : 50;
      const category = relation.category ?? "neutral";
      if (positiveCategories.includes(category)) {
        // Positive relations: higher strength = more positive influence.
        totalInfluence += (overallStrength - 50) * this.config.socialInfluenceWeight;
      } else if (negativeCategories.includes(category)) {
        // Negative relations: higher strength = more negative influence.
        totalInfluence -= overallStrength * this.config.socialInfluenceWeight;
      }
      typeCounts[category] = (typeCounts[category] ?? 0) + 1;
    }

    const avgInfluence = totalInfluence / relations.length;
    const clampedInfluence = Math.max(-100, Math.min(100, avgInfluence));
    // Behavior modifier: 0.5 (negative influence) to 1.5 (positive influence).
    const behaviorModifier = 1 + clampedInfluence / 200;

    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    this.totalSocialInfluences++;
    this.socialInfluenceSum += clampedInfluence;

    const result: SocialInfluenceResult = {
      entityId,
      relationsConsidered: relations.length,
      socialInfluence: Math.round(clampedInfluence),
      behaviorModifier: Math.round(behaviorModifier * 100) / 100,
      dominantRelationType: dominantType,
      description: `${entityId} influenced by ${relations.length} relations (dominant: ${dominantType ?? "none"}, modifier: ${behaviorModifier.toFixed(2)})`,
    };

    this.makeEvent("integration.social_influence_applied", entityId, undefined, undefined, result.description);
    return result;
  }

  /** Apply social influence to all NPCs in the personality system. */
  applySocialInfluenceToAll(): SocialInfluenceResult[] {
    if (!this.npcPersonalitySystem) return [];
    // Get all entity IDs from personality system.
    const results: SocialInfluenceResult[] = [];
    const personalities = (this.npcPersonalitySystem as any).getAllPersonalities?.() ?? [];
    for (const profile of personalities) {
      const entityId = profile.entityId ?? profile.id;
      if (entityId) {
        const result = this.applySocialInfluence(entityId);
        if (result) results.push(result);
      }
    }
    return results;
  }

  // --- Social Event -> Narrative Bridge ---

  /** Bridge a social event to the dynamic narrative system. */
  bridgeSocialEventToNarrative(socialEventId: string): SocialNarrativeBridgeResult | null {
    if (!this.config.socialNarrativeEnabled || !this.socialEventSystem || !this.dynamicNarrativeSystem) {
      return null;
    }

    if (this.bridgedSocialEvents.has(socialEventId)) {
      return null; // Already bridged.
    }

    // Use getAllEvents to find event (getEvent only returns active events).
    const allEvents = this.socialEventSystem.getAllEvents?.() ?? [];
    const socialEvent = allEvents.find((e: any) => e.id === socialEventId);
    if (!socialEvent) {
      return {
        socialEventId,
        socialEventType: "unknown",
        narrativeTriggered: false,
        narrativeArcId: null,
        narrativeEventId: null,
        description: `Social event ${socialEventId} not found`,
      };
    }

    this.bridgedSocialEvents.add(socialEventId);
    this.totalSocialEventBridges++;

    // Record the social event as a narrative event.
    // Use "world" type for social events (valid DynamicNarrativeEventType).
    const narrativeEvent = this.dynamicNarrativeSystem.recordEvent(
      "world",
      socialEvent.name ?? socialEvent.type,
      `Social event: ${socialEvent.description ?? socialEvent.name ?? socialEvent.type}`,
      {
        metadata: {
          socialEventId: socialEvent.id,
          socialEventType: socialEvent.type,
          participantCount: (socialEvent as any).participants?.length ?? 0,
          location: (socialEvent as any).location,
        },
      },
    );

    const result: SocialNarrativeBridgeResult = {
      socialEventId,
      socialEventType: socialEvent.type,
      narrativeTriggered: true,
      narrativeArcId: narrativeEvent?.arcId ?? null,
      narrativeEventId: narrativeEvent?.id ?? null,
      description: `Social event ${socialEvent.type} (${socialEvent.name ?? ""}) bridged to narrative as event ${narrativeEvent?.id ?? "unknown"}`,
    };

    this.makeEvent("integration.social_event_bridged", undefined, socialEventId, undefined, result.description);
    return result;
  }

  /** Bridge all recent social events to narrative. */
  bridgeRecentSocialEvents(maxEvents: number = 20): SocialNarrativeBridgeResult[] {
    if (!this.socialEventSystem) return [];
    const allEvents = this.socialEventSystem.getAllEvents?.() ?? [];
    const recentEvents = allEvents.slice(-maxEvents);
    const results: SocialNarrativeBridgeResult[] = [];
    for (const event of recentEvents) {
      const result = this.bridgeSocialEventToNarrative(event.id);
      if (result) results.push(result);
    }
    return results;
  }

  // --- Culture -> NPC Personality Bridge ---

  /** Apply cultural influence to an NPC's personality traits. */
  applyCulturalInfluence(entityId: string, cultureId: string): CulturalInfluenceResult | null {
    if (!this.config.culturalInfluenceEnabled || !this.culturalEvolutionSystem || !this.npcPersonalitySystem) {
      return null;
    }

    const culture = this.culturalEvolutionSystem.getCulture(cultureId);
    if (!culture) {
      return {
        entityId,
        cultureId,
        traitsConsidered: 0,
        traitModifications: {},
        culturalInfluence: 0,
        description: `Culture ${cultureId} not found`,
      };
    }

    const traits = this.culturalEvolutionSystem.getTraitsForCulture(cultureId);
    if (traits.length === 0) {
      return {
        entityId,
        cultureId,
        traitsConsidered: 0,
        traitModifications: {},
        culturalInfluence: 0,
        description: `Culture ${culture.name} has no traits`,
      };
    }

    // Map cultural trait types to Big Five personality modifications.
    const traitModifications: Record<string, number> = {};
    let totalInfluence = 0;

    for (const trait of traits) {
      const influence = (trait.adaptability / 100) * this.config.culturalInfluenceWeight * 10;
      totalInfluence += influence;

      // Map trait types to personality dimensions.
      switch (trait.type) {
        case "religion":
        case "ritual":
        case "custom":
          traitModifications["conscientiousness"] = (traitModifications["conscientiousness"] ?? 0) + influence;
          break;
        case "art":
        case "music":
        case "myth":
          traitModifications["openness"] = (traitModifications["openness"] ?? 0) + influence;
          break;
        case "value":
        case "governance":
        case "economy":
          traitModifications["agreeableness"] = (traitModifications["agreeableness"] ?? 0) + influence * 0.5;
          break;
        case "technology":
        case "architecture":
          traitModifications["conscientiousness"] = (traitModifications["conscientiousness"] ?? 0) + influence * 0.5;
          traitModifications["openness"] = (traitModifications["openness"] ?? 0) + influence * 0.5;
          break;
        case "language":
        case "etiquette":
          traitModifications["agreeableness"] = (traitModifications["agreeableness"] ?? 0) + influence;
          break;
        case "food":
        case "dress":
        case "holiday":
        case "custom":
          traitModifications["extraversion"] = (traitModifications["extraversion"] ?? 0) + influence * 0.5;
          break;
      }
    }

    // Apply modifications to NPC personality if it exists.
    const personality = this.npcPersonalitySystem.getPersonality(entityId);
    if (personality) {
      for (const [trait, delta] of Object.entries(traitModifications)) {
        this.npcPersonalitySystem.modifyTrait(entityId, trait as any, delta);
      }
    }

    const avgInfluence = totalInfluence / traits.length;
    this.totalCulturalInfluences++;
    this.culturalInfluenceSum += avgInfluence;

    const result: CulturalInfluenceResult = {
      entityId,
      cultureId,
      traitsConsidered: traits.length,
      traitModifications: Object.fromEntries(
        Object.entries(traitModifications).map(([k, v]) => [k, Math.round(v * 100) / 100]),
      ),
      culturalInfluence: Math.round(avgInfluence),
      description: `${entityId} influenced by culture ${culture.name} (${traits.length} traits, avg influence: ${avgInfluence.toFixed(1)})`,
    };

    this.makeEvent("integration.cultural_influence_applied", entityId, undefined, cultureId, result.description);
    return result;
  }

  // --- Full Sync ---

  /** Run a full integration sync cycle. */
  sync(): {
    socialInfluences: SocialInfluenceResult[];
    socialEventBridges: SocialNarrativeBridgeResult[];
    culturalInfluences: CulturalInfluenceResult[];
  } {
    this.syncCounter++;

    const socialInfluences = this.applySocialInfluenceToAll();
    const socialEventBridges = this.bridgeRecentSocialEvents();
    // Cultural influence is applied on demand, not automatically to all.

    this.makeEvent("integration.sync_completed", undefined, undefined, undefined,
      `Sync cycle ${this.syncCounter}: ${socialInfluences.length} social influences, ${socialEventBridges.length} event bridges`);

    return { socialInfluences, socialEventBridges, culturalInfluences: [] };
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    this.currentTick++;

    if (this.config.autoBridgeEvents) {
      this.sync();
    }
  }

  stop(): void {
    // Cleanup if needed.
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      eventHistory: this.eventHistory.slice(-100),
      bridgedSocialEvents: [...this.bridgedSocialEvents],
      currentTick: this.currentTick,
      syncCounter: this.syncCounter,
      stats: {
        totalSocialInfluences: this.totalSocialInfluences,
        totalSocialEventBridges: this.totalSocialEventBridges,
        totalCulturalInfluences: this.totalCulturalInfluences,
        socialInfluenceSum: this.socialInfluenceSum,
        culturalInfluenceSum: this.culturalInfluenceSum,
      },
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_SOCIAL_CULTURAL_INTEGRATION_CONFIG, ...(data.config as object) };
    this.eventHistory = (data.eventHistory as IntegrationEvent[]) ?? [];
    this.bridgedSocialEvents = new Set((data.bridgedSocialEvents as string[]) ?? []);
    this.currentTick = (data.currentTick as number) ?? 0;
    this.syncCounter = (data.syncCounter as number) ?? 0;

    const stats = data.stats as Record<string, number>;
    this.totalSocialInfluences = stats?.totalSocialInfluences ?? 0;
    this.totalSocialEventBridges = stats?.totalSocialEventBridges ?? 0;
    this.totalCulturalInfluences = stats?.totalCulturalInfluences ?? 0;
    this.socialInfluenceSum = stats?.socialInfluenceSum ?? 0;
    this.culturalInfluenceSum = stats?.culturalInfluenceSum ?? 0;
  }

  // --- Statistics ---

  getStats(): SocialCulturalIntegrationStats {
    const activeBridges =
      (this.socialRelationGraph ? 1 : 0) +
      (this.socialEventSystem ? 1 : 0) +
      (this.culturalEvolutionSystem ? 1 : 0) +
      (this.npcPersonalitySystem ? 1 : 0) +
      (this.dynamicNarrativeSystem ? 1 : 0);

    return {
      totalSocialInfluences: this.totalSocialInfluences,
      totalSocialEventBridges: this.totalSocialEventBridges,
      totalCulturalInfluences: this.totalCulturalInfluences,
      totalSyncCycles: this.syncCounter,
      activeBridges,
      averageSocialInfluence: this.totalSocialInfluences > 0
        ? this.socialInfluenceSum / this.totalSocialInfluences
        : 0,
      averageCulturalInfluence: this.totalCulturalInfluences > 0
        ? this.culturalInfluenceSum / this.totalCulturalInfluences
        : 0,
    };
  }

  // --- Internal Helpers ---

  private makeEvent(
    type: IntegrationEventType,
    entityId?: string,
    socialEventId?: string,
    cultureId?: string,
    description?: string,
  ): IntegrationEvent {
    const event: IntegrationEvent = {
      type,
      entityId,
      socialEventId,
      cultureId,
      description,
      tick: this.currentTick,
    };
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.shift();
    }
    return event;
  }
}
