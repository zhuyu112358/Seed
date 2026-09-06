// M13 Enhanced Social Relation Graph System.
// Rich social relationship network with multi-dimensional strength, dynamic
// decay, relation events, path queries, and simple group detection.
// All social content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import type {
  RichSocialRelation,
  RelationCategory,
  RelationSubtype,
  RelationStrength,
  RelationEventType,
  RelationEventPayload,
  RelationModificationResult,
  SocialPathResult,
  SocialGroup,
  SocialRelationGraphConfig,
} from "./SocialRelationTypes.js";
import {
  DEFAULT_RELATION_STRENGTH,
  DEFAULT_SOCIAL_RELATION_CONFIG,
} from "./SocialRelationTypes.js";

/** WorldSystem: enhanced social relation graph. */
export class SocialRelationGraph {
  readonly name = "social-relation-graph";
  enabled = true;

  private config: SocialRelationGraphConfig;
  private relations: Map<string, RichSocialRelation> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map();
  private eventHistory: RelationEventPayload[] = [];
  private relationCounter = 0;

  constructor(config?: Partial<SocialRelationGraphConfig>) {
    this.config = { ...DEFAULT_SOCIAL_RELATION_CONFIG, ...config };
  }

  // --- Relation Management ---

  /** Create or update a relation between two entities. */
  addRelation(
    entityA: string,
    entityB: string,
    category: RelationCategory,
    subtype: RelationSubtype,
    strength?: Partial<RelationStrength>,
    mutual = true,
    metadata?: Record<string, unknown>,
  ): RelationModificationResult {
    if (entityA === entityB) {
      return { success: false, events: [], failureReason: "Cannot create relation with self" };
    }

    const key = this.relationKey(entityA, entityB);
    const existing = this.relations.get(key);
    const events: RelationEventPayload[] = [];

    if (existing) {
      // Update existing relation.
      const oldCategory = existing.category;
      const oldSubtype = existing.subtype;
      existing.category = category;
      existing.subtype = subtype;
      existing.mutual = mutual;
      if (strength) {
        existing.strength = { ...existing.strength, ...strength };
      }
      existing.overallScore = this.calculateOverallScore(existing.strength);
      if (metadata) existing.metadata = { ...existing.metadata, ...metadata };

      if (oldCategory !== category || oldSubtype !== subtype) {
        events.push(this.makeEvent("relation.strengthened", entityA, entityB, existing.id, {
          oldCategory, newCategory: category, oldSubtype, newSubtype: subtype,
        }));
      }
      return { success: true, relation: existing, events };
    }

    // Check max relations per entity.
    const aCount = this.entityIndex.get(entityA)?.size ?? 0;
    const bCount = this.entityIndex.get(entityB)?.size ?? 0;
    if (aCount >= this.config.maxRelationsPerEntity || bCount >= this.config.maxRelationsPerEntity) {
      return { success: false, events: [], failureReason: "Max relations per entity exceeded" };
    }

    // Create new relation.
    this.relationCounter++;
    const relation: RichSocialRelation = {
      id: `rel_${this.relationCounter}`,
      entityA,
      entityB,
      category,
      subtype,
      strength: { ...DEFAULT_RELATION_STRENGTH, ...strength },
      overallScore: 0,
      mutual,
      establishedTick: 0,
      lastInteractionTick: 0,
      interactionCount: 0,
      active: true,
      metadata,
    };
    relation.overallScore = this.calculateOverallScore(relation.strength);

    this.relations.set(key, relation);
    this.indexRelation(entityA, key);
    this.indexRelation(entityB, key);

    events.push(this.makeEvent("relation.established", entityA, entityB, relation.id, {
      newCategory: category, newSubtype: subtype,
    }));

    return { success: true, relation, events };
  }

  /** Get a relation between two entities. */
  getRelation(entityA: string, entityB: string): RichSocialRelation | undefined {
    return this.relations.get(this.relationKey(entityA, entityB));
  }

  /** Check if a relation exists. */
  hasRelation(entityA: string, entityB: string): boolean {
    return this.relations.has(this.relationKey(entityA, entityB));
  }

  /** Remove a relation. */
  removeRelation(entityA: string, entityB: string): boolean {
    const key = this.relationKey(entityA, entityB);
    const relation = this.relations.get(key);
    if (!relation) return false;

    this.relations.delete(key);
    this.entityIndex.get(entityA)?.delete(key);
    this.entityIndex.get(entityB)?.delete(key);
    return true;
  }

  /** Get all relations for an entity. */
  getRelations(entityId: string): RichSocialRelation[] {
    const keys = this.entityIndex.get(entityId);
    if (!keys) return [];
    const result: RichSocialRelation[] = [];
    for (const key of keys) {
      const rel = this.relations.get(key);
      if (rel && rel.active) result.push(rel);
    }
    return result;
  }

