import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';
import { World } from '../src/engine/World.js';
test('recordTick and buildReport', () => { const ev = new WorldEvaluator(); const w = new World({name:'t',tickRate:60}); ev.recordTick(0.01); ev.recordTick(0.02); const r = ev.buildReport(w); assert.ok(r.performance.tickTimeAvgMs>0); assert.equal(r.world.name,'t'); });
test('bump counters', () => { const ev = new WorldEvaluator(); ev.bump('collisions'); ev.bump('collisions'); const w = new World({name:'t',tickRate:60}); const r = ev.buildReport(w); assert.ok(r.activity.collisionsPerTick>=0); });
