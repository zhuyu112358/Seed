// NPC Schedule types for M12 Phase 5: NPC daily routine.
//
// Seed provides the schedule framework (activities, transitions, location preferences).
// Ember defines specific activities and how they affect behavior.

/** A point in 2D space (x, z plane). */
export interface ScheduleLocation {
  x: number;
  z: number;
}

/** Status of a scheduled activity. */
export type ActivityStatus = "pending" | "active" | "completed" | "skipped";

/** A single activity in an NPC's daily schedule. */
export interface ScheduleActivity {
  /** Unique activity ID. */
  id: string;
  /** Human-readable activity name. */
  name: string;
  /** Start time in time-of-day units (0 to dayLength). */
  startTime: number;
  /** End time in time-of-day units. */
  endTime: number;
  /** Preferred location for this activity (optional). */
  location?: ScheduleLocation;
  /** Priority (higher = more important, used for conflict resolution). */
  priority: number;
  /** Type of action this activity maps to (e.g., "sleep", "work", "eat"). */
  actionType: string;
  /** Whether this activity is currently enabled. Default true. */
  enabled?: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Current activity state for an NPC. */
export interface CurrentActivity {
  /** The active activity, or null if none. */
  activity: ScheduleActivity | null;
  /** When the current activity started (time-of-day). */
  startedAt: number;
  /** Status of the current activity. */
  status: ActivityStatus;
  /** How many times this activity has been attempted today. */
  attemptCount: number;
}

/** Configuration for the schedule system. */
export interface ScheduleConfig {
  /** Whether to auto-transition activities based on time. Default true. */
  autoTransition: boolean;
  /** Whether to emit events on activity change. Default true. */
  emitEvents: boolean;
  /** Day length in time units (must match WorldClock). Default 1440 (minutes in a day). */
  dayLength: number;
  /** Time tolerance for activity start (activity starts within this window). Default 0. */
  startTolerance: number;
}

/** Default schedule configuration. */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  autoTransition: true,
  emitEvents: true,
  dayLength: 1440,
  startTolerance: 0,
};

/** Result of an activity transition check. */
export interface TransitionResult {
  /** Whether a transition occurred. */
  transitioned: boolean;
  /** The previous activity (null if none). */
  previous: ScheduleActivity | null;
  /** The new activity (null if none). */
  next: ScheduleActivity | null;
  /** Reason for the transition. */
  reason: string;
}

/** Preset daily schedule templates. */
export const SCHEDULE_TEMPLATES: Record<string, ScheduleActivity[]> = {
  // Simple day/night cycle.
  diurnal: [
    { id: "sleep", name: "Sleep", startTime: 0, endTime: 360, priority: 10, actionType: "sleep", location: { x: 0, z: 0 } },
    { id: "morning", name: "Morning Routine", startTime: 360, endTime: 480, priority: 5, actionType: "idle" },
    { id: "work", name: "Work", startTime: 480, endTime: 1020, priority: 8, actionType: "work" },
    { id: "evening", name: "Evening Leisure", startTime: 1020, endTime: 1320, priority: 4, actionType: "idle" },
    { id: "sleep_night", name: "Sleep", startTime: 1320, endTime: 1440, priority: 10, actionType: "sleep", location: { x: 0, z: 0 } },
  ],
  // Nocturnal (active at night).
  nocturnal: [
    { id: "sleep_day", name: "Sleep", startTime: 360, endTime: 1080, priority: 10, actionType: "sleep", location: { x: 0, z: 0 } },
    { id: "active_night", name: "Night Activity", startTime: 1080, endTime: 1440, priority: 8, actionType: "work" },
    { id: "active_late", name: "Late Night", startTime: 0, endTime: 360, priority: 6, actionType: "idle" },
  ],
  // Shift worker (split shifts).
  shift_worker: [
    { id: "sleep", name: "Sleep", startTime: 0, endTime: 300, priority: 10, actionType: "sleep", location: { x: 0, z: 0 } },
    { id: "morning_shift", name: "Morning Shift", startTime: 300, endTime: 720, priority: 8, actionType: "work" },
    { id: "break", name: "Break", startTime: 720, endTime: 840, priority: 5, actionType: "idle" },
    { id: "evening_shift", name: "Evening Shift", startTime: 840, endTime: 1260, priority: 8, actionType: "work" },
    { id: "wind_down", name: "Wind Down", startTime: 1260, endTime: 1440, priority: 4, actionType: "idle" },
  ],
};