  /** Get relations filtered by category. */
  getRelationsByCategory(entityId: string, category: RelationCategory): RichSocialRelation[] {
    return this.getRelations(entityId).filter((r) => r.category === category);
  }

  /** Get all entity IDs connected to this entity. */
  getConnectedEntities(entityId: string): string[] {
    return this.getRelations(entityId).map((r) =>
      r.entityA === entityId ? r.entityB : r.entityA,
    );
  }

  // --- Strength Modification ---

  /** Modify a specific strength dimension. */
  modifyStrength(
    entityA: string,
    entityB: string,
    dimension: keyof RelationStrength,
    delta: number,
  ): boolean {
    const relation = this.getRelation(entityA, entityB);
    if (!relation) return false;

    const oldValue = relation.strength[dimension];
    const newValue = Math.max(0, Math.min(100, oldValue + delta));
    relation.strength[dimension] = newValue;
    relation.overallScore = this.calculateOverallScore(relation.strength);

    if (newValue < this.config.inactivityThreshold && relation.active) {
      relation.active = false;
    } else if (newValue >= this.config.inactivityThreshold && !relation.active) {
      relation.active = true;
    }

    return true;
  }

  /** Record an interaction, updating strength and metadata. */
  recordInteraction(
    entityA: string,
    entityB: string,
    interactionType: string,
    strengthImpact?: Partial<RelationStrength>,
  ): boolean {
    const relation = this.getRelation(entityA, entityB);
    if (!relation) return false;

    relation.interactionCount++;
    relation.lastInteractionTick = 0; // Will be set by tick if world available.

    if (strengthImpact) {
      for (const [dim, delta] of Object.entries(strengthImpact)) {
        this.modifyStrength(entityA, entityB, dim as keyof RelationStrength, delta as number);
      }
    }

    return true;
  }

  // --- Event Emission ---

  /** Emit a specific relation event. */
  emitRelationEvent(
    type: RelationEventType,
    entityA: string,
    entityB: string,
    description?: string,
  ): RelationEventPayload | null {
    const relation = this.getRelation(entityA, entityB);
    const event = this.makeEvent(type, entityA, entityB, relation?.id, { description });
    this.recordEvent(event);
    return event;
  }

  /** Get recent relation events. */
  getRecentEvents(limit = 50): RelationEventPayload[] {
    return this.eventHistory.slice(-limit);
  }

  /** Get events involving a specific entity. */
  getEventsForEntity(entityId: string, limit = 50): RelationEventPayload[] {
    return this.eventHistory
      .filter((e) => e.entityA === entityId || e.entityB === entityId)
      .slice(-limit);
  }

  // --- Path Queries ---

