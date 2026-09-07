// Performance module exports (M11 phase 4).
export type {
  SystemPerformance,
  FrameStats,
  PerformanceProfilerConfig,
} from "./PerformanceProfiler.js";
export { DEFAULT_PROFILER_CONFIG, PerformanceProfiler } from "./PerformanceProfiler.js";
export type { BenchmarkConfig, BenchmarkResult } from "./Benchmark.js";
export { DEFAULT_BENCHMARK_CONFIG, runBenchmark } from "./Benchmark.js";

// Large Scale Simulation (M14 Phase 6)
export type {
  LargeScaleEntity,
  ECSComponent,
  BenchmarkResult as LargeScaleBenchmarkResult,
  LargeScaleSimulationConfig,
  ECSEvaluationReport,
  LargeScaleSimulationStats,
} from "./LargeScaleSimulationTypes.js";
export {
  LargeScaleEntityType,
  ECSComponentType,
  BenchmarkScenarioType,
  DEFAULT_LARGE_SCALE_CONFIG,
} from "./LargeScaleSimulationTypes.js";
export { LargeScaleSimulationSystem } from "./LargeScaleSimulationSystem.js";
