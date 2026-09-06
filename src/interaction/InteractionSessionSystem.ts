// InteractionSessionSystem: manages ongoing interaction sessions between entities.
//
// This system complements the existing InteractionSystem (object state machines)
// and M7 social/trading/party systems by providing a unified session management
// layer for NPC-NPC and NPC-environment interactions with duration, progress,
// and lifecycle events.
//
// Seed provides the session framework. Ember decides when to interact.
// Application layer configures interaction definitions.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import type { GameObject } from "../entity/Entity.js";
import {
  InteractionDefinition,
  InteractionSession,
  InteractionStartResult,
  InteractionEventPayload,
  InteractionParticipant,
  InteractionState,
  DEFAULT_INTERACTION_DEFINITION,
} from "./InteractionTypes.js";

export class InteractionSessionSystem implements WorldSystem {
  readonly name = "interaction-session";
  enabled = true;

  private readonly definitions = new Map<string, InteractionDefinition>();
  private readonly sessions = new Map<string, InteractionSession>();
  private readonly entitySessions = new Map<string, Set<string>>(); // entityId → sessionIds
  private events: EventSystem | null = null;
  private currentTick = 0;
  private sessionCounter = 0;

  // --- Definition management ---

  /** Register an interaction definition. */
  registerDefinition(definition: Partial<InteractionDefinition> & { type: string; name: string }): void {
    const full: InteractionDefinition = { ...DEFAULT_INTERACTION_DEFINITION, ...definition };
    this.definitions.set(full.type, full);
  }

  /** Get an interaction definition by type. */
  getDefinition(type: string): InteractionDefinition | undefined {
    return this.definitions.get(type);
  }

  /** Get all registered definitions. */
  getDefinitions(): InteractionDefinition[] {
    return Array.from(this.definitions.values());
  }

  // --- Session management ---

  /**
   * Start an interaction session.
   * @param type Interaction type.
   * @param initiatorId Entity ID of the initiator.
   * @param targetId Optional target entity ID.
   * @param context Optional context data.
   */
  startInteraction(
    type: string,
    initiatorId: string,
    targetId?: string,
    context?: Record<string, unknown>,
  ): InteractionStartResult {
    const definition = this.definitions.get(type);
    if (!definition) {
      return { success: false, reason: `Interaction type '${type}' not registered` };
    }

    // Check if initiator is already in an active session.
    const initiatorSessions = this.entitySessions.get(initiatorId);
    if (initiatorSessions) {
      for (const sessionId of initiatorSessions) {
        const session = this.sessions.get(sessionId);
        if (session && (session.state === "active" || session.state === "pending")) {
          return { success: false, reason: `Initiator '${initiatorId}' is already in an active interaction` };
        }
      }
    }

    // Check participant count.
    const participantCount = 1 + (targetId ? 1 : 0);
    if (participantCount < definition.minParticipants) {
      return { success: false, reason: `Requires at least ${definition.minParticipants} participants` };
    }
    if (definition.maxParticipants > 0 && participantCount > definition.maxParticipants) {
      return { success: false, reason: `Maximum ${definition.maxParticipants} participants allowed` };
    }

    // Create session.
    this.sessionCounter++;
    const sessionId = `interaction_${this.sessionCounter}`;
    const participants: InteractionParticipant[] = [
      { entityId: initiatorId, role: "initiator", joinedAt: this.currentTick },
    ];
    if (targetId) {
      participants.push({ entityId: targetId, role: "target", joinedAt: this.currentTick });
    }

    const session: InteractionSession = {
      id: sessionId,
      type,
      definition,
      state: definition.duration > 0 ? "active" : "completed",
      participants,
      elapsedTicks: 0,
      progress: definition.duration > 0 ? 0 : 1,
      createdAt: this.currentTick,
      startedAt: this.currentTick,
      endedAt: definition.duration > 0 ? null : this.currentTick,
      context,
    };

    this.sessions.set(sessionId, session);
    this.registerEntitySession(initiatorId, sessionId);
    if (targetId) this.registerEntitySession(targetId, sessionId);

    // Emit events.
    this.emitEvent(session, "interaction.started");
    if (session.state === "completed") {
      this.emitEvent(session, "interaction.completed");
    }

    return { success: true, session };
  }

