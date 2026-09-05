// Social graph types. All social content is defined by application layer.
/** Types of social relationships between entities. */
export type SocialRelationType = "friend" | "neutral" | "enemy" | "rival" | "ally" | "family";

/** A social relationship between two entities. */
export interface SocialRelation {
  entityA: string;
  entityB: string;
  type: SocialRelationType;
  /** Trust level 0-100. Higher = more trust. */
  trust: number;
  /** Familiarity level 0-100. Higher = more familiar. */
  familiarity: number;
  /** Last interaction tick (world.tick). */
  lastInteractionTick: number;
  /** Number of interactions between these entities. */
  interactionCount: number;
  /** Custom metadata (application-defined). */
  metadata?: Record<string, unknown>;
}

/** Event payload for social relation changes. */
export interface SocialRelationChange {
  entityA: string;
  entityB: string;
  oldType: SocialRelationType;
  newType: SocialRelationType;
  oldTrust: number;
  newTrust: number;
}

/** Context for social interaction callbacks. */
export interface SocialInteractionContext {
  entityA: string;
  entityB: string;
  interactionType: string;
  worldTick: number;
  [key: string]: unknown;
}
