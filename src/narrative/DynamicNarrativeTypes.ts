// Dynamic Narrative types for M12 Phase 6: World narrative enhancement.
//
// Seed provides the narrative framework (arcs, events, branches, state tracking).
// Ember and the application layer define specific narrative content and branching logic.
//
// Note: This is separate from the M6 NarrativeSystem (narrative chain infrastructure).
// This module adds dynamic narrative generation with arcs, event chains, and branching.

/** Status of a narrative arc. */
export type DynamicNarrativeArcStatus = "locked" | "available" | "active" | "completed" | "failed";

/** A phase within a narrative arc. */
export interface NarrativePhase {
  /** Unique phase ID. */
  id: string;
  /** Phase name. */
  name: string;
  /** Phase description. */
  description: string;
  /** Conditions required to enter this phase (evaluated by application layer). */
  entryConditions?: Record<string, unknown>;
  /** Events that trigger during this phase. */
  events?: string[];
  /** Whether this phase is the final phase. */
  isFinal?: boolean;
}

/** A narrative arc (storyline) with multiple phases. */
export interface DynamicNarrativeArc {
  /** Unique arc ID. */
  id: string;
  /** Arc name. */
  name: string;
  /** Arc description. */
  description: string;
  /** Current status. */
  status: DynamicNarrativeArcStatus;
  /** Ordered list of phases. */
  phases: NarrativePhase[];
  /** Current phase index. */
  currentPhaseIndex: number;
  /** Priority (higher = more important). */
  priority: number;
  /** Participants (entity IDs). */
  participants: string[];
  /** When the arc started (tick count). */
  startedAt?: number;
  /** When the arc ended (tick count). */
  endedAt?: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Type of narrative event. */
export type DynamicNarrativeEventType =
  | "plot"        // Main plot advancement
  | "character"   // Character development
  | "world"       // World state change
  | "player"      // Player action consequence
  | "random"      // Random/emergent event
  | "climax"      // Climactic moment
  | "resolution"; // Resolution/conclusion

/** A single narrative event in the event chain. */
export interface DynamicNarrativeEvent {
  /** Unique event ID. */
  id: string;
  /** Event type. */
  type: DynamicNarrativeEventType;
  /** Event title. */
  title: string;
  /** Event description. */
  description: string;
  /** When the event occurred (tick count). */
  timestamp: number;
  /** Participants (entity IDs). */
  participants: string[];
  /** Location (optional). */
  location?: { x: number; z: number };
  /** ID of the arc this event belongs to (optional). */
  arcId?: string;
  /** ID of the previous event in the chain (optional). */
  previousEventId?: string;
  /** Consequences of this event (state changes). */
  consequences?: Record<string, unknown>;
  /** Whether this event was triggered by a player action. */
  playerTriggered?: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A narrative branch (choice point). */
export interface DynamicNarrativeBranch {
  /** Unique branch ID. */
  id: string;
  /** Branch point description (the choice presented). */
  description: string;
  /** Available choices. */
  choices: DynamicNarrativeChoice[];
  /** The selected choice (null if not yet selected). */
  selectedChoiceId: string | null;
  /** Whether this branch has been resolved. */
  resolved: boolean;
  /** When the branch was created (tick count). */
  createdAt: number;
  /** When the branch was resolved (tick count). */
  resolvedAt?: number;
  /** ID of the arc this branch belongs to (optional). */
  arcId?: string;
}

/** A single choice within a narrative branch. */
export interface DynamicNarrativeChoice {
  /** Unique choice ID. */
  id: string;
  /** Choice text (what the player/NPC sees). */
  text: string;
  /** Weight for random selection (higher = more likely). Default 1. */
  weight: number;
  /** Consequences of choosing this option. */
  consequences: Record<string, unknown>;
  /** Events triggered by this choice. */
  triggeredEvents?: string[];
  /** Whether this choice is currently available. */
  available?: boolean;
  /** Requirements to unlock this choice. */
  requirements?: Record<string, unknown>;
}

/** Configuration for the dynamic narrative system. */
export interface DynamicNarrativeConfig {
  /** Maximum events to keep in history. Default 500. */
  maxEventHistory: number;
  /** Whether to auto-advance arcs when phase conditions are met. Default true. */
  autoAdvanceArcs: boolean;
  /** Whether to emit events on narrative changes. Default true. */
  emitEvents: boolean;
  /** Whether player actions can influence narrative. Default true. */
  playerInfluenceEnabled: boolean;
  /** Random seed for deterministic branch selection. */
  randomSeed?: number;
}

/** Default narrative configuration. */
export const DEFAULT_DYNAMIC_NARRATIVE_CONFIG: DynamicNarrativeConfig = {
  maxEventHistory: 500,
  autoAdvanceArcs: true,
  emitEvents: true,
  playerInfluenceEnabled: true,
};

/** Result of an arc advancement check. */
export interface DynamicArcAdvancementResult {
  /** Whether the arc advanced. */
  advanced: boolean;
  /** The previous phase ID. */
  previousPhaseId: string | null;
  /** The new phase ID. */
  newPhaseId: string | null;
  /** Reason for advancement or lack thereof. */
  reason: string;
}
