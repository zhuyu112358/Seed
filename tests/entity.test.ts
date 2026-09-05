// Unit tests for src/entity/Entity.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Entity, GameObject } from '../src/entity/Entity.js';

describe('Entity', () => {
  it('constructor assigns sensible defaults', () => {
    const e = new Entity({ name: 'root', type: 'dynamic' });
    assert.equal(e.name, 'root');
    assert.equal(e.type, 'dynamic');
    assert.equal(e.position.x, 0);
    assert.equal(e.mass, 1);
    assert.equal(e.material, 'default');
    assert.equal(e.active, true);
    assert.ok(e.id.length > 0);
    assert.ok(e.state instanceof Map);
  });

  it('attach / detach build the hierarchy', () => {
    const parent = new Entity({ name: 'p', type: 'dynamic' });
    const child = new Entity({ name: 'c', type: 'dynamic' });
    parent.attach(child);
    assert.equal(child.parent, parent);
    assert.deepEqual(parent.children, [child]);
    const other = new Entity({ name: 'o', type: 'dynamic' });
    other.attach(child);
    assert.equal(child.parent, other);
    assert.equal(parent.children.length, 0);
    child.detach();
    assert.equal(child.parent, null);
  });

  it('walk traverses the whole subtree', () => {
    const root = new Entity({ id: 'root', name: 'root', type: 'dynamic' });
    const a = new Entity({ id: 'a', name: 'a', type: 'dynamic' });
    const b = new Entity({ id: 'b', name: 'b', type: 'dynamic' });
    const a1 = new Entity({ id: 'a1', name: 'a1', type: 'dynamic' });
    root.attach(a);
    root.attach(b);
    a.attach(a1);
    const seen: string[] = [];
    root.walk((e) => seen.push(e.id));
    assert.deepEqual(seen, ['root', 'a', 'a1', 'b']);
  });

  it('toJSON serialises key fields', () => {
    const e = new Entity({ id: 'e1', name: 'box', type: 'static', mass: 5 });
    e.properties.set('hp', 100);
    const json = e.toJSON() as Record<string, any>;
    assert.equal(json.id, 'e1');
    assert.equal(json.type, 'static');
    assert.equal(json.mass, 5);
    assert.deepEqual(json.position, { x: 0, y: 0, z: 0 });
    assert.deepEqual(json.children, []);
    assert.equal(json.properties.hp, 100);
  });

  it('GameObject inherits Entity and computes AABB', () => {
    const g = new GameObject({
      name: 'ball',
      type: 'dynamic',
      position: { x: 10, y: 10, z: 10 },
      halfExtents: { x: 1, y: 2, z: 3 },
    });
    assert.ok(g instanceof Entity);
    assert.equal(g.hittable, true);
    assert.deepEqual(g.aabbMin().toArray(), [9, 8, 7]);
    assert.deepEqual(g.aabbMax().toArray(), [11, 12, 13]);
  });

  it('active state can be toggled', () => {
    const e = new Entity({ name: 'x', type: 'dynamic' });
    assert.equal(e.active, true);
    e.active = false;
    assert.equal(e.active, false);
  });
});
