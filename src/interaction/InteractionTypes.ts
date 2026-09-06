// Interaction session types for M11 phase 3: deepened interaction system.
//
// Seed provides the interaction session framework (duration, progress, events).
// Ember decides when to start/end interactions. Application layer configures
// interaction definitions (durations, ranges, requirements).

/** Type of interaction session. */
export type InteractionType =
  | "dialogue"
  | "trade"
  | "party_invite"
  | "inspect"
  | "use_object"
  | "harvest"
  | "craft"
  | "build"
  | "greet"
  | "follow"
  | "custom";

/** State of an interaction session. */
export type InteractionState =
  | "pending"      // Session created, waiting for start conditions.
  | "active"       // Session is in progress.
  | "completed"    // Session completed successfully.
  | "interrupted"  // Session was interrupted.
  | "cancelled";   // Session was cancelled before completion.

/** Definition of an interaction type (configurable). */
export interface InteractionDefinition {
  /** Unique interaction type identifier. */
  type: InteractionType | string;
  /** Human-readable name. */
  name: string;
  /** Duration in ticks (0 = instant). Default 0. */
  duration: number;
  /** Maximum interaction range (0 = no range check). Default 0. */
  range: number;
  /** Minimum number of participants. Default 1. */
  minParticipants: number;
  /** Maximum number of participants (0 = unlimited). Default 0. */
  maxParticipants: number;
  /** Whether the interaction can be interrupted. Default true. */
  interruptible: boolean;
  /** Whether both participants must be within range. Default false. */
  requireMutualRange: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Default interaction definition values. */
export const DEFAULT_INTERACTION_DEFINITION: Omit<InteractionDefinition, "type" | "name"> = {
  duration: 0,
  range: 0,
  minParticipants: 1,
  maxParticipants: 0,
  interruptible: true,
  requireMutualRange: false,
};

/** A participant in an interaction session. */
export interface InteractionParticipant {
  entityId: string;
  role: "initiator" | "target" | "observer" | "participant";
  joinedAt: number;
}

/** An active interaction session. */
export interface InteractionSession {
  /** Unique session ID. */
  id: string;
  /** Interaction type. */
  type: InteractionType | string;
  /** Interaction definition. */
  definition: InteractionDefinition;
  /** Current state. */
  state: InteractionState;
  /** Participants in the session. */
  participants: InteractionParticipant[];
  /** Elapsed ticks in current state. */
  elapsedTicks: number;
  /** Progress (0-1) for active sessions. */
  progress: number;
  /** Tick when session was created. */
  createdAt: number;
  /** Tick when session became active. */
  startedAt: number | null;
  /** Tick when session ended (completed/interrupted/cancelled). */
  endedAt: number | null;
  /** Optional context data. */
  context?: Record<string, unknown>;
}

/** Result of starting an interaction. */
export interface InteractionStartResult {
  success: boolean;
  reason?: string;
  session?: InteractionSession;
}

/** Event payload for interaction state changes. */
export interface InteractionEventPayload {
  sessionId: string;
  type: InteractionType | string;
  interactionName: string;
  state: InteractionState;
  progress: number;
  initiatorId: string;
  targetId?: string;
  participantIds: string[];
  [key: string]: unknown;
}
