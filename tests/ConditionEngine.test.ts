import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConditionEngine, type ConditionContext, type Predicate } from '../src/event/ConditionEngine.js';
import { Entity } from '../src/entity/Entity.js';

function ctx(worldTime: number, entities: Entity[]): ConditionContext {
  const map = new Map<string, Entity>();
  for (const e of entities) map.set(e.id, e);
  return { worldTime, entities: map };
}

test('worldTime comparisons evaluate correctly', () => {
  const eng = new ConditionEngine();
  const c = ctx(5, []);
  const gt: Predicate = { kind: 'worldTime', op: 'gt', value: 3 };
  const lt: Predicate = { kind: 'worldTime', op: 'lt', value: 10 };
  const eq: Predicate = { kind: 'worldTime', op: 'lte', value: 5 };
  assert.equal(eng.evaluate(gt, c), true);
  assert.equal(eng.evaluate(lt, c), true);
  assert.equal(eng.evaluate(eq, c), true);
});

test('entityProperty reads from properties then state', () => {
  const eng = new ConditionEngine();
  const e = new Entity({ id: 'hero', name: 'hero', type: 'soul' });
  e.properties.set('energy', 80);
  e.state.set('heat', 12);
  const c = ctx(0, [e]);

  const highEnergy: Predicate = { kind: 'entityProperty', entityId: 'hero', property: 'energy', op: 'gte', value: 50 };
  const hot: Predicate = { kind: 'entityProperty', entityId: 'hero', property: 'heat', op: 'gt', value: 10 };
  const missing: Predicate = { kind: 'entityProperty', entityId: 'ghost', property: 'x', op: 'gt', value: 0 };
  assert.equal(eng.evaluate(highEnergy, c), true);
  assert.equal(eng.evaluate(hot, c), true);
  assert.equal(eng.evaluate(missing, c), false);
});

test('and / or / not compose predicates', () => {
  const eng = new ConditionEngine();
  const c = ctx(5, []);
  const p: Predicate = { kind: 'worldTime', op: 'gt', value: 3 };
  const q: Predicate = { kind: 'worldTime', op: 'lt', value: 10 };
  assert.equal(eng.evaluate({ kind: 'and', left: p, right: q }, c), true);
  assert.equal(eng.evaluate({ kind: 'or', left: p, right: { kind: 'worldTime', op: 'gt', value: 100 } }, c), true);
  assert.equal(eng.evaluate({ kind: 'not', inner: p }, c), false);
});
