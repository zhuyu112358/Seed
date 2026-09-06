// M13 Cultural Evolution System.
// Cultural traits with mutation/selection/transmission, cultural differentiation,
// cultural contact and fusion, cultural change. All content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type {
  CulturalTrait,
  CulturalTraitType,
  CulturalMutation,
  CulturalTransmission,
  Culture,
  CulturalDistanceResult,
  CultureMergeResult,
  CulturalEvolutionConfig,
  CulturalEvolutionEvent,
  CulturalEvolutionEventType,
  CulturalEvolutionStats,
} from "./CulturalEvolutionTypes.js";
import { DEFAULT_CULTURAL_EVOLUTION_CONFIG } from "./CulturalEvolutionTypes.js";

/** WorldSystem: cultural evolution with trait mutation/selection/transmission. */
export class CulturalEvolutionSystem {
  readonly name = "cultural-evolution-system";
  enabled = true;

  private config: CulturalEvolutionConfig;
  private cultures: Map<string, Culture> = new Map();
  private traits: Map<string, CulturalTrait> = new Map();
  private mutationHistory: CulturalMutation[] = [];
  private transmissionHistory: CulturalTransmission[] = [];
  private eventHistory: CulturalEvolutionEvent[] = [];
  private cultureCounter = 0;
  private traitCounter = 0;
  private mutationCounter = 0;
  private transmissionCounter = 0;
  private currentTick = 0;

  constructor(config?: Partial<CulturalEvolutionConfig>) {
    this.config = { ...DEFAULT_CULTURAL_EVOLUTION_CONFIG, ...config };
  }

  // --- Culture Management ---

