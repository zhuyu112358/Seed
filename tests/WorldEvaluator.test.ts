import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';
import { World } from '../src/engine/World.js';

function makeWorld(): World {
  return new World({ name: 'eval-world', tickRate: 60 });
}

test('recordTick feeds performance percentiles into the report', () => {
  const ev = new WorldEvaluator();
  ev.recordTick(2);
  ev.recordTick(4);
  ev.recordTick(6);
  const report = ev.buildReport(makeWorld());
  assert.equal(report.performance.tickTimeAvgMs, 4);
  assert.equal(report.world.name, 'eval-world');
  assert.ok(typeof report.performance.rssBytes === 'number');
});

test('bumps on counters appear in activity and soul-interaction rates', () => {
  const ev = new WorldEvaluator();
  const world = makeWorld();
  world.step(0.01); // tick -> 1
  ev.bump('events', 5);
  ev.bump('collisions', 2);
  ev.bump('soulActions', 4);
  ev.bump('soulActionsSucceeded', 3);
  const report = ev.buildReport(world);
  assert.equal(report.activity.eventsPerTick, 5);
  assert.equal(report.activity.collisionsPerTick, 2);
  assert.ok(report.soulInteraction.actionSuccessRate > 0.7);
});

test('flush writes a JSON report to disk and returns its path', () => {
  const ev = new WorldEvaluator();
  ev.recordTick(1);
  ev.bump('messages', 1);
  const file = ev.flush(makeWorld());
  assert.ok(fs.existsSync(file), `expected report file at ${file}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(parsed.world.name, 'eval-world');
  fs.rmSync(file, { force: true });
});
