// NPC Memory types for M12 Phase 1: NPC AI deepening.
//
// Seed provides the memory framework (storage, retrieval, decay).
// Ember decides what to remember and how memories affect decisions.
// Application layer configures memory parameters (retention, decay rates).

/** Type of memory entry. Determines default retention and decay behavior. */
export type MemoryType =
  | "interaction"   // Interaction with another entity (dialogue, trade, combat)
  | "observation"   // Observed event (saw something, heard something)
  | "action"        // Action performed by the NPC (attacked, harvested, built)
  | "emotion"       // Emotional experience (felt fear, joy, anger)
  | "location"      // Location discovery (found a place, explored an area)
  | "knowledge"     // Learned information (facts, rules, recipes)
  | "custom";       // Custom memory type

/** Importance level of a memory. Affects decay rate and retention. */
export type MemoryImportance = "trivial" | "low" | "medium" | "high" | "critical";

/** A single memory entry in an NPC's memory. */
export interface MemoryEntry {
  /** Unique memory ID. */
  id: string;
  /** Memory type. */
  type: MemoryType;
  /** Human-readable memory text/description. */
  text: string;
  /** Importance level. */
  importance: MemoryImportance;
  /** Tick when the memory was created. */
  createdAt: number;
  /** Tick when the memory was last accessed/retrieved. */
  lastAccessedAt: number;
  /** Number of times this memory has been retrieved. */
  accessCount: number;
  /** Current decay value (0-1, 1 = fresh, 0 = forgotten). */
  decay: number;
  /** Related entity IDs (e.g., who was involved in the interaction). */
  relatedEntities: string[];
  /** Location where the memory occurred (optional). */
  location?: { x: number; z: number };
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Configuration for NPC memory system. */
export interface NPCMemoryConfig {
  /** Maximum number of short-term memories. Default 50. */
  maxShortTermMemories: number;
  /** Maximum number of long-term memories. Default 200. */
  maxLongTermMemories: number;
  /** Short-term memory retention in ticks. Default 600 (10 seconds at 60fps). */
  shortTermRetentionTicks: number;
  /** Decay rate per tick for short-term memories. Default 0.001. */
  shortTermDecayRate: number;
  /** Decay rate per tick for long-term memories. Default 0.0001. */
  longTermDecayRate: number;
  /** Importance threshold for promoting to long-term memory. Default "high". */
  longTermThreshold: MemoryImportance;
  /** Whether accessing a memory refreshes its decay. Default true. */
  accessRefreshesDecay: boolean;
  /** Whether to automatically forget memories below decay threshold. Default true. */
  autoForget: boolean;
  /** Decay threshold below which memories are forgotten. Default 0.1. */
  forgetThreshold: number;
}

/** Default NPC memory configuration. */
export const DEFAULT_NPC_MEMORY_CONFIG: NPCMemoryConfig = {
  maxShortTermMemories: 50,
  maxLongTermMemories: 200,
  shortTermRetentionTicks: 600,
  shortTermDecayRate: 0.001,
  longTermDecayRate: 0.0001,
  longTermThreshold: "high",
  accessRefreshesDecay: true,
  autoForget: true,
  forgetThreshold: 0.1,
};

/** Importance weight mapping (higher = slower decay). */
export const IMPORTANCE_WEIGHT: Record<MemoryImportance, number> = {
  trivial: 0.5,
  low: 0.75,
  medium: 1.0,
  high: 1.5,
  critical: 2.0,
};

/** Result of a memory query. */
export interface MemoryQueryResult {
  memories: MemoryEntry[];
  totalCount: number;
  shortTermCount: number;
  longTermCount: number;
}
