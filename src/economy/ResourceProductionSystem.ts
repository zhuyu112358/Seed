/**
 * Resource Production System
 *
 * M14 Economic Foundation Layer - Phase 1
 *
 * Extends the M3 resource/crafting system with:
 * - Production chains (multi-step recipes)
 * - Efficiency modifiers (technology, building, worker skill, etc.)
 * - Producer entities (NPCs, buildings, workshops)
 * - Production scheduling (batch, queue, priority)
 * - Production statistics and bottleneck analysis
 *
 * This system does NOT replace CraftingSystem - it extends it with
 * production-specific capabilities. Basic crafting still works through
 * CraftingSystem; ResourceProductionSystem adds advanced production
 * management for economic simulation.
 */

import type { World } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Event } from '../event/Event.js';
import {
  ProductionStatus,
  ProducerType,
  EfficiencyModifierType,
  ProductionPriority,
  ProductionEventType,
  type ProductionInput,
  type ProductionOutput,
  type EfficiencyModifier,
  type ProductionRecipe,
  type ProductionJob,
  type Producer,
  type ProductionStats,
  type ResourceProductionConfig,
  DEFAULT_RESOURCE_PRODUCTION_CONFIG,
  type ProductionStartResult,
  type ProductionUnitResult,
  type ProductionChainResult,
  type BottleneckAnalysis,
} from './ResourceProductionTypes.js';

export class ResourceProductionSystem {
  readonly name = 'resource-production-system';
  enabled = true;

  private config: Required<ResourceProductionConfig>;
  private recipes: Map<string, ProductionRecipe> = new Map();
  private producers: Map<string, Producer> = new Map();
  private jobs: Map<string, ProductionJob> = new Map();
  private jobQueue: string[] = [];
  private stats: ProductionStats;
  private currentTick: number = 0;
  private processCounter: number = 0;
  private jobIdCounter: number = 0;
  private modifierIdCounter: number = 0;

