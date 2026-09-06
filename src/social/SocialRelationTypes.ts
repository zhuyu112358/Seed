// M13 Enhanced social relation types.
// All social content is defined by application layer; this module provides
// the framework for rich relationship networks with dynamic strength and events.

/** Extended relationship types beyond M7's basic six. */
export type RelationCategory =
  | "family"        // kinship: parent/child/sibling/spouse/cousin
  | "friendship"    // friend/close_friend/acquaintance
  | "enmity"        // enemy/rival/betrayer
  | "hierarchy"     // lord/vassal/master/apprentice/employer/employee
  | "partnership"   // business_partner/ally/coalition
  | "romance"       // lover/fiance/spouse
  | "mentorship"    // teacher/student/mentor/protege
  | "neutral";      // no significant relation

/** Specific relation subtypes within a category. */
export type RelationSubtype =
  // Family
  | "parent" | "child" | "sibling" | "spouse" | "cousin" | "grandparent" | "grandchild"
  // Friendship
  | "friend" | "close_friend" | "acquaintance" | "best_friend"
  // Enmity
  | "enemy" | "rival" | "betrayer" | "sworn_enemy"
  // Hierarchy
  | "lord" | "vassal" | "master" | "apprentice" | "employer" | "employee" | "leader" | "follower"
  // Partnership
  | "business_partner" | "ally" | "coalition_member" | "trade_partner"
  // Romance
  | "lover" | "fiance" | "romantic_partner"
  // Mentorship
  | "teacher" | "student" | "mentor" | "protege"
  // Neutral
  | "neutral" | "stranger";

/** Multi-dimensional relationship strength (all 0-100). */
export interface RelationStrength {
  /** Trust: willingness to rely on the other (0-100). */
  trust: number;
  /** Intimacy: emotional closeness (0-100). */
  intimacy: number;
  /** Respect: admiration or deference (0-100). */
  respect: number;
  /** Fear: apprehension or intimidation (0-100). */
  fear: number;
  /** Influence: ability to affect the other's decisions (0-100). */
  influence: number;
}

/** Default neutral relationship strength. */
export const DEFAULT_RELATION_STRENGTH: RelationStrength = {
  trust: 50,
  intimacy: 20,
  respect: 30,
  fear: 10,
  influence: 20,
};

/** A rich social relationship between two entities. */
export interface RichSocialRelation {
  /** Unique relation ID. */
  id: string;
  /** First entity ID. */
  entityA: string;
  /** Second entity ID. */
  entityB: string;
  /** Broad relationship category. */
  category: RelationCategory;
  /** Specific relationship subtype. */
  subtype: RelationSubtype;
  /** Multi-dimensional strength. */
  strength: RelationStrength;
  /** Overall relation score 0-100 (derived from strength dimensions). */
  overallScore: number;
  /** Whether the relation is mutual (symmetric) or directed. */
  mutual: boolean;
  /** Tick when relation was established. */
  establishedTick: number;
  /** Tick of last interaction. */
  lastInteractionTick: number;
  /** Total interaction count. */
  interactionCount: number;
  /** Whether the relation is currently active (not broken/severed). */
  active: boolean;
  /** Custom metadata (application-defined). */
  metadata?: Record<string, unknown>;
}

/** Types of social relation events. */
export type RelationEventType =
  | "relation.established"    // first meeting / acquaintance
  | "relation.strengthened"   // bond grows stronger
  | "relation.weakened"       // bond grows weaker
  | "relation.severed"        // relationship broken
  | "relation.reconciled"     // relationship restored
  | "relation.betrayed"       // one betrays the other
  | "relation.alliance_formed" // formal alliance
  | "relation.alliance_broken" // alliance broken
  | "relation.marriage"       // marriage / union
  | "relation.divorce"        // separation
  | "relation.birth"          // new family member born
  | "relation.death"          // family member died
  | "relation.promotion"      // hierarchy change (promotion)
  | "relation.demotion"       // hierarchy change (demotion)
  | "relation.apprenticeship_started"  // master-apprentice begins
  | "relation.apprenticeship_completed"; // apprenticeship complete

/** Payload for a relation event. */
export interface RelationEventPayload {
  /** Event type. */
  type: RelationEventType;
  /** Entity A ID. */
  entityA: string;
  /** Entity B ID. */
  entityB: string;
  /** Relation ID (if relation exists). */
  relationId?: string;
  /** Old category (if changed). */
  oldCategory?: RelationCategory;
  /** New category (if changed). */
  newCategory?: RelationCategory;
  /** Old subtype (if changed). */
  oldSubtype?: RelationSubtype;
  /** New subtype (if changed). */
  newSubtype?: RelationSubtype;
  /** Strength change details. */
  strengthChange?: Partial<RelationStrength>;
  /** Event description (application-defined). */
  description?: string;
  /** World tick when event occurred. */
  tick: number;
}

/** Configuration for SocialRelationGraph. */
export interface SocialRelationGraphConfig {
  /** Maximum relations per entity (default 100). */
  maxRelationsPerEntity: number;
  /** Decay rate per tick for inactive relations (default 0.001). */
  decayRate: number;
  /** Whether to auto-decay strength over time (default true). */
  autoDecay: boolean;
  /** Threshold below which a relation becomes inactive (default 5). */
  inactivityThreshold: number;
  /** Whether to emit events on relation changes (default true). */
  emitEvents: boolean;
  /** Maximum event history size (default 500). */
  maxEventHistory: number;
}

/** Default configuration. */
export const DEFAULT_SOCIAL_RELATION_CONFIG: SocialRelationGraphConfig = {
  maxRelationsPerEntity: 100,
  decayRate: 0.001,
  autoDecay: true,
  inactivityThreshold: 5,
  emitEvents: true,
  maxEventHistory: 500,
};

/** Result of a relation modification. */
export interface RelationModificationResult {
  /** Whether the modification succeeded. */
  success: boolean;
  /** The modified relation (if success). */
  relation?: RichSocialRelation;
  /** Events emitted during modification. */
  events: RelationEventPayload[];
  /** Reason for failure (if any). */
  failureReason?: string;
}

/** Result of a social path query. */
export interface SocialPathResult {
  /** Whether a path exists. */
  exists: boolean;
  /** Path as array of entity IDs (from source to target). */
  path: string[];
  /** Social distance (number of hops). */
  distance: number;
  /** Average trust along the path (0-100). */
  averageTrust: number;
}

/** Detected social group / faction. */
export interface SocialGroup {
  /** Group ID. */
  id: string;
  /** Member entity IDs. */
  members: string[];
  /** Cohesion score 0-100 (how tightly connected). */
  cohesion: number;
  /** Dominant relation category within group. */
  dominantCategory: RelationCategory;
}
