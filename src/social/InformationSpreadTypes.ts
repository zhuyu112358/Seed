// M13 Information Spread Model types.
// Information spread: SIR epidemic model for ideas/rumors/news,
// social influence networks, credibility assessment, and information mutation.
// All content is defined by application layer.

/** Types of information. */
export type InformationType =
  | "idea"        // 观念
  | "rumor"       // 谣言
  | "news"        // 新闻
  | "gossip"      // 八卦
  | "propaganda"  // 宣传
  | "knowledge"   // 知识
  | "meme"        // 模因
  | "warning"     // 警告
  | "tradition";  // 传统

/** SIR model states (extended with exposed and ignored). */
export type InformationState =
  | "susceptible"  // 易感 (not yet exposed)
  | "exposed"      // 暴露 (received but not yet infected)
  | "infected"     // 感染 (believes and spreads)
  | "recovered"    // 恢复 (no longer spreads)
  | "ignored";     // 忽略 (rejected outright)

/** An item of information spreading through the network. */
export interface InformationItem {
  /** Unique information ID. */
  id: string;
  /** Information type. */
  type: InformationType;
  /** Information content/text. */
  content: string;
  /** Source entity ID that originated this information. */
  sourceId: string;
  /** Base credibility of the source (0-100). */
  sourceCredibility: number;
  /** How easily this information spreads (0-100). */
  infectivity: number;
  /** How long an infected node remains infectious (in ticks). */
  infectiousDuration: number;
  /** Current credibility score (0-100, decreases with mutation). */
  currentCredibility: number;
  /** Number of times this information has mutated. */
  mutationCount: number;
  /** Mutation history. */
  mutationHistory: InformationMutation[];
  /** Tick when information was created. */
  createdTick: number;
  /** Total number of nodes that have been infected. */
  totalInfected: number;
  /** Total number of spread events. */
  totalSpreadEvents: number;
  /** Whether the information is still active (not extinct). */
  active: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A record of information mutation. */
export interface InformationMutation {
  /** Mutation ID. */
  id: string;
  /** Original content before mutation. */
  originalContent: string;
  /** New content after mutation. */
  mutatedContent: string;
  /** Entity that propagated the mutated version. */
  mutatedBy: string;
  /** Tick when mutation occurred. */
  tick: number;
  /** Credibility impact (negative number). */
  credibilityImpact: number;
}

/** A node in the information spread network (an entity). */
export interface InformationNode {
  /** Entity ID. */
  entityId: string;
  /** Current infection state for each information item (infoId -> state). */
  states: Map<string, InformationState>;
  /** When the node was infected for each info (infoId -> tick). */
  infectedAt: Map<string, number>;
  /** When the node recovered for each info (infoId -> tick). */
  recoveredAt: Map<string, number>;
  /** Number of times this node has spread information. */
  spreadCount: number;
  /** Number of times this node has received information. */
  receiveCount: number;
  /** How skeptical this node is (higher = harder to infect, 0-100). */
  skepticism: number;
  /** How influential this node is as a spreader (0-100). */
  influence: number;
}

/** Result of a credibility assessment. */
export interface CredibilityAssessment {
  /** Information ID. */
  infoId: string;
  /** Overall credibility score (0-100). */
  overallCredibility: number;
  /** Source credibility component. */
  sourceScore: number;
  /** Type credibility component (some types are inherently less credible). */
  typeScore: number;
  /** Mutation penalty component. */
  mutationPenalty: number;
  /** Spread saturation component (over-spread reduces credibility). */
  spreadPenalty: number;
  /** Whether the information is likely true. */
  likelyTrue: boolean;
  /** Assessment explanation. */
  explanation: string;
}

/** Configuration for InformationSpreadModel. */
export interface InformationSpreadConfig {
  /** Base infection probability per contact (0-1). */
  baseInfectionRate: number;
  /** Base recovery probability per tick (0-1). */
  baseRecoveryRate: number;
  /** Mutation probability per spread event (0-1). */
  mutationRate: number;
  /** Whether to auto-spread information each tick. */
  autoSpread: boolean;
  /** Whether to auto-recover infected nodes each tick. */
  autoRecover: boolean;
  /** Whether to apply mutations during spread. */
  enableMutation: boolean;
  /** Maximum active information items. */
  maxActiveInformation: number;
  /** Maximum spread history per information. */
  maxSpreadHistory: number;
  /** Whether to emit events. */
  emitEvents: boolean;
  /** Threshold below which information is considered not credible. */
  credibilityThreshold: number;
}

/** Default configuration. */
export const DEFAULT_INFORMATION_SPREAD_CONFIG: InformationSpreadConfig = {
  baseInfectionRate: 0.3,
  baseRecoveryRate: 0.05,
  mutationRate: 0.1,
  autoSpread: true,
  autoRecover: true,
  enableMutation: true,
  maxActiveInformation: 100,
  maxSpreadHistory: 500,
  emitEvents: true,
  credibilityThreshold: 40,
};

/** Event types emitted by InformationSpreadModel. */
export type InformationSpreadEventType =
  | "info.created"
  | "info.spread"
  | "info.infected"
  | "info.recovered"
  | "info.mutated"
  | "info.extinct"
  | "info.credibility_assessed";

/** Event payload for information spread events. */
export interface InformationSpreadEvent {
  type: InformationSpreadEventType;
  infoId?: string;
  entityId?: string;
  fromEntityId?: string;
  description?: string;
  tick: number;
  metadata?: Record<string, unknown>;
}

/** Statistics for InformationSpreadModel. */
export interface InformationSpreadStats {
  totalInformation: number;
  activeInformation: number;
  extinctInformation: number;
  totalNodes: number;
  totalInfected: number;
  totalSpreadEvents: number;
  totalMutations: number;
  averageCredibility: number;
  mostInfectedInfo: string | null;
  dominantInformationType: InformationType | null;
}
