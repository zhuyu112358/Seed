/**
 * Large Scale Simulation System
 *
 * M14 Economic Foundation Layer - Phase 6
 *
 * Provides large-scale entity simulation, ECS architecture evaluation,
 * and performance benchmarking at scale. Used for performance optimization
 * and大规模验证.
 */

import type { World } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import {
  LargeScaleEntityType,
  ECSComponentType,
  BenchmarkScenarioType,
  type LargeScaleEntity,
  type ECSComponent,
  type BenchmarkResult,
  type LargeScaleSimulationConfig,
  DEFAULT_LARGE_SCALE_CONFIG,
  type ECSEvaluationReport,
  type LargeScaleSimulationStats,
} from './LargeScaleSimulationTypes.js';

export class LargeScaleSimulationSystem {
  readonly name = 'large-scale-simulation-system';
  enabled = true;

  private config: Required<LargeScaleSimulationConfig>;
  private entities: Map<string, LargeScaleEntity> = new Map();
  private components: Map<ECSComponentType, ECSComponent> = new Map();
  private entityIdCounter: number = 0;
  private stats: LargeScaleSimulationStats;
  private currentTick: number = 0;

  constructor(config?: LargeScaleSimulationConfig) {
    this.config = { ...DEFAULT_LARGE_SCALE_CONFIG, ...config };
    this.stats = this.createEmptyStats();
    this.initializeComponents();
  }

  // ---------------------------------------------------------------------------
  // Component Initialization
  // ---------------------------------------------------------------------------

