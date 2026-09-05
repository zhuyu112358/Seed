import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorldBuilder, EntityFactory } from '../src/sdk/index.js';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';

test('WorldEvaluator builds a report', () => {
  const world = new WorldBuilder('eval-test')
    .addEntity(EntityFactory.staticBox('g', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }))
    .build();
  world.step(1 / 60);
  const ev = new WorldEvaluator();
  ev.recordTick(1.2);
  ev.recordTick(2.4);
  ev.bump('collisions', 3);
  const report = ev.buildReport(world);
  assert.equal(report.world.name, 'eval-test');
  assert.ok(report.performance.tickTimeAvgMs > 0);
  assert.equal(report.activity.collisionsPerTick, 3);
  assert.ok(Math.abs(report.performance.fps - (1000/1.8)) < 1, 'fps close');
});

test('WorldEvaluator.flush writes a JSON file', () => {
  const world = new WorldBuilder('eval-flush').build();
  const ev = new WorldEvaluator();
  ev.recordTick(1);
  const file = ev.flush(world);
  assert.ok(fs.existsSync(file));
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(parsed.world.name, 'eval-flush');
  fs.rmSync(file, { force: true });
});

