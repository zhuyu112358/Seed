// PerformanceProfiler: measures frame time, FPS, and per-system performance.
//
// This is a diagnostic system - it does not affect game logic.
// It tracks frame times, calculates FPS, and provides per-system timing.
// Used for M11 phase 4 performance optimization and benchmarking.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";

/** Performance statistics for a single system. */
export interface SystemPerformance {
  name: string;
  totalTimeMs: number;
  callCount: number;
  avgTimeMs: number;
  maxTimeMs: number;
  lastTimeMs: number;
}

/** Frame performance statistics. */
export interface FrameStats {
  frameNumber: number;
  frameTimeMs: number;
  fps: number;
  systemTimes: Record<string, number>;
}

/** Performance profiler configuration. */
export interface PerformanceProfilerConfig {
  /** Whether to enable profiling. Default true. */
  enabled: boolean;
  /** Number of frames to keep in history for FPS calculation. Default 60. */
  frameHistorySize: number;
  /** Warning threshold for frame time in ms (1000/30 ≈ 33.3ms). Default 33.3. */
  frameTimeWarningMs: number;
  /** Whether to track per-system timing. Default true. */
  trackSystemTiming: boolean;
}

/** Default profiler configuration. */
export const DEFAULT_PROFILER_CONFIG: PerformanceProfilerConfig = {
  enabled: true,
  frameHistorySize: 60,
  frameTimeWarningMs: 1000 / 30,
  trackSystemTiming: true,
};

export class PerformanceProfiler implements WorldSystem {
  readonly name = "performance-profiler";
  enabled = true;

  private config: PerformanceProfilerConfig;
  private frameTimes: number[] = [];
  private frameCount = 0;
  private lastFrameStart = 0;
  private systemStats = new Map<string, SystemPerformance>();
  private currentFrameSystemTimes = new Map<string, number>();
  private slowFrameCount = 0;
  private totalFrameTime = 0;
  private peakFrameTime = 0;
  private events: EventSystem | null = null;

  constructor(config?: Partial<PerformanceProfilerConfig>) {
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config };
    this.enabled = this.config.enabled;
  }

  // --- Frame timing ---

  /** Called at the start of a frame (before systems tick). */
  beginFrame(): void {
    if (!this.enabled) return;
    this.lastFrameStart = performance.now();
    this.currentFrameSystemTimes.clear();
  }

  /** Called at the end of a frame (after all systems tick). */
  endFrame(): void {
    if (!this.enabled) return;
    const frameTime = performance.now() - this.lastFrameStart;
    this.frameCount++;
    this.totalFrameTime += frameTime;
    if (frameTime > this.peakFrameTime) this.peakFrameTime = frameTime;
    if (frameTime > this.config.frameTimeWarningMs) this.slowFrameCount++;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.config.frameHistorySize) {
      this.frameTimes.shift();
    }
  }

  // --- System timing ---

  /**
   * Measure the execution time of a system's tick.
   * Call this around each system's tick method.
   */
  measureSystem(name: string, fn: () => void): void {
    if (!this.enabled || !this.config.trackSystemTiming) {
      fn();
      return;
    }
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    this.currentFrameSystemTimes.set(name, elapsed);

    let stats = this.systemStats.get(name);
    if (!stats) {
      stats = { name, totalTimeMs: 0, callCount: 0, avgTimeMs: 0, maxTimeMs: 0, lastTimeMs: 0 };
      this.systemStats.set(name, stats);
    }
    stats.totalTimeMs += elapsed;
    stats.callCount++;
    stats.avgTimeMs = stats.totalTimeMs / stats.callCount;
    if (elapsed > stats.maxTimeMs) stats.maxTimeMs = elapsed;
    stats.lastTimeMs = elapsed;
  }

  // --- Statistics ---

  /** Get current FPS (based on frame history). */
  getFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
  }

  /** Get average frame time in ms. */
  getAvgFrameTimeMs(): number {
    if (this.frameCount === 0) return 0;
    return this.totalFrameTime / this.frameCount;
  }

  /** Get peak frame time in ms. */
  getPeakFrameTimeMs(): number {
    return this.peakFrameTime;
  }

  /** Get number of slow frames (above warning threshold). */
  getSlowFrameCount(): number {
    return this.slowFrameCount;
  }

  /** Get total frame count. */
  getFrameCount(): number {
    return this.frameCount;
  }

  /** Get per-system performance statistics. */
  getSystemStats(): SystemPerformance[] {
    return Array.from(this.systemStats.values()).sort((a, b) => b.totalTimeMs - a.totalTimeMs);
  }

  /** Get the slowest systems (top N). */
  getSlowestSystems(n: number = 5): SystemPerformance[] {
    return this.getSystemStats().slice(0, n);
  }

  /** Get current frame's system times. */
  getCurrentFrameSystemTimes(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, time] of this.currentFrameSystemTimes) {
      result[name] = time;
    }
    return result;
  }

  /** Get a summary of performance statistics. */
  getSummary(): Record<string, unknown> {
    return {
      fps: this.getFPS(),
      avgFrameTimeMs: this.getAvgFrameTimeMs(),
      peakFrameTimeMs: this.getPeakFrameTimeMs(),
      frameCount: this.frameCount,
      slowFrameCount: this.slowFrameCount,
      slowFramePercentage: this.frameCount > 0 ? (this.slowFrameCount / this.frameCount) * 100 : 0,
      systemCount: this.systemStats.size,
      slowestSystems: this.getSlowestSystems(5).map(s => ({
        name: s.name,
        avgTimeMs: s.avgTimeMs,
        maxTimeMs: s.maxTimeMs,
        totalTimeMs: s.totalTimeMs,
      })),
    };
  }

  /** Reset all statistics. */
  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.totalFrameTime = 0;
    this.peakFrameTime = 0;
    this.slowFrameCount = 0;
    this.systemStats.clear();
    this.currentFrameSystemTimes.clear();
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.events = events;
    // The profiler is typically called by the WorldEngine directly,
    // but we implement tick for WorldSystem interface compliance.
  }

  stop(): void {
    this.events = null;
  }
}
