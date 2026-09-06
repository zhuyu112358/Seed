// AttentionSystem: prioritizes perception events by severity, distance,
// recency, and type importance. Provides attention decay over time and
// top-N event selection for cognitive processing.
//
// Seed provides the attention calculation framework. Application layer
// configures attention parameters. Ember handles cognitive processing
// of prioritized events.
//
// Priority formula:
//   priority = severityWeight * severityPriority
//            + distanceWeight * (1 - normalizedDistance)  [closer = higher]
//            + recencyWeight * (1 - normalizedAge)       [newer = higher]
//            + typeBonus (per-type importance)

import {
  PerceptionEvent,
  PerceptionSeverity,
  SEVERITY_PRIORITY,
} from "./PerceptionFilterTypes.js";

/** Configuration for attention system. */
export interface AttentionConfig {
  /** Weight for severity in priority calculation. Default 0.5. */
  severityWeight: number;
  /** Weight for distance (closer = higher priority). Default 0.2. */
  distanceWeight: number;
  /** Weight for recency (newer = higher priority). Default 0.2. */
  recencyWeight: number;
  /** Maximum events to process per tick (attention span). Default 10. */
  maxEventsPerTick: number;
  /** Reference distance for normalization (events beyond this get 0 distance bonus). Default 50. */
  referenceDistance: number;
  /** Reference age in ticks for normalization (events older than this get 0 recency bonus). Default 600. */
  referenceAge: number;
  /** Attention decay rate per tick (0 = no decay, 1 = full decay). Default 0.01. */
  attentionDecay: number;
}

/** Default attention configuration. */
export const DEFAULT_ATTENTION_CONFIG: AttentionConfig = {
  severityWeight: 0.5,
  distanceWeight: 0.2,
  recencyWeight: 0.2,
  maxEventsPerTick: 10,
  referenceDistance: 50,
  referenceAge: 600,
  attentionDecay: 0.01,
};

/** A prioritized perception event. */
export interface PrioritizedEvent {
  /** The original event. */
  event: PerceptionEvent;
  /** Calculated priority score (0-1, higher = more important). */
  priority: number;
  /** Severity component of priority. */
  severityScore: number;
  /** Distance component of priority. */
  distanceScore: number;
  /** Recency component of priority. */
  recencyScore: number;
}

/** Result of an attention operation. */
export interface AttentionResult {
  /** Number of events processed. */
  processedCount: number;
  /** Number of events selected (within attention span). */
  selectedCount: number;
  /** Average priority of selected events. */
  averagePriority: number;
}

/** Per-type importance bonus (0-1). */
export type TypeImportanceMap = Record<string, number>;

export class AttentionSystem {
  readonly name = "attentionsystem";
  /** Attention configuration. */
  config: AttentionConfig;
  /** Per-type importance bonuses. */
  private typeImportance: TypeImportanceMap = {};
  /** Current tick counter. */
  private currentTick = 0;

  constructor(config?: Partial<AttentionConfig>) {
    this.config = { ...DEFAULT_ATTENTION_CONFIG, ...config };
  }

  // --- Configuration ---

