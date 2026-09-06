// NPCMemorySystem: manages short-term and long-term memory for NPC entities.
//
// This system provides memory storage, retrieval, decay, and promotion
// from short-term to long-term memory. It is a generic framework -
// Ember decides what to remember and how memories affect decisions.
//
// M12 Phase 1: NPC Memory System.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import {
  MemoryEntry,
  MemoryType,
  MemoryImportance,
  NPCMemoryConfig,
  DEFAULT_NPC_MEMORY_CONFIG,
  IMPORTANCE_WEIGHT,
  MemoryQueryResult,
} from "./MemoryTypes.js";

export class NPCMemorySystem implements WorldSystem {
  readonly name = "npc-memory";
  enabled = true;

  private config: NPCMemoryConfig;
  private readonly shortTerm = new Map<string, MemoryEntry[]>(); // entityId → memories
  private readonly longTerm = new Map<string, MemoryEntry[]>(); // entityId → memories
  private currentTick = 0;
  private memoryCounter = 0;
  private events: EventSystem | null = null;

  constructor(config?: Partial<NPCMemoryConfig>) {
    this.config = { ...DEFAULT_NPC_MEMORY_CONFIG, ...config };
  }

  // --- Memory creation ---

  /**
   * Add a memory to an NPC's short-term memory.
   * Important memories may be promoted to long-term memory.
   */
  addMemory(
    entityId: string,
    type: MemoryType,
    text: string,
    importance: MemoryImportance = "medium",
    options?: {
      relatedEntities?: string[];
      location?: { x: number; z: number };
      metadata?: Record<string, unknown>;
    },
  ): MemoryEntry {
    this.memoryCounter++;
    const entry: MemoryEntry = {
      id: `memory_${this.memoryCounter}`,
      type,
      text,
      importance,
      createdAt: this.currentTick,
      lastAccessedAt: this.currentTick,
      accessCount: 0,
      decay: 1.0,
      relatedEntities: options?.relatedEntities ?? [],
      location: options?.location,
      metadata: options?.metadata,
    };

    // Add to short-term memory.
    this.addToShortTerm(entityId, entry);

    // Auto-promote high/critical importance to long-term.
    if (this.isLongTermImportance(importance)) {
      this.addToLongTerm(entityId, { ...entry });
    }

    // Emit memory created event.
    this.emitMemoryEvent(entityId, "memory.created", entry);

    return entry;
  }

  // --- Memory retrieval ---

  /**
   * Retrieve memories for an NPC with optional filters.
   * Accessing a memory refreshes its decay (if configured).
   */
  getMemories(
    entityId: string,
    filters?: {
      type?: MemoryType;
      importance?: MemoryImportance;
      relatedEntity?: string;
      minDecay?: number;
      limit?: number;
      includeShortTerm?: boolean;
      includeLongTerm?: boolean;
    },
  ): MemoryQueryResult {
    const shortTerm = this.shortTerm.get(entityId) ?? [];
    const longTerm = this.longTerm.get(entityId) ?? [];

    let all: MemoryEntry[] = [];
    if (filters?.includeShortTerm !== false) all = all.concat(shortTerm);
    if (filters?.includeLongTerm !== false) all = all.concat(longTerm);

    // Deduplicate by ID (memories may exist in both short and long term).
    const seen = new Set<string>();
    all = all.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    // Apply filters.
    if (filters?.type) {
      const type = filters.type;
      all = all.filter(m => m.type === type);
    }
    if (filters?.importance) {
      const importance = filters.importance;
      all = all.filter(m => m.importance === importance);
    }
    if (filters?.relatedEntity) {
      const relatedEntity = filters.relatedEntity;
      all = all.filter(m => m.relatedEntities.includes(relatedEntity));
    }
    if (filters?.minDecay !== undefined) {
      const minDecay = filters.minDecay;
      all = all.filter(m => m.decay >= minDecay);
    }

    // Sort by decay (freshest first), then by createdAt (newest first).
    all.sort((a, b) => {
      if (b.decay !== a.decay) return b.decay - a.decay;
      return b.createdAt - a.createdAt;
    });

    // Refresh decay for accessed memories.
    if (this.config.accessRefreshesDecay) {
      for (const memory of all) {
        memory.lastAccessedAt = this.currentTick;
        memory.accessCount++;
        memory.decay = Math.min(1, memory.decay + 0.1);
      }
    }

    const limit = filters?.limit ?? all.length;
    const result = all.slice(0, limit);

    return {
      memories: result,
      totalCount: all.length,
      shortTermCount: shortTerm.length,
      longTermCount: longTerm.length,
    };
  }

  /** Get a single memory by ID. */
  getMemoryById(entityId: string, memoryId: string): MemoryEntry | undefined {
    const shortTerm = this.shortTerm.get(entityId) ?? [];
    const longTerm = this.longTerm.get(entityId) ?? [];
    const found = shortTerm.find(m => m.id === memoryId) ?? longTerm.find(m => m.id === memoryId);
    if (found && this.config.accessRefreshesDecay) {
      found.lastAccessedAt = this.currentTick;
      found.accessCount++;
      found.decay = Math.min(1, found.decay + 0.1);
    }
    return found;
  }

  // --- Memory management ---

  /** Promote a short-term memory to long-term memory. */
  promoteToLongTerm(entityId: string, memoryId: string): boolean {
    const shortTerm = this.shortTerm.get(entityId);
    if (!shortTerm) return false;
    const index = shortTerm.findIndex(m => m.id === memoryId);
    if (index < 0) return false;

    const memory = shortTerm[index];
    this.addToLongTerm(entityId, { ...memory });
    // Keep in short-term too (it will decay out naturally).
    this.emitMemoryEvent(entityId, "memory.promoted", memory);
    return true;
  }