  private initializeComponents(): void {
    for (const type of Object.values(ECSComponentType)) {
      this.components.set(type, {
        type,
        entityIds: new Set<string>(),
        entityData: new Map<string, Record<string, unknown>>(),
        updateCount: 0,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Entity Management
  // ---------------------------------------------------------------------------

  createEntity(
    type: LargeScaleEntityType,
    components?: ECSComponentType[],
    data?: Record<string, unknown>
  ): LargeScaleEntity {
    const id = `${this.config.entityIdPrefix}${++this.entityIdCounter}`;
    const entity: LargeScaleEntity = {
      id,
      type,
      components: new Set(components ?? []),
      createdTick: this.currentTick,
      isActive: true,
      data,
    };

    this.entities.set(id, entity);
    this.stats.totalCreated++;
    this.stats.activeEntities++;
    this.stats.peakEntityCount = Math.max(this.stats.peakEntityCount, this.stats.activeEntities);
    this.stats.entitiesByType[type]++;

    // Attach components
    for (const compType of entity.components) {
      this.attachComponent(id, compType);
    }

    return entity;
  }

  createEntitiesBatch(
    count: number,
    type: LargeScaleEntityType,
    components?: ECSComponentType[]
  ): LargeScaleEntity[] {
    const entities: LargeScaleEntity[] = [];
    for (let i = 0; i < count; i++) {
      entities.push(this.createEntity(type, components));
    }
    return entities;
  }

  destroyEntity(entityId: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    // Detach all components
    for (const compType of entity.components) {
      this.detachComponent(entityId, compType);
    }

    this.entities.delete(entityId);
    this.stats.totalDestroyed++;
    this.stats.activeEntities--;
    this.stats.entitiesByType[entity.type]--;

    return true;
  }

  destroyEntitiesBatch(entityIds: string[]): number {
    let destroyed = 0;
    for (const id of entityIds) {
      if (this.destroyEntity(id)) destroyed++;
    }
    return destroyed;
  }

  getEntity(entityId: string): LargeScaleEntity | undefined {
    return this.entities.get(entityId);
  }

  getAllEntities(): LargeScaleEntity[] {
    return Array.from(this.entities.values());
  }

  getActiveEntities(): LargeScaleEntity[] {
    return Array.from(this.entities.values()).filter(e => e.isActive);
  }

  getEntitiesByType(type: LargeScaleEntityType): LargeScaleEntity[] {
    return Array.from(this.entities.values()).filter(e => e.type === type);
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  // ---------------------------------------------------------------------------
  // Component Management
  // ---------------------------------------------------------------------------

  attachComponent(entityId: string, componentType: ECSComponentType): boolean {
    const entity = this.entities.get(entityId);
    const component = this.components.get(componentType);
    if (!entity || !component) return false;

    entity.components.add(componentType);
    component.entityIds.add(entityId);
    component.entityData.set(entityId, {});

    return true;
  }

  detachComponent(entityId: string, componentType: ECSComponentType): boolean {
    const entity = this.entities.get(entityId);
    const component = this.components.get(componentType);
    if (!entity || !component) return false;

    entity.components.delete(componentType);
    component.entityIds.delete(entityId);
    component.entityData.delete(entityId);

    return true;
  }

  updateComponentData(
    entityId: string,
    componentType: ECSComponentType,
    data: Record<string, unknown>
  ): boolean {
    const component = this.components.get(componentType);
    if (!component || !component.entityIds.has(entityId)) return false;

    const existing = component.entityData.get(entityId) ?? {};
    component.entityData.set(entityId, { ...existing, ...data });
    component.updateCount++;
    this.stats.totalComponentUpdates++;

    return true;
  }

  getComponentData(
    entityId: string,
    componentType: ECSComponentType
  ): Record<string, unknown> | undefined {
    return this.components.get(componentType)?.entityData.get(entityId);
  }

  getEntitiesWithComponent(componentType: ECSComponentType): string[] {
    return Array.from(this.components.get(componentType)?.entityIds ?? []);
  }

  getEntitiesWithAllComponents(componentTypes: ECSComponentType[]): string[] {
    if (componentTypes.length === 0) return [];

    let result: Set<string> | null = null;
    for (const compType of componentTypes) {
      const entityIds = this.components.get(compType)?.entityIds;
      if (!entityIds) return [];
      if (!result) {
        result = new Set<string>(entityIds);
      } else {
        const current = result as Set<string>;
        result = new Set<string>([...current].filter((id: string) => entityIds.has(id)));
      }
    }
    return result ? Array.from(result) : [];
  }

  // ---------------------------------------------------------------------------
  // Benchmarking
  // ---------------------------------------------------------------------------

  runBenchmark(
    scenario: BenchmarkScenarioType,
    entityCount: number,
    iterations: number = 5
  ): BenchmarkResult {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      this.executeBenchmarkScenario(scenario, entityCount);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const totalTimeMs = times.reduce((a, b) => a + b, 0);
    const avgTimeMs = totalTimeMs / iterations;
    const minTimeMs = Math.min(...times);
    const maxTimeMs = Math.max(...times);
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTimeMs, 2), 0) / iterations;
    const stdDevMs = Math.sqrt(variance);

    const result: BenchmarkResult = {
      scenario,
      entityCount,
      totalTimeMs,
      avgTimePerEntityUs: (avgTimeMs / Math.max(1, entityCount)) * 1000,
      operationsPerSecond: entityCount > 0 ? (entityCount * iterations) / (totalTimeMs / 1000) : 0,
      iterations,
      minTimeMs,
      maxTimeMs,
      stdDevMs,
      passed: avgTimeMs <= this.config.performanceThresholds[scenario],
      timestamp: Date.now(),
    };

    if (this.config.trackMemory && typeof process !== 'undefined' && process.memoryUsage) {
      result.peakMemoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    }

    this.stats.totalBenchmarks++;
    this.stats.benchmarkHistory.push(result);

    // Keep only last 100 benchmark results
    if (this.stats.benchmarkHistory.length > 100) {
      this.stats.benchmarkHistory = this.stats.benchmarkHistory.slice(-100);
    }

    return result;
  }

  private executeBenchmarkScenario(scenario: BenchmarkScenarioType, entityCount: number): void {
    switch (scenario) {
      case BenchmarkScenarioType.ENTITY_CREATION:
        this.benchmarkEntityCreation(entityCount);
        break;
      case BenchmarkScenarioType.ENTITY_DESTRUCTION:
        this.benchmarkEntityDestruction(entityCount);
        break;
      case BenchmarkScenarioType.COMPONENT_UPDATE:
        this.benchmarkComponentUpdate(entityCount);
        break;
      case BenchmarkScenarioType.QUERY:
        this.benchmarkQuery(entityCount);
        break;
      case BenchmarkScenarioType.SERIALIZATION:
        this.benchmarkSerialization(entityCount);
        break;
      case BenchmarkScenarioType.SYSTEM_TICK:
        this.benchmarkSystemTick(entityCount);
        break;
      case BenchmarkScenarioType.EVENT_DISPATCH:
        this.benchmarkEventDispatch(entityCount);
        break;
      case BenchmarkScenarioType.FULL_SIMULATION:
        this.benchmarkFullSimulation(entityCount);
        break;
      default:
        break;
    }
  }

  private benchmarkEntityCreation(count: number): void {
    for (let i = 0; i < count; i++) {
      this.createEntity(LargeScaleEntityType.NPC, [
        ECSComponentType.POSITION,
        ECSComponentType.HEALTH,
        ECSComponentType.AI,
      ]);
    }
  }

  private benchmarkEntityDestruction(count: number): void {
    const entities = this.getActiveEntities().slice(0, count);
    for (const entity of entities) {
      this.destroyEntity(entity.id);
    }
  }

  private benchmarkComponentUpdate(count: number): void {
    const entities = this.getActiveEntities().slice(0, count);
    for (const entity of entities) {
      this.updateComponentData(entity.id, ECSComponentType.POSITION, {
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      });
    }
  }

  private benchmarkQuery(count: number): void {
    for (let i = 0; i < count; i++) {
      this.getEntitiesWithAllComponents([
        ECSComponentType.POSITION,
        ECSComponentType.HEALTH,
        ECSComponentType.AI,
      ]);
    }
  }

  private benchmarkSerialization(count: number): void {
    // Simulate serialization by iterating entities
    const entities = this.getActiveEntities().slice(0, count);
    for (const entity of entities) {
      JSON.stringify({
        id: entity.id,
        type: entity.type,
        components: Array.from(entity.components),
      });
    }
  }

  private benchmarkSystemTick(count: number): void {
    const entities = this.getActiveEntities().slice(0, count);
    for (const entity of entities) {
      // Simulate system tick by updating position
      const pos = this.getComponentData(entity.id, ECSComponentType.POSITION) ?? { x: 0, y: 0 };
      this.updateComponentData(entity.id, ECSComponentType.POSITION, {
        x: (pos.x as number) + Math.random() * 10,
        y: (pos.y as number) + Math.random() * 10,
      });
    }
  }

  private benchmarkEventDispatch(count: number): void {
    // Simulate event dispatch by creating and processing events
    for (let i = 0; i < count; i++) {
      const event = { type: 'test_event', payload: { index: i } };
      JSON.stringify(event);
    }
  }

  private benchmarkFullSimulation(count: number): void {
    // Create entities
    const entities = this.createEntitiesBatch(
      Math.floor(count / 3),
      LargeScaleEntityType.NPC,
      [ECSComponentType.POSITION, ECSComponentType.HEALTH, ECSComponentType.AI]
    );

    // Update components
    for (const entity of entities) {
      this.updateComponentData(entity.id, ECSComponentType.POSITION, { x: 1, y: 2 });
    }

    // Query
    this.getEntitiesWithAllComponents([ECSComponentType.POSITION, ECSComponentType.AI]);

    // Destroy some
    for (let i = 0; i < Math.floor(entities.length / 2); i++) {
      this.destroyEntity(entities[i].id);
    }
  }

  runAllBenchmarks(entityCount: number = 1000): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];
    for (const scenario of Object.values(BenchmarkScenarioType)) {
      if (scenario === BenchmarkScenarioType.CUSTOM) continue;
      results.push(this.runBenchmark(scenario, entityCount));
    }
    return results;
  }

  getBenchmarkHistory(): BenchmarkResult[] {
    return [...this.stats.benchmarkHistory];
  }

  getLatestBenchmark(scenario: BenchmarkScenarioType): BenchmarkResult | undefined {
    return this.stats.benchmarkHistory
      .filter(b => b.scenario === scenario)
      .pop();
  }

  // ---------------------------------------------------------------------------
  // ECS Architecture Evaluation
  // ---------------------------------------------------------------------------

  /**
   * Evaluate the ECS (Entity Component System) architecture effectiveness.
   * Analyzes component density, entity-component distribution, memory usage,
   * and query performance to assess how well the ECS pattern is utilized.
   * @returns ECSEvaluationReport containing architecture metrics, component
   *          density analysis, performance benchmarks, and optimization recommendations
   */
  evaluateECSArchitecture(): ECSEvaluationReport {
    const totalEntities = this.getEntityCount();
    const totalComponents = this.components.size;

    // Calculate average components per entity
    let totalComponentAttachments = 0;
    for (const component of this.components.values()) {
      totalComponentAttachments += component.entityIds.size;
    }
    const avgComponentsPerEntity = totalEntities > 0 ? totalComponentAttachments / totalEntities : 0;

    // Component density
    const componentDensity = {} as Record<ECSComponentType, number>;
    for (const [type, component] of this.components) {
      componentDensity[type] = totalEntities > 0 ? component.entityIds.size / totalEntities : 0;
    }

    // Run quick performance tests
    const queryResult = this.runBenchmark(BenchmarkScenarioType.QUERY, Math.min(100, totalEntities));
    const updateResult = this.runBenchmark(BenchmarkScenarioType.COMPONENT_UPDATE, Math.min(100, totalEntities));

    const queryPerformance = queryResult.operationsPerSecond / 1000; // K ops/sec
    const updatePerformance = updateResult.operationsPerSecond / 1000;

    // Memory efficiency
    let memoryEfficiency = 0;
    if (this.config.trackMemory && typeof process !== 'undefined' && process.memoryUsage) {
      const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
      memoryEfficiency = memoryMB > 0 ? totalEntities / memoryMB : 0;
    }

    // Overall score (0-100)
    const scoreComponents = [
      Math.min(100, avgComponentsPerEntity * 20),
      Math.min(100, queryPerformance),
      Math.min(100, updatePerformance),
      Math.min(100, memoryEfficiency / 10),
    ];
    const overallScore = scoreComponents.reduce((a, b) => a + b, 0) / scoreComponents.length;

    // Recommendations
    const recommendations: string[] = [];
    if (avgComponentsPerEntity < 2) {
      recommendations.push('Entities have few components; consider adding more component types for richer simulation');
    }
    if (queryPerformance < 10) {
      recommendations.push('Query performance is low; consider optimizing component storage with sparse sets');
    }
    if (updatePerformance < 10) {
      recommendations.push('Update performance is low; consider batching component updates');
    }
    if (memoryEfficiency < 100) {
      recommendations.push('Memory efficiency could be improved; consider using typed arrays for component data');
    }
    if (recommendations.length === 0) {
      recommendations.push('ECS architecture is performing well; continue monitoring at scale');
    }

    return {
      totalEntities,
      totalComponents,
      avgComponentsPerEntity,
      componentDensity,
      queryPerformance,
      updatePerformance,
      memoryEfficiency,
      overallScore,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats(): LargeScaleSimulationStats {
    return {
      ...this.stats,
      benchmarkHistory: [...this.stats.benchmarkHistory],
      entitiesByType: { ...this.stats.entitiesByType },
    };
  }

  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  clearAllEntities(): void {
    this.entities.clear();
    for (const component of this.components.values()) {
      component.entityIds.clear();
      component.entityData.clear();
    }
    this.stats.activeEntities = 0;
    this.stats.entitiesByType = this.createEmptyEntityTypeCount();
  }

  // ---------------------------------------------------------------------------
  // Tick / Update
  // ---------------------------------------------------------------------------

  tick(_dt: number, _world: World | null, _events: EventSystem | null): void {
    if (!this.enabled) return;
    this.currentTick++;
    this.stats.totalTicks++;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      entities: Array.from(this.entities.values()).map(e => ({
        ...e,
        components: Array.from(e.components),
      })),
      entityIdCounter: this.entityIdCounter,
      stats: {
        ...this.stats,
        entitiesByType: this.stats.entitiesByType,
      },
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config) this.config = { ...DEFAULT_LARGE_SCALE_CONFIG, ...(data.config as object) };
    if (data.entities) {
      this.entities = new Map(
        (data.entities as Array<{ id: string; components: ECSComponentType[] } & LargeScaleEntity>)
          .map(e => [e.id, { ...e, components: new Set(e.components) }])
      );
    }
    if (typeof data.entityIdCounter === 'number') this.entityIdCounter = data.entityIdCounter;
    if (data.stats) this.stats = data.stats as LargeScaleSimulationStats;
    if (typeof data.currentTick === 'number') this.currentTick = data.currentTick;

    // Rebuild component indices
    this.initializeComponents();
    for (const entity of this.entities.values()) {
      for (const compType of entity.components) {
        const component = this.components.get(compType);
        if (component) {
          component.entityIds.add(entity.id);
          component.entityData.set(entity.id, {});
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private createEmptyStats(): LargeScaleSimulationStats {
    return {
      totalCreated: 0,
      totalDestroyed: 0,
      activeEntities: 0,
      entitiesByType: this.createEmptyEntityTypeCount(),
      totalComponentUpdates: 0,
      totalBenchmarks: 0,
      benchmarkHistory: [],
      peakEntityCount: 0,
      totalTicks: 0,
    };
  }

  private createEmptyEntityTypeCount(): Record<LargeScaleEntityType, number> {
    const count = {} as Record<LargeScaleEntityType, number>;
    for (const type of Object.values(LargeScaleEntityType)) {
      count[type] = 0;
    }
    return count;
  }
}
