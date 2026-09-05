import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entity, GameObject } from '../src/entity/Entity.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';

test('Entity lifecycle: attach/detach children', () => {
  const parent = new Entity({ name: 'root', type: 'static' });
  const child = new Entity({ name: 'child', type: 'static' });
  parent.attach(child);
  assert.equal(child.parent, parent);
  assert.equal(parent.children.length, 1);
  child.detach();
  assert.equal(child.parent, null);
  assert.equal(parent.children.length, 0);
});

test('GameObject exposes AABB', () => {
  const g = new GameObject({ name: 'box', position: { x: 1, y: 1, z: 1 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } });
  assert.deepEqual(g.aabbMin().toObject(), { x: 0.5, y: 0.5, z: 0.5 });
  assert.deepEqual(g.aabbMax().toObject(), { x: 1.5, y: 1.5, z: 1.5 });
});

test('EntityFactory builds archetypes', () => {
  const ground = EntityFactory.staticBox('g', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
  assert.equal(ground.type, 'static');
  assert.equal(ground.mass, Number.POSITIVE_INFINITY);
  const dyn = EntityFactory.dynamicBox({ name: 'd', position: { x: 0, y: 0, z: 0 }, mass: 2 });
  assert.equal(dyn.type, 'dynamic');
  assert.equal(dyn.mass, 2);
  const zone = EntityFactory.zoneTrigger({ name: 'z', center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } });
  assert.equal(zone.type, 'trigger');
  const proxy = EntityFactory.soulProxy({ soulId: 'abc', name: 'Vex', element: 'wind' });
  assert.equal(proxy.type, 'soul-proxy');
  assert.equal(proxy.properties.get('soulId'), 'abc');
});
