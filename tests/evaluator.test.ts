// Unit tests for WorldEvaluator (src/evaluator/WorldEvaluator.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/engine/World.js';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';

function makeWorld(tick = 10): World {
  const w = new World({ name: 'eval-world', tickRate: 60 });
  // Advance the world so buildReport has a non-zero tick denominator.
  for (let i = 0; i < tick; i++) w.step(1 / 60);
  return w;
}

describe('WorldEvaluator sampling', () => {
  it('recordTick accumulates samples and buildReport computes avg/p95/p99/fps', () => {
    const ev = new WorldEvaluator();
    for (let i = 1; i <= 100; i++) ev.recordTick(i); // 1..100 ms
    const world = makeWorld(10);
    const report = ev.buildReport(world);

    assert.equal(report.performance.tickTimeAvgMs, 50.5, 'mean of 1..100');
    assert.ok(report.performance.tickTimeP95Ms > 0);
    assert.ok(report.performance.tickTimeP99Ms > 0);
    assert.equal(report.performance.fps, Math.round((1000 / 50.5) * 1000) / 1000);
  });

  it('an empty sample set yields zeroed performance numbers', () => {
    const ev = new WorldEvaluator();
    const report = ev.buildReport(makeWorld(1));
    assert.equal(report.performance.tickTimeAvgMs, 0);
    assert.equal(report.performance.fps, 0);
  });
});

describe('WorldEvaluator counters', () => {
  it('bump increments activity counters and buildReport divides by ticks', () => {
    const ev = new WorldEvaluator();
    ev.bump('collisions', 3);
    ev.bump('messages'); // default by = 1
    ev.bump('moved', 5);
    ev.bump('soulActions', 4);
    ev.bump('soulActionsSucceeded', 2);

    const report = ev.buildReport(makeWorld(10));
    assert.equal(report.activity.collisionsPerTick, 0.3);
    assert.equal(report.activity.messagesPerTick, 0.1);
    assert.equal(report.activity.movedEntitiesPerTick, 0.5);
    assert.equal(report.soulInteraction.actionSuccessRate, 0.5);
  });

  it('reports a perfect success rate when no soul actions were taken', () => {
    const ev = new WorldEvaluator();
    const report = ev.buildReport(makeWorld(1));
    assert.equal(report.soulInteraction.actionSuccessRate, 1);
  });
});

describe('WorldEvaluator report content', () => {
  it('reflects world metadata', () => {
    const ev = new WorldEvaluator();
    const world = makeWorld(7);
    const report = ev.buildReport(world);
    assert.equal(report.world.name, 'eval-world');
    assert.equal(report.world.tick, 7);
    assert.equal(report.world.entityCount, 0);
    assert.equal(report.world.worldTime, 7 / 60);
  });
});

describe('WorldEvaluator.flush', () => {
  it('writes a JSON report to logs/ and returns the file path', () => {
    const ev = new WorldEvaluator();
    ev.recordTick(1.2);
    ev.bump('events', 5);
    const file = ev.flush(makeWorld(5));
    assert.match(file, /[\/\\]logs[\/\\]eval-.+\.json$/);
    assert.ok(fs.existsSync(file));
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(parsed.world.name, 'eval-world');
    assert.ok(parsed.performance.tickTimeAvgMs > 0);
    // Clean up the artifact this test produced.
    fs.rmSync(file, { force: true });
  });
});
