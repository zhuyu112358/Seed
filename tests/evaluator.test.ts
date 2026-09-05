import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldEvaluator } from '../src/evaluator/WorldEvaluator.js';
import { World } from '../src/engine/World.js';
test('recordTick buildReport', () => { const ev = new WorldEvaluator(); const w = new World({name:'t',tickRate:60}); ev.recordTick(0.01); const r = ev.buildReport(w); assert.ok(r.performance.tickTimeAvgMs>0); });
test('flush', () => { const ev = new WorldEvaluator(); const w = new World({name:'f',tickRate:60}); ev.recordTick(0.01); assert.ok(ev.flush(w)); });
