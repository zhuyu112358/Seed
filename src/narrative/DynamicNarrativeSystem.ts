// DynamicNarrativeSystem: WorldSystem for dynamic narrative generation.
//
// Manages narrative arcs, event chains, branching narratives, and player influence.
// Provides the framework for emergent storytelling. Application layer defines
// specific content and condition evaluation.
//
// M12 Phase 6: Dynamic Narrative Generation.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import {
  DynamicNarrativeArc,
  DynamicNarrativeArcStatus,
  DynamicNarrativeEvent,
  DynamicNarrativeEventType,
  DynamicNarrativeBranch,
  DynamicNarrativeChoice,
  DynamicNarrativeConfig,
  DEFAULT_DYNAMIC_NARRATIVE_CONFIG,
  DynamicArcAdvancementResult,
} from "./DynamicNarrativeTypes.js";

export class DynamicNarrativeSystem implements WorldSystem {
  readonly name = "dynamic-narrative";
  enabled = true;

  private config: DynamicNarrativeConfig;
  private readonly arcs = new Map<string, DynamicNarrativeArc>(); // arcId → arc
  private readonly events: DynamicNarrativeEvent[] = []; // event chain (chronological)
  private readonly branches = new Map<string, DynamicNarrativeBranch>(); // branchId → branch
  private readonly narrativeState = new Map<string, unknown>(); // global narrative state
  private eventCounter = 0;
  private currentTick = 0;
  private eventSystem: EventSystem | null = null;

  constructor(config?: Partial<DynamicNarrativeConfig>) {
    this.config = { ...DEFAULT_DYNAMIC_NARRATIVE_CONFIG, ...config };
  }

  // --- Narrative Arc Management ---

  /** Register a new narrative arc. */
  addArc(arc: DynamicNarrativeArc): void {
    this.arcs.set(arc.id, arc);
  }

  /** Get a narrative arc by ID. */
  getArc(arcId: string): DynamicNarrativeArc | undefined {
    return this.arcs.get(arcId);
  }

  /** Get all narrative arcs. */
  getAllArcs(): DynamicNarrativeArc[] {
    return Array.from(this.arcs.values());
  }

  /** Get arcs by status. */
  getArcsByStatus(status: DynamicNarrativeArcStatus): DynamicNarrativeArc[] {
    return this.getAllArcs().filter(a => a.status === status);
  }

  /** Get the current phase of an arc. */
  getCurrentPhase(arcId: string) {
    const arc = this.arcs.get(arcId);
    if (!arc) return null;
    return arc.phases[arc.currentPhaseIndex] ?? null;
  }

  /** Start an arc (sets status to active, starts at phase 0). */
  startArc(arcId: string): boolean {
    const arc = this.arcs.get(arcId);
    if (!arc || arc.status === "active") return false;
    arc.status = "active";
    arc.currentPhaseIndex = 0;
    arc.startedAt = this.currentTick;
    this.emitDynamicNarrativeEvent("narrative.arc_started", {
      arcId,
      arcName: arc.name,
      phaseId: arc.phases[0]?.id,
    });
    return true;
  }

  /** Advance an arc to the next phase. */
  advanceArc(arcId: string): DynamicArcAdvancementResult {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return { advanced: false, previousPhaseId: null, newPhaseId: null, reason: "arc_not_found" };
    }
    if (arc.status !== "active") {
      return { advanced: false, previousPhaseId: null, newPhaseId: null, reason: "arc_not_active" };
    }

    const previousPhase = arc.phases[arc.currentPhaseIndex];
    const nextIndex = arc.currentPhaseIndex + 1;

    if (nextIndex >= arc.phases.length) {
      // Arc completed.
      arc.status = "completed";
      arc.endedAt = this.currentTick;
      this.emitDynamicNarrativeEvent("narrative.arc_completed", {
        arcId,
        arcName: arc.name,
      });
      return {
        advanced: true,
        previousPhaseId: previousPhase?.id ?? null,
        newPhaseId: null,
        reason: "arc_completed",
      };
    }

    arc.currentPhaseIndex = nextIndex;
    const newPhase = arc.phases[nextIndex];

    this.emitDynamicNarrativeEvent("narrative.phase_changed", {
      arcId,
      arcName: arc.name,
      previousPhaseId: previousPhase?.id,
      newPhaseId: newPhase?.id,
      newPhaseName: newPhase?.name,
    });

