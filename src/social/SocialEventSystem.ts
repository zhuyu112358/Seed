// M13 Social Event System.
// Manages social events: weddings, funerals, festivals, celebrations, gatherings,
// conflicts, wars, migrations, and more. Supports event lifecycle, participation,
// narrative generation, and social impact application.
// All event content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type {
  SocialEvent,
  SocialEventType,
  SocialEventStatus,
  EventParticipant,
  EventParticipantRole,
  ParticipationStatus,
  EventSocialImpact,
  SocialEventSystemConfig,
  EventCreationResult,
  SocialEventSystemEvent,
  SocialEventSystemEventType,
  SocialEventStats,
} from "./SocialEventTypes.js";
import { DEFAULT_SOCIAL_EVENT_CONFIG } from "./SocialEventTypes.js";

/** WorldSystem: social event management. */
export class SocialEventSystem {
  readonly name = "social-event-system";
  enabled = true;

  private config: SocialEventSystemConfig;
  private events: Map<string, SocialEvent> = new Map();
  private eventHistory: SocialEvent[] = [];
  private systemEvents: SocialEventSystemEvent[] = [];
  private eventCounter = 0;
  private currentTick = 0;

  constructor(config?: Partial<SocialEventSystemConfig>) {
    this.config = { ...DEFAULT_SOCIAL_EVENT_CONFIG, ...config };
  }

  // --- Event Management ---

  /** Create a new social event. */
  createEvent(
    type: SocialEventType,
    name: string,
    description: string,
    options?: {
      location?: string;
      scheduledStartTick?: number;
      durationTicks?: number;
      maxAttendees?: number;
      organizers?: string[];
      socialImpact?: EventSocialImpact[];
      isPublic?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): EventCreationResult {
    const activeCount = this.getActiveEvents().length;
    if (activeCount >= this.config.maxActiveEvents) {
      return { success: false, events: [], failureReason: "Max active events exceeded" };
    }

    this.eventCounter++;
    const event: SocialEvent = {
      id: `event_${this.eventCounter}`,
      type,
      name,
      description,
      location: options?.location ?? "unknown",
      scheduledStartTick: options?.scheduledStartTick ?? this.currentTick,
      durationTicks: options?.durationTicks ?? this.config.defaultDurationTicks,
      status: "scheduled",
      actualStartTick: null,
      endTick: null,
      participants: [],
      maxAttendees: options?.maxAttendees ?? 100,
      socialImpact: options?.socialImpact ?? [],
      narrativeGenerated: false,
      narrativeText: null,
      isPublic: options?.isPublic ?? true,
      metadata: options?.metadata,
    };

    // Add organizers as participants.
    if (options?.organizers) {
      for (const organizerId of options.organizers) {
        event.participants.push({
          entityId: organizerId,
          role: "organizer",
          status: "confirmed",
          arrivalTick: null,
          departureTick: null,
        });
      }
    }

    this.events.set(event.id, event);

    const systemEvent = this.makeSystemEvent("social_event.scheduled", event.id, undefined,
      `Event scheduled: ${name} (${type}) at ${event.location}`);
    return { success: true, event, events: [systemEvent] };
  }

  /** Get an event by ID. */
  getEvent(eventId: string): SocialEvent | undefined {
    return this.events.get(eventId);
  }

  /** Get all events (active + history). */
  getAllEvents(): SocialEvent[] {
    return [...this.events.values(), ...this.eventHistory];
  }

  /** Get active events (scheduled + ongoing). */
  getActiveEvents(): SocialEvent[] {
    return [...this.events.values()].filter(
      (e) => e.status === "scheduled" || e.status === "ongoing",
    );
  }

  /** Get ongoing events. */
  getOngoingEvents(): SocialEvent[] {
    return [...this.events.values()].filter((e) => e.status === "ongoing");
  }

  /** Get events by type. */
  getEventsByType(type: SocialEventType): SocialEvent[] {
    return this.getAllEvents().filter((e) => e.type === type);
  }

  /** Get events at a location. */
  getEventsAtLocation(location: string): SocialEvent[] {
    return this.getActiveEvents().filter((e) => e.location === location);
  }

  /** Cancel an event. */
  cancelEvent(eventId: string, reason?: string): boolean {
    const event = this.events.get(eventId);
    if (!event || event.status === "completed" || event.status === "cancelled") {
      return false;
    }

    event.status = "cancelled";
    event.endTick = this.currentTick;
    this.moveToHistory(event);

    this.makeSystemEvent("social_event.cancelled", eventId, undefined,
      `Event cancelled: ${event.name}${reason ? ` - ${reason}` : ""}`);
    return true;
  }

  /** Complete an event manually. */
  completeEvent(eventId: string): boolean {
    const event = this.events.get(eventId);
    if (!event || event.status !== "ongoing") {
      return false;
    }

    event.status = "completed";
    event.endTick = this.currentTick;

    // Mark all participants as attended.
    for (const participant of event.participants) {
      if (participant.status === "confirmed" || participant.status === "attended") {
        participant.status = "attended";
        if (!participant.departureTick) {
          participant.departureTick = this.currentTick;
        }
      }
    }

    // Generate narrative if auto-enabled.
    if (this.config.autoGenerateNarrative && !event.narrativeGenerated) {
      this.generateNarrative(eventId);
    }

    // Apply social impact if auto-enabled.
    if (this.config.autoApplySocialImpact) {
      this.applySocialImpact(eventId);
    }

    this.moveToHistory(event);

    this.makeSystemEvent("social_event.completed", eventId, undefined,
      `Event completed: ${event.name} (${event.participants.filter(p => p.status === "attended").length} attendees)`);
    return true;
  }

  // --- Participation ---

  /** Add a participant to an event. */
  addParticipant(
    eventId: string,
    entityId: string,
    role: EventParticipantRole = "attendee",
  ): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;
    if (event.status === "completed" || event.status === "cancelled") return false;

    // Check if already participating.
    if (event.participants.some((p) => p.entityId === entityId)) {
      return false;
    }

    // Check max attendees (only for non-organizer/host roles).
    const attendeeCount = event.participants.filter(
      (p) => p.role === "attendee" || p.role === "guest_of_honor",
    ).length;
    if ((role === "attendee" || role === "guest_of_honor") && attendeeCount >= event.maxAttendees) {
      return false;
    }

    const participant: EventParticipant = {
      entityId,
      role,
      status: event.status === "ongoing" ? "attended" : "confirmed",
      arrivalTick: event.status === "ongoing" ? this.currentTick : null,
      departureTick: null,
    };

    event.participants.push(participant);

    this.makeSystemEvent("social_event.participant_joined", eventId, entityId,
      `${entityId} joined event ${event.name} as ${role}`);
    return true;
  }

