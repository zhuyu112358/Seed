// Unit tests for src/evaluator/WorldEvaluator.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';
import { World } from '../src/engine/World.js';

function makeWorld(): World {
  const world = new World({ name: 'test', tickRate: 60 });
  world.step(1 / 60);
  world.step(1 / 60);
  return world;
}

describe('WorldEvaluator', () => {
  it('recordTick samples tick durations', () => {
    const ev = new WorldEvaluator();
    ev.recordTick(2); ev.recordTick(4); ev.recordTick(6);
    assert.equal(ev.buildReport(makeWorld()).performance.tickTimeAvgMs, 4);
  });

  it('bump increments activity counters and feeds the report', () => {
    const ev = new WorldEvaluator();
    ev.bump('events', 5);
    ev.bump('soulActions', 2);
    ev.bump('soulActionsSucceeded', 1);
    const report = ev.buildReport(makeWorld());
    assert.equal(report.activity.eventsPerTick, 2.5);
    assert.equal(report.soulInteraction.actionSuccessRate, 0.5);
  });

  it('buildReport produces a complete report', () => {
    const ev = new WorldEvaluator();
    ev.recordTick(1); ev.recordTick(3);
    const r = ev.buildReport(makeWorld());
    assert.ok(typeof r.generatedAt === 'string');
    assert.equal(r.world.name, 'test');
    assert.equal(r.world.tick, 2);
    assert.ok(r.performance.tickTimeAvgMs >= 0);
    assert.ok(Array.isArray(r.subsystems));
  });

  it('p95 and p99 percentiles are computed from samples', () => {
    const ev = new WorldEvaluator();
    for (let i = 1; i <= 100; i++) ev.recordTick(i);
    const r = ev.buildReport(makeWorld());
    assert.equal(typeof r.performance.tickTimeP95Ms, 'number');
    assert.equal(typeof r.performance.tickTimeP99Ms, 'number');
    assert.ok(r.performance.tickTimeP99Ms >= r.performance.tickTimeP95Ms);
  });

  it('flush writes a JSON report file and returns its path', () => {
    const ev = new WorldEvaluator();
    ev.recordTick(2);
    ev.bump('events', 1);
    const file = ev.flush(makeWorld());
    assert.ok(file.endsWith('.json'));
    assert.equal(fs.existsSync(file), true);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).world.name, 'test');
  });
});