  /** Create a new culture. */
  createCulture(
    name: string,
    description: string,
    options?: {
      population?: number;
      influence?: number;
      location?: string;
      parentCultureId?: string;
      initialTraitIds?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Culture | null {
    if (this.cultures.size >= this.config.maxCultures) return null;

    this.cultureCounter++;
    const culture: Culture = {
      id: `culture_${this.cultureCounter}`,
      name,
      description,
      traitIds: new Set(options?.initialTraitIds ?? []),
      population: options?.population ?? 1000,
      influence: options?.influence ?? 30,
      location: options?.location ?? "unknown",
      createdTick: this.currentTick,
      parentCultureId: options?.parentCultureId ?? null,
      childCultureIds: [],
      active: true,
      cohesion: 70,
      metadata: options?.metadata,
    };

    this.cultures.set(culture.id, culture);

    // Register as child of parent culture.
    if (options?.parentCultureId) {
      const parent = this.cultures.get(options.parentCultureId);
      if (parent) {
        parent.childCultureIds.push(culture.id);
      }
    }

    this.makeEvent("culture.created", culture.id, undefined, undefined,
      `Culture created: ${name} (${description.substring(0, 50)})`);
    return culture;
  }

  /** Get a culture by ID. */
  getCulture(cultureId: string): Culture | undefined {
    return this.cultures.get(cultureId);
  }

  /** Get all active cultures. */
  getActiveCultures(): Culture[] {
    return [...this.cultures.values()].filter((c) => c.active);
  }

  /** Get all cultures (active + extinct). */
  getAllCultures(): Culture[] {
    return [...this.cultures.values()];
  }

  // --- Cultural Trait Management ---

  /** Create a new cultural trait. */
  createTrait(
    type: CulturalTraitType,
    name: string,
    description: string,
    originCultureId: string,
    options?: {
      transmissibility?: number;
      adaptability?: number;
      mutationRate?: number;
      metadata?: Record<string, unknown>;
    },
  ): CulturalTrait | null {
    if (this.traits.size >= this.config.maxTotalTraits) return null;

    this.traitCounter++;
    const trait: CulturalTrait = {
      id: `trait_${this.traitCounter}`,
      type,
      name,
      description,
      originCultureId,
      transmissibility: options?.transmissibility ?? 50,
      adaptability: options?.adaptability ?? 50,
      mutationRate: options?.mutationRate ?? this.config.baseMutationRate,
      age: 0,
      followerCount: 1,
      active: true,
      mutationHistory: [],
      metadata: options?.metadata,
    };

    this.traits.set(trait.id, trait);

    // Add trait to origin culture.
    const culture = this.cultures.get(originCultureId);
    if (culture && culture.traitIds.size < this.config.maxTraitsPerCulture) {
      culture.traitIds.add(trait.id);
    }

    this.makeEvent("trait.created", originCultureId, trait.id, undefined,
      `Trait created: ${name} (${type}) in culture ${originCultureId}`);
    return trait;
  }

  /** Get a trait by ID. */
  getTrait(traitId: string): CulturalTrait | undefined {
    return this.traits.get(traitId);
  }

  /** Get all traits for a culture. */
  getTraitsForCulture(cultureId: string): CulturalTrait[] {
    const culture = this.cultures.get(cultureId);
    if (!culture) return [];
    return [...culture.traitIds]
      .map((id) => this.traits.get(id))
      .filter((t): t is CulturalTrait => t !== undefined && t.active);
  }

  /** Add a trait to a culture. */
  addTraitToCulture(cultureId: string, traitId: string): boolean {
    const culture = this.cultures.get(cultureId);
    const trait = this.traits.get(traitId);
    if (!culture || !trait) return false;
    if (culture.traitIds.has(traitId)) return false;
    if (culture.traitIds.size >= this.config.maxTraitsPerCulture) return false;

    culture.traitIds.add(traitId);
    trait.followerCount++;
    return true;
  }

  /** Remove a trait from a culture. */
  removeTraitFromCulture(cultureId: string, traitId: string): boolean {
    const culture = this.cultures.get(cultureId);
    const trait = this.traits.get(traitId);
    if (!culture || !trait) return false;
    if (!culture.traitIds.has(traitId)) return false;

    culture.traitIds.delete(traitId);
    trait.followerCount = Math.max(0, trait.followerCount - 1);
    return true;
  }

  // --- Cultural Transmission ---

  /** Transmit a trait from one culture to another. */
  transmitTrait(
    traitId: string,
    fromCultureId: string,
    toCultureId: string,
  ): boolean {
    const trait = this.traits.get(traitId);
    const fromCulture = this.cultures.get(fromCultureId);
    const toCulture = this.cultures.get(toCultureId);

    if (!trait || !fromCulture || !toCulture) return false;
    if (!fromCulture.traitIds.has(traitId)) return false;
    if (toCulture.traitIds.has(traitId)) return false;
    if (toCulture.traitIds.size >= this.config.maxTraitsPerCulture) return false;

    // Calculate transmission probability.
    const transmissionProbability = Math.min(0.95,
      this.config.baseTransmissionRate *
      (trait.transmissibility / 50) *
      (fromCulture.influence / 50) *
      (trait.adaptability / 50)
    );

    const success = Math.random() < transmissionProbability;

    this.transmissionCounter++;
    const record: CulturalTransmission = {
      id: `trans_${this.transmissionCounter}`,
      traitId,
      fromCultureId,
      toCultureId,
      success,
      tick: this.currentTick,
    };
    this.transmissionHistory.push(record);
    if (this.transmissionHistory.length > this.config.maxHistory) {
      this.transmissionHistory.shift();
    }

    if (success) {
      toCulture.traitIds.add(traitId);
      trait.followerCount++;
      this.makeEvent("trait.transmitted", toCultureId, traitId, fromCultureId,
        `Trait ${trait.name} transmitted from ${fromCulture.name} to ${toCulture.name} (prob: ${transmissionProbability.toFixed(3)})`);
    }

    return success;
  }

  // --- Cultural Mutation ---

  /** Mutate a cultural trait. */
  mutateTrait(traitId: string, cultureId: string): CulturalMutation | null {
    const trait = this.traits.get(traitId);
    const culture = this.cultures.get(cultureId);
    if (!trait || !culture) return null;
    if (!culture.traitIds.has(traitId)) return null;

    this.mutationCounter++;
    const originalName = trait.name;
    const mutatedName = `${trait.name} (${culture.name} variant)`;
    trait.name = mutatedName;
    trait.mutationRate = Math.min(0.5, trait.mutationRate * 1.1);
    trait.transmissibility = Math.max(10, trait.transmissibility + (Math.random() * 20 - 10));

    const mutation: CulturalMutation = {
      id: `mutation_${this.mutationCounter}`,
      traitId,
      originalName,
      mutatedName,
      cultureId,
      description: `Trait ${originalName} mutated to ${mutatedName} in ${culture.name}`,
      tick: this.currentTick,
    };

    trait.mutationHistory.push(mutation);
    this.mutationHistory.push(mutation);
    if (this.mutationHistory.length > this.config.maxHistory) {
      this.mutationHistory.shift();
    }

    this.makeEvent("trait.mutated", cultureId, traitId, undefined,
      `Trait ${originalName} mutated to ${mutatedName} in ${culture.name}`);

    return mutation;
  }

  // --- Cultural Selection ---

  /** Select (prune) low-adaptability traits from a culture. */
  selectTraits(cultureId: string): number {
    const culture = this.cultures.get(cultureId);
    if (!culture) return 0;

    let pruned = 0;
    const traitIdsToPrune: string[] = [];

    for (const traitId of culture.traitIds) {
      const trait = this.traits.get(traitId);
      if (trait && trait.adaptability < this.config.selectionThreshold) {
        traitIdsToPrune.push(traitId);
      }
    }

    for (const traitId of traitIdsToPrune) {
      this.removeTraitFromCulture(cultureId, traitId);
      pruned++;
    }

    return pruned;
  }

  // --- Cultural Distance / Differentiation ---

  /** Calculate cultural distance between two cultures. */
  getCulturalDistance(cultureAId: string, cultureBId: string): CulturalDistanceResult | null {
    const cultureA = this.cultures.get(cultureAId);
    const cultureB = this.cultures.get(cultureBId);
    if (!cultureA || !cultureB) return null;

    const traitsA = this.getTraitsForCulture(cultureAId);
    const traitsB = this.getTraitsForCulture(cultureBId);

    const traitIdsA = new Set(traitsA.map((t) => t.id));
    const traitIdsB = new Set(traitsB.map((t) => t.id));

    const shared = [...traitIdsA].filter((id) => traitIdsB.has(id));
    const uniqueA = [...traitIdsA].filter((id) => !traitIdsB.has(id));
    const uniqueB = [...traitIdsB].filter((id) => !traitIdsA.has(id));

    // Calculate differing types.
    const typesA = new Set(traitsA.map((t) => t.type));
    const typesB = new Set(traitsB.map((t) => t.type));
    const differingTypes = [...new Set([...uniqueA, ...uniqueB])]
      .map((id) => this.traits.get(id)?.type)
      .filter((t): t is CulturalTraitType => t !== undefined);

    // Distance: 0 = identical, 100 = completely different.
    const totalTraits = traitIdsA.size + traitIdsB.size;
    const distance = totalTraits > 0
      ? Math.round(((uniqueA.length + uniqueB.length) / totalTraits) * 100)
      : 0;

    return {
      cultureAId,
      cultureBId,
      distance,
      sharedTraits: shared.length,
      uniqueToA: uniqueA.length,
      uniqueToB: uniqueB.length,
      differingTypes: [...new Set(differingTypes)],
    };
  }

  // --- Cultural Contact and Fusion ---

  /** Merge two cultures into a new fused culture. */
  mergeCultures(
    cultureAId: string,
    cultureBId: string,
    newName: string,
    newDescription: string,
  ): CultureMergeResult {
    const cultureA = this.cultures.get(cultureAId);
    const cultureB = this.cultures.get(cultureBId);
    if (!cultureA || !cultureB) {
      return { success: false, mergedCultureId: null, traitsCombined: 0, reason: "One or both cultures not found" };
    }
    if (!cultureA.active || !cultureB.active) {
      return { success: false, mergedCultureId: null, traitsCombined: 0, reason: "One or both cultures not active" };
    }

    // Combine traits (union, limited by maxTraitsPerCulture).
    const combinedTraitIds = new Set([...cultureA.traitIds, ...cultureB.traitIds]);
    const traitArray = [...combinedTraitIds].slice(0, this.config.maxTraitsPerCulture);

    // Create merged culture.
    const mergedCulture = this.createCulture(newName, newDescription, {
      population: cultureA.population + cultureB.population,
      influence: Math.round((cultureA.influence + cultureB.influence) / 2),
      location: cultureA.location,
      initialTraitIds: traitArray,
    });

    if (!mergedCulture) {
      return { success: false, mergedCultureId: null, traitsCombined: 0, reason: "Failed to create merged culture (max cultures reached)" };
    }

    // Deactivate original cultures.
    cultureA.active = false;
    cultureB.active = false;

    this.makeEvent("culture.merged", mergedCulture.id, undefined, cultureAId,
      `Cultures ${cultureA.name} and ${cultureB.name} merged into ${newName}`);

    return {
      success: true,
      mergedCultureId: mergedCulture.id,
      traitsCombined: traitArray.length,
      reason: "Merge successful",
    };
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    this.currentTick++;

    // Age all traits.
    for (const trait of this.traits.values()) {
      if (trait.active) trait.age++;
    }

    // Auto-transmit: each culture may transmit traits to others.
    if (this.config.autoTransmit) {
      const activeCultures = this.getActiveCultures();
      for (const fromCulture of activeCultures) {
        for (const toCulture of activeCultures) {
          if (fromCulture.id === toCulture.id) continue;
          // Try transmitting each trait.
          for (const traitId of fromCulture.traitIds) {
            if (!toCulture.traitIds.has(traitId)) {
              this.transmitTrait(traitId, fromCulture.id, toCulture.id);
            }
          }
        }
      }
    }

    // Auto-mutate: each trait in each culture may mutate.
    if (this.config.autoMutate) {
      for (const culture of this.getActiveCultures()) {
        for (const traitId of culture.traitIds) {
          const trait = this.traits.get(traitId);
          if (trait && Math.random() < trait.mutationRate) {
            this.mutateTrait(traitId, culture.id);
          }
        }
      }
    }

    // Auto-select: prune low-adaptability traits.
    if (this.config.autoSelect) {
      for (const culture of this.getActiveCultures()) {
        this.selectTraits(culture.id);
      }
    }
  }

  stop(): void {
    // Cleanup if needed.
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      cultures: [...this.cultures.values()].map((c) => ({
        ...c,
        traitIds: [...c.traitIds],
      })),
      traits: [...this.traits.values()],
      mutationHistory: this.mutationHistory.slice(-100),
      transmissionHistory: this.transmissionHistory.slice(-100),
      eventHistory: this.eventHistory.slice(-100),
      counters: {
        culture: this.cultureCounter,
        trait: this.traitCounter,
        mutation: this.mutationCounter,
        transmission: this.transmissionCounter,
      },
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_CULTURAL_EVOLUTION_CONFIG, ...(data.config as object) };
    this.cultures.clear();
    this.traits.clear();
    this.mutationHistory = [];
    this.transmissionHistory = [];
    this.eventHistory = [];

    const cultures = (data.cultures as Array<Omit<Culture, "traitIds"> & { traitIds: string[] }>) ?? [];
    for (const c of cultures) {
      this.cultures.set(c.id, { ...c, traitIds: new Set(c.traitIds) });
    }

    const traits = data.traits as CulturalTrait[];
    for (const t of traits) {
      this.traits.set(t.id, t);
    }

    this.mutationHistory = (data.mutationHistory as CulturalMutation[]) ?? [];
    this.transmissionHistory = (data.transmissionHistory as CulturalTransmission[]) ?? [];
    this.eventHistory = (data.eventHistory as CulturalEvolutionEvent[]) ?? [];

    const counters = data.counters as Record<string, number>;
    this.cultureCounter = counters?.culture ?? this.cultures.size;
    this.traitCounter = counters?.trait ?? this.traits.size;
    this.mutationCounter = counters?.mutation ?? 0;
    this.transmissionCounter = counters?.transmission ?? 0;
    this.currentTick = (data.currentTick as number) ?? 0;
  }

  // --- Statistics ---

  getStats(): CulturalEvolutionStats {
    const allCultures = this.getAllCultures();
    const activeCultures = this.getActiveCultures();
    const allTraits = [...this.traits.values()];
    const activeTraits = allTraits.filter((t) => t.active);

    let totalTraitAssignments = 0;
    let maxInfluence = -1;
    let mostInfluentialCulture: string | null = null;
    let maxFollowers = -1;
    let mostFollowedTrait: string | null = null;
    const typeCounts: Record<string, number> = {};

    for (const c of activeCultures) {
      totalTraitAssignments += c.traitIds.size;
      if (c.influence > maxInfluence) {
        maxInfluence = c.influence;
        mostInfluentialCulture = c.id;
      }
    }

    for (const t of activeTraits) {
      if (t.followerCount > maxFollowers) {
        maxFollowers = t.followerCount;
        mostFollowedTrait = t.id;
      }
      typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
    }

    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as CulturalTraitType | undefined ?? null;

    return {
      totalCultures: allCultures.length,
      activeCultures: activeCultures.length,
      extinctCultures: allCultures.length - activeCultures.length,
      totalTraits: allTraits.length,
      activeTraits: activeTraits.length,
      totalMutations: this.mutationHistory.length,
      totalTransmissions: this.transmissionHistory.length,
      averageTraitsPerCulture: activeCultures.length > 0 ? totalTraitAssignments / activeCultures.length : 0,
      mostInfluentialCulture,
      mostFollowedTrait,
      dominantTraitType: dominantType,
    };
  }

  // --- Internal Helpers ---

  private makeEvent(
    type: CulturalEvolutionEventType,
    cultureId?: string,
    traitId?: string,
    otherCultureId?: string,
    description?: string,
  ): CulturalEvolutionEvent {
    const event: CulturalEvolutionEvent = {
      type,
      cultureId,
      traitId,
      otherCultureId,
      description,
      tick: this.currentTick,
    };
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.config.maxHistory) {
      this.eventHistory.shift();
    }
    return event;
  }
}
