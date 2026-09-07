/**
 * Large Scale Simulation System - Unit Tests
 *
 * Tests for M14 Economic Foundation Layer - Phase 6
 * Covers: entity management, component management, benchmarking,
 * ECS evaluation, statistics, serialization
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LargeScaleSimulationSystem } from '../src/performance/LargeScaleSimulationSystem.js';
import {
  LargeScaleEntityType,
  ECSComponentType,
  BenchmarkScenarioType,
  DEFAULT_LARGE_SCALE_CONFIG,
} from '../src/performance/LargeScaleSimulationTypes.js';

describe('LargeScaleSimulationSystem - Configuration', () => {
  it('should use default configuration when none provided', () => {
    const system = new LargeScaleSimulationSystem();
    assert.ok(system.enabled);
    assert.equal(system.name, 'large-scale-simulation-system');
  });

  it('should accept custom configuration', () => {
    const system = new LargeScaleSimulationSystem({
      maxEntities: 50000,
      defaultBatchSize: 500,
    });
    assert.ok(system);
  });

  it('should have valid default config values', () => {
    assert.equal(DEFAULT_LARGE_SCALE_CONFIG.maxEntities, 100000);
    assert.equal(DEFAULT_LARGE_SCALE_CONFIG.defaultBatchSize, 1000);
    assert.equal(DEFAULT_LARGE_SCALE_CONFIG.trackMemory, true);
  });
});

describe('LargeScaleSimulationSystem - Entity Management', () => {
  it('should create an entity', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);

    assert.ok(entity.id);
    assert.equal(entity.type, LargeScaleEntityType.NPC);
    assert.equal(entity.isActive, true);
    assert.ok(entity.components.has(ECSComponentType.POSITION));
  });

  it('should create entities in batch', () => {
    const system = new LargeScaleSimulationSystem();
    const entities = system.createEntitiesBatch(100, LargeScaleEntityType.NPC);
    assert.equal(entities.length, 100);
    assert.equal(system.getEntityCount(), 100);
  });

  it('should destroy an entity', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC);
    assert.equal(system.getEntityCount(), 1);

    const result = system.destroyEntity(entity.id);
    assert.equal(result, true);
    assert.equal(system.getEntityCount(), 0);
  });

  it('should destroy entities in batch', () => {
    const system = new LargeScaleSimulationSystem();
    const entities = system.createEntitiesBatch(50, LargeScaleEntityType.NPC);
    const ids = entities.slice(0, 20).map(e => e.id);

    const destroyed = system.destroyEntitiesBatch(ids);
    assert.equal(destroyed, 20);
    assert.equal(system.getEntityCount(), 30);
  });

  it('should retrieve entity by id', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC);
    assert.ok(system.getEntity(entity.id));
    assert.equal(system.getEntity('nonexistent'), undefined);
  });

  it('should list all entities', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(10, LargeScaleEntityType.NPC);
    system.createEntitiesBatch(5, LargeScaleEntityType.BUILDING);
    assert.equal(system.getAllEntities().length, 15);
  });

  it('should get entities by type', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(10, LargeScaleEntityType.NPC);
    system.createEntitiesBatch(5, LargeScaleEntityType.BUILDING);
    system.createEntitiesBatch(3, LargeScaleEntityType.RESOURCE_NODE);

    assert.equal(system.getEntitiesByType(LargeScaleEntityType.NPC).length, 10);
    assert.equal(system.getEntitiesByType(LargeScaleEntityType.BUILDING).length, 5);
  });

  it('should track peak entity count', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(100, LargeScaleEntityType.NPC);
    const entities = system.getAllEntities();
    system.destroyEntitiesBatch(entities.slice(0, 50).map(e => e.id));

    const stats = system.getStats();
    assert.equal(stats.peakEntityCount, 100);
    assert.equal(stats.activeEntities, 50);
  });
});

describe('LargeScaleSimulationSystem - Component Management', () => {
  it('should attach a component to entity', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC);
    const result = system.attachComponent(entity.id, ECSComponentType.HEALTH);
    assert.equal(result, true);
    assert.ok(system.getEntity(entity.id)!.components.has(ECSComponentType.HEALTH));
  });

  it('should detach a component from entity', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.HEALTH]);
    const result = system.detachComponent(entity.id, ECSComponentType.HEALTH);
    assert.equal(result, true);
    assert.equal(system.getEntity(entity.id)!.components.has(ECSComponentType.HEALTH), false);
  });

  it('should update component data', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    const result = system.updateComponentData(entity.id, ECSComponentType.POSITION, { x: 10, y: 20 });
    assert.equal(result, true);

    const data = system.getComponentData(entity.id, ECSComponentType.POSITION);
    assert.equal(data!.x, 10);
    assert.equal(data!.y, 20);
  });

  it('should get entities with a specific component', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.HEALTH]);
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.AI]);

    assert.equal(system.getEntitiesWithComponent(ECSComponentType.POSITION).length, 2);
    assert.equal(system.getEntitiesWithComponent(ECSComponentType.HEALTH).length, 1);
  });

  it('should get entities with all specified components', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.HEALTH]);
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.HEALTH, ECSComponentType.AI]);

    assert.equal(system.getEntitiesWithAllComponents([ECSComponentType.POSITION, ECSComponentType.HEALTH]).length, 2);
    assert.equal(system.getEntitiesWithAllComponents([ECSComponentType.POSITION, ECSComponentType.HEALTH, ECSComponentType.AI]).length, 1);
  });

  it('should return empty for no matching components', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    assert.equal(system.getEntitiesWithAllComponents([ECSComponentType.AI, ECSComponentType.HEALTH]).length, 0);
  });
});

describe('LargeScaleSimulationSystem - Benchmarking', () => {
  it('should run a benchmark', () => {
    const system = new LargeScaleSimulationSystem();
    const result = system.runBenchmark(BenchmarkScenarioType.ENTITY_CREATION, 100, 3);

    assert.equal(result.scenario, BenchmarkScenarioType.ENTITY_CREATION);
    assert.equal(result.entityCount, 100);
    assert.equal(result.iterations, 3);
    assert.ok(result.totalTimeMs >= 0);
    assert.ok(result.avgTimePerEntityUs >= 0);
    assert.ok(result.operationsPerSecond >= 0);
    assert.ok(result.minTimeMs <= result.maxTimeMs);
  });

  it('should run all benchmarks', () => {
    const system = new LargeScaleSimulationSystem();
    const results = system.runAllBenchmarks(50);
    // Should have results for all scenarios except CUSTOM
    assert.ok(results.length >= 8);
  });

  it('should track benchmark history', () => {
    const system = new LargeScaleSimulationSystem();
    system.runBenchmark(BenchmarkScenarioType.ENTITY_CREATION, 50);
    system.runBenchmark(BenchmarkScenarioType.QUERY, 50);

    const history = system.getBenchmarkHistory();
    assert.equal(history.length, 2);
  });

  it('should get latest benchmark for scenario', () => {
    const system = new LargeScaleSimulationSystem();
    system.runBenchmark(BenchmarkScenarioType.ENTITY_CREATION, 50);
    system.runBenchmark(BenchmarkScenarioType.ENTITY_CREATION, 100);

    const latest = system.getLatestBenchmark(BenchmarkScenarioType.ENTITY_CREATION);
    assert.ok(latest);
    assert.equal(latest!.entityCount, 100);
  });

  it('should return undefined for no benchmark history', () => {
    const system = new LargeScaleSimulationSystem();
    assert.equal(system.getLatestBenchmark(BenchmarkScenarioType.QUERY), undefined);
  });

  it('should benchmark entity destruction', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(200, LargeScaleEntityType.NPC);
    const result = system.runBenchmark(BenchmarkScenarioType.ENTITY_DESTRUCTION, 100, 2);
    assert.ok(result);
    assert.equal(result.scenario, BenchmarkScenarioType.ENTITY_DESTRUCTION);
  });

  it('should benchmark component update', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(100, LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    const result = system.runBenchmark(BenchmarkScenarioType.COMPONENT_UPDATE, 50, 2);
    assert.ok(result);
  });

  it('should benchmark query', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(100, LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.AI]);
    const result = system.runBenchmark(BenchmarkScenarioType.QUERY, 50, 2);
    assert.ok(result);
  });

  it('should benchmark full simulation', () => {
    const system = new LargeScaleSimulationSystem();
    const result = system.runBenchmark(BenchmarkScenarioType.FULL_SIMULATION, 30, 2);
    assert.ok(result);
    assert.ok(system.getEntityCount() > 0);
  });
});

describe('LargeScaleSimulationSystem - ECS Evaluation', () => {
  it('should evaluate ECS architecture', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(50, LargeScaleEntityType.NPC, [
      ECSComponentType.POSITION,
      ECSComponentType.HEALTH,
      ECSComponentType.AI,
    ]);

    const report = system.evaluateECSArchitecture();
    assert.ok(report);
    assert.equal(report.totalEntities, 50);
    assert.ok(report.totalComponents > 0);
    assert.ok(report.avgComponentsPerEntity > 0);
    assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
    assert.ok(report.recommendations.length > 0);
  });

  it('should calculate component density', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(10, LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    system.createEntitiesBatch(10, LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.HEALTH]);

    const report = system.evaluateECSArchitecture();
    assert.ok(report.componentDensity[ECSComponentType.POSITION] > 0);
    assert.ok(report.componentDensity[ECSComponentType.HEALTH] > 0);
  });

  it('should handle empty system evaluation', () => {
    const system = new LargeScaleSimulationSystem();
    const report = system.evaluateECSArchitecture();
    assert.equal(report.totalEntities, 0);
    assert.equal(report.avgComponentsPerEntity, 0);
  });
});

describe('LargeScaleSimulationSystem - Statistics', () => {
  it('should get simulation statistics', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(100, LargeScaleEntityType.NPC);
    system.createEntitiesBatch(50, LargeScaleEntityType.BUILDING);

    const stats = system.getStats();
    assert.equal(stats.totalCreated, 150);
    assert.equal(stats.activeEntities, 150);
    assert.equal(stats.entitiesByType[LargeScaleEntityType.NPC], 100);
    assert.equal(stats.entitiesByType[LargeScaleEntityType.BUILDING], 50);
  });

  it('should track total destroyed', () => {
    const system = new LargeScaleSimulationSystem();
    const entities = system.createEntitiesBatch(100, LargeScaleEntityType.NPC);
    system.destroyEntitiesBatch(entities.slice(0, 30).map(e => e.id));

    const stats = system.getStats();
    assert.equal(stats.totalDestroyed, 30);
    assert.equal(stats.activeEntities, 70);
  });

  it('should track component updates', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    system.updateComponentData(entity.id, ECSComponentType.POSITION, { x: 1 });
    system.updateComponentData(entity.id, ECSComponentType.POSITION, { x: 2 });

    const stats = system.getStats();
    assert.equal(stats.totalComponentUpdates, 2);
  });

  it('should reset statistics', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(100, LargeScaleEntityType.NPC);
    system.resetStats();

    const stats = system.getStats();
    assert.equal(stats.totalCreated, 0);
    assert.equal(stats.activeEntities, 0);
  });

  it('should clear all entities', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(100, LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);
    system.clearAllEntities();

    assert.equal(system.getEntityCount(), 0);
    assert.equal(system.getEntitiesWithComponent(ECSComponentType.POSITION).length, 0);
  });
});

describe('LargeScaleSimulationSystem - Serialization', () => {
  it('should serialize and deserialize system state', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(50, LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.HEALTH]);
    system.createEntitiesBatch(20, LargeScaleEntityType.BUILDING, [ECSComponentType.POSITION]);

    const serialized = system.serialize();
    assert.ok(serialized);
    assert.ok(serialized.entities);

    const newSystem = new LargeScaleSimulationSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getEntityCount(), 70);
    assert.equal(newSystem.getEntitiesByType(LargeScaleEntityType.NPC).length, 50);
    assert.equal(newSystem.getEntitiesByType(LargeScaleEntityType.BUILDING).length, 20);
  });

  it('should preserve component attachments after serialization', () => {
    const system = new LargeScaleSimulationSystem();
    const entity = system.createEntity(LargeScaleEntityType.NPC, [ECSComponentType.POSITION, ECSComponentType.AI]);

    const serialized = system.serialize();
    const newSystem = new LargeScaleSimulationSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    const restored = newSystem.getEntity(entity.id)!;
    assert.ok(restored.components.has(ECSComponentType.POSITION));
    assert.ok(restored.components.has(ECSComponentType.AI));
    assert.equal(newSystem.getEntitiesWithComponent(ECSComponentType.AI).length, 1);
  });

  it('should handle empty system serialization', () => {
    const system = new LargeScaleSimulationSystem();
    const serialized = system.serialize();

    const newSystem = new LargeScaleSimulationSystem();
    newSystem.deserialize(serialized as Record<string, unknown>);

    assert.equal(newSystem.getEntityCount(), 0);
  });
});

describe('LargeScaleSimulationSystem - Large Scale Validation', () => {
  it('should handle 1000 entities', () => {
    const system = new LargeScaleSimulationSystem();
    const entities = system.createEntitiesBatch(1000, LargeScaleEntityType.NPC, [
      ECSComponentType.POSITION,
      ECSComponentType.HEALTH,
      ECSComponentType.AI,
    ]);
    assert.equal(entities.length, 1000);
    assert.equal(system.getEntityCount(), 1000);
    assert.equal(system.getEntitiesWithComponent(ECSComponentType.AI).length, 1000);
  });

  it('should query 1000 entities efficiently', () => {
    const system = new LargeScaleSimulationSystem();
    system.createEntitiesBatch(1000, LargeScaleEntityType.NPC, [
      ECSComponentType.POSITION,
      ECSComponentType.HEALTH,
      ECSComponentType.AI,
    ]);

    const startTime = performance.now();
    const result = system.getEntitiesWithAllComponents([ECSComponentType.POSITION, ECSComponentType.AI]);
    const endTime = performance.now();

    assert.equal(result.length, 1000);
    // Should complete in reasonable time (< 100ms)
    assert.ok(endTime - startTime < 100, `Query took ${endTime - startTime}ms`);
  });

  it('should update 1000 entities components', () => {
    const system = new LargeScaleSimulationSystem();
    const entities = system.createEntitiesBatch(1000, LargeScaleEntityType.NPC, [ECSComponentType.POSITION]);

    const startTime = performance.now();
    for (const entity of entities) {
      system.updateComponentData(entity.id, ECSComponentType.POSITION, { x: 1, y: 2 });
    }
    const endTime = performance.now();

    assert.equal(system.getStats().totalComponentUpdates, 1000);
    assert.ok(endTime - startTime < 500, `Update took ${endTime - startTime}ms`);
  });

  it('should run benchmark at 1000 entity scale', () => {
    const system = new LargeScaleSimulationSystem();
    const result = system.runBenchmark(BenchmarkScenarioType.ENTITY_CREATION, 1000, 2);
    assert.ok(result);
    assert.equal(result.entityCount, 1000);
    assert.ok(result.operationsPerSecond > 0);
  });
});
