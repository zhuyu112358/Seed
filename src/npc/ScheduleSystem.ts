// ScheduleSystem: WorldSystem for NPC daily routines.
//
// Manages activity schedules, time-based transitions, location preferences,
// and activity events. Integrates with WorldClock for time-of-day tracking.
//
// M12 Phase 5: NPC Daily Schedule.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import {
  ScheduleActivity,
  CurrentActivity,
  ScheduleConfig,
  DEFAULT_SCHEDULE_CONFIG,
  TransitionResult,
  ScheduleLocation,
} from "./ScheduleTypes.js";

export class ScheduleSystem implements WorldSystem {
  readonly name = "npc-schedule";
  enabled = true;

  private config: ScheduleConfig;
  private readonly schedules = new Map<string, ScheduleActivity[]>(); // entityId → activities
  private readonly current = new Map<string, CurrentActivity>(); // entityId → current activity
  private readonly lastDay = new Map<string, number>(); // entityId → last processed day
  private currentTimeOfDay = 0;
  private currentDay = 0;
  private events: EventSystem | null = null;

  constructor(config?: Partial<ScheduleConfig>) {
    this.config = { ...DEFAULT_SCHEDULE_CONFIG, ...config };
  }

  // --- Schedule management ---

  /** Set the full schedule for an entity (replaces existing). */
  setSchedule(entityId: string, activities: ScheduleActivity[]): void {
    // Sort by start time.
    const sorted = [...activities].sort((a, b) => a.startTime - b.startTime);
    this.schedules.set(entityId, sorted);
    // Reset current activity.
    this.current.set(entityId, {
      activity: null,
      startedAt: 0,
      status: "pending",
      attemptCount: 0,
    });
  }

  /** Get the schedule for an entity. */
  getSchedule(entityId: string): ScheduleActivity[] {
    return this.schedules.get(entityId) ?? [];
  }

  /** Add an activity to an entity's schedule. */
  addActivity(entityId: string, activity: ScheduleActivity): void {
    const activities = this.schedules.get(entityId) ?? [];
    activities.push(activity);
    activities.sort((a, b) => a.startTime - b.startTime);
    this.schedules.set(entityId, activities);
  }

  /** Remove an activity from an entity's schedule. */
  removeActivity(entityId: string, activityId: string): boolean {
    const activities = this.schedules.get(entityId);
    if (!activities) return false;
    const index = activities.findIndex(a => a.id === activityId);
    if (index < 0) return false;
    activities.splice(index, 1);
    return true;
  }

  /** Update an activity's properties. */
  updateActivity(entityId: string, activityId: string, updates: Partial<ScheduleActivity>): boolean {
    const activities = this.schedules.get(entityId);
    if (!activities) return false;
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return false;
    Object.assign(activity, updates);
    activities.sort((a, b) => a.startTime - b.startTime);
    return true;
  }

  // --- Current activity ---

  /** Get the current activity for an entity. */
  getCurrentActivity(entityId: string): CurrentActivity | undefined {
    return this.current.get(entityId);
  }

  /** Get the activity that should be active at a given time. */
  getActivityAtTime(entityId: string, timeOfDay: number): ScheduleActivity | null {
    const activities = this.schedules.get(entityId);
    if (!activities) return null;

    // Find enabled activities where time falls within [start, end).
    // Handle wrap-around (activities that cross midnight).
    const matching = activities.filter(a => {
      if (a.enabled === false) return false;
      if (a.startTime <= a.endTime) {
        // Normal range.
        return timeOfDay >= a.startTime && timeOfDay < a.endTime;
      } else {
        // Wrap-around (e.g., 22:00 - 02:00).
        return timeOfDay >= a.startTime || timeOfDay < a.endTime;
      }
    });

    if (matching.length === 0) return null;
    // Return highest priority (or first if tied).
    matching.sort((a, b) => b.priority - a.priority);
    return matching[0];
  }

  /** Get the next scheduled activity after the current time. */
  getNextActivity(entityId: string, timeOfDay: number): ScheduleActivity | null {
    const activities = this.schedules.get(entityId);
    if (!activities || activities.length === 0) return null;

    const upcoming = activities
      .filter(a => a.enabled !== false && a.startTime > timeOfDay)
      .sort((a, b) => a.startTime - b.startTime);

    if (upcoming.length > 0) return upcoming[0];
    // Wrap to first activity of next day.
    return activities.filter(a => a.enabled !== false).sort((a, b) => a.startTime - b.startTime)[0] ?? null;
  }

  // --- Manual control ---

  /** Force-start an activity (overrides auto-transition). */
  startActivity(entityId: string, activityId: string): boolean {
    const activities = this.schedules.get(entityId);
    const activity = activities?.find(a => a.id === activityId);
    if (!activity) return false;

    const current = this.current.get(entityId) ?? {
      activity: null,
      startedAt: 0,
      status: "pending" as const,
      attemptCount: 0,
    };

    const previous = current.activity;
    current.activity = activity;
    current.startedAt = this.currentTimeOfDay;
    current.status = "active";
    current.attemptCount++;
    this.current.set(entityId, current);

    if (this.config.emitEvents) {
      this.emitActivityEvent(entityId, "schedule.activity_started", activity, previous);
    }
    return true;
  }

