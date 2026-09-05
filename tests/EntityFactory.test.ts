// Unit tests for src/entity/EntityFactory.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { GameObject } from '../src/entity/Entity.js';

describe('EntityFactory', () => {
  it('staticBox produces an immovable static body', () => {
    const box = EntityFactory.staticBox('ground', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 });
    assert.ok(box instanceof GameObject);
    assert.equal(box.type, 'static');
    assert.equal(box.mass, Number.POSITIVE_INFINITY);
    assert.equal(box.material, 'stone');
  });

  it('dynamicBox produces a movable body with defaults', () => {
    const box = EntityFactory.dynamicBox({ name: 'crate', position: { x: 2, y: 3, z: 4 } });
    assert.equal(box.type, 'dynamic');
    assert.equal(box.mass, 1);
    assert.equal(box.material, 'wood');
    const custom = EntityFactory.dynamicBox({
      name: 'heavy', position: { x: 0, y: 0, z: 0 }, mass: 10, material: 'metal',
      velocity: { x: 1, y: 0, z: 0 },
    });
    assert.equal(custom.mass, 10);
    assert.equal(custom.velocity.x, 1);
  });

  it('zoneTrigger is a non-physical zone region', () => {
    const zone = EntityFactory.zoneTrigger({
      name: 'lava', center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 2, y: 2, z: 2 },
    });
    assert.equal(zone.type, 'trigger');
    assert.equal(zone.mass, 0);
    assert.equal(zone.properties.get('isZone'), true);
  });

  it('soulProxy builds a proxied soul body', () => {
    const proxy = EntityFactory.soulProxy({ soulId: 'abc123', name: 'Ghost', element: 'fire' });
    assert.equal(proxy.type, 'soul-proxy');
    assert.equal(proxy.id, 'soul_abc123');
    assert.equal(proxy.properties.get('soulId'), 'abc123');
    assert.equal(proxy.state.get('insideWorld'), true);
  });

  it('static distance computes Euclidean distance', () => {
    assert.equal(EntityFactory.distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5);
  });
});