  /** Get a session by ID. */
  getSession(sessionId: string): InteractionSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Get all active sessions. */
  getActiveSessions(): InteractionSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state === "active");
  }

  /** Get all sessions for an entity. */
  getEntitySessions(entityId: string): InteractionSession[] {
    const sessionIds = this.entitySessions.get(entityId);
    if (!sessionIds) return [];
    const result: InteractionSession[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) result.push(session);
    }
    return result;
  }

  /** Check if an entity is in an active interaction. */
  isInteracting(entityId: string): boolean {
    const sessions = this.getEntitySessions(entityId);
    return sessions.some(s => s.state === "active" || s.state === "pending");
  }

  /**
   * Interrupt an active session.
   * @returns True if session was interrupted.
   */
  interruptSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== "active") return false;
    if (!session.definition.interruptible) return false;

    session.state = "interrupted";
    session.endedAt = this.currentTick;
    this.emitEvent(session, "interaction.interrupted");
    return true;
  }

  /**
   * Cancel a session (before it becomes active or during active).
   * @returns True if session was cancelled.
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.state === "completed" || session.state === "interrupted" || session.state === "cancelled") {
      return false;
    }

    session.state = "cancelled";
    session.endedAt = this.currentTick;
    this.emitEvent(session, "interaction.cancelled");
    return true;
  }

  /** Add a participant to an active session. */
  addParticipant(sessionId: string, entityId: string, role: InteractionParticipant["role"] = "participant"): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== "active") return false;
    if (session.participants.some(p => p.entityId === entityId)) return false;

    const maxParticipants = session.definition.maxParticipants;
    if (maxParticipants > 0 && session.participants.length >= maxParticipants) return false;

    session.participants.push({ entityId, role, joinedAt: this.currentTick });
    this.registerEntitySession(entityId, sessionId);
    return true;
  }

  /** Remove a participant from a session. */
  removeParticipant(sessionId: string, entityId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const participant = session.participants.find(p => p.entityId === entityId);
    if (!participant) return false;
    const wasInitiator = participant.role === "initiator";

    const index = session.participants.findIndex(p => p.entityId === entityId);
    session.participants.splice(index, 1);
    this.unregisterEntitySession(entityId, sessionId);

    // If initiator leaves, cancel the session.
    if (wasInitiator) {
      this.cancelSession(sessionId);
    }
    return true;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.events = events;
    this.currentTick++;

    // Update active sessions.
    for (const session of this.sessions.values()) {
      if (session.state !== "active") continue;

      session.elapsedTicks++;
      if (session.definition.duration > 0) {
        session.progress = Math.min(1, session.elapsedTicks / session.definition.duration);
      }

      // Emit progress event at 25%, 50%, 75%.
      if (session.definition.duration > 0) {
        const milestones = [0.25, 0.5, 0.75];
        for (const milestone of milestones) {
          const milestoneTick = Math.floor(session.definition.duration * milestone);
          if (session.elapsedTicks === milestoneTick) {
            this.emitEvent(session, "interaction.progress");
          }
        }
      }

      // Check completion.
      if (session.definition.duration === 0 || session.elapsedTicks >= session.definition.duration) {
        session.state = "completed";
        session.progress = 1;
        session.endedAt = this.currentTick;
        this.emitEvent(session, "interaction.completed");
      }
    }

    // Clean up old sessions (keep last 100).
    if (this.sessions.size > 100) {
      const completedSessions = Array.from(this.sessions.values())
        .filter(s => s.state !== "active" && s.state !== "pending")
        .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
      const toRemove = completedSessions.slice(0, this.sessions.size - 100);
      for (const session of toRemove) {
        this.sessions.delete(session.id);
        for (const participant of session.participants) {
          this.unregisterEntitySession(participant.entityId, session.id);
        }
      }
    }
  }

  stop(): void {
    this.sessions.clear();
    this.entitySessions.clear();
    this.events = null;
  }

  // --- Internal helpers ---

  private registerEntitySession(entityId: string, sessionId: string): void {
    let set = this.entitySessions.get(entityId);
    if (!set) {
      set = new Set();
      this.entitySessions.set(entityId, set);
    }
    set.add(sessionId);
  }

  private unregisterEntitySession(entityId: string, sessionId: string): void {
    const set = this.entitySessions.get(entityId);
    if (set) {
      set.delete(sessionId);
      if (set.size === 0) this.entitySessions.delete(entityId);
    }
  }

  private emitEvent(session: InteractionSession, eventType: string): void {
    if (!this.events) return;
    const initiator = session.participants.find(p => p.role === "initiator");
    const target = session.participants.find(p => p.role === "target");
    const payload: InteractionEventPayload = {
      sessionId: session.id,
      type: session.type,
      interactionName: session.definition.name,
      state: session.state,
      progress: session.progress,
      initiatorId: initiator?.entityId ?? "",
      targetId: target?.entityId,
      participantIds: session.participants.map(p => p.entityId),
    };
    this.events.emit(new Event({
      type: eventType,
      payload,
      sourceId: initiator?.entityId ?? null,
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const definitions: Record<string, InteractionDefinition> = {};
    for (const [type, def] of this.definitions) definitions[type] = def;
    const sessions: Record<string, InteractionSession> = {};
    for (const [id, session] of this.sessions) sessions[id] = session;
    return { definitions, sessions, sessionCounter: this.sessionCounter, currentTick: this.currentTick };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.definitions && typeof data.definitions === "object") {
      for (const [type, def] of Object.entries(data.definitions as Record<string, InteractionDefinition>)) {
        this.definitions.set(type, def);
      }
    }
    if (data.sessions && typeof data.sessions === "object") {
      for (const [id, session] of Object.entries(data.sessions as Record<string, InteractionSession>)) {
        this.sessions.set(id, session);
        for (const participant of session.participants) {
          this.registerEntitySession(participant.entityId, id);
        }
      }
    }
    if (typeof data.sessionCounter === "number") this.sessionCounter = data.sessionCounter;
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
  }
}