  /** Remove a participant from an event. */
  removeParticipant(eventId: string, entityId: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const index = event.participants.findIndex((p) => p.entityId === entityId);
    if (index === -1) return false;

    const participant = event.participants[index];
    if (event.status === "ongoing") {
      participant.status = "left";
      participant.departureTick = this.currentTick;
    } else {
      event.participants.splice(index, 1);
    }

    this.makeSystemEvent("social_event.participant_left", eventId, entityId,
      `${entityId} left event ${event.name}`);
    return true;
  }

  /** Get participants of an event. */
  getParticipants(eventId: string): EventParticipant[] {
    return this.events.get(eventId)?.participants ?? [];
  }

  /** Get attendees (confirmed or attended). */
  getAttendees(eventId: string): EventParticipant[] {
    return this.getParticipants(eventId).filter(
      (p) => p.status === "confirmed" || p.status === "attended",
    );
  }

  /** Get events an entity is participating in. */
  getEventsForEntity(entityId: string): SocialEvent[] {
    return this.getActiveEvents().filter((e) =>
      e.participants.some((p) => p.entityId === entityId),
    );
  }

  /** Check if an entity is participating in an event. */
  isParticipating(eventId: string, entityId: string): boolean {
    return this.getParticipants(eventId).some((p) => p.entityId === entityId);
  }

  // --- Narrative Generation ---