  constructor(config?: ResourceProductionConfig) {
    this.config = { ...DEFAULT_RESOURCE_PRODUCTION_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }

  // ---------------------------------------------------------------------------
  // Recipe Management
  // ---------------------------------------------------------------------------

  registerRecipe(recipe: ProductionRecipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  getRecipe(recipeId: string): ProductionRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  getAllRecipes(): ProductionRecipe[] {
    return Array.from(this.recipes.values());
  }

  getRecipesByCategory(category: string): ProductionRecipe[] {
    return Array.from(this.recipes.values()).filter(r => r.category === category);
  }

  getRecipesByTag(tag: string): ProductionRecipe[] {
    return Array.from(this.recipes.values()).filter(r => r.tags?.includes(tag));
  }

  removeRecipe(recipeId: string): boolean {
    return this.recipes.delete(recipeId);
  }

  // ---------------------------------------------------------------------------
  // Producer Management
  // ---------------------------------------------------------------------------

  registerProducer(
    id: string,
    type: ProducerType,
    name: string,
    options?: Partial<Producer>
  ): Producer {
    const producer: Producer = {
      id,
      type,
      name,
      maxConcurrentJobs: options?.maxConcurrentJobs ?? 1,
      activeJobIds: [],
      baseEfficiency: options?.baseEfficiency ?? 1.0,
      workerSkill: options?.workerSkill ?? 50,
      permanentModifiers: options?.permanentModifiers ?? [],
      productionCapacity: options?.productionCapacity ?? 1.0,
      isActive: options?.isActive ?? true,
      location: options?.location,
      metadata: options?.metadata,
    };
    this.producers.set(id, producer);
    this.emitEvent(ProductionEventType.PRODUCER_REGISTERED, { producerId: id });
    return producer;
  }

  getProducer(producerId: string): Producer | undefined {
    return this.producers.get(producerId);
  }

  getAllProducers(): Producer[] {
    return Array.from(this.producers.values());
  }

  getActiveProducers(): Producer[] {
    return Array.from(this.producers.values()).filter(p => p.isActive);
  }

  updateProducer(producerId: string, updates: Partial<Producer>): boolean {
    const producer = this.producers.get(producerId);
    if (!producer) return false;
    Object.assign(producer, updates);
    this.emitEvent(ProductionEventType.PRODUCER_UPDATED, { producerId });
    return true;
  }

  setProducerActive(producerId: string, active: boolean): boolean {
    return this.updateProducer(producerId, { isActive: active });
  }

  addPermanentModifier(producerId: string, modifier: Omit<EfficiencyModifier, 'id'>): EfficiencyModifier | null {
    const producer = this.producers.get(producerId);
    if (!producer) return null;
    const fullModifier: EfficiencyModifier = {
      ...modifier,
      id: `mod_${++this.modifierIdCounter}`,
    };
    producer.permanentModifiers.push(fullModifier);
    this.emitEvent(ProductionEventType.MODIFIER_ADDED, { producerId, modifierId: fullModifier.id });
    return fullModifier;
  }

  removePermanentModifier(producerId: string, modifierId: string): boolean {
    const producer = this.producers.get(producerId);
    if (!producer) return false;
    const idx = producer.permanentModifiers.findIndex(m => m.id === modifierId);
    if (idx === -1) return false;
    producer.permanentModifiers.splice(idx, 1);
    this.emitEvent(ProductionEventType.MODIFIER_REMOVED, { producerId, modifierId });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Production Job Management
  // ---------------------------------------------------------------------------

  createJob(
    recipeId: string,
    producerId: string,
    options?: {
      batchSize?: number;
      priority?: ProductionPriority;
      workers?: string[];
      metadata?: Record<string, unknown>;
      events?: EventSystem | null;
    }
  ): ProductionStartResult {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return { success: false, reason: `Recipe not found: ${recipeId}` };
    }

    const producer = this.producers.get(producerId);
    if (!producer) {
      return { success: false, reason: `Producer not found: ${producerId}` };
    }

    if (!producer.isActive) {
      return { success: false, reason: `Producer is not active: ${producerId}` };
    }

    // Check producer type requirement
    if (recipe.requiredProducerType && recipe.requiredProducerType !== producer.type) {
      return {
        success: false,
        reason: `Producer type ${producer.type} does not match required type ${recipe.requiredProducerType}`,
      };
    }

    // Check worker skill requirement
    if (recipe.minWorkerSkill && producer.workerSkill < recipe.minWorkerSkill) {
      return {
        success: false,
        reason: `Worker skill ${producer.workerSkill} below minimum ${recipe.minWorkerSkill}`,
      };
    }

    const batchSize = options?.batchSize ?? 1;
    if (recipe.supportsBatch === false && batchSize > 1) {
      return { success: false, reason: 'Recipe does not support batch production' };
    }
    if (recipe.maxBatchSize && batchSize > recipe.maxBatchSize) {
      return { success: false, reason: `Batch size ${batchSize} exceeds maximum ${recipe.maxBatchSize}` };
    }

    // Check queue size
    if (this.jobQueue.length >= this.config.maxQueueSize) {
      return { success: false, reason: 'Job queue is full' };
    }

    const jobId = `job_${++this.jobIdCounter}`;
    const effectiveEfficiency = this.calculateEffectiveEfficiency(recipe, producer);
    const effectiveProductionTime = Math.max(1, Math.round(recipe.baseProductionTime / effectiveEfficiency));

    const job: ProductionJob = {
      id: jobId,
      recipeId,
      producerId,
      producerType: producer.type,
      status: ProductionStatus.PENDING,
      priority: options?.priority ?? this.config.defaultPriority,
      batchSize,
      progress: 0,
      completedUnits: 0,
      totalUnits: batchSize,
      startTick: this.currentTick,
      estimatedCompletionTick: this.currentTick + effectiveProductionTime * batchSize,
      appliedModifiers: this.getActiveModifiers(producer),
      effectiveEfficiency,
      effectiveProductionTime,
      assignedWorkers: options?.workers ?? [],
      metadata: options?.metadata,
    };

    this.jobs.set(jobId, job);
    this.jobQueue.push(jobId);
    this.stats.totalJobsCreated++;

    this.emitEvent(ProductionEventType.JOB_CREATED, { jobId, recipeId, producerId }, options?.events);

    // Auto-start if configured and capacity available
    if (this.config.autoStartJobs) {
      this.tryStartJob(jobId, options?.events);
    }

    return { success: true, jobId };
  }

  private tryStartJob(jobId: string, events?: EventSystem | null): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== ProductionStatus.PENDING) return false;

    const producer = this.producers.get(job.producerId);
    if (!producer || !producer.isActive) return false;

    // Check concurrent job limit
    if (producer.activeJobIds.length >= producer.maxConcurrentJobs) return false;

    // Check input availability (consume inputs)
    // Note: In a full integration, this would check against ResourceInventory.
    // For now, we assume inputs are available (inventory integration can be added).

    job.status = ProductionStatus.ACTIVE;
    producer.activeJobIds.push(jobId);

    this.emitEvent(ProductionEventType.JOB_STARTED, { jobId, recipeId: job.recipeId, producerId: job.producerId }, events);
    return true;
  }