  /** Forget (remove) a specific memory. */
  forgetMemory(entityId: string, memoryId: string): boolean {
    let removed = false;
    const shortTerm = this.shortTerm.get(entityId);
    if (shortTerm) {
      const index = shortTerm.findIndex(m => m.id === memoryId);
      if (index >= 0) {
        shortTerm.splice(index, 1);
        removed = true;
      }
    }
    const longTerm = this.longTerm.get(entityId);
    if (longTerm) {
      const index = longTerm.findIndex(m => m.id === memoryId);
      if (index >= 0) {
        longTerm.splice(index, 1);
        removed = true;
      }
    }
    return removed;
  }

  /** Clear all memories for an NPC. */
  clearMemories(entityId: string): void {
    this.shortTerm.delete(entityId);
    this.longTerm.delete(entityId);
  }

  /** Get memory statistics for an NPC. */
  getMemoryStats(entityId: string): {
    shortTermCount: number;
    longTermCount: number;
    totalCount: number;
    avgDecay: number;
    byType: Record<string, number>;
  } {
    const shortTerm = this.shortTerm.get(entityId) ?? [];
    const longTerm = this.longTerm.get(entityId) ?? [];
    // Deduplicate by memory ID (memories may exist in both short and long term).
    const seen = new Set<string>();
    const all: MemoryEntry[] = [];
    for (const m of shortTerm.concat(longTerm)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        all.push(m);
      }
    }
    const byType: Record<string, number> = {};
    let totalDecay = 0;
    for (const m of all) {
      byType[m.type] = (byType[m.type] ?? 0) + 1;
      totalDecay += m.decay;
    }
    return {
      shortTermCount: shortTerm.length,
      longTermCount: longTerm.length,
      totalCount: all.length,
      avgDecay: all.length > 0 ? totalDecay / all.length : 0,
      byType,
    };
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.events = events;
    this.currentTick++;

    // Decay short-term memories.
    for (const [entityId, memories] of this.shortTerm) {
      for (let i = memories.length - 1; i >= 0; i--) {
        const memory = memories[i];
        const weight = IMPORTANCE_WEIGHT[memory.importance] ?? 1;
        memory.decay -= this.config.shortTermDecayRate / weight;

        // Auto-forget below threshold.
        if (this.config.autoForget && memory.decay <= this.config.forgetThreshold) {
          memories.splice(i, 1);
          this.emitMemoryEvent(entityId, "memory.forgotten", memory);
        }
      }
    }

    // Decay long-term memories (slower).
    for (const [, memories] of this.longTerm) {
      for (const memory of memories) {
        const weight = IMPORTANCE_WEIGHT[memory.importance] ?? 1;
        memory.decay -= this.config.longTermDecayRate / weight;
        if (memory.decay < 0) memory.decay = 0;
      }
    }
  }

  stop(): void {
    this.events = null;
  }

  // --- Internal helpers ---

  private addToShortTerm(entityId: string, memory: MemoryEntry): void {
    let memories = this.shortTerm.get(entityId);
    if (!memories) {
      memories = [];
      this.shortTerm.set(entityId, memories);
    }
    memories.unshift(memory);
    // Enforce max size (remove oldest).
    while (memories.length > this.config.maxShortTermMemories) {
      memories.pop();
    }
  }

  private addToLongTerm(entityId: string, memory: MemoryEntry): void {
    let memories = this.longTerm.get(entityId);
    if (!memories) {
      memories = [];
      this.longTerm.set(entityId, memories);
    }
    memories.unshift(memory);
    // Enforce max size (remove oldest).
    while (memories.length > this.config.maxLongTermMemories) {
      memories.pop();
    }
  }

  private isLongTermImportance(importance: MemoryImportance): boolean {
    const order: MemoryImportance[] = ["trivial", "low", "medium", "high", "critical"];
    const thresholdIndex = order.indexOf(this.config.longTermThreshold);
    const importanceIndex = order.indexOf(importance);
    return importanceIndex >= thresholdIndex;
  }

  private emitMemoryEvent(entityId: string, eventType: string, memory: MemoryEntry): void {
    if (!this.events) return;
    this.events.emit(new Event({
      type: eventType,
      payload: {
        entityId,
        memoryId: memory.id,
        memoryType: memory.type,
        importance: memory.importance,
        text: memory.text,
        decay: memory.decay,
      },
      sourceId: entityId,
    }));
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const shortTerm: Record<string, MemoryEntry[]> = {};
    for (const [id, memories] of this.shortTerm) shortTerm[id] = memories;
    const longTerm: Record<string, MemoryEntry[]> = {};
    for (const [id, memories] of this.longTerm) longTerm[id] = memories;
    return { shortTerm, longTerm, memoryCounter: this.memoryCounter, currentTick: this.currentTick };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.shortTerm && typeof data.shortTerm === "object") {
      for (const [id, memories] of Object.entries(data.shortTerm as Record<string, MemoryEntry[]>)) {
        this.shortTerm.set(id, memories);
      }
    }
    if (data.longTerm && typeof data.longTerm === "object") {
      for (const [id, memories] of Object.entries(data.longTerm as Record<string, MemoryEntry[]>)) {
        this.longTerm.set(id, memories);
      }
    }
    if (typeof data.memoryCounter === "number") this.memoryCounter = data.memoryCounter;
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
  }
}
