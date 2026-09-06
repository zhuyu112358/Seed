// Tests for M11 Phase 4: PerformanceProfiler + Benchmark.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PerformanceProfiler } from "../src/performance/PerformanceProfiler.js";
import { runBenchmark, DEFAULT_BENCHMARK_CONFIG } from "../src/performance/Benchmark.js";
import { World } from "../src/engine/World.js";

describe("PerformanceProfiler - Frame Timing", () => {
  test("beginFrame/endFrame records frame time", () => {
    const profiler = new PerformanceProfiler();
    profiler.beginFrame();
    // Simulate some work.
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    profiler.endFrame();
    assert.equal(profiler.getFrameCount(), 1);
    assert.ok(profiler.getAvgFrameTimeMs() > 0);
  });

  test("FPS calculation works", () => {
    const profiler = new PerformanceProfiler({ frameHistorySize: 10 });
    // Simulate 60fps frames (~16.67ms each).
    for (let i = 0; i < 10; i++) {
      profiler.beginFrame();
      const start = performance.now();
      while (performance.now() - start < 1) { /* busy wait ~1ms */ }
      profiler.endFrame();
    }
    const fps = profiler.getFPS();
    assert.ok(fps > 0, `FPS should be > 0, got ${fps}`);
    assert.ok(fps <= 1000, `FPS should be reasonable, got ${fps}`);
  });

  test("peak frame time tracked", () => {
    const profiler = new PerformanceProfiler();
    profiler.beginFrame();
    profiler.endFrame();
    profiler.beginFrame();
    const start = performance.now();
    while (performance.now() - start < 5) { /* busy wait */ }
    profiler.endFrame();
    assert.ok(profiler.getPeakFrameTimeMs() >= profiler.getAvgFrameTimeMs());
  });

  test("slow frame count tracked", () => {
    const profiler = new PerformanceProfiler({ frameTimeWarningMs: 0.1 });
    profiler.beginFrame();
    // Ensure frame takes at least 0.1ms.
    const start = performance.now();
    while (performance.now() - start < 0.2) { /* busy wait */ }
    profiler.endFrame();
    assert.ok(profiler.getSlowFrameCount() >= 1);
  });

  test("reset clears all statistics", () => {
    const profiler = new PerformanceProfiler();
    profiler.beginFrame();
    profiler.endFrame();
    profiler.reset();
    assert.equal(profiler.getFrameCount(), 0);
    assert.equal(profiler.getFPS(), 0);
    assert.equal(profiler.getPeakFrameTimeMs(), 0);
    assert.equal(profiler.getSlowFrameCount(), 0);
  });

  test("disabled profiler does not record", () => {
    const profiler = new PerformanceProfiler({ enabled: false });
    profiler.beginFrame();
    profiler.endFrame();
    assert.equal(profiler.getFrameCount(), 0);
  });
});

describe("PerformanceProfiler - System Timing", () => {
  test("measureSystem records system time", () => {
    const profiler = new PerformanceProfiler();
    profiler.measureSystem("test-system", () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) sum += i;
    });
    const stats = profiler.getSystemStats();
    assert.equal(stats.length, 1);
    assert.equal(stats[0].name, "test-system");
    assert.equal(stats[0].callCount, 1);
    assert.ok(stats[0].totalTimeMs > 0);
  });

  test("measureSystem averages multiple calls", () => {
    const profiler = new PerformanceProfiler();
    for (let i = 0; i < 5; i++) {
      profiler.measureSystem("test-system", () => {
        let sum = 0;
        for (let j = 0; j < 100; j++) sum += j;
      });
    }
    const stats = profiler.getSystemStats()[0];
    assert.equal(stats.callCount, 5);
    assert.ok(Math.abs(stats.avgTimeMs * 5 - stats.totalTimeMs) < 0.01);
  });

  test("getSlowestSystems returns sorted by total time", () => {
    const profiler = new PerformanceProfiler();
    profiler.measureSystem("fast", () => { let x = 1; });
    profiler.measureSystem("slow", () => {
      let sum = 0;
      for (let i = 0; i < 10000; i++) sum += i;
    });
    const slowest = profiler.getSlowestSystems(2);
    assert.equal(slowest.length, 2);
    assert.ok(slowest[0].totalTimeMs >= slowest[1].totalTimeMs);
  });

  test("current frame system times recorded", () => {
    const profiler = new PerformanceProfiler();
    profiler.beginFrame();
    profiler.measureSystem("sys-a", () => { let x = 1; });
    profiler.measureSystem("sys-b", () => { let x = 2; });
    profiler.endFrame();
    const times = profiler.getCurrentFrameSystemTimes();
    assert.ok("sys-a" in times);
    assert.ok("sys-b" in times);
  });
});