  startJob(jobId: string): boolean {
    return this.tryStartJob(jobId);
  }

  pauseJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== ProductionStatus.ACTIVE) return false;
    job.status = ProductionStatus.PAUSED;
    this.emitEvent(ProductionEventType.JOB_PAUSED, { jobId });
    return true;
  }

  resumeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== ProductionStatus.PAUSED) return false;
    job.status = ProductionStatus.ACTIVE;
    this.emitEvent(ProductionEventType.JOB_RESUMED, { jobId });
    return true;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (job.status === ProductionStatus.COMPLETED || job.status === ProductionStatus.CANCELLED) {
      return false;
    }

    const producer = this.producers.get(job.producerId);
    if (producer) {
      const idx = producer.activeJobIds.indexOf(jobId);
      if (idx !== -1) producer.activeJobIds.splice(idx, 1);
    }

    job.status = ProductionStatus.CANCELLED;
    this.stats.totalJobsCancelled++;
    this.removeFromQueue(jobId);
    this.emitEvent(ProductionEventType.JOB_CANCELLED, { jobId });
    return true;
  }

  getJob(jobId: string): ProductionJob | undefined {
    return this.jobs.get(jobId);
  }

  getJobsByProducer(producerId: string): ProductionJob[] {
    return Array.from(this.jobs.values()).filter(j => j.producerId === producerId);
  }

  getActiveJobs(): ProductionJob[] {
    return Array.from(this.jobs.values()).filter(j => j.status === ProductionStatus.ACTIVE);
  }

  getPendingJobs(): ProductionJob[] {
    return Array.from(this.jobs.values()).filter(j => j.status === ProductionStatus.PENDING);
  }

  getCompletedJobs(limit?: number): ProductionJob[] {
    const completed = Array.from(this.jobs.values()).filter(j => j.status === ProductionStatus.COMPLETED);
    return limit ? completed.slice(-limit) : completed;
  }

  getJobQueue(): string[] {
    return [...this.jobQueue];
  }

  // ---------------------------------------------------------------------------
  // Efficiency Calculation
  // ---------------------------------------------------------------------------

  private calculateEffectiveEfficiency(recipe: ProductionRecipe, producer: Producer): number {
    if (!this.config.enableEfficiencyModifiers) {
      return recipe.baseEfficiency ?? 1.0;
    }

    let efficiency = recipe.baseEfficiency ?? 1.0;
    efficiency *= producer.baseEfficiency;

    // Worker skill modifier (0-100 skill -> 0.5-1.5 multiplier)
    const skillMultiplier = 0.5 + (producer.workerSkill / 100);
    efficiency *= skillMultiplier;

    // Permanent modifiers
    for (const modifier of producer.permanentModifiers) {
      if (modifier.expiresAtTick && modifier.expiresAtTick < this.currentTick) continue;
      efficiency *= modifier.multiplier;
    }

    // Clamp to reasonable range
    return Math.max(0.1, Math.min(5.0, efficiency));
  }

  private getActiveModifiers(producer: Producer): EfficiencyModifier[] {
    return producer.permanentModifiers.filter(
      m => !m.expiresAtTick || m.expiresAtTick >= this.currentTick
    );
  }

  recalculateJobEfficiency(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    const recipe = this.recipes.get(job.recipeId);
    const producer = this.producers.get(job.producerId);
    if (!recipe || !producer) return false;

    const oldEfficiency = job.effectiveEfficiency;
    job.effectiveEfficiency = this.calculateEffectiveEfficiency(recipe, producer);
    job.effectiveProductionTime = Math.max(1, Math.round(recipe.baseProductionTime / job.effectiveEfficiency));
    job.appliedModifiers = this.getActiveModifiers(producer);

    if (oldEfficiency !== job.effectiveEfficiency) {
      this.emitEvent(ProductionEventType.EFFICIENCY_CHANGED, {
        jobId,
        oldEfficiency,
        newEfficiency: job.effectiveEfficiency,
      });
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Production Chain Analysis
  // ---------------------------------------------------------------------------

  // Helper: find recipe that produces a given resource type
  private findRecipeByOutput(resourceTypeId: string): ProductionRecipe | undefined {
    return Array.from(this.recipes.values()).find(
      r => r.outputs.some(o => o.resourceTypeId === resourceTypeId)
    );
  }

  analyzeProductionChain(recipeId: string, maxDepth: number = 10): ProductionChainResult {
    const visited = new Set<string>();
    const rawMaterials: ProductionInput[] = [];
    const intermediateProducts: string[] = [];
    let totalTime = 0;
    let depth = 0;
    const missingRecipes: string[] = [];

    // Start from the recipe ID (which may be a recipe ID or an output resource ID)
    const startRecipe = this.recipes.get(recipeId) ?? this.findRecipeByOutput(recipeId);

    const resolve = (resourceId: string, currentDepth: number): boolean => {
      if (currentDepth > maxDepth) return false;
      if (visited.has(resourceId)) return true;
      visited.add(resourceId);

      // Find recipe that produces this resource
      const recipe = this.recipes.get(resourceId) ?? this.findRecipeByOutput(resourceId);
      if (!recipe) {
        // Check if this resource is an output of any recipe (intermediate product)
        const isIntermediate = Array.from(this.recipes.values()).some(
          r => r.outputs.some(o => o.resourceTypeId === resourceId)
        );
        if (isIntermediate) {
          if (!missingRecipes.includes(resourceId)) {
            missingRecipes.push(resourceId);
          }
        } else {
          // Raw material (no recipe produces it)
          const existing = rawMaterials.find(m => m.resourceTypeId === resourceId);
          if (existing) {
            existing.amount += 1; // Default amount if not from a specific input
          } else {
            rawMaterials.push({ resourceTypeId: resourceId, amount: 1 });
          }
        }
        return !isIntermediate;
      }

      depth = Math.max(depth, currentDepth);
      totalTime += recipe.baseProductionTime;

      for (const input of recipe.inputs) {
        const inputRecipe = this.recipes.get(input.resourceTypeId) ?? this.findRecipeByOutput(input.resourceTypeId);
        if (inputRecipe) {
          if (!intermediateProducts.includes(input.resourceTypeId)) {
            intermediateProducts.push(input.resourceTypeId);
          }
          resolve(input.resourceTypeId, currentDepth + 1);
        } else {
          // Check if this input is an intermediate product (output of some recipe)
          const isIntermediate = Array.from(this.recipes.values()).some(
            r => r.outputs.some(o => o.resourceTypeId === input.resourceTypeId)
          );
          if (isIntermediate) {
            if (!missingRecipes.includes(input.resourceTypeId)) {
              missingRecipes.push(input.resourceTypeId);
            }
          } else {
            // Raw material
            const existing = rawMaterials.find(m => m.resourceTypeId === input.resourceTypeId);
            if (existing) {
              existing.amount += input.amount;
            } else {
              rawMaterials.push({ ...input });
            }
          }
        }
      }
      return true;
    };

    let fullyResolvable = true;
    if (startRecipe) {
      fullyResolvable = resolve(startRecipe.id, 0);
    } else {
      missingRecipes.push(recipeId);
      fullyResolvable = false;
    }

    return {
      recipeId,
      depth,
      totalRawMaterials: rawMaterials,
      intermediateProducts,
      totalEstimatedTime: totalTime,
      fullyResolvable,
      missingRecipes,
    };
  }

  // ---------------------------------------------------------------------------
  // Statistics and Bottleneck Analysis
  // ---------------------------------------------------------------------------

  getStats(): ProductionStats {
    return { ...this.stats };
  }

  analyzeBottlenecks(topN: number = 5): BottleneckAnalysis[] {
    const recipeStats: Map<string, { total: number; failed: number; totalDelay: number; completed: number }> = new Map();

    for (const job of this.jobs.values()) {
      if (!recipeStats.has(job.recipeId)) {
        recipeStats.set(job.recipeId, { total: 0, failed: 0, totalDelay: 0, completed: 0 });
      }
      const stats = recipeStats.get(job.recipeId)!;
      stats.total++;
      if (job.status === ProductionStatus.FAILED) stats.failed++;
      if (job.status === ProductionStatus.COMPLETED) {
        stats.completed++;
        if (job.completionTick && job.estimatedCompletionTick) {
          stats.totalDelay += Math.max(0, job.completionTick - job.estimatedCompletionTick);
        }
      }
    }

    const bottlenecks: BottleneckAnalysis[] = [];
    for (const [recipeId, stats] of recipeStats) {
      if (stats.total < 3) continue; // Need enough data
      const failureRate = stats.failed / stats.total;
      const averageDelay = stats.completed > 0 ? stats.totalDelay / stats.completed : 0;
      const severity = Math.min(100, (failureRate * 50) + (averageDelay / 100) * 50);

      if (severity > 10) {
        bottlenecks.push({
          recipeId,
          severity,
          averageDelay,
          failureRate,
          affectedJobs: stats.total,
          suggestion: this.generateBottleneckSuggestion(recipeId, failureRate, averageDelay),
        });
      }
    }

    return bottlenecks.sort((a, b) => b.severity - a.severity).slice(0, topN);
  }

  private generateBottleneckSuggestion(recipeId: string, failureRate: number, averageDelay: number): string {
    const recipe = this.recipes.get(recipeId);
    const name = recipe?.name ?? recipeId;

    if (failureRate > 0.3) {
      return `High failure rate for ${name}. Check input availability and producer skill level.`;
    }
    if (averageDelay > 50) {
      return `Significant delays for ${name}. Consider increasing producer efficiency or adding more producers.`;
    }
    return `Minor bottleneck for ${name}. Monitor production efficiency and input supply.`;
  }

  // ---------------------------------------------------------------------------
  // Tick / Update
  // ---------------------------------------------------------------------------

  tick(_dt: number, _world: World | null, events: EventSystem | null): void {
    if (!this.enabled) return;
    this.currentTick++;
    this.processCounter++;

    if (this.processCounter < this.config.processInterval) return;
    this.processCounter = 0;

    // Process active jobs
    for (const job of this.jobs.values()) {
      if (job.status !== ProductionStatus.ACTIVE) continue;
      this.processJob(job, events);
    }

    // Sort queue by priority (higher priority first) - always sort
    this.jobQueue.sort((a, b) => {
      const jobA = this.jobs.get(a);
      const jobB = this.jobs.get(b);
      if (!jobA || !jobB) return 0;
      return jobB.priority - jobA.priority;
    });

    // Try to start pending jobs
    if (this.config.autoStartJobs) {
      for (const jobId of [...this.jobQueue]) {
        this.tryStartJob(jobId, events);
      }
    }

    // Clean up old completed/failed jobs (keep history within maxHistorySize)
    this.cleanupOldJobs();
  }

  private processJob(job: ProductionJob, events: EventSystem | null): void {
    job.progress += 1 / job.effectiveProductionTime;

    if (job.progress >= 1) {
      job.progress = 0;
      job.completedUnits++;

      // Produce outputs for this unit
      const result = this.completeProductionUnit(job);

      if (result.success) {
        this.stats.totalUnitsProduced += job.batchSize;
        this.updateProductionStats(job, result);
        this.emitEvent(ProductionEventType.UNIT_COMPLETED, {
          jobId: job.id,
          unitNumber: job.completedUnits,
          outputs: result.outputs,
        }, events);
      } else {
        // Unit failed
        job.status = ProductionStatus.FAILED;
        job.failureReason = result.reason ?? 'Unknown production failure';
        this.stats.totalJobsFailed++;
        this.removeFromQueue(job.id);
        const producer = this.producers.get(job.producerId);
        if (producer) {
          const idx = producer.activeJobIds.indexOf(job.id);
          if (idx !== -1) producer.activeJobIds.splice(idx, 1);
        }
        this.emitEvent(ProductionEventType.JOB_FAILED, {
          jobId: job.id,
          reason: job.failureReason,
        }, events);
        return;
      }

      // Check if batch is complete
      if (job.completedUnits >= job.totalUnits) {
        job.status = ProductionStatus.COMPLETED;
        job.completionTick = this.currentTick;
        this.stats.totalJobsCompleted++;
        this.removeFromQueue(job.id);
        const producer = this.producers.get(job.producerId);
        if (producer) {
          const idx = producer.activeJobIds.indexOf(job.id);
          if (idx !== -1) producer.activeJobIds.splice(idx, 1);
        }
        this.emitEvent(ProductionEventType.JOB_COMPLETED, {
          jobId: job.id,
          recipeId: job.recipeId,
          producerId: job.producerId,
          totalUnits: job.completedUnits,
        }, events);
      }
    }
  }

  private completeProductionUnit(job: ProductionJob): ProductionUnitResult {
    const recipe = this.recipes.get(job.recipeId);
    if (!recipe) {
      return { success: false, reason: 'Recipe not found' };
    }

    // Calculate output quality based on efficiency
    const baseQuality = recipe.outputs[0]?.baseQuality ?? 50;
    const quality = Math.min(100, Math.round(baseQuality * job.effectiveEfficiency));

    // In a full integration, inputs would be consumed from ResourceInventory
    // and outputs would be added to ResourceInventory.
    // For now, we return the theoretical inputs/outputs.

    return {
      success: true,
      outputs: recipe.outputs.map(o => ({ ...o })),
      consumedInputs: recipe.inputs.map(i => ({ ...i })),
      quality,
    };
  }

  private updateProductionStats(job: ProductionJob, result: ProductionUnitResult): void {
    // Update production by recipe
    this.stats.productionByRecipe[job.recipeId] =
      (this.stats.productionByRecipe[job.recipeId] ?? 0) + 1;

    // Update production by producer
    this.stats.productionByProducer[job.producerId] =
      (this.stats.productionByProducer[job.producerId] ?? 0) + 1;

    // Update resource stats
    if (result.outputs) {
      for (const output of result.outputs) {
        this.stats.productionByResource[output.resourceTypeId] =
          (this.stats.productionByResource[output.resourceTypeId] ?? 0) + output.amount;
      }
    }
    if (result.consumedInputs) {
      for (const input of result.consumedInputs) {
        this.stats.consumptionByResource[input.resourceTypeId] =
          (this.stats.consumptionByResource[input.resourceTypeId] ?? 0) + input.amount;
        this.stats.totalResourcesConsumed += input.amount;
      }
    }

    // Update average efficiency
    const totalCompleted = this.stats.totalJobsCompleted;
    if (totalCompleted > 0) {
      this.stats.averageEfficiency =
        ((this.stats.averageEfficiency * (totalCompleted - 1)) + job.effectiveEfficiency) / totalCompleted;
      this.stats.averageProductionTime =
        ((this.stats.averageProductionTime * (totalCompleted - 1)) + job.effectiveProductionTime) / totalCompleted;
    }
  }

  private removeFromQueue(jobId: string): void {
    const idx = this.jobQueue.indexOf(jobId);
    if (idx !== -1) this.jobQueue.splice(idx, 1);
  }

  private cleanupOldJobs(): void {
    const completedJobs = Array.from(this.jobs.values()).filter(
      j => j.status === ProductionStatus.COMPLETED || j.status === ProductionStatus.FAILED
    );
    if (completedJobs.length > this.config.maxHistorySize) {
      const toRemove = completedJobs
        .sort((a, b) => (a.completionTick ?? 0) - (b.completionTick ?? 0))
        .slice(0, completedJobs.length - this.config.maxHistorySize);
      for (const job of toRemove) {
        this.jobs.delete(job.id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private emitEvent(type: ProductionEventType, payload: Record<string, unknown>, events?: EventSystem | null): void {
    if (!this.config.emitEvents) return;
    if (events) {
      const event = new Event({
        type,
        payload,
        sourceId: this.name,
      });
      events.emit(event);
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      recipes: Array.from(this.recipes.values()),
      producers: Array.from(this.producers.values()),
      jobs: Array.from(this.jobs.values()),
      jobQueue: this.jobQueue,
      stats: this.stats,
      currentTick: this.currentTick,
      jobIdCounter: this.jobIdCounter,
      modifierIdCounter: this.modifierIdCounter,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config) this.config = { ...DEFAULT_RESOURCE_PRODUCTION_CONFIG, ...(data.config as object) };
    if (data.recipes) {
      this.recipes = new Map((data.recipes as ProductionRecipe[]).map(r => [r.id, r]));
    }
    if (data.producers) {
      this.producers = new Map((data.producers as Producer[]).map(p => [p.id, p]));
    }
    if (data.jobs) {
      this.jobs = new Map((data.jobs as ProductionJob[]).map(j => [j.id, j]));
    }
    if (data.jobQueue) this.jobQueue = data.jobQueue as string[];
    if (data.stats) this.stats = data.stats as ProductionStats;
    if (typeof data.currentTick === 'number') this.currentTick = data.currentTick;
    if (typeof data.jobIdCounter === 'number') this.jobIdCounter = data.jobIdCounter;
    if (typeof data.modifierIdCounter === 'number') this.modifierIdCounter = data.modifierIdCounter;
  }

  private createEmptyStats(): ProductionStats {
    return {
      totalJobsCreated: 0,
      totalJobsCompleted: 0,
      totalJobsFailed: 0,
      totalJobsCancelled: 0,
      activeJobs: 0,
      pendingJobs: 0,
      totalUnitsProduced: 0,
      totalResourcesConsumed: 0,
      averageEfficiency: 0,
      averageProductionTime: 0,
      productionByRecipe: {},
      productionByProducer: {},
      consumptionByResource: {},
      productionByResource: {},
      bottleneckRecipes: [],
    };
  }

  // Update active/pending counts in stats
  updateStatsCounts(): void {
    this.stats.activeJobs = this.getActiveJobs().length;
    this.stats.pendingJobs = this.getPendingJobs().length;
  }
}
