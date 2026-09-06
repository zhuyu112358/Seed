// SoundPerceptionSystem: auditory perception with distance attenuation.
//
// Manages sound sources and listeners, computes received intensity using
// inverse-square distance attenuation + medium absorption (same model as
// AcousticPropagation), filters by audibility threshold, and provides
// direction of arrival. Can emit heard_sound events for perception integration.
//
// Seed only provides the calculation framework. Application layer configures
// sources/listeners; Ember handles cognitive processing of auditory info.
//
// Coordinate system: x/z plane (top-down). Direction 0 = +x axis,
// positive angles = counterclockwise.

import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  SoundType,
  SoundSource,
  SoundListener,
  HeardSound,
  SoundConfig,
  DEFAULT_SOUND_CONFIG,
  SoundResult,
} from "./SoundTypes.js";

export class SoundPerceptionSystem {
  readonly name = "soundperception";
  enabled = true;
  private sources = new Map<string, SoundSource>();
  private listeners = new Map<string, SoundListener>();
  private sourceCounter = 0;
  private listenerCounter = 0;
  private currentTick = 0;
  /** Sound perception configuration. */
  config: SoundConfig;

  constructor(config?: Partial<SoundConfig>) {
    this.config = { ...DEFAULT_SOUND_CONFIG, ...config };
  }

  private generateSourceId(): string {
    this.sourceCounter++;
    return `sound_${Date.now()}_${this.sourceCounter}`;
  }

  private generateListenerId(): string {
    this.listenerCounter++;
    return `listener_${Date.now()}_${this.listenerCounter}`;
  }

  // --- Sound source management ---

  /**
   * Add a sound source.
   * @param type Type of sound.
   * @param position Source position.
   * @param intensity Source intensity (0-1).
   * @param duration Duration in ticks (0 = persistent).
   * @param frequency Optional frequency in Hz.
   * @param metadata Optional metadata.
   */
  addSource(
    type: SoundType,
    position: { x: number; z: number },
    intensity: number,
    duration = 0,
    frequency?: number,
    metadata?: Record<string, unknown>,
  ): SoundResult {
    if (intensity < 0 || intensity > 1) {
      return { success: false, error: "Intensity must be between 0 and 1" };
    }
    const id = this.generateSourceId();
    const source: SoundSource = {
      id,
      type,
      position: { ...position },
      intensity,
      frequency,
      duration,
      createdTick: this.currentTick,
      active: true,
      metadata,
    };
    this.sources.set(id, source);
    return { success: true, sourceId: id };
  }

  /** Remove a sound source. */
  removeSource(sourceId: string): SoundResult {
    if (!this.sources.has(sourceId)) {
      return { success: false, error: "Sound source not found" };
    }
    this.sources.delete(sourceId);
    return { success: true, sourceId };
  }

  /** Get a sound source by ID. */
  getSource(sourceId: string): SoundSource | undefined {
    return this.sources.get(sourceId);
  }

  /** Get all sound sources. */
  getSources(): SoundSource[] {
    return Array.from(this.sources.values());
  }

  /** Get active sound sources only. */
  getActiveSources(): SoundSource[] {
    return Array.from(this.sources.values()).filter((s) => s.active);
  }

  /** Get sources by type. */
  getSourcesByType(type: SoundType): SoundSource[] {
    return Array.from(this.sources.values()).filter((s) => s.type === type);
  }

  /** Set source position. */
  setSourcePosition(sourceId: string, position: { x: number; z: number }): SoundResult {
    const source = this.sources.get(sourceId);
    if (!source) return { success: false, error: "Sound source not found" };
    source.position = { ...position };
    return { success: true, sourceId };
  }

  /** Set source intensity. */
  setSourceIntensity(sourceId: string, intensity: number): SoundResult {
    const source = this.sources.get(sourceId);
    if (!source) return { success: false, error: "Sound source not found" };
    if (intensity < 0 || intensity > 1) {
      return { success: false, error: "Intensity must be between 0 and 1" };
    }
    source.intensity = intensity;
    return { success: true, sourceId };
  }