  /** Complete the current activity manually. */
  completeActivity(entityId: string): boolean {
    const current = this.current.get(entityId);
    if (!current || !current.activity || current.status !== "active") return false;

    const activity = current.activity;
    current.status = "completed";
    if (this.config.emitEvents) {
      this.emitActivityEvent(entityId, "schedule.activity_completed", activity, null);
    }
    // Clear current activity.
    current.activity = null;
    current.status = "pending";
    return true;
  }

  /** Skip the current activity. */
  skipActivity(entityId: string): boolean {
    const current = this.current.get(entityId);
    if (!current || !current.activity) return false;

    const activity = current.activity;
    current.status = "skipped";
    if (this.config.emitEvents) {
      this.emitActivityEvent(entityId, "schedule.activity_skipped", activity, null);
    }
    current.activity = null;
    current.status = "pending";
    return true;
  }

  // --- Location preferences ---

  /** Get the preferred location for the current activity. */
  getCurrentLocation(entityId: string): ScheduleLocation | undefined {
    return this.current.get(entityId)?.activity?.location;
  }

  /** Get the preferred location for a specific activity. */
  getActivityLocation(entityId: string, activityId: string): ScheduleLocation | undefined {
    return this.schedules.get(entityId)?.find(a => a.id === activityId)?.location;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, world: World, events: EventSystem): void {
    this.events = events;

    // Get time from WorldClock if available.
    const clock = world.systems.find(s => s.name === "world-clock") as unknown as { getTimeOfDay?: () => number };
    if (clock && typeof clock.getTimeOfDay === "function") {
      this.currentTimeOfDay = clock.getTimeOfDay();
    } else {
      // Fallback: increment time manually.
      this.currentTimeOfDay = (this.currentTimeOfDay + 1) % this.config.dayLength;
    }

    // Track day changes.
    if (this.currentTimeOfDay < 1) {
      this.currentDay++;
    }

    if (!this.config.autoTransition) return;

    // Check transitions for all entities.
    for (const entityId of this.schedules.keys()) {
      this.checkTransition(entityId);
    }
  }

  stop(): void {
    this.events = null;
  }

  // --- Internal helpers ---

  private checkTransition(entityId: string): TransitionResult {
    const expected = this.getActivityAtTime(entityId, this.currentTimeOfDay);
    const current = this.current.get(entityId);

    if (!current) {
      // Initialize current activity tracking.
      this.current.set(entityId, {
        activity: null,
        startedAt: 0,
        status: "pending",
        attemptCount: 0,
      });
    }

    const currentActivity = current?.activity ?? null;

    // No expected activity and no current activity → no change.
    if (!expected && !currentActivity) {
      return { transitioned: false, previous: null, next: null, reason: "no_activity" };
    }

    // Expected activity is the same as current → no change.
    if (expected && currentActivity && expected.id === currentActivity.id) {
      return { transitioned: false, previous: currentActivity, next: currentActivity, reason: "same_activity" };
    }

    // Transition needed.
    const previous = currentActivity;
    const next = expected;

    // Complete previous activity if active.
    if (previous && current?.status === "active") {
      current.status = "completed";
      if (this.config.emitEvents) {
        this.emitActivityEvent(entityId, "schedule.activity_completed", previous, null);
      }
    }

    // Start new activity.
    if (next) {
      const cur = this.current.get(entityId)!;
      cur.activity = next;
      cur.startedAt = this.currentTimeOfDay;
      cur.status = "active";
      cur.attemptCount++;
      if (this.config.emitEvents) {
        this.emitActivityEvent(entityId, "schedule.activity_started", next, previous);
      }
    } else {
      const cur = this.current.get(entityId)!;
      cur.activity = null;
      cur.status = "pending";
    }

    return { transitioned: true, previous, next, reason: next ? "time_based" : "activity_ended" };
  }

  private emitActivityEvent(
    entityId: string,
    eventType: string,
    activity: ScheduleActivity,
    previous: ScheduleActivity | null,
  ): void {
    if (!this.events) return;
    this.events.emit(new Event({
      type: eventType,
      payload: {
        entityId,
        activityId: activity.id,
        activityName: activity.name,
        actionType: activity.actionType,
        priority: activity.priority,
        location: activity.location,
        startTime: activity.startTime,
        endTime: activity.endTime,
        previousActivityId: previous?.id ?? null,
        timeOfDay: this.currentTimeOfDay,
      },
      sourceId: entityId,
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const schedules: Record<string, ScheduleActivity[]> = {};
    for (const [id, s] of this.schedules) schedules[id] = s;
    const current: Record<string, CurrentActivity> = {};
    for (const [id, c] of this.current) current[id] = c;
    return { schedules, current, currentTimeOfDay: this.currentTimeOfDay, currentDay: this.currentDay };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.schedules && typeof data.schedules === "object") {
      for (const [id, s] of Object.entries(data.schedules as Record<string, ScheduleActivity[]>)) {
        this.schedules.set(id, s);
      }
    }
    if (data.current && typeof data.current === "object") {
      for (const [id, c] of Object.entries(data.current as Record<string, CurrentActivity>)) {
        this.current.set(id, c);
      }
    }
    if (typeof data.currentTimeOfDay === "number") this.currentTimeOfDay = data.currentTimeOfDay;
    if (typeof data.currentDay === "number") this.currentDay = data.currentDay;
  }
}
