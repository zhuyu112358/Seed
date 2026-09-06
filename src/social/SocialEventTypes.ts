// M13 Social Event System types.
// Social events: weddings, funerals, festivals, celebrations, gatherings,
// conflicts, wars, migrations, and more. Event triggering, participation,
// and narrative generation. All event content is defined by application layer.

/** Types of social events. */
export type SocialEventType =
  | "wedding"           // 婚礼
  | "funeral"           // 葬礼
  | "festival"          // 节日
  | "celebration"       // 庆典
  | "gathering"         // 集会
  | "conflict"          // 冲突
  | "war"               // 战争
  | "migration"         // 迁徙
  | "birth"             // 出生
  | "coming_of_age"     // 成人礼
  | "graduation"        // 毕业
  | "coronation"        // 加冕
  | "treaty"            // 条约签署
  | "trade_fair"        // 集市/贸易展
  | "religious_ceremony" // 宗教仪式
  | "protest"           // 抗议
  | "riot"              // 暴乱
  | "diplomatic_meeting"; // 外交会晤

/** Status of a social event. */
export type SocialEventStatus = "scheduled" | "ongoing" | "completed" | "cancelled";

/** Role of a participant in an event. */
export type EventParticipantRole =
  | "organizer"        // 组织者
  | "host"             // 主人
  | "guest_of_honor"   // 贵宾
  | "attendee"         // 参与者
  | "performer"        // 表演者
  | "security"         // 安保
  | "speaker"          // 演讲者
  | "witness";         // 见证人

/** Participation status. */
export type ParticipationStatus = "invited" | "confirmed" | "attended" | "left" | "absent";

/** A participant in a social event. */
export interface EventParticipant {
  /** Entity ID of the participant. */
  entityId: string;
  /** Role in the event. */
  role: EventParticipantRole;
  /** Participation status. */
  status: ParticipationStatus;
  /** Tick when participant arrived (null if not yet arrived). */
  arrivalTick: number | null;
  /** Tick when participant left (null if still attending). */
  departureTick: number | null;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Social impact of an event on relations. */
export interface EventSocialImpact {
  /** Relation category to modify. */
  relationCategory: string;
  /** Strength delta to apply (positive or negative). */
  strengthDelta: Partial<Record<string, number>>;
  /** Which pairs of participants are affected. */
  affectedPairs: "all" | "organizers_attendees" | "specific";
  /** Specific entity pairs if affectedPairs is "specific". */
  specificPairs?: [string, string][];
}

/** A social event definition. */
export interface SocialEvent {
  /** Unique event ID. */
  id: string;
  /** Event type. */
  type: SocialEventType;
  /** Short name. */
  name: string;
  /** Detailed description. */
  description: string;
  /** Location identifier (application-defined). */
  location: string;
  /** Tick when event is scheduled to start. */
  scheduledStartTick: number;
  /** Duration in ticks. */
  durationTicks: number;
  /** Current status. */
  status: SocialEventStatus;
  /** Tick when event actually started (null if not started). */
  actualStartTick: number | null;
  /** Tick when event ended (null if not ended). */
  endTick: number | null;
  /** Participants in the event. */
  participants: EventParticipant[];
  /** Maximum number of attendees. */
  maxAttendees: number;
  /** Social impact configuration. */
  socialImpact: EventSocialImpact[];
  /** Whether narrative has been generated for this event. */
  narrativeGenerated: boolean;
  /** Generated narrative text (if any). */
  narrativeText: string | null;
  /** Whether the event is public (anyone can attend) or invitation-only. */
  isPublic: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Configuration for SocialEventSystem. */
export interface SocialEventSystemConfig {
  /** Maximum number of active events. */
  maxActiveEvents: number;
  /** Maximum event history size. */
  maxEventHistory: number;
  /** Whether to auto-progress event lifecycle. */
  autoProgress: boolean;
  /** Whether to auto-generate narratives. */
  autoGenerateNarrative: boolean;
  /** Whether to apply social impact automatically. */
  autoApplySocialImpact: boolean;
  /** Whether to emit events. */
  emitEvents: boolean;
  /** Default event duration in ticks. */
  defaultDurationTicks: number;
}

/** Default configuration. */
export const DEFAULT_SOCIAL_EVENT_CONFIG: SocialEventSystemConfig = {
  maxActiveEvents: 50,
  maxEventHistory: 500,
  autoProgress: true,
  autoGenerateNarrative: true,
  autoApplySocialImpact: true,
  emitEvents: true,
  defaultDurationTicks: 100,
};

/** Event types emitted by SocialEventSystem. */
export type SocialEventSystemEventType =
  | "social_event.scheduled"
  | "social_event.started"
  | "social_event.completed"
  | "social_event.cancelled"
  | "social_event.participant_joined"
  | "social_event.participant_left"
  | "social_event.narrative_generated"
  | "social_event.impact_applied";

/** Event payload for social event system events. */
export interface SocialEventSystemEvent {
  type: SocialEventSystemEventType;
  eventId?: string;
  entityId?: string;
  description?: string;
  tick: number;
  metadata?: Record<string, unknown>;
}

/** Result of event creation. */
export interface EventCreationResult {
  success: boolean;
  event?: SocialEvent;
  events: SocialEventSystemEvent[];
  failureReason?: string;
}

/** Statistics for SocialEventSystem. */
export interface SocialEventStats {
  totalEvents: number;
  scheduledEvents: number;
  ongoingEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  eventsByType: Record<string, number>;
  totalParticipants: number;
  narrativesGenerated: number;
  averageAttendance: number;
}