    return {
      advanced: true,
      previousPhaseId: previousPhase?.id ?? null,
      newPhaseId: newPhase?.id ?? null,
      reason: "phase_advanced",
    };
  }

  /** Fail an arc. */
  failArc(arcId: string, reason?: string): boolean {
    const arc = this.arcs.get(arcId);
    if (!arc || arc.status !== "active") return false;
    arc.status = "failed";
    arc.endedAt = this.currentTick;
    this.emitDynamicNarrativeEvent("narrative.arc_failed", {
      arcId,
      arcName: arc.name,
      reason,
    });
    return true;
  }

  /** Update arc properties. */
  updateArc(arcId: string, updates: Partial<DynamicNarrativeArc>): boolean {
    const arc = this.arcs.get(arcId);
    if (!arc) return false;
    Object.assign(arc, updates);
    return true;
  }

  // --- Event Chain Management ---

  /** Record a narrative event and add it to the event chain. */
  recordEvent(
    type: DynamicNarrativeEventType,
    title: string,
    description: string,
    options?: {
      participants?: string[];
      location?: { x: number; z: number };
      arcId?: string;
      consequences?: Record<string, unknown>;
      playerTriggered?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): DynamicNarrativeEvent {
    this.eventCounter++;
    const event: DynamicNarrativeEvent = {
      id: `narrative_event_${this.eventCounter}`,
      type,
      title,
      description,
      timestamp: this.currentTick,
      participants: options?.participants ?? [],
      location: options?.location,
      arcId: options?.arcId,
      previousEventId: this.events.length > 0 ? this.events[this.events.length - 1].id : undefined,
      consequences: options?.consequences,
      playerTriggered: options?.playerTriggered ?? false,
      metadata: options?.metadata,
    };

    this.events.push(event);

    // Apply consequences to narrative state.
    if (event.consequences) {
      for (const [key, value] of Object.entries(event.consequences)) {
        this.narrativeState.set(key, value);
      }
    }

    // Enforce max history.
    while (this.events.length > this.config.maxEventHistory) {
      this.events.shift();
    }

    this.emitDynamicNarrativeEvent("narrative.event_recorded", {
      eventId: event.id,
      type: event.type,
      title: event.title,
      arcId: event.arcId,
      playerTriggered: event.playerTriggered,
    });

    return event;
  }

  /** Get all events (chronological). */
  getEvents(): DynamicNarrativeEvent[] {
    return [...this.events];
  }

  /** Get events by arc. */
  getEventsByArc(arcId: string): DynamicNarrativeEvent[] {
    return this.events.filter(e => e.arcId === arcId);
  }

  /** Get events by type. */
  getEventsByType(type: DynamicNarrativeEventType): DynamicNarrativeEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /** Get the most recent N events. */
  getRecentEvents(count: number): DynamicNarrativeEvent[] {
    return this.events.slice(-count);
  }

  /** Get a specific event by ID. */
  getEvent(eventId: string): DynamicNarrativeEvent | undefined {
    return this.events.find(e => e.id === eventId);
  }

  // --- Branching Narrative ---

  /** Create a new narrative branch (choice point). */
  createBranch(
    description: string,
    choices: DynamicNarrativeChoice[],
    options?: { arcId?: string },
  ): DynamicNarrativeBranch {
    const branchId = `branch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const branch: DynamicNarrativeBranch = {
      id: branchId,
      description,
      choices,
      selectedChoiceId: null,
      resolved: false,
      createdAt: this.currentTick,
      arcId: options?.arcId,
    };
    this.branches.set(branchId, branch);
    this.emitDynamicNarrativeEvent("narrative.branch_created", {
      branchId,
      description,
      choiceCount: choices.length,
      arcId: options?.arcId,
    });
    return branch;
  }

  /** Select a choice in a branch. */
  selectChoice(branchId: string, choiceId: string): boolean {
    const branch = this.branches.get(branchId);
    if (!branch || branch.resolved) return false;

    const choice = branch.choices.find(c => c.id === choiceId);
    if (!choice) return false;

    branch.selectedChoiceId = choiceId;
    branch.resolved = true;
    branch.resolvedAt = this.currentTick;

    // Apply choice consequences.
    for (const [key, value] of Object.entries(choice.consequences)) {
      this.narrativeState.set(key, value);
    }

    this.emitDynamicNarrativeEvent("narrative.choice_selected", {
      branchId,
      choiceId,
      choiceText: choice.text,
      arcId: branch.arcId,
    });

    return true;
  }

  /** Auto-select a choice based on weights (for NPC-driven narratives). */
  autoSelectChoice(branchId: string): string | null {
    const branch = this.branches.get(branchId);
    if (!branch || branch.resolved) return null;

    const available = branch.choices.filter(c => c.available !== false);
    if (available.length === 0) return null;

    // Weighted random selection.
    const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;
    for (const choice of available) {
      random -= choice.weight;
      if (random <= 0) {
        this.selectChoice(branchId, choice.id);
        return choice.id;
      }
    }
    // Fallback to first.
    this.selectChoice(branchId, available[0].id);
    return available[0].id;
  }

  /** Get a branch by ID. */
  getBranch(branchId: string): DynamicNarrativeBranch | undefined {
    return this.branches.get(branchId);
  }

  /** Get all unresolved branches. */
  getUnresolvedBranches(): DynamicNarrativeBranch[] {
    return Array.from(this.branches.values()).filter(b => !b.resolved);
  }

  // --- Player Influence ---

  /** Record a player action and its narrative consequence. */
  recordPlayerAction(
    action: string,
    description: string,
    consequences: Record<string, unknown>,
    options?: { participants?: string[]; location?: { x: number; z: number } },
  ): DynamicNarrativeEvent {
    return this.recordEvent("player", `Player: ${action}`, description, {
      participants: options?.participants,
      location: options?.location,
      consequences,
      playerTriggered: true,
    });
  }

  /** Get the narrative influence score for a player (based on state changes they caused). */
  getPlayerInfluence(playerId: string): number {
    // Count events triggered by this player.
    const playerEvents = this.events.filter(
      e => e.playerTriggered && e.participants.includes(playerId),
    );
    return playerEvents.length;
  }

  // --- Narrative State ---

  /** Get a value from the global narrative state. */
  getState<T = unknown>(key: string): T | undefined {
    return this.narrativeState.get(key) as T | undefined;
  }

  /** Set a value in the global narrative state. */
  setState(key: string, value: unknown): void {
    this.narrativeState.set(key, value);
  }

  /** Get all narrative state. */
  getAllState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const [key, value] of this.narrativeState) state[key] = value;
    return state;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.eventSystem = events;
    this.currentTick++;
    // Auto-advance arcs if configured (conditions evaluated by application layer
    // via updateArc + advanceArc, so no automatic condition checking here).
  }

  stop(): void {
    this.eventSystem = null;
  }

  // --- Internal helpers ---

  private emitDynamicNarrativeEvent(eventType: string, payload: Record<string, unknown>): void {
    if (!this.eventSystem || !this.config.emitEvents) return;
    this.eventSystem.emit(new Event({
      type: eventType,
      payload,
      sourceId: "dynamic-narrative",
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const arcs: Record<string, DynamicNarrativeArc> = {};
    for (const [id, arc] of this.arcs) arcs[id] = arc;
    const branches: Record<string, DynamicNarrativeBranch> = {};
    for (const [id, branch] of this.branches) branches[id] = branch;
    const state: Record<string, unknown> = {};
    for (const [key, value] of this.narrativeState) state[key] = value;
    return {
      arcs,
      events: this.events,
      branches,
      state,
      eventCounter: this.eventCounter,
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.arcs && typeof data.arcs === "object") {
      for (const [id, arc] of Object.entries(data.arcs as Record<string, DynamicNarrativeArc>)) {
        this.arcs.set(id, arc);
      }
    }
    if (Array.isArray(data.events)) {
      this.events.push(...(data.events as DynamicNarrativeEvent[]));
    }
    if (data.branches && typeof data.branches === "object") {
      for (const [id, branch] of Object.entries(data.branches as Record<string, DynamicNarrativeBranch>)) {
        this.branches.set(id, branch);
      }
    }
    if (data.state && typeof data.state === "object") {
      for (const [key, value] of Object.entries(data.state as Record<string, unknown>)) {
        this.narrativeState.set(key, value);
      }
    }
    if (typeof data.eventCounter === "number") this.eventCounter = data.eventCounter;
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
  }
}


