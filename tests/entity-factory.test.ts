// Unit tests for EntityFactory (src/entity/EntityFactory.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { GameObject } from '../src/entity/Entity.js';

describe('EntityFactory.staticBox', () => {
  it('builds an immovable static box', () => {
    const g = EntityFactory.staticBox('ground', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 });
    assert.ok(g instanceof GameObject);
    assert.equal(g.type, 'static');
    assert.equal(g.mass, Number.POSITIVE_INFINITY);
    assert.equal(g.material, 'stone');
    assert.equal(g.interactable, true);
    assert.equal(g.hittable, true);
    assert.deepEqual(g.position.toObject(), { x: 0, y: 0, z: 0 });
    assert.deepEqual(g.halfExtents.toObject(), { x: 5, y: 0.5, z: 5 });
  });
});

describe('EntityFactory.dynamicBox', () => {
  it('builds a movable dynamic box with defaults', () => {
    const b = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 1, z: 0 } });
    assert.equal(b.type, 'dynamic');
    assert.equal(b.mass, 1);
    assert.equal(b.material, 'wood');
    assert.deepEqual(b.halfExtents.toObject(), { x: 0.5, y: 0.5, z: 0.5 });
    assert.equal(b.interactable, true);
    assert.deepEqual(b.velocity.toObject(), { x: 0, y: 0, z: 0 });
  });

  it('honours mass, material, velocity and halfExtents', () => {
    const b = EntityFactory.dynamicBox({
      name: 'heavy',
      position: { x: 1, y: 2, z: 3 },
      mass: 4,
      material: 'metal',
      velocity: { x: 1, y: 0, z: 0 },
      halfExtents: { x: 2, y: 2, z: 2 },
    });
    assert.equal(b.mass, 4);
    assert.equal(b.material, 'metal');
    assert.equal(b.velocity.x, 1);
    assert.deepEqual(b.halfExtents.toObject(), { x: 2, y: 2, z: 2 });
  });
});

describe('EntityFactory.zoneTrigger', () => {
  it('builds a non-physical trigger zone marked as a zone', () => {
    let enteredId = '';
    const z = EntityFactory.zoneTrigger({
      name: 'spawn',
      center: { x: 10, y: 0, z: 10 },
      halfExtents: { x: 3, y: 3, z: 3 },
      onEnter: (id) => (enteredId = id),
    });
    assert.equal(z.type, 'trigger');
    assert.equal(z.mass, 0);
    assert.equal(z.material, 'zone');
    assert.equal(z.interactable, false);
    assert.equal(z.hittable, false);
    assert.equal(z.properties.get('isZone'), true);
    assert.equal(typeof z.properties.get('onEnter'), 'function');
    // The stored onEnter callback actually fires.
    (z.properties.get('onEnter') as (id: string) => void)('ent-1');
    assert.equal(enteredId, 'ent-1');
  });
});

describe('EntityFactory.soulProxy', () => {
  it('builds a soul-proxy with a soul_-prefixed id and element material', () => {
    const p = EntityFactory.soulProxy({ soulId: 'abc', name: 'Vex', element: 'wind' });
    assert.equal(p.id, 'soul_abc');
    assert.equal(p.type, 'soul-proxy');
    assert.equal(p.material, 'soul:wind');
    assert.equal(p.mass, 5);
    assert.deepEqual(p.position.toObject(), { x: 0, y: 1, z: 0 });
    assert.equal(p.properties.get('soulId'), 'abc');
    assert.equal(p.properties.get('element'), 'wind');
    assert.equal(p.state.get('insideWorld'), true);
  });

  it('honours a custom spawn position', () => {
    const p = EntityFactory.soulProxy({
      soulId: 'x',
      name: 'Y',
      element: 'fire',
      position: { x: 5, y: 6, z: 7 },
    });
    assert.deepEqual(p.position.toObject(), { x: 5, y: 6, z: 7 });
  });
});

describe('EntityFactory.distance', () => {
  it('computes the Euclidean distance between two points', () => {
    const d = EntityFactory.distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
    assert.equal(d, 5);
  });
});