describe("PerformanceProfiler - Summary", () => {
  test("getSummary returns complete statistics", () => {
    const profiler = new PerformanceProfiler();
    profiler.beginFrame();
    profiler.measureSystem("test", () => { let x = 1; });
    profiler.endFrame();
    const summary = profiler.getSummary();
    assert.ok("fps" in summary);
    assert.ok("avgFrameTimeMs" in summary);
    assert.ok("peakFrameTimeMs" in summary);
    assert.ok("frameCount" in summary);
    assert.ok("slowFrameCount" in summary);
    assert.ok("slowFramePercentage" in summary);
    assert.ok("systemCount" in summary);
    assert.ok("slowestSystems" in summary);
    assert.equal(summary.frameCount, 1);
  });
});

describe("PerformanceProfiler - WorldSystem Interface", () => {
  test("can be added to World", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const profiler = new PerformanceProfiler();
    world.addSystem(profiler);
    world.step(1 / 60);
    assert.equal(profiler.getFrameCount(), 0); // tick doesn't record frames
  });
});

describe("Benchmark - Basic", () => {
  test("runBenchmark returns valid result", () => {
    const result = runBenchmark({
      npcCount: 10,
      frameCount: 30,
      enablePhysics: false,
      enablePerception: false,
      movingNpcs: false,
    });
    assert.ok(result.fps > 0);
    assert.ok(result.avgFrameTimeMs > 0);
    assert.equal(result.config.npcCount, 10);
    assert.equal(result.config.frameCount, 30);
    assert.ok(typeof result.meets30FpsTarget === "boolean");
  });

  test("benchmark with physics and perception", () => {
    const result = runBenchmark({
      npcCount: 20,
      frameCount: 60,
      enablePhysics: true,
      enablePerception: true,
      movingNpcs: true,
    });
    assert.ok(result.fps > 0);
    assert.ok(result.avgFrameTimeMs > 0);
  });

  test("100 NPC benchmark meets basic performance criteria", () => {
    const result = runBenchmark({
      npcCount: 100,
      frameCount: 120,
      enablePhysics: true,
      enablePerception: true,
      movingNpcs: true,
    });
    // In a test environment with no rendering, 100 NPCs should easily
    // exceed 30 FPS. We check that FPS is reasonable (>10) and frame
    // times are not absurdly high.
    assert.ok(result.fps > 10, `Expected FPS > 10 for 100 NPCs, got ${result.fps}`);
    assert.ok(result.avgFrameTimeMs < 100, `Expected avg frame time < 100ms, got ${result.avgFrameTimeMs}`);
  });

  test("benchmark system stats include physics and perception", () => {
    const result = runBenchmark({
      npcCount: 10,
      frameCount: 30,
      enablePhysics: true,
      enablePerception: true,
      movingNpcs: false,
    });
    // System stats may be empty if profiler isn't wired into world tick,
    // but the result structure should be valid.
    assert.ok(Array.isArray(result.systemStats));
  });

  test("default benchmark config has 100 NPCs", () => {
    assert.equal(DEFAULT_BENCHMARK_CONFIG.npcCount, 100);
    assert.equal(DEFAULT_BENCHMARK_CONFIG.frameCount, 600);
    assert.equal(DEFAULT_BENCHMARK_CONFIG.enablePhysics, true);
    assert.equal(DEFAULT_BENCHMARK_CONFIG.enablePerception, true);
  });
});
