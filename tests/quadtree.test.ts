import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Quadtree } from '../src/physics/Quadtree.js';
import { GameObject } from '../src/entity/Entity.js';

function makeBox(name: string, x: number, y: number, size = 2): GameObject {
  return new GameObject({
    name, type: 'dynamic',
    position: { x, y, z: 0 },
    mass: 1, material: 'wood',
  });
}

describe('Quadtree', () => {
  it('inserts and queries a single body', () => {
    const qt = new Quadtree({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
    const body = makeBox('a', 0, 0);
    assert.equal(qt.insert(body), true);
    const results = qt.query(body);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, body.id);
  });

  it('returns bodies near query point', () => {
    const qt = new Quadtree({ minX: -50, minY: -50, maxX: 50, maxY: 50 }, 0, { maxObjects: 1, maxLevels: 10 });
    const near = makeBox('near', 1, 1);
    const far = makeBox('far', 40, 40);
    qt.insert(near);
    qt.insert(far);
    const results = qt.query(near);
    const ids = results.map(r => r.name);
    assert.ok(ids.includes('near'));
    assert.ok(!ids.includes('far'));
  });

  it('splits when exceeding maxObjects', () => {
    const qt = new Quadtree({ minX: -50, minY: -50, maxX: 50, maxY: 50 }, 0, { maxObjects: 2, maxLevels: 5 });
    for (let i = 0; i < 10; i++) {
      qt.insert(makeBox(`b${i}`, i * 5 - 20, i * 3 - 10));
    }
    assert.equal(qt.size, 10);
  });

  it('queryAllPairs returns unique pairs without duplicates', () => {
    const qt = new Quadtree({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
    const bodies = [
      makeBox('a', 0, 0),
      makeBox('b', 1, 1),
      makeBox('c', 2, 2),
      makeBox('d', 40, 40),
    ];
    for (const b of bodies) qt.insert(b);
    const pairs = qt.queryAllPairs(bodies);
    assert.ok(pairs.length >= 2);
    // No duplicate pairs
    const keys = new Set(pairs.map(([i, j]) => `${i}:${j}`));
    assert.equal(keys.size, pairs.length);
    // All i < j
    for (const [i, j] of pairs) assert.ok(i < j);
  });

  it('clear removes all objects', () => {
    const qt = new Quadtree({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
    qt.insert(makeBox('a', 0, 0));
    qt.insert(makeBox('b', 5, 5));
    assert.equal(qt.size, 2);
    qt.clear();
    assert.equal(qt.size, 0);
  });

  it('rejects bodies outside bounds', () => {
    const qt = new Quadtree({ minX: -10, minY: -10, maxX: 10, maxY: 10 });
    const outside = makeBox('out', 100, 100);
    assert.equal(qt.insert(outside), false);
    assert.equal(qt.size, 0);
  });
});