import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entity, GameObject } from '../src/entity/Entity.js';

test('Entity defaults mass/position and generates an id', () => {
  const e = new Entity({ name: 'root', type: 'interactive' });
  assert.equal(e.name, 'root');
  assert.equal(e.type, 'interactive');
  assert.equal(e.mass, 1);
  assert.equal(e.position.x, 0);
  assert.equal(e.active, true);
  assert.ok(typeof e.id === 'string' && e.id.length > 0);
});

test('attach/detach builds hierarchy and walk traverses the subtree', () => {
  const parent = new Entity({ name: 'p', type: 'interactive' });
  const child = new Entity({ name: 'c', type: 'interactive' });
  const grand = new Entity({ name: 'g', type: 'interactive' });
  parent.attach(child);
  child.attach(grand);
  assert.equal(child.parent, parent);
  assert.ok(parent.children.includes(child));

  const seen: string[] = [];
  parent.walk((e) => seen.push(e.name));
  assert.deepEqual(seen, ['p', 'c', 'g']);

  child.detach();
  assert.equal(child.parent, null);
  assert.equal(parent.children.length, 0);
});

test('GameObject computes AABB corners and exposes interaction flags', () => {
  const go = new GameObject({
    name: 'box',
    position: { x: 1, y: 2, z: 3 },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    interactable: true,
    hittable: true,
  });
  assert.equal(go.type, 'dynamic');
  assert.equal(go.interactable, true);
  assert.equal(go.hittable, true);
  assert.deepEqual(go.aabbMin().toArray(), [0.5, 1.5, 2.5]);
  assert.deepEqual(go.aabbMax().toArray(), [1.5, 2.5, 3.5]);
});

test('toJSON serializes the entity to a plain object', () => {
  const e = new Entity({ name: 'ser', type: 'npc', mass: 3 });
  const json = e.toJSON();
  assert.equal(json.name, 'ser');
  assert.equal(json.type, 'npc');
  assert.equal(json.mass, 3);
  assert.deepEqual(json.position, { x: 0, y: 0, z: 0 });
  assert.ok(Array.isArray(json.children));
});