  /** Generate narrative text for an event. */
  generateNarrative(eventId: string): string | null {
    const event = this.events.get(eventId) ?? this.eventHistory.find((e) => e.id === eventId);
    if (!event) return null;

    const attendeeCount = event.participants.filter(
      (p) => p.status === "attended" || p.status === "confirmed",
    ).length;
    const organizers = event.participants.filter((p) => p.role === "organizer").map((p) => p.entityId);

    const narrative = this.buildNarrative(event, attendeeCount, organizers);
    event.narrativeText = narrative;
    event.narrativeGenerated = true;

    this.makeSystemEvent("social_event.narrative_generated", eventId, undefined,
      `Narrative generated for event: ${event.name}`);
    return narrative;
  }

  /** Build narrative text based on event type and details. */
  private buildNarrative(
    event: SocialEvent,
    attendeeCount: number,
    organizers: string[],
  ): string {
    const organizerText = organizers.length > 0
      ? `organized by ${organizers.join(", ")}`
      : "a community gathering";

    const templates: Record<SocialEventType, string> = {
      wedding: `A joyous wedding ceremony took place at ${event.location}. ${organizerText}. ${attendeeCount} guests gathered to celebrate the union. The atmosphere was filled with love and celebration.`,
      funeral: `A solemn funeral was held at ${event.location} in memory of the departed. ${organizerText}. ${attendeeCount} mourners paid their respects. The ceremony was marked by grief and remembrance.`,
      festival: `The ${event.name} festival commenced at ${event.location}. ${organizerText}. ${attendeeCount} revelers enjoyed the festivities. The air was alive with music, food, and merriment.`,
      celebration: `A grand celebration was held at ${event.location}. ${organizerText}. ${attendeeCount} people joined in the festivities. Joy and laughter filled the occasion.`,
      gathering: `A gathering took place at ${event.location}. ${organizerText}. ${attendeeCount} individuals came together for ${event.description}.`,
      conflict: `A conflict erupted at ${event.location}. ${organizerText}. ${attendeeCount} individuals were involved in the confrontation. Tensions ran high.`,
      war: `War was declared at ${event.location}. ${organizerText}. ${attendeeCount} combatants were mobilized. The fate of the region hangs in the balance.`,
      migration: `A migration began from ${event.location}. ${organizerText}. ${attendeeCount} travelers set out on the journey. They carry their hopes and belongings to new lands.`,
      birth: `A new life was born at ${event.location}. ${organizerText}. The community welcomes the newest member with joy.`,
      coming_of_age: `A coming-of-age ceremony was held at ${event.location}. ${organizerText}. ${attendeeCount} young people took their place in adult society.`,
      graduation: `A graduation ceremony took place at ${event.location}. ${organizerText}. ${attendeeCount} graduates celebrated their achievements.`,
      coronation: `A coronation was held at ${event.location}. ${organizerText}. ${attendeeCount} witnesses watched the ascension. A new era begins.`,
      treaty: `A treaty was signed at ${event.location}. ${organizerText}. ${attendeeCount} delegates witnessed the historic agreement. Peace and cooperation are pledged.`,
      trade_fair: `A trade fair opened at ${event.location}. ${organizerText}. ${attendeeCount} merchants and buyers gathered for commerce. Goods and ideas are exchanged.`,
      religious_ceremony: `A religious ceremony was conducted at ${event.location}. ${organizerText}. ${attendeeCount} faithful participated in the sacred rites.`,
      protest: `A protest was staged at ${event.location}. ${organizerText}. ${attendeeCount} demonstrators voiced their demands. The air was charged with passion.`,
      riot: `A riot broke out at ${event.location}. ${organizerText}. ${attendeeCount} individuals were involved in the unrest. Chaos and disorder reigned.`,
      diplomatic_meeting: `A diplomatic meeting was convened at ${event.location}. ${organizerText}. ${attendeeCount} envoys engaged in negotiations. The future of relations is discussed.`,
    };

    return templates[event.type] ?? `An event (${event.type}) took place at ${event.location}. ${organizerText}. ${attendeeCount} people attended.`;
  }

  // --- Social Impact ---