  /** Set source active state. */
  setSourceActive(sourceId: string, active: boolean): SoundResult {
    const source = this.sources.get(sourceId);
    if (!source) return { success: false, error: "Sound source not found" };
    source.active = active;
    return { success: true, sourceId };
  }

  /** Number of sound sources. */
  get sourceCount(): number {
    return this.sources.size;
  }

  // --- Listener management ---

  /**
   * Add a sound listener.
   * @param position Listener position.
   * @param hearingThreshold Minimum intensity to hear (0-1). Default from config.
   * @param listenerId Optional specific ID.
   */
  addListener(
    position: { x: number; z: number },
    hearingThreshold?: number,
    listenerId?: string,
  ): SoundResult {
    const id = listenerId || this.generateListenerId();
    if (this.listeners.has(id)) {
      return { success: false, error: `Listener ${id} already exists` };
    }
    const listener: SoundListener = {
      id,
      position: { ...position },
      hearingThreshold: hearingThreshold ?? this.config.minAudible,
      active: true,
    };
    this.listeners.set(id, listener);
    return { success: true, listenerId: id };
  }

  /** Remove a listener. */
  removeListener(listenerId: string): SoundResult {
    if (!this.listeners.has(listenerId)) {
      return { success: false, error: "Listener not found" };
    }
    this.listeners.delete(listenerId);
    return { success: true, listenerId };
  }

  /** Get a listener by ID. */
  getListener(listenerId: string): SoundListener | undefined {
    return this.listeners.get(listenerId);
  }

  /** Get all listeners. */
  getListeners(): SoundListener[] {
    return Array.from(this.listeners.values());
  }

  /** Set listener position. */
  setListenerPosition(listenerId: string, position: { x: number; z: number }): SoundResult {
    const listener = this.listeners.get(listenerId);
    if (!listener) return { success: false, error: "Listener not found" };
    listener.position = { ...position };
    return { success: true, listenerId };
  }

  /** Set listener hearing threshold. */
  setListenerThreshold(listenerId: string, threshold: number): SoundResult {
    const listener = this.listeners.get(listenerId);
    if (!listener) return { success: false, error: "Listener not found" };
    if (threshold < 0 || threshold > 1) {
      return { success: false, error: "Threshold must be between 0 and 1" };
    }
    listener.hearingThreshold = threshold;
    return { success: true, listenerId };
  }

  /** Set listener active state. */
  setListenerActive(listenerId: string, active: boolean): SoundResult {
    const listener = this.listeners.get(listenerId);
    if (!listener) return { success: false, error: "Listener not found" };
    listener.active = active;
    return { success: true, listenerId };
  }

  /** Number of listeners. */
  get listenerCount(): number {
    return this.listeners.size;
  }

  // --- Sound perception calculations ---

  /**
   * Compute received intensity at a distance from a source.
   * Uses inverse-square attenuation + linear absorption (same model as AcousticPropagation).
   * @param sourceIntensity Source intensity (0-1).
   * @param distance Distance from source to listener.
   * @returns Received intensity (0-1).
   */
  computeReceivedIntensity(sourceIntensity: number, distance: number): number {
    if (distance > this.config.maxRadius) return 0;
    if (distance === 0) return sourceIntensity;
    const inverseSquare = 1 / (1 + this.config.attenuation * distance * distance);
    const mediumAbsorption = Math.max(0, 1 - this.config.absorption * distance);
    return Math.max(0, Math.min(1, sourceIntensity * inverseSquare * mediumAbsorption));
  }

