/**
 * Resource Production System - Type Definitions
 *
 * Defines types for the M14 economic foundation layer's
 * resource production subsystem. Handles production chains,
 * efficiency modifiers, producers, scheduling, and statistics.
 */

// Production process status
export enum ProductionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Producer type - what entity is performing production
export enum ProducerType {
  NPC = 'npc',
  BUILDING = 'building',
  WORKSHOP = 'workshop',
  FACTORY = 'factory',
  FARM = 'farm',
  MINE = 'mine',
  CUSTOM = 'custom',
}

// Efficiency modifier source
export enum EfficiencyModifierType {
  TECHNOLOGY = 'technology',
  BUILDING = 'building',
  WORKER_SKILL = 'worker_skill',
  TOOL_QUALITY = 'tool_quality',
  RESOURCE_QUALITY = 'resource_quality',
  ENVIRONMENT = 'environment',
  CULTURE = 'culture',
  SOCIAL = 'social',
  CUSTOM = 'custom',
}

// Production priority
export enum ProductionPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

// Input requirement for a production recipe
export interface ProductionInput {
  resourceTypeId: string;
  amount: number;
  // Optional: minimum quality threshold (0-100)
  minQuality?: number;
}

// Output from a production recipe
export interface ProductionOutput {
  resourceTypeId: string;
  amount: number;
  // Base quality of output (0-100), can be modified by efficiency
  baseQuality?: number;
}

// Efficiency modifier applied to production
export interface EfficiencyModifier {
  id: string;
  type: EfficiencyModifierType;
  name: string;
  // Multiplicative modifier (e.g., 1.2 = +20% efficiency, 0.8 = -20%)
  multiplier: number;
  // Optional: flat time reduction in ticks
  timeReduction?: number;
  // Optional: flat output bonus
  outputBonus?: number;
  // Optional: expiration tick (undefined = permanent)
  expiresAtTick?: number;
  description?: string;
}

// Production recipe - extends basic crafting with production-specific fields
export interface ProductionRecipe {
  id: string;
  name: string;
  description?: string;
  // Category for grouping and filtering
  category?: string;
  inputs: ProductionInput[];
  outputs: ProductionOutput[];
  // Base production time in ticks
  baseProductionTime: number;
  // Base efficiency (0.1 - 2.0, default 1.0)
  baseEfficiency?: number;
  // Required producer type
  requiredProducerType?: ProducerType;
  // Minimum worker skill required (0-100)
  minWorkerSkill?: number;
  // Whether this recipe can be batched (multiple units in one production run)
  supportsBatch?: boolean;
  // Maximum batch size
  maxBatchSize?: number;
  // Tags for searching/filtering
  tags?: string[];
}