  /** Apply social impact of an event (modifies relations between participants). */
  applySocialImpact(eventId: string): boolean {
    const event = this.events.get(eventId) ?? this.eventHistory.find((e) => e.id === eventId);
    if (!event || event.socialImpact.length === 0) return false;

    // In a full implementation, this would modify SocialRelationGraph.
    // Here we record that impact was applied and provide the data.
    this.makeSystemEvent("social_event.impact_applied", eventId, undefined,
      `Social impact applied for event: ${event.name} (${event.socialImpact.length} impact rules)`);
    return true;
  }

  /** Get social impact configuration for an event. */
  getSocialImpact(eventId: string): EventSocialImpact[] {
    return this.events.get(eventId)?.socialImpact ?? [];
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;

    this.currentTick++;

    if (this.config.autoProgress) {
      this.progressEvents();
    }
  }

  /** Progress event lifecycle: scheduled → ongoing → completed. */
  private progressEvents(): void {
    for (const event of [...this.events.values()]) {
      if (event.status === "scheduled" && this.currentTick >= event.scheduledStartTick) {
        // Start the event.
        event.status = "ongoing";
        event.actualStartTick = this.currentTick;

        // Mark confirmed participants as attended.
        for (const participant of event.participants) {
          if (participant.status === "confirmed") {
            participant.status = "attended";
            participant.arrivalTick = this.currentTick;
          }
        }

        this.makeSystemEvent("social_event.started", event.id, undefined,
          `Event started: ${event.name} (${event.participants.length} participants)`);
      }

      if (event.status === "ongoing" && event.actualStartTick !== null) {
        const elapsed = this.currentTick - event.actualStartTick;
        if (elapsed >= event.durationTicks) {
          this.completeEvent(event.id);
        }
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
      events: [...this.events.values()],
      eventHistory: this.eventHistory.slice(-100),
      systemEvents: this.systemEvents.slice(-100),
      eventCounter: this.eventCounter,
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_SOCIAL_EVENT_CONFIG, ...(data.config as object) };
    this.events.clear();
    this.eventHistory = [];
    this.systemEvents = [];

    const events = data.events as SocialEvent[];
    for (const event of events) {
      this.events.set(event.id, event);
    }

    this.eventHistory = (data.eventHistory as SocialEvent[]) ?? [];
    this.systemEvents = (data.systemEvents as SocialEventSystemEvent[]) ?? [];
    this.eventCounter = (data.eventCounter as number) ?? this.events.size;
    this.currentTick = (data.currentTick as number) ?? 0;
  }

  // --- Statistics ---

  getStats(): SocialEventStats {
    const allEvents = this.getAllEvents();
    const eventsByType: Record<string, number> = {};
    let totalParticipants = 0;
    let narrativesGenerated = 0;
    let totalAttendance = 0;
    let completedCount = 0;

    for (const event of allEvents) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
      totalParticipants += event.participants.length;
      if (event.narrativeGenerated) narrativesGenerated++;
      if (event.status === "completed") {
        completedCount++;
        totalAttendance += event.participants.filter((p) => p.status === "attended").length;
      }
    }

    return {
      totalEvents: allEvents.length,
      scheduledEvents: allEvents.filter((e) => e.status === "scheduled").length,
      ongoingEvents: allEvents.filter((e) => e.status === "ongoing").length,
      completedEvents: allEvents.filter((e) => e.status === "completed").length,
      cancelledEvents: allEvents.filter((e) => e.status === "cancelled").length,
      eventsByType,
      totalParticipants,
      narrativesGenerated,
      averageAttendance: completedCount > 0 ? totalAttendance / completedCount : 0,
    };
  }

  // --- Internal Helpers ---

  private moveToHistory(event: SocialEvent): void {
    this.events.delete(event.id);
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory.shift();
    }
  }

  private makeSystemEvent(
    type: SocialEventSystemEventType,
    eventId?: string,
    entityId?: string,
    description?: string,
  ): SocialEventSystemEvent {
    const systemEvent: SocialEventSystemEvent = {
      type,
      eventId,
      entityId,
      description,
      tick: this.currentTick,
    };
    this.systemEvents.push(systemEvent);
    if (this.systemEvents.length > 500) {
      this.systemEvents.shift();
    }
    return systemEvent;
  }
}
