// Core event primitives: the Event envelope and the concrete event payloads.

export interface EventPayload {
  [key: string]: unknown;
}

/**
 * The envelope carried on the event bus. `propagation` models how far an event
 * travels through the world (used by EventPropagation for spatial decay).
 */
export class Event<T extends EventPayload = EventPayload> {
  public readonly type: string;
  public readonly payload: T;
  public readonly timestamp: number;
  public readonly sourceId: string | null;
  public propagation: {
    origin: { x: number; y: number; z: number } | null;
    /** Remaining radius the event can travel, in metres. */
    remainingRadius: number;
    /** Current intensity in [0,1], decayed as the event spreads. */
    intensity: number;
  };
  private cancelled = false;

  constructor(opts: {
    type: string;
    payload: T;
    sourceId?: string | null;
    timestamp?: number;
    origin?: { x: number; y: number; z: number } | null;
    maxRadius?: number;
    intensity?: number;
  }) {
    this.type = opts.type;
    this.payload = opts.payload;
    this.timestamp = opts.timestamp ?? Date.now();
    this.sourceId = opts.sourceId ?? null;
    this.propagation = {
      origin: opts.origin ?? null,
      remainingRadius: opts.maxRadius ?? Infinity,
      intensity: opts.intensity ?? 1,
    };
  }

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }
}

// ---- Concrete event factories ---------------------------------------------

export class CollisionEvent extends Event<{
  a: string;
  b: string;
  point: { x: number; y: number; z: number };
  relativeSpeed: number;
}> {
  constructor(a: string, b: string, point: { x: number; y: number; z: number }, relativeSpeed: number) {
    super({
      type: 'physics.collision',
      payload: { a, b, point, relativeSpeed },
      sourceId: a,
      origin: point,
    });
  }
}

/** Emitted when two bodies START colliding (first tick of contact). */
export class CollisionEnterEvent extends Event<{
  a: string;
  b: string;
  point: { x: number; y: number; z: number };
  relativeSpeed: number;
  normal: { x: number; z: number };
  penetration: number;
}> {
  constructor(
    a: string, b: string,
    point: { x: number; y: number; z: number },
    relativeSpeed: number,
    normal: { x: number; z: number },
    penetration: number,
  ) {
    super({
      type: 'physics.collision.enter',
      payload: { a, b, point, relativeSpeed, normal, penetration },
      sourceId: a,
      origin: point,
    });
  }
}

/** Emitted when two bodies CONTINUE colliding (subsequent ticks of contact). */
export class CollisionStayEvent extends Event<{
  a: string;
  b: string;
  point: { x: number; y: number; z: number };
  relativeSpeed: number;
  normal: { x: number; z: number };
  penetration: number;
  contactDurationTicks: number;
}> {
  constructor(
    a: string, b: string,
    point: { x: number; y: number; z: number },
    relativeSpeed: number,
    normal: { x: number; z: number },
    penetration: number,
    contactDurationTicks: number,
  ) {
    super({
      type: 'physics.collision.stay',
      payload: { a, b, point, relativeSpeed, normal, penetration, contactDurationTicks },
      sourceId: a,
      origin: point,
    });
  }
}

/** Emitted when two bodies STOP colliding (first tick without contact). */
export class CollisionExitEvent extends Event<{
  a: string;
  b: string;
  lastContactPoint: { x: number; y: number; z: number };
  contactDurationTicks: number;
}> {
  constructor(
    a: string, b: string,
    lastContactPoint: { x: number; y: number; z: number },
    contactDurationTicks: number,
  ) {
    super({
      type: 'physics.collision.exit',
      payload: { a, b, lastContactPoint, contactDurationTicks },
      sourceId: a,
      origin: lastContactPoint,
    });
  }
}

/** Emitted when an entity ENTERS a trigger volume (first tick of overlap). */
export class TriggerEnterEvent extends Event<{
  triggerId: string;
  otherId: string;
  point: { x: number; y: number; z: number };
}> {
  constructor(
    triggerId: string, otherId: string,
    point: { x: number; y: number; z: number },
  ) {
    super({
      type: 'physics.trigger.enter',
      payload: { triggerId, otherId, point },
      sourceId: triggerId,
      origin: point,
    });
  }
}

/** Emitted when an entity STAYS inside a trigger volume (subsequent ticks). */
export class TriggerStayEvent extends Event<{
  triggerId: string;
  otherId: string;
  point: { x: number; y: number; z: number };
  contactDurationTicks: number;
}> {
  constructor(
    triggerId: string, otherId: string,
    point: { x: number; y: number; z: number },
    contactDurationTicks: number,
  ) {
    super({
      type: 'physics.trigger.stay',
      payload: { triggerId, otherId, point, contactDurationTicks },
      sourceId: triggerId,
      origin: point,
    });
  }
}

/** Emitted when an entity EXITS a trigger volume (first tick without overlap). */
export class TriggerExitEvent extends Event<{
  triggerId: string;
  otherId: string;
  lastContactPoint: { x: number; y: number; z: number };
  contactDurationTicks: number;
}> {
  constructor(
    triggerId: string, otherId: string,
    lastContactPoint: { x: number; y: number; z: number },
    contactDurationTicks: number,
  ) {
    super({
      type: 'physics.trigger.exit',
      payload: { triggerId, otherId, lastContactPoint, contactDurationTicks },
      sourceId: triggerId,
      origin: lastContactPoint,
    });
  }
}

export class EntityEnterZone extends Event<{ zoneId: string; entityId: string }> {
  constructor(zoneId: string, entityId: string, origin: { x: number; y: number; z: number }) {
    super({
      type: 'zone.enter',
      payload: { zoneId, entityId },
      sourceId: zoneId,
      origin,
    });
  }
}

export class WorldTickEvent extends Event<{ tick: number; worldTime: number }> {
  constructor(tick: number, worldTime: number) {
    super({ type: 'world.tick', payload: { tick, worldTime }, sourceId: 'engine' });
  }
}

/** Reserved: weather changes, emitted by a future weather subsystem. */
export class WeatherEvent extends Event<{ kind: string; strength: number }> {
  constructor(kind: string, strength: number) {
    super({ type: 'world.weather', payload: { kind, strength }, sourceId: 'engine' });
  }
}

/** Emitted by MovementController when an entity reaches its moveTarget. */
export class EntityArrivedEvent extends Event<{
  entityId: string;
  targetPosition: { x: number; y: number; z: number };
  actualPosition: { x: number; y: number; z: number };
  stopReason: string;
  distanceToTarget: number;
}> {
  constructor(
    entityId: string,
    targetPosition: { x: number; y: number; z: number },
    actualPosition: { x: number; y: number; z: number },
    stopReason: string,
    distanceToTarget: number,
  ) {
    super({
      type: 'movement.arrived',
      payload: { entityId, targetPosition, actualPosition, stopReason, distanceToTarget },
      sourceId: entityId,
      origin: actualPosition,
    });
  }
}
