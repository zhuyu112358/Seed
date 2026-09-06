// M13 Cultural Evolution types.
// Cultural traits with mutation/selection/transmission, cultural differentiation,
// cultural contact and fusion, cultural change driving narrative.
// All content is defined by application layer.

/** Types of cultural traits. */
export type CulturalTraitType =
  | "language"      // 语言
  | "religion"      // 宗教
  | "custom"        // 习俗
  | "art"           // 艺术
  | "music"         // 音乐
  | "food"          // 饮食
  | "dress"         // 服饰
  | "architecture"  // 建筑
  | "ritual"        // 仪式
  | "value"         // 价值观
  | "technology"    // 技术
  | "myth"          // 神话
  | "etiquette"     // 礼仪
  | "holiday"       // 节日
  | "economy"       // 经济模式
  | "governance";   // 治理模式

/** A cultural trait that can evolve and spread. */
export interface CulturalTrait {
  /** Unique trait ID. */
  id: string;
  /** Trait type. */
  type: CulturalTraitType;
  /** Trait name. */
  name: string;
  /** Trait description. */
  description: string;
  /** Culture ID where this trait originated. */
  originCultureId: string;
  /** How easily this trait spreads to other cultures (0-100). */
  transmissibility: number;
  /** How well this trait adapts to new environments (0-100). */
  adaptability: number;
  /** Probability of mutation per tick (0-1). */
  mutationRate: number;
  /** How many ticks this trait has existed. */
  age: number;
  /** Number of cultures that have adopted this trait. */
  followerCount: number;
  /** Whether this trait is still active (not extinct). */
  active: boolean;
  /** Mutation history. */
  mutationHistory: CulturalMutation[];
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A record of cultural trait mutation. */
export interface CulturalMutation {
  /** Mutation ID. */
  id: string;
  /** Trait ID that mutated. */
  traitId: string;
  /** Original name before mutation. */
  originalName: string;
  /** New name after mutation. */
  mutatedName: string;
  /** Culture where mutation occurred. */
  cultureId: string;
  /** Mutation description. */
  description: string;
  /** Tick when mutation occurred. */
  tick: number;
}

/** A record of cultural transmission. */
export interface CulturalTransmission {
  /** Transmission ID. */
  id: string;
  /** Trait ID transmitted. */
  traitId: string;
  /** Source culture ID. */
  fromCultureId: string;
  /** Target culture ID. */
  toCultureId: string;
  /** Whether transmission was successful. */
  success: boolean;
  /** Tick when transmission occurred. */
  tick: number;
}

/** A culture with a set of cultural traits. */
export interface Culture {
  /** Unique culture ID. */
  id: string;
  /** Culture name. */
  name: string;
  /** Culture description. */
  description: string;
  /** Set of trait IDs belonging to this culture. */
  traitIds: Set<string>;
  /** Population size (application-defined). */
  population: number;
  /** Cultural influence (0-100). */
  influence: number;
  /** Location/region identifier. */
  location: string;
  /** Tick when culture was created. */
  createdTick: number;
  /** Parent culture ID (if derived from another culture). */
  parentCultureId: string | null;
  /** Child culture IDs. */
  childCultureIds: string[];
  /** Whether culture is still active. */
  active: boolean;
  /** Cultural cohesion (0-100, higher = more unified). */
  cohesion: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Result of cultural distance calculation. */
export interface CulturalDistanceResult {
  /** Culture A ID. */
  cultureAId: string;
  /** Culture B ID. */
  cultureBId: string;
  /** Distance score (0-100, 0 = identical, 100 = completely different). */
  distance: number;
  /** Number of shared traits. */
  sharedTraits: number;
  /** Number of traits unique to A. */
  uniqueToA: number;
  /** Number of traits unique to B. */
  uniqueToB: number;
  /** Trait types where they differ. */
  differingTypes: CulturalTraitType[];
}

/** Result of culture merge. */
export interface CultureMergeResult {
  /** Whether merge was successful. */
  success: boolean;
  /** New merged culture ID (if created). */
  mergedCultureId: string | null;
  /** Number of traits combined. */
  traitsCombined: number;
  /** Reason for success/failure. */
  reason: string;
}

/** Configuration for CulturalEvolutionSystem. */
export interface CulturalEvolutionConfig {
  /** Base transmission probability per contact (0-1). */
  baseTransmissionRate: number;
  /** Base mutation probability per trait per tick (0-1). */
  baseMutationRate: number;
  /** Whether to auto-transmit traits each tick. */
  autoTransmit: boolean;
  /** Whether to auto-mutate traits each tick. */
  autoMutate: boolean;
  /** Whether to auto-select (prune low-adaptability traits). */
  autoSelect: boolean;
  /** Threshold below which traits are pruned during selection (0-100). */
  selectionThreshold: number;
  /** Maximum active cultures. */
  maxCultures: number;
  /** Maximum traits per culture. */
  maxTraitsPerCulture: number;
  /** Maximum total traits. */
  maxTotalTraits: number;
  /** Whether to emit events. */
  emitEvents: boolean;
  /** Maximum history records. */
  maxHistory: number;
}

/** Default configuration. */
export const DEFAULT_CULTURAL_EVOLUTION_CONFIG: CulturalEvolutionConfig = {
  baseTransmissionRate: 0.2,
  baseMutationRate: 0.01,
  autoTransmit: true,
  autoMutate: true,
  autoSelect: true,
  selectionThreshold: 20,
  maxCultures: 50,
  maxTraitsPerCulture: 30,
  maxTotalTraits: 200,
  emitEvents: true,
  maxHistory: 500,
};

/** Event types emitted by CulturalEvolutionSystem. */
export type CulturalEvolutionEventType =
  | "culture.created"
  | "culture.merged"
  | "culture.extinct"
  | "trait.created"
  | "trait.mutated"
  | "trait.transmitted"
  | "trait.extinct"
  | "culture.differentiated";

/** Event payload for cultural evolution events. */
export interface CulturalEvolutionEvent {
  type: CulturalEvolutionEventType;
  cultureId?: string;
  traitId?: string;
  otherCultureId?: string;
  description?: string;
  tick: number;
}

/** Statistics for CulturalEvolutionSystem. */
export interface CulturalEvolutionStats {
  totalCultures: number;
  activeCultures: number;
  extinctCultures: number;
  totalTraits: number;
  activeTraits: number;
  totalMutations: number;
  totalTransmissions: number;
  averageTraitsPerCulture: number;
  mostInfluentialCulture: string | null;
  mostFollowedTrait: string | null;
  dominantTraitType: CulturalTraitType | null;
}
