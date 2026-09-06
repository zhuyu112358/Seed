// Performance benchmark utility for M11 phase 4.
//
// Provides helpers to create worlds with many NPCs and measure
// frame time, FPS, and system performance. Used for benchmarking
// and verifying the 100+ NPC @ 30FPS performance target.

import { World } from "../engine/World.js";
import { GameObject } from "../entity/Entity.js";
import { Vector3 } from "../entity/Vector3.js";
import { PhysicsSystem } from "../physics/PhysicsSystem.js";
import { SoulPerceptionSystem } from "../entity/SoulPerceptionSystem.js";
import { PerformanceProfiler } from "./PerformanceProfiler.js";

/** Benchmark configuration. */
export interface BenchmarkConfig {
  /** Number of NPC entities to create. Default 100. */
  npcCount: number;
  /** World size (square). Default 1000. */
  worldSize: number;
  /** Number of frames to run. Default 600 (10 seconds at 60fps). */
  frameCount: number;
  /** Whether to enable physics. Default true. */
  enablePhysics: boolean;
  /** Whether to enable perception. Default true. */
  enablePerception: boolean;
  /** Whether NPCs move randomly. Default true. */
  movingNpcs: boolean;
}

/** Default benchmark configuration. */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  npcCount: 100,
  worldSize: 1000,
  frameCount: 600,
  enablePhysics: true,
  enablePerception: true,
  movingNpcs: true,
};

/** Benchmark result. */
export interface BenchmarkResult {
  config: BenchmarkConfig;
  fps: number;
  avgFrameTimeMs: number;
  peakFrameTimeMs: number;
  slowFrameCount: number;
  slowFramePercentage: number;
  meets30FpsTarget: boolean;
  systemStats: Array<{
    name: string;
    avgTimeMs: number;
    maxTimeMs: number;
    totalTimeMs: number;
  }>;
}

/**
 * Run a performance benchmark with the given configuration.
 * Creates a world with N NPCs and measures frame performance.
 */
export function runBenchmark(config?: Partial<BenchmarkConfig>): BenchmarkResult {
  const cfg: BenchmarkConfig = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
  const world = new World({ name: "benchmark", tickRate: 60 });
  const profiler = new PerformanceProfiler();

  if (cfg.enablePhysics) {
    world.addSystem(new PhysicsSystem());
  }
  if (cfg.enablePerception) {
    world.addSystem(new SoulPerceptionSystem());
  }

  // Create NPCs with random positions and velocities.
  const npcs: GameObject[] = [];
  for (let i = 0; i < cfg.npcCount; i++) {
    const npc = new GameObject({
      id: `npc_${i}`,
      type: "soul",
      name: `NPC ${i}`,
      position: {
        x: Math.random() * cfg.worldSize - cfg.worldSize / 2,
        y: 0,
        z: Math.random() * cfg.worldSize - cfg.worldSize / 2,
      },
    });
    if (cfg.movingNpcs) {
      npc.velocity = new Vector3(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2,
      );
    }
    world.addEntity(npc);
    npcs.push(npc);
  }

  // Run benchmark frames.
  const dt = 1 / 60;
  for (let frame = 0; frame < cfg.frameCount; frame++) {
    profiler.beginFrame();

    // Update NPC positions (simple movement).
    if (cfg.movingNpcs) {
      for (const npc of npcs) {
        let newX = npc.position.x + npc.velocity.x * dt;
        let newZ = npc.position.z + npc.velocity.z * dt;
        let velX = npc.velocity.x;
        let velZ = npc.velocity.z;
        // Bounce off world boundaries.
        const half = cfg.worldSize / 2;
        if (newX > half || newX < -half) { velX *= -1; newX = npc.position.x; }
        if (newZ > half || newZ < -half) { velZ *= -1; newZ = npc.position.z; }
        npc.position = new Vector3(newX, 0, newZ);
        npc.velocity = new Vector3(velX, 0, velZ);
      }
    }

    world.step(dt);
    profiler.endFrame();
  }

  const fps = profiler.getFPS();
  const result: BenchmarkResult = {
    config: cfg,
    fps,
    avgFrameTimeMs: profiler.getAvgFrameTimeMs(),
    peakFrameTimeMs: profiler.getPeakFrameTimeMs(),
    slowFrameCount: profiler.getSlowFrameCount(),
    slowFramePercentage: profiler.getFrameCount() > 0
      ? (profiler.getSlowFrameCount() / profiler.getFrameCount()) * 100
      : 0,
    meets30FpsTarget: fps >= 30,
    systemStats: profiler.getSlowestSystems(10).map(s => ({
      name: s.name,
      avgTimeMs: s.avgTimeMs,
      maxTimeMs: s.maxTimeMs,
      totalTimeMs: s.totalTimeMs,
    })),
  };

  return result;
}
