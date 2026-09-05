// Unit tests for WorldEvaluator (src/evaluator/WorldEvaluator.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/engine/World.js';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';

function makeWorld(tick = 10): World {
  const w = new World({ name: 'eval-world', tickRate: 60 });
  for (let i = 0; i < tick; i++) w.step(1 / 60);
  return w;
}

describe('WorldEvaluator sampling', () => {
  it('recordTick accumulates and buildReport computes avg/p95/p99/fps', () => {
    const ev = new WorldEvaluator();
    for (let i = 1; i <= 100; i++) ev.recordTick(i);
    const report = ev.buildReport(makeWorld(10));
    assert.equal(report.performance.tickTimeAvgMs, 50.5);
    assert.ok(report.performance.tickTimeP95Ms > 0);
    assert.ok(report.performance.tickTimeP99Ms > 0);
    assert.equal(report.performance.fps, Math.round((1000 / 50.5) * 1000) / 1000);
  });
  it('empty sample set yields zeroed performance', () => {
    const r = new WorldEvaluator().buildReport(makeWorld(1));
    assert.equal(r.performance.tickTimeAvgMs, 0);
    assert.equal(r.performance.fps, 0);
  });
});

describe('WorldEvaluator counters', () => {
  it('bump increments and buildReport divides by ticks', () => {
    const ev = new WorldEvaluator();
    ev.bump('collisions', 3);
    ev.bump('messages');
    ev.bump('moved', 5);
    ev.bump('soulActions', 4);
    ev.bump('soulActionsSucceeded', 2);
    const r = ev.buildReport(makeWorld(10));
    assert.equal(r.activity.collisionsPerTick, 0.3);
    assert.equal(r.soulInteraction.actionSuccessRate, 0.5);
  });
  it('perfect success rate when no actions', () => {
    assert.equal(new WorldEvaluator().buildReport(makeWorld(1)).soulInteraction.actionSuccessRate, 1);
  });
});

describe('WorldEvaluator report and flush', () => {
  it('reflects world metadata', () => {
    const r = new WorldEvaluator().buildReport(makeWorld(7));
    assert.equal(r.world.name, 'eval-world');
    assert.equal(r.world.tick, 7);
  });
  it('flush writes a JSON report and returns the path', () => {
    const ev = new WorldEvaluator();
    ev.recordTick(1.2);
    const file = ev.flush(makeWorld(5));
    assert.match(file, /[\/\\]logs[\/\\]eval-.+\.json$/);
    assert.ok(fs.existsSync(file));
    fs.rmSync(file, { force: true });
  });
});