// Active production job
export interface ProductionJob {
  id: string;
  recipeId: string;
  producerId: string;
  producerType: ProducerType;
  status: ProductionStatus;
  priority: ProductionPriority;
  // Batch size (how many times to run the recipe)
  batchSize: number;
  // Current progress (0-1) for the current batch unit
  progress: number;
  // Completed units in this batch
  completedUnits: number;
  // Total units to produce (batchSize)
  totalUnits: number;
  // Start tick
  startTick: number;
  // Expected completion tick (estimated)
  estimatedCompletionTick: number;
  // Actual completion tick
  completionTick?: number;
  // Applied efficiency modifiers
  appliedModifiers: EfficiencyModifier[];
  // Current effective efficiency (product of all modifiers * base efficiency)
  effectiveEfficiency: number;
  // Effective production time per unit (in ticks)
  effectiveProductionTime: number;
  // Worker IDs assigned to this job
  assignedWorkers: string[];
  // Failure reason if status = failed
  failureReason?: string;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Producer entity - tracks production capacity and modifiers
export interface Producer {
  id: string;
  type: ProducerType;
  name: string;
  // Maximum concurrent production jobs
  maxConcurrentJobs: number;
  // Current active jobs
  activeJobIds: string[];
  // Base efficiency for this producer
  baseEfficiency: number;
  // Worker skill level (0-100), average of assigned workers
  workerSkill: number;
  // Permanent efficiency modifiers for this producer
  permanentModifiers: EfficiencyModifier[];
  // Total production capacity (units per tick at 100% efficiency)
  productionCapacity: number;
  // Whether producer is currently active
  isActive: boolean;
  // Location (optional, for spatial production)
  location?: { x: number; y: number; z: number };
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Production statistics
export interface ProductionStats {
  // Total jobs created
  totalJobsCreated: number;
  // Total jobs completed
  totalJobsCompleted: number;
  // Total jobs failed
  totalJobsFailed: number;
  // Total jobs cancelled
  totalJobsCancelled: number;
  // Currently active jobs
  activeJobs: number;
  // Currently pending jobs
  pendingJobs: number;
  // Total units produced (all time)
  totalUnitsProduced: number;
  // Total resources consumed (all time)
  totalResourcesConsumed: number;
  // Average efficiency across all completed jobs
  averageEfficiency: number;
  // Average production time per unit (ticks)
  averageProductionTime: number;
  // Production by recipe (recipeId -> units produced)
  productionByRecipe: Record<string, number>;
  // Production by producer (producerId -> units produced)
  productionByProducer: Record<string, number>;
  // Resource consumption by type (resourceTypeId -> amount consumed)
  consumptionByResource: Record<string, number>;
  // Resource production by type (resourceTypeId -> amount produced)
  productionByResource: Record<string, number>;
  // Bottleneck analysis: recipes with highest failure/delay rates
  bottleneckRecipes: string[];
}

// Production system configuration
export interface ResourceProductionConfig {
  // Whether to automatically start pending jobs when capacity is available
  autoStartJobs?: boolean;
  // Whether to automatically assign workers to jobs
  autoAssignWorkers?: boolean;
  // Maximum number of jobs in the queue
  maxQueueSize?: number;
  // Default priority for new jobs
  defaultPriority?: ProductionPriority;
  // Whether to emit production events
  emitEvents?: boolean;
  // Tick interval for production progress (process every N ticks)
  processInterval?: number;
  // Maximum history size for statistics
  maxHistorySize?: number;
  // Whether to enable efficiency modifier system
  enableEfficiencyModifiers?: boolean;
}

// Default configuration
export const DEFAULT_RESOURCE_PRODUCTION_CONFIG: Required<ResourceProductionConfig> = {
  autoStartJobs: true,
  autoAssignWorkers: true,
  maxQueueSize: 1000,
  defaultPriority: ProductionPriority.NORMAL,
  emitEvents: true,
  processInterval: 1,
  maxHistorySize: 10000,
  enableEfficiencyModifiers: true,
};

// Production event types
export enum ProductionEventType {
  JOB_CREATED = 'production.job_created',
  JOB_STARTED = 'production.job_started',
  JOB_COMPLETED = 'production.job_completed',
  JOB_FAILED = 'production.job_failed',
  JOB_CANCELLED = 'production.job_cancelled',
  JOB_PAUSED = 'production.job_paused',
  JOB_RESUMED = 'production.job_resumed',
  UNIT_COMPLETED = 'production.unit_completed',
  EFFICIENCY_CHANGED = 'production.efficiency_changed',
  PRODUCER_REGISTERED = 'production.producer_registered',
  PRODUCER_UPDATED = 'production.producer_updated',
  MODIFIER_ADDED = 'production.modifier_added',
  MODIFIER_REMOVED = 'production.modifier_removed',
  BOTTLENECK_DETECTED = 'production.bottleneck_detected',
}

// Result of starting a production job
export interface ProductionStartResult {
  success: boolean;
  jobId?: string;
  reason?: string;
}

// Result of completing a production unit
export interface ProductionUnitResult {
  success: boolean;
  outputs?: ProductionOutput[];
  consumedInputs?: ProductionInput[];
  quality?: number;
  reason?: string;
}

// Production chain analysis result
export interface ProductionChainResult {
  recipeId: string;
  // Depth of the production chain (how many steps from raw materials)
  depth: number;
  // Total raw materials needed (recursively resolved)
  totalRawMaterials: ProductionInput[];
  // Intermediate products in the chain
  intermediateProducts: string[];
  // Total estimated production time (sum of all steps)
  totalEstimatedTime: number;
  // Whether the chain is fully resolvable (all sub-recipes exist)
  fullyResolvable: boolean;
  // Missing recipes in the chain
  missingRecipes: string[];
}

// Bottleneck analysis result
export interface BottleneckAnalysis {
  // Recipe ID with the highest delay/failure rate
  recipeId: string;
  // Severity score (0-100)
  severity: number;
  // Average delay in ticks (vs estimated time)
  averageDelay: number;
  // Failure rate (0-1)
  failureRate: number;
  // Number of jobs affected
  affectedJobs: number;
  // Suggested fix
  suggestion: string;
}
