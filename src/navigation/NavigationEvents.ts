// Navigation event classes. All events extend the base Event class
// with typed payloads. Seed only emits these events; perception and
// response are handled by SoulPerceptionSystem and the application layer.
import { Event } from "../event/Event.js";
import { NavigationEventPayload } from "./NavigationTypes.js";

/** Emitted when an entity's path is recalculated or changed. */
export class PathChangedEvent extends Event<NavigationEventPayload> {
  static readonly type = "navigation.path_changed";
  constructor(payload: NavigationEventPayload) {
    super({ type: PathChangedEvent.type, payload, sourceId: payload.entityId });
  }
}

/** Emitted when an entity's path is blocked and cannot be completed. */
export class PathBlockedEvent extends Event<NavigationEventPayload> {
  static readonly type = "navigation.path_blocked";
  constructor(payload: NavigationEventPayload) {
    super({ type: PathBlockedEvent.type, payload, sourceId: payload.entityId });
  }
}

/** Emitted when an entity arrives at its destination. */
export class ArrivedEvent extends Event<NavigationEventPayload> {
  static readonly type = "navigation.arrived";
  constructor(payload: NavigationEventPayload) {
    super({ type: ArrivedEvent.type, payload, sourceId: payload.entityId });
  }
}

/** Emitted when an entity reaches a waypoint along its path. */
export class WaypointReachedEvent extends Event<NavigationEventPayload> {
  static readonly type = "navigation.waypoint_reached";
  constructor(payload: NavigationEventPayload) {
    super({ type: WaypointReachedEvent.type, payload, sourceId: payload.entityId });
  }
}
