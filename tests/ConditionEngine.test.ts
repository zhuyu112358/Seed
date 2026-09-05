// Unit tests for src/event/ConditionEngine.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConditionEngine, type Predicate, type ConditionContext } from '../src/event/ConditionEngine.js';
import { Entity } from '../src/entity/Entity.js';

function ctx(worldTime: number, entities: Entity[]): ConditionContext {
  const map = new Map<string, Entity>();
  for (const e of entities) map.set(e.id, e);
  return { worldTime, entities: map };
}
function withProperty(id: string, prop: string, value: unknown): Entity {
  const e = new Entity({ id, name: id, type: 'dynamic' });
  e.properties.set(prop, value);
  return e;
}

describe('ConditionEngine', () => {
  it('entityProperty comparisons eq/gt/lt/gte/lte', () => {
    const eng = new ConditionEngine();
    const e = withProperty('p1', 'hp', 50);
    const c = ctx(0, [e]);
    assert.equal(eng.evaluate({ kind: 'entityProperty', entityId: 'p1', property: 'hp', op: 'eq', value: 50 }, c), true);
    assert.equal(eng.evaluate({ kind: 'entityProperty', entityId: 'p1', property: 'hp', op: 'gt', value: 10 }, c), true);
    assert.equal(eng.evaluate({ kind: 'entityProperty', entityId: 'p1', property: 'hp', op: 'lt', value: 10 }, c), false);
    assert.equal(eng.evaluate({ kind: 'entityProperty', entityId: 'p1', property: 'hp', op: 'gte', value: 50 }, c), true);
  });
  it('worldTime predicate', () => {
    const eng = new ConditionEngine();
    const c = ctx(42, []);
    assert.equal(eng.evaluate({ kind: 'worldTime', op: 'gt', value: 40 }, c), true);
    assert.equal(eng.evaluate({ kind: 'worldTime', op: 'lte', value: 10 }, c), false);
  });
  it('and / or / not combine predicates', () => {
    const eng = new ConditionEngine();
    const e = withProperty('p1', 'hp', 50);
    const c = ctx(30, [e]);
    const hpOk: Predicate = { kind: 'entityProperty', entityId: 'p1', property: 'hp', op: 'gt', value: 10 };
    const timeOk: Predicate = { kind: 'worldTime', op: 'gt', value: 20 };
    const timeBad: Predicate = { kind: 'worldTime', op: 'gt', value: 100 };
    assert.equal(eng.evaluate({ kind: 'and', left: hpOk, right: timeOk }, c), true);
    assert.equal(eng.evaluate({ kind: 'or', left: hpOk, right: timeBad }, c), true);
    assert.equal(eng.evaluate({ kind: 'not', inner: timeBad }, c), true);
  });
  it('missing entity evaluates to false', () => {
    const eng = new ConditionEngine();
    assert.equal(eng.evaluate({ kind: 'entityProperty', entityId: 'ghost', property: 'hp', op: 'gt', value: 0 }, ctx(0, [])), false);
  });
  it('non-numeric property evaluates to false', () => {
    const eng = new ConditionEngine();
    const e = withProperty('p1', 'name', 'not-a-number');
    assert.equal(eng.evaluate({ kind: 'entityProperty', entityId: 'p1', property: 'name', op: 'gt', value: 0 }, ctx(0, [e])), false);
  });
});