  /** Find shortest social path between two entities (BFS). */
  findSocialPath(source: string, target: string, maxDepth = 6): SocialPathResult {
    if (source === target) {
      return { exists: true, path: [source], distance: 0, averageTrust: 100 };
    }

    const visited = new Set<string>([source]);
    const queue: { entity: string; path: string[]; trustSum: number }[] = [
      { entity: source, path: [source], trustSum: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth) continue;

      const neighbors = this.getConnectedEntities(current.entity);
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);

        const rel = this.getRelation(current.entity, neighbor);
        const edgeTrust = rel?.strength.trust ?? 0;
        const newPath = [...current.path, neighbor];

        if (neighbor === target) {
          const totalTrust = current.trustSum + edgeTrust;
          return {
            exists: true,
            path: newPath,
            distance: newPath.length - 1,
            averageTrust: totalTrust / (newPath.length - 1),
          };
        }

        queue.push({ entity: neighbor, path: newPath, trustSum: current.trustSum + edgeTrust });
      }
    }

    return { exists: false, path: [], distance: -1, averageTrust: 0 };
  }

  /** Find common connections between two entities. */
  findCommonConnections(entityA: string, entityB: string): string[] {
    const aConnections = new Set(this.getConnectedEntities(entityA));
    return this.getConnectedEntities(entityB).filter((e) => aConnections.has(e));
  }

  /** Calculate social degree (number of active relations). */
  getSocialDegree(entityId: string): number {
    return this.getRelations(entityId).length;
  }

  // --- Group Detection ---

  /** Simple group detection: find tightly connected clusters (threshold-based). */
  detectGroups(minSize = 3, cohesionThreshold = 60): SocialGroup[] {
    const allEntities = new Set<string>();
    for (const rel of this.relations.values()) {
      if (rel.active && rel.overallScore >= cohesionThreshold) {
        allEntities.add(rel.entityA);
        allEntities.add(rel.entityB);
      }
    }

    const groups: SocialGroup[] = [];
    const visited = new Set<string>();
    let groupCounter = 0;

    for (const seed of allEntities) {
      if (visited.has(seed)) continue;

      // BFS to find connected component (only high-strength edges).
      const members: string[] = [];
      const queue = [seed];
      const localVisited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (localVisited.has(current)) continue;
        localVisited.add(current);
        members.push(current);

        for (const neighbor of this.getConnectedEntities(current)) {
          const rel = this.getRelation(current, neighbor);
          if (rel && rel.active && rel.overallScore >= cohesionThreshold && !localVisited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      if (members.length >= minSize) {
        groupCounter++;
        // Calculate cohesion.
        let totalScore = 0;
        let edgeCount = 0;
        const categoryCounts = new Map<RelationCategory, number>();
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const rel = this.getRelation(members[i], members[j]);
            if (rel && rel.active) {
              totalScore += rel.overallScore;
              edgeCount++;
              categoryCounts.set(rel.category, (categoryCounts.get(rel.category) ?? 0) + 1);
            }
          }
        }
        const cohesion = edgeCount > 0 ? totalScore / edgeCount : 0;
        const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";

        groups.push({
          id: `group_${groupCounter}`,
          members,
          cohesion,
          dominantCategory,
        });
        for (const m of members) visited.add(m);
      }
    }

    return groups;
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;

    // Auto-decay inactive relations.
    if (this.config.autoDecay) {
      for (const relation of this.relations.values()) {
        if (!relation.active) continue;
        // Decay all dimensions slightly.
        for (const dim of Object.keys(relation.strength) as (keyof RelationStrength)[]) {
          relation.strength[dim] = Math.max(0, relation.strength[dim] - this.config.decayRate);
        }
        relation.overallScore = this.calculateOverallScore(relation.strength);

        if (relation.overallScore < this.config.inactivityThreshold) {
          relation.active = false;
        }
      }
    }

    // Emit queued events.
    if (this.config.emitEvents) {
      for (const event of this.eventHistory) {
        // Events are recorded internally; application layer can subscribe via getRecentEvents.
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
      relations: [...this.relations.values()],
      eventHistory: this.eventHistory.slice(-100),
      relationCounter: this.relationCounter,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_SOCIAL_RELATION_CONFIG, ...(data.config as object) };
    this.relations.clear();
    this.entityIndex.clear();

    const rels = data.relations as RichSocialRelation[];
    for (const rel of rels) {
      const key = this.relationKey(rel.entityA, rel.entityB);
      this.relations.set(key, rel);
      this.indexRelation(rel.entityA, key);
      this.indexRelation(rel.entityB, key);
    }

    this.eventHistory = (data.eventHistory as RelationEventPayload[]) ?? [];
    this.relationCounter = (data.relationCounter as number) ?? this.relations.size;
  }

  // --- Statistics ---

  getStats(): {
    totalRelations: number;
    activeRelations: number;
    totalEntities: number;
    totalEvents: number;
    averageOverallScore: number;
    categoryBreakdown: Record<string, number>;
  } {
    let active = 0;
    let totalScore = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const rel of this.relations.values()) {
      if (rel.active) {
        active++;
        totalScore += rel.overallScore;
      }
      categoryBreakdown[rel.category] = (categoryBreakdown[rel.category] ?? 0) + 1;
    }

    return {
      totalRelations: this.relations.size,
      activeRelations: active,
      totalEntities: this.entityIndex.size,
      totalEvents: this.eventHistory.length,
      averageOverallScore: active > 0 ? totalScore / active : 0,
      categoryBreakdown,
    };
  }

  // --- Internal Helpers ---

  private relationKey(a: string, b: string): string {
    return a < b ? `${a}::${b}` : `${b}::${a}`;
  }

  private indexRelation(entityId: string, key: string): void {
    if (!this.entityIndex.has(entityId)) {
      this.entityIndex.set(entityId, new Set());
    }
    this.entityIndex.get(entityId)!.add(key);
  }

  private calculateOverallScore(strength: RelationStrength): number {
    // Weighted average: trust 0.3, intimacy 0.25, respect 0.2, influence 0.15, fear 0.1
    return Math.round(
      strength.trust * 0.3 +
      strength.intimacy * 0.25 +
      strength.respect * 0.2 +
      strength.influence * 0.15 +
      strength.fear * 0.1,
    );
  }

  private makeEvent(
    type: RelationEventType,
    entityA: string,
    entityB: string,
    relationId?: string,
    extra?: Partial<RelationEventPayload>,
  ): RelationEventPayload {
    const event: RelationEventPayload = {
      type,
      entityA,
      entityB,
      relationId,
      tick: 0,
      ...extra,
    };
    this.recordEvent(event);
    return event;
  }

  private recordEvent(event: RelationEventPayload): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.shift();
    }
  }
}
