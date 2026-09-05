// SocialGraph: manages social relationships between entities.
// All social content (relation types, trust/familiarity values) is managed by application logic.
// Seed only provides the graph storage, modification API, and event emission.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  SocialRelation,
  SocialRelationType,
} from "./SocialTypes.js";
import {
  SocialRelationChangedEvent,
  SocialTrustChangedEvent,
  SocialInteractionEvent,
} from "./SocialEvents.js";

export class SocialGraph {
  readonly name = "social";
  enabled = true;
  /** Key: "entityA|entityB" (sorted, undirected). Value: SocialRelation. */
  private relations = new Map<string, SocialRelation>();

  /** Make a canonical undirected key for two entities. */
  private makeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /** Set or create a relation between two entities. */
  setRelation(
    entityA: string,
    entityB: string,
    type: SocialRelationType,
    events?: EventSystem,
    trust = 50,
    familiarity = 0,
  ): SocialRelation {
    const key = this.makeKey(entityA, entityB);
    const existing = this.relations.get(key);
    const oldType = existing?.type ?? "neutral";
    const oldTrust = existing?.trust ?? 50;

    const relation: SocialRelation = {
      entityA,
      entityB,
      type,
      trust: Math.max(0, Math.min(100, trust)),
      familiarity: Math.max(0, Math.min(100, familiarity)),
      lastInteractionTick: existing?.lastInteractionTick ?? 0,
      interactionCount: existing?.interactionCount ?? 0,
      metadata: existing?.metadata,
    };
    this.relations.set(key, relation);

    if (events && (oldType !== type || oldTrust !== trust)) {
      events.emit(new SocialRelationChangedEvent(entityA, entityB, oldType, type));
      if (oldTrust !== trust) {
        events.emit(new SocialTrustChangedEvent(entityA, entityB, oldTrust, trust));
      }
    }
    return relation;
  }

  /** Get the relation between two entities, or undefined if none. */
  getRelation(entityA: string, entityB: string): SocialRelation | undefined {
    return this.relations.get(this.makeKey(entityA, entityB));
  }

  /** Check if a relation exists between two entities. */
  hasRelation(entityA: string, entityB: string): boolean {
    return this.relations.has(this.makeKey(entityA, entityB));
  }

  /** Remove a relation between two entities. Returns true if it existed. */
  removeRelation(entityA: string, entityB: string): boolean {
    return this.relations.delete(this.makeKey(entityA, entityB));
  }

  /** Get all relations involving an entity. */
  getRelations(entityId: string): SocialRelation[] {
    const result: SocialRelation[] = [];
    for (const relation of this.relations.values()) {
      if (relation.entityA === entityId || relation.entityB === entityId) {
        result.push(relation);
      }
    }
    return result;
  }

  /** Get all entities with a specific relation type to the given entity. */
  getRelationsByType(entityId: string, type: SocialRelationType): SocialRelation[] {
    return this.getRelations(entityId).filter((r) => r.type === type);
  }

  /** Get all friend entities. */
  getFriends(entityId: string): string[] {
    return this.getRelationsByType(entityId, "friend").map((r) =>
      r.entityA === entityId ? r.entityB : r.entityA,
    );
  }

  /** Get all enemy entities. */
  getEnemies(entityId: string): string[] {
    return this.getRelationsByType(entityId, "enemy").map((r) =>
      r.entityA === entityId ? r.entityB : r.entityA,
    );
  }

  /** Get all ally entities. */
  getAllies(entityId: string): string[] {
    return this.getRelationsByType(entityId, "ally").map((r) =>
      r.entityA === entityId ? r.entityB : r.entityA,
    );
  }

  /** Modify trust between two entities. Clamps to 0-100. Returns new trust value. */
  modifyTrust(entityA: string, entityB: string, delta: number, events?: EventSystem): number {
    const key = this.makeKey(entityA, entityB);
    const relation = this.relations.get(key);
    if (!relation) {
      // Auto-create neutral relation.
      return this.setRelation(entityA, entityB, "neutral", events, 50 + delta, 0).trust;
    }
    const oldTrust = relation.trust;
    relation.trust = Math.max(0, Math.min(100, relation.trust + delta));
    if (events && oldTrust !== relation.trust) {
      events.emit(new SocialTrustChangedEvent(entityA, entityB, oldTrust, relation.trust));
    }
    return relation.trust;
  }

  /** Modify familiarity between two entities. Clamps to 0-100. Returns new familiarity. */
  modifyFamiliarity(entityA: string, entityB: string, delta: number): number {
    const key = this.makeKey(entityA, entityB);
    const relation = this.relations.get(key);
    if (!relation) {
      return this.setRelation(entityA, entityB, "neutral", undefined, 50, delta).familiarity;
    }
    relation.familiarity = Math.max(0, Math.min(100, relation.familiarity + delta));
    return relation.familiarity;
  }

  /** Record a social interaction between two entities. Updates trust/familiarity and emits event. */
  recordInteraction(
    entityA: string,
    entityB: string,
    interactionType: string,
    trustDelta: number,
    familiarityDelta: number,
    events: EventSystem,
    worldTick: number,
  ): SocialRelation {
    const key = this.makeKey(entityA, entityB);
    let relation = this.relations.get(key);
    if (!relation) {
      relation = this.setRelation(entityA, entityB, "neutral", events, 50, 0);
    }
    const oldTrust = relation.trust;
    relation.trust = Math.max(0, Math.min(100, relation.trust + trustDelta));
    relation.familiarity = Math.max(0, Math.min(100, relation.familiarity + familiarityDelta));
    relation.lastInteractionTick = worldTick;
    relation.interactionCount++;

    events.emit(new SocialInteractionEvent(entityA, entityB, interactionType, trustDelta, familiarityDelta));
    if (oldTrust !== relation.trust) {
      events.emit(new SocialTrustChangedEvent(entityA, entityB, oldTrust, relation.trust));
    }
    return relation;
  }

  /** Get trust level between two entities (0-100). Returns 50 (neutral default) if no relation. */
  getTrust(entityA: string, entityB: string): number {
    return this.getRelation(entityA, entityB)?.trust ?? 50;
  }

  /** Get relation type between two entities. Returns "neutral" if no relation. */
  getRelationType(entityA: string, entityB: string): SocialRelationType {
    return this.getRelation(entityA, entityB)?.type ?? "neutral";
  }

  /** Number of relations in the graph. */
  get relationCount(): number {
    return this.relations.size;
  }

  /** WorldSystem interface: called each tick. Currently no per-tick logic. */
  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    // Future: relationship decay over time, periodic relationship checks.
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.relations.clear();
  }

  /** Serialize all relations. */
  serialize(): Record<string, unknown> {
    const relations: Record<string, SocialRelation> = {};
    for (const [key, relation] of this.relations) {
      relations[key] = relation;
    }
    return { relations };
  }

  /** Deserialize relations. */
  deserialize(data: Record<string, unknown>): void {
    if (data.relations && typeof data.relations === "object") {
      for (const [key, relation] of Object.entries(data.relations as Record<string, SocialRelation>)) {
        this.relations.set(key, relation);
      }
    }
  }
}
