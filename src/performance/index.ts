// Performance module exports (M11 phase 4).
export type {
  SystemPerformance,
  FrameStats,
  PerformanceProfilerConfig,
} from "./PerformanceProfiler.js";
export { DEFAULT_PROFILER_CONFIG, PerformanceProfiler } from "./PerformanceProfiler.js";
export type { BenchmarkConfig, BenchmarkResult } from "./Benchmark.js";
export { DEFAULT_BENCHMARK_CONFIG, runBenchmark } from "./Benchmark.js";
