import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';

describe('WorldEvaluator', () => {
  it('should create evaluator', () => {
    const eval_ = new WorldEvaluator();
    assert.ok(eval_);
  });

  it('should record tick metrics', () => {
    const eval_ = new WorldEvaluator();
    eval_.recordTick(0.016);
    eval_.recordTick(0.020);
    eval_.recordTick(0.018);
    const metrics = eval_.getPerformanceMetrics();
    assert.ok(metrics.avgTickTimeMs > 0);
    assert.ok(metrics.p99TickTimeMs >= metrics.avgTickTimeMs);
  });

  it('should track entity count', () => {
    const eval_ = new WorldEvaluator();
    eval_.setEntityCount(42);
    const metrics = eval_.getPerformanceMetrics();
    assert.equal(metrics.entityCount, 42);
  });

  it('should track active events', () => {
    const eval_ = new WorldEvaluator();
    eval_.setActiveEvents(5);
    const metrics = eval_.getPerformanceMetrics();
    assert.equal(metrics.activeEvents, 5);
  });

  it('should record activity counters', () => {
    const eval_ = new WorldEvaluator();
    eval_.recordActivity('collisions', 10);
    eval_.recordActivity('interactions', 5);
    eval_.recordActivity('communications', 3);
    const activity = eval_.getActivityMetrics();
    assert.ok(activity.entityInteractionsPerSecond >= 0);
    assert.ok(activity.communicationsPerSecond >= 0);
  });

  it('should track soul interaction quality', () => {
    const eval_ = new WorldEvaluator();
    eval_.recordSoulAction(true);
    eval_.recordSoulAction(true);
    eval_.recordSoulAction(false);
    eval_.recordPerception(true);
    eval_.setConnectedSouls(3);
    const quality = eval_.getSoulInteractionQuality();
    assert.ok(quality.actionExecutionSuccessRate > 0);
    assert.ok(quality.actionExecutionSuccessRate <= 1);
    assert.equal(quality.connectedSouls, 3);
  });

  it('should compute feature coverage', () => {
    const eval_ = new WorldEvaluator();
    eval_.setModuleStatus('physics', 'implemented');
    eval_.setModuleStatus('weather', 'partial');
    eval_.setModuleStatus('distributed', 'planned');
    const coverage = eval_.getFeatureCoverage();
    assert.ok(coverage.totalPlanned >= 3);
    assert.ok(coverage.implemented >= 1);
    assert.ok(coverage.coveragePercent > 0);
  });

  it('should generate evaluation report', () => {
    const eval_ = new WorldEvaluator();
    eval_.recordTick(0.016);
    eval_.setEntityCount(10);
    eval_.setActiveEvents(2);
    eval_.recordSoulAction(true);
    eval_.setConnectedSouls(1);
    const report = eval_.generateReport('test-world');
    assert.equal(report.worldId, 'test-world');
    assert.ok(report.performance.avgTickTimeMs > 0);
    assert.ok(report.overallScore >= 0);
    assert.ok(report.overallScore <= 100);
    assert.ok(['S', 'A', 'B', 'C', 'D', 'F'].includes(report.grade));
  });

  it('should generate recommendations', () => {
    const eval_ = new WorldEvaluator();
    const report = eval_.generateReport('test');
    assert.ok(Array.isArray(report.recommendations));
  });

  it('should reset metrics', () => {
    const eval_ = new WorldEvaluator();
    eval_.recordTick(0.05);
    eval_.setEntityCount(100);
    eval_.reset();
    const metrics = eval_.getPerformanceMetrics();
    assert.equal(metrics.entityCount, 0);
  });
});
