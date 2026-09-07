/**
 * Large Scale Simulation System - Type Definitions
 *
 * M14 Economic Foundation Layer - Phase 6
 *
 * Defines types for large-scale entity simulation, ECS architecture
 * evaluation, and performance benchmarking at scale.
 */

// Entity type for large-scale simulation
export enum LargeScaleEntityType {
  NPC = 'npc',
  BUILDING = 'building',
  RESOURCE_NODE = 'resource_node',
  ITEM = 'item',
  PROJECTILE = 'projectile',
  PARTICLE = 'particle',
  CIVILIZATION = 'civilization',
  CUSTOM = 'custom',
}

// Component type for ECS evaluation
export enum ECSComponentType {
  POSITION = 'position',
  VELOCITY = 'velocity',
  HEALTH = 'health',
  INVENTORY = 'inventory',
  AI = 'ai',
  RENDER = 'render',
  COLLISION = 'collision',
  ECONOMIC = 'economic',
  SOCIAL = 'social',
  CULTURAL = 'cultural',
  CUSTOM = 'custom',
}

// Benchmark scenario type
export enum BenchmarkScenarioType {
  ENTITY_CREATION = 'entity_creation',
  ENTITY_DESTRUCTION = 'entity_destruction',
  COMPONENT_UPDATE = 'component_update',
  SYSTEM_TICK = 'system_tick',
  QUERY = 'query',
  SERIALIZATION = 'serialization',
  MEMORY_ALLOCATION = 'memory_allocation',
  EVENT_DISPATCH = 'event_dispatch',
  FULL_SIMULATION = 'full_simulation',
  CUSTOM = 'custom',
}

// Entity in large-scale simulation
export interface LargeScaleEntity {
  id: string;
  type: LargeScaleEntityType;
  // Component IDs attached to this entity
  components: Set<ECSComponentType>;
  // Creation tick
  createdTick: number;
  // Whether entity is active
  isActive: boolean;
  // Custom data
  data?: Record<string, unknown>;
}

// Component data for ECS
export interface ECSComponent {
  type: ECSComponentType;
  // Entity IDs that have this component
  entityIds: Set<string>;
  // Component data per entity
  entityData: Map<string, Record<string, unknown>>;
  // Update count
  updateCount: number;
}

// Benchmark result for a single run
export interface BenchmarkResult {
  scenario: BenchmarkScenarioType;
  // Entity count tested
  entityCount: number;
  // Total time in ms
  totalTimeMs: number;
  // Average time per entity in microseconds
  avgTimePerEntityUs: number;
  // Operations per second
  operationsPerSecond: number;
  // Peak memory usage in MB (if available)
  peakMemoryMB?: number;
  // Number of iterations
  iterations: number;
  // Min time in ms
  minTimeMs: number;
  // Max time in ms
  maxTimeMs: number;
  // Standard deviation in ms
  stdDevMs: number;
  // Whether benchmark passed performance threshold
  passed: boolean;
  // Timestamp
  timestamp: number;
}

// Large scale simulation configuration
export interface LargeScaleSimulationConfig {
  // Maximum entities allowed
  maxEntities?: number;
  // Entity ID prefix
  entityIdPrefix?: string;
  // Whether to track memory usage
  trackMemory?: boolean;
  // Whether to enable detailed profiling
  detailedProfiling?: boolean;
  // Default entity batch size for creation
  defaultBatchSize?: number;
  // Performance thresholds (ms per 1000 entities)
  performanceThresholds?: Record<BenchmarkScenarioType, number>;
}

// Default configuration
export const DEFAULT_LARGE_SCALE_CONFIG: Required<LargeScaleSimulationConfig> = {
  maxEntities: 100000,
  entityIdPrefix: 'lse_',
  trackMemory: true,
  detailedProfiling: false,
  defaultBatchSize: 1000,
  performanceThresholds: {
    [BenchmarkScenarioType.ENTITY_CREATION]: 50,
    [BenchmarkScenarioType.ENTITY_DESTRUCTION]: 50,
    [BenchmarkScenarioType.COMPONENT_UPDATE]: 100,
    [BenchmarkScenarioType.SYSTEM_TICK]: 200,
    [BenchmarkScenarioType.QUERY]: 30,
    [BenchmarkScenarioType.SERIALIZATION]: 500,
    [BenchmarkScenarioType.MEMORY_ALLOCATION]: 100,
    [BenchmarkScenarioType.EVENT_DISPATCH]: 50,
    [BenchmarkScenarioType.FULL_SIMULATION]: 500,
    [BenchmarkScenarioType.CUSTOM]: 1000,
  },
};

// ECS architecture evaluation report
export interface ECSEvaluationReport {
  // Total entities evaluated
  totalEntities: number;
  // Total components
  totalComponents: number;
  // Average components per entity
  avgComponentsPerEntity: number;
  // Entity density per component type
  componentDensity: Record<ECSComponentType, number>;
  // Query performance (entities per ms)
  queryPerformance: number;
  // Update performance (entities per ms)
  updatePerformance: number;
  // Memory efficiency (entities per MB)
  memoryEfficiency: number;
  // Overall ECS score (0-100)
  overallScore: number;
  // Recommendations for improvement
  recommendations: string[];
  // Evaluation timestamp
  timestamp: number;
}

// Large scale simulation statistics
export interface LargeScaleSimulationStats {
  // Total entities created
  totalCreated: number;
  // Total entities destroyed
  totalDestroyed: number;
  // Current active entities
  activeEntities: number;
  // Entities by type
  entitiesByType: Record<LargeScaleEntityType, number>;
  // Total component updates
  totalComponentUpdates: number;
  // Total benchmarks run
  totalBenchmarks: number;
  // Benchmark history
  benchmarkHistory: BenchmarkResult[];
  // Peak entity count
  peakEntityCount: number;
  // Total simulation ticks
  totalTicks: number;
}
