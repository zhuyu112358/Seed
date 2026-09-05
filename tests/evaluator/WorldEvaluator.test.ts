import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldEvaluator } from '../../src/evaluator/WorldEvaluator.js';
import type { WorldStats } from '../../src/types/index.js';

function fakeEngine() {
  const stats: WorldStats = {
    tickCount: 100, uptimeMs: 5000, entityCount: 12, activeEvents: 0,
    avgTickTimeMs: 2, p99TickTimeMs: 4, fps: 60, memoryUsageMB: 32,
    collisionsPerSecond: 1, interactionsPerSecond: 2,
  };
  return { getStats: () => stats, createEntity: () => ({}) } as unknown as import('../../src/engine/WorldEngine.js').WorldEngine;
}

test('generateReport produces a complete scored report', () => {
  const evaluator = new WorldEvaluator({ worldEngine: fakeEngine(), durationMs: 500 });
  evaluator.bump('soulActions', 10);
  evaluator.bump('soulActionsSucceeded', 9);
  evaluator.bump('entityInteractions', 20);
  evaluator.bump('eventTriggers', 3);
  evaluator.setActiveSouls(1);
  const report = evaluator.generateReport();
  assert.ok(report.version);
  assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
  assert.ok(['S', 'A', 'B', 'C', 'D', 'F'].includes(report.grade));
  assert.ok(report.recommendations.length >= 1);
  assert.ok(report.issues.length >= 1);
  assert.equal(report.worldActivity.activeSouls, 1);
});

test('feature coverage reports known modules', () => {
  const evaluator = new WorldEvaluator({ worldEngine: fakeEngine(), durationMs: 500 });
  const coverage = evaluator.collectFeatureCoverage();
  assert.ok(coverage.totalPlanned > 0);
  assert.ok(coverage.modules.some((m) => m.name === 'SoulBridge'));
  assert.ok(coverage.coveragePercent >= 0 && coverage.coveragePercent <= 100);
});

test('soul interaction quality reflects action success rate', () => {
  const evaluator = new WorldEvaluator({ worldEngine: fakeEngine(), durationMs: 500 });
  evaluator.bump('soulActions', 10);
  evaluator.bump('soulActionsSucceeded', 8);
  const quality = evaluator.collectSoulInteractionQuality();
  assert.equal(quality.actionExecutionSuccessRate, 0.8);
});

test('grade is within the valid set', () => {
  const evaluator = new WorldEvaluator({ worldEngine: fakeEngine(), durationMs: 500 });
  const report = evaluator.generateReport();
  assert.ok(['S', 'A', 'B', 'C', 'D', 'F'].includes(report.grade));
});

test('saveReport writes valid JSON', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'seed-eval-'));
  const file = path.join(dir, 'report.json');
  const evaluator = new WorldEvaluator({ worldEngine: fakeEngine(), durationMs: 500 });
  await evaluator.saveReport(file);
  const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  assert.ok(parsed.overallScore !== undefined);
  assert.ok(parsed.grade);
});
