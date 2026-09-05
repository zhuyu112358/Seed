import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EntityFactory } from '../src/entity/EntityFactory.js';

test('staticBox creates an immovable stone box', () => {
  const box = EntityFactory.staticBox('ground', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 });
  assert.equal(box.type, 'static');
  assert.equal(box.material, 'stone');
  assert.equal(box.mass, Number.POSITIVE_INFINITY);
  assert.equal(box.interactable, true);
  assert.deepEqual(box.aabbMax().toArray(), [5, 0.5, 5]);
});

test('dynamicBox creates a movable body with sensible defaults', () => {
  const box = EntityFactory.dynamicBox({
    name: 'crate',
    position: { x: 2, y: 0, z: 0 },
    mass: 4,
  });
  assert.equal(box.type, 'dynamic');
  assert.equal(box.mass, 4);
  assert.equal(box.material, 'wood');
  assert.deepEqual(box.halfExtents.toArray(), [0.5, 0.5, 0.5]);
});

test('zoneTrigger marks a non-physical zone and soulProxy carries soul metadata', () => {
  const zone = EntityFactory.zoneTrigger({
    name: 'lava',
    center: { x: 10, y: 0, z: 10 },
    halfExtents: { x: 2, y: 2, z: 2 },
  });
  assert.equal(zone.type, 'trigger');
  assert.equal(zone.hittable, false);
  assert.equal(zone.properties.get('isZone'), true);

  const soul = EntityFactory.soulProxy({ soulId: 'abc', name: 'Neo', element: 'fire' });
  assert.equal(soul.id, 'soul_abc');
  assert.equal(soul.type, 'soul-proxy');
  assert.equal(soul.properties.get('element'), 'fire');
  assert.equal(soul.state.get('insideWorld'), true);
});

test('distance helper computes Euclidean distance between points', () => {
  const d = EntityFactory.distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
  assert.equal(d, 5);
});