  /**
   * Compute distance between source and listener.
   */
  computeDistance(
    sourcePos: { x: number; z: number },
    listenerPos: { x: number; z: number },
  ): number {
    const dx = sourcePos.x - listenerPos.x;
    const dz = sourcePos.z - listenerPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Compute direction angle from listener to source.
   * @returns Angle in degrees (0 = +x, counterclockwise, -180 to 180).
   */
  computeDirectionAngle(
    sourcePos: { x: number; z: number },
    listenerPos: { x: number; z: number },
  ): number {
    const dx = sourcePos.x - listenerPos.x;
    const dz = sourcePos.z - listenerPos.z;
    if (dx === 0 && dz === 0) return 0;
    return (Math.atan2(dz, dx) * 180) / Math.PI;
  }

  /**
   * Check if a sound source is audible to a listener.
   */
  isAudible(sourceId: string, listenerId: string): boolean {
    const source = this.sources.get(sourceId);
    const listener = this.listeners.get(listenerId);
    if (!source || !listener || !source.active || !listener.active) return false;

    const distance = this.computeDistance(source.position, listener.position);
    if (distance > this.config.maxRadius) return false;

    const received = this.computeReceivedIntensity(source.intensity, distance);
    return received > listener.hearingThreshold;
  }

  /**
   * Get detailed heard sound info for a source-listener pair.
   * @returns HeardSound info (audible flag indicates if above threshold), null if source/listener not found.
   */
  getHeardSound(sourceId: string, listenerId: string): HeardSound | null {
    const source = this.sources.get(sourceId);
    const listener = this.listeners.get(listenerId);
    if (!source || !listener) return null;

    const distance = this.computeDistance(source.position, listener.position);
    const received = this.computeReceivedIntensity(source.intensity, distance);
    const direction = this.computeDirectionAngle(source.position, listener.position);

    return {
      sourceId,
      type: source.type,
      sourcePosition: { ...source.position },
      receivedIntensity: received,
      distance,
      directionAngle: direction,
      audible: source.active && listener.active && received > listener.hearingThreshold && distance <= this.config.maxRadius,
    };
  }

  /**
   * Get all sounds audible to a listener, sorted by received intensity (loudest first).
   * @param listenerId The listener.
   * @param onlyAudible If true, only return sounds above threshold. Default true.
   */
  getHeardSounds(listenerId: string, onlyAudible = true): HeardSound[] {
    const listener = this.listeners.get(listenerId);
    if (!listener || !listener.active) return [];

    const result: HeardSound[] = [];
    for (const source of this.sources.values()) {
      if (!source.active) continue;
      const heard = this.getHeardSound(source.id, listenerId);
      if (!heard) continue;
      if (onlyAudible && !heard.audible) continue;
      result.push(heard);
    }
    // Sort by received intensity (loudest first).
    result.sort((a, b) => b.receivedIntensity - a.receivedIntensity);
    return result;
  }

  /**
   * Find all listeners that can hear a sound source.
   * @param sourceId The sound source.
   * @returns Array of listener IDs that can hear the source.
   */
  findListenersHearingSource(sourceId: string): string[] {
    const source = this.sources.get(sourceId);
    if (!source || !source.active) return [];

    const result: string[] = [];
    for (const listener of this.listeners.values()) {
      if (!listener.active) continue;
      if (this.isAudible(sourceId, listener.id)) {
        result.push(listener.id);
      }
    }
    return result;
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    this.currentTick++;
    // Expire temporary sounds (duration > 0).
    for (const [id, source] of this.sources) {
      if (source.duration > 0 && this.currentTick - source.createdTick >= source.duration) {
        source.active = false;
      }
    }
  }

  stop(): void {
    this.sources.clear();
    this.listeners.clear();
    this.sourceCounter = 0;
    this.listenerCounter = 0;
    this.currentTick = 0;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const sources: Record<string, SoundSource> = {};
    for (const [id, s] of this.sources) sources[id] = s;
    const listeners: Record<string, SoundListener> = {};
    for (const [id, l] of this.listeners) listeners[id] = l;
    return {
      sources,
      listeners,
      sourceCounter: this.sourceCounter,
      listenerCounter: this.listenerCounter,
      currentTick: this.currentTick,
      config: this.config,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.sources && typeof data.sources === "object") {
      for (const [id, s] of Object.entries(data.sources as Record<string, SoundSource>)) {
        this.sources.set(id, s);
      }
    }
    if (data.listeners && typeof data.listeners === "object") {
      for (const [id, l] of Object.entries(data.listeners as Record<string, SoundListener>)) {
        this.listeners.set(id, l);
      }
    }
    if (typeof data.sourceCounter === "number") this.sourceCounter = data.sourceCounter;
    if (typeof data.listenerCounter === "number") this.listenerCounter = data.listenerCounter;
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_SOUND_CONFIG, ...(data.config as Partial<SoundConfig>) };
    }
  }
}