  /** Update attention configuration. */
  setConfig(config: Partial<AttentionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Set importance bonus for an event type. */
  setTypeImportance(type: string, importance: number): void {
    this.typeImportance[type] = Math.max(0, Math.min(1, importance));
  }

  /** Get importance bonus for an event type. */
  getTypeImportance(type: string): number {
    return this.typeImportance[type] ?? 0;
  }

  /** Remove type importance bonus. */
  removeTypeImportance(type: string): void {
    delete this.typeImportance[type];
  }

  // --- Priority calculation ---

  /**
   * Calculate priority score for a single event.
   * @param event The event to prioritize.
   * @param observerPosition Observer position (for distance calculation).
   * @param currentTick Current tick (for recency calculation).
   * @returns PrioritizedEvent with priority score and components.
   */
  calculatePriority(
    event: PerceptionEvent,
    observerPosition?: { x: number; z: number },
    currentTick?: number,
  ): PrioritizedEvent {
    const tick = currentTick ?? this.currentTick;

    // Severity score (0-1, normalized by max severity = 4).
    const severityPriority = SEVERITY_PRIORITY[event.severity] ?? 1;
    const severityScore = severityPriority / 4;

    // Distance score (0-1, closer = higher).
    let distanceScore = 0;
    if (event.position && observerPosition && this.config.referenceDistance > 0) {
      const dx = event.position.x - observerPosition.x;
      const dz = event.position.z - observerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      distanceScore = Math.max(0, 1 - distance / this.config.referenceDistance);
    }

    // Recency score (0-1, newer = higher).
    let recencyScore = 0;
    if (event.tick !== undefined && this.config.referenceAge > 0) {
      const age = tick - event.tick;
      recencyScore = Math.max(0, Math.min(1, 1 - age / this.config.referenceAge));
    }

    // Type importance bonus.
    const typeBonus = this.typeImportance[event.type] ?? 0;

    // Weighted priority (0-1).
    const totalWeight = this.config.severityWeight + this.config.distanceWeight + this.config.recencyWeight;
    let priority = 0;
    if (totalWeight > 0) {
      priority = (
        this.config.severityWeight * severityScore +
        this.config.distanceWeight * distanceScore +
        this.config.recencyWeight * recencyScore
      ) / totalWeight;
    }
    // Add type bonus (capped at 1).
    priority = Math.min(1, priority + typeBonus * 0.2);

    return {
      event,
      priority,
      severityScore,
      distanceScore,
      recencyScore,
    };
  }

  /**
   * Prioritize a list of events, sorted by priority (highest first).
   * @param events Events to prioritize.
   * @param observerPosition Observer position.
   * @param currentTick Current tick.
   * @returns Array of PrioritizedEvent sorted by priority descending.
   */
  prioritizeEvents(
    events: PerceptionEvent[],
    observerPosition?: { x: number; z: number },
    currentTick?: number,
  ): PrioritizedEvent[] {
    const prioritized = events.map((e) => this.calculatePriority(e, observerPosition, currentTick));
    prioritized.sort((a, b) => b.priority - a.priority);
    return prioritized;
  }

  /**
   * Get top N most important events (within attention span).
   * @param events Events to select from.
   * @param observerPosition Observer position.
   * @param currentTick Current tick.
   * @param maxCount Maximum number of events (defaults to config.maxEventsPerTick).
   * @returns Top N prioritized events + attention result stats.
   */
  getTopEvents(
    events: PerceptionEvent[],
    observerPosition?: { x: number; z: number },
    currentTick?: number,
    maxCount?: number,
  ): { events: PrioritizedEvent[]; result: AttentionResult } {
    const prioritized = this.prioritizeEvents(events, observerPosition, currentTick);
    const n = maxCount ?? this.config.maxEventsPerTick;
    const selected = prioritized.slice(0, n);
    const avgPriority = selected.length > 0
      ? selected.reduce((sum, e) => sum + e.priority, 0) / selected.length
      : 0;

    return {
      events: selected,
      result: {
        processedCount: events.length,
        selectedCount: selected.length,
        averagePriority: avgPriority,
      },
    };
  }

  /**
   * Apply attention decay to event priorities (simulates forgetting).
   * @param prioritizedEvents Events to decay.
   * @param ticks Number of ticks to decay.
   * @returns Decayed prioritized events.
   */
  applyAttentionDecay(prioritizedEvents: PrioritizedEvent[], ticks = 1): PrioritizedEvent[] {
    const decayFactor = Math.pow(1 - this.config.attentionDecay, ticks);
    return prioritizedEvents.map((pe) => ({
      ...pe,
      priority: Math.max(0, pe.priority * decayFactor),
    }));
  }

  // --- WorldSystem interface ---

  tick(): void {
    this.currentTick++;
  }

  stop(): void {
    this.typeImportance = {};
    this.currentTick = 0;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      typeImportance: { ...this.typeImportance },
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_ATTENTION_CONFIG, ...(data.config as Partial<AttentionConfig>) };
    }
    if (data.typeImportance && typeof data.typeImportance === "object") {
      this.typeImportance = { ...(data.typeImportance as TypeImportanceMap) };
    }
    if (typeof data.currentTick === "number") {
      this.currentTick = data.currentTick;
    }
  }
}
