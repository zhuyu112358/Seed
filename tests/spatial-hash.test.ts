// Unit tests for SpatialHash broad-phase collision detection.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from '../src/physics/SpatialHash.js';
import { GameObject } from '../src/entity/Entity.js';
import { Vector3 } from '../src/entity/Vector3.js';

function makeBody(id: string, x: number, z: number, halfX = 0.5, halfZ = 0.5): GameObject {
  return new GameObject({
    id,
    name: id,
    type: 'dynamic',
    position: { x, y: 0, z },
    halfExtents: { x: halfX, y: 0.5, z: halfZ },
    mass: 1,
    material: 'flesh',
  });
}

describe('SpatialHash', () => {
  let hash: SpatialHash;

  beforeEach(() => {
    hash = new SpatialHash(5); // 5m cells
  });

  describe('constructor', () => {
    it('creates hash with specified cell size', () => {
      const h = new SpatialHash(10);
      assert.equal(h.cellSize, 10);
    });

    it('defaults cell size to 5', () => {
      const h = new SpatialHash();
      assert.equal(h.cellSize, 5);
    });

    it('throws on non-positive cell size', () => {
      assert.throws(() => new SpatialHash(0));
      assert.throws(() => new SpatialHash(-1));
    });

    it('starts empty', () => {
      assert.equal(hash.entityCount, 0);
      const stats = hash.getStats();
      assert.equal(stats.cellsUsed, 0);
      assert.equal(stats.totalInsertions, 0);
    });
  });

  describe('insert and query', () => {
    it('inserts a single entity and queries it', () => {
      const body = makeBody('a', 2, 3);
      hash.insert(body);
      assert.equal(hash.entityCount, 1);

      // Querying the same entity returns no candidates (excludes self).
      const candidates = hash.query(body);
      assert.equal(candidates.length, 0);
    });

    it('finds entities in the same cell', () => {
      const a = makeBody('a', 1, 1); // cell (0,0)
      const b = makeBody('b', 2, 2); // cell (0,0)
      hash.insert(a);
      hash.insert(b);

      const candidates = hash.query(a);
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].id, 'b');
    });

    it('does not find entities in far cells', () => {
      const a = makeBody('a', 1, 1);   // cell (0,0)
      const b = makeBody('b', 50, 50); // cell (10,10)
      hash.insert(a);
      hash.insert(b);

      const candidates = hash.query(a);
      assert.equal(candidates.length, 0);
    });

    it('finds entities in adjacent cells', () => {
      // Entity at boundary between cells.
      const a = makeBody('a', 4.9, 4.9); // AABB [4.4,5.4] -> cells (0,0) and (1,1)
      const b = makeBody('b', 5.1, 5.1); // AABB [4.6,5.6] -> cells (0,0) and (1,1)
      hash.insert(a);
      hash.insert(b);

      const candidates = hash.query(a);
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].id, 'b');
    });

    it('handles large entities spanning multiple cells', () => {
      const big = new GameObject({
        id: 'big',
        name: 'Big',
        type: 'static',
        position: { x: 10, y: 0, z: 10 },
        halfExtents: { x: 8, y: 1, z: 8 }, // 16x16 entity, spans ~4x4 cells
        mass: 0,
        material: 'stone',
      });
      hash.insert(big);

      const stats = hash.getStats();
      // 16x16 entity with 5m cells should span at least 3x3 = 9 cells.
      assert.ok(stats.cellsUsed >= 9, `expected >= 9 cells, got ${stats.cellsUsed}`);
      assert.equal(stats.totalInsertions, stats.cellsUsed); // one entity in each cell
    });

    it('refreshes entity position on re-insert', () => {
      const body = makeBody('a', 1, 1);
      hash.insert(body);

      // Move the entity far away and re-insert.
      body.position = new Vector3(50, 0, 50);
      hash.insert(body);

      // Old position should no longer have the entity.
      const probe = makeBody('probe', 1, 1);
      hash.insert(probe);
      const candidates = hash.query(probe);
      // probe is in cell (0,0), body is now in cell (10,10) — no overlap.
      assert.equal(candidates.length, 0);
    });
  });

  describe('remove', () => {
    it('removes an entity', () => {
      const a = makeBody('a', 1, 1);
      const b = makeBody('b', 2, 2);
      hash.insert(a);
      hash.insert(b);

      assert.equal(hash.entityCount, 2);
      const removed = hash.remove('a');
      assert.equal(removed, true);
      assert.equal(hash.entityCount, 1);

      const candidates = hash.query(b);
      assert.equal(candidates.length, 0);
    });

    it('returns false for non-existent entity', () => {
      assert.equal(hash.remove('nonexistent'), false);
    });

    it('cleans up empty cells', () => {
      const a = makeBody('a', 1, 1);
      hash.insert(a);
      assert.equal(hash.getStats().cellsUsed, 1);

      hash.remove('a');
      assert.equal(hash.getStats().cellsUsed, 0);
    });
  });

  describe('clear', () => {
    it('removes all entities and cells', () => {
      hash.insert(makeBody('a', 1, 1));
      hash.insert(makeBody('b', 10, 10));
      hash.insert(makeBody('c', 20, 20));

      assert.equal(hash.entityCount, 3);
      hash.clear();
      assert.equal(hash.entityCount, 0);
      assert.equal(hash.getStats().cellsUsed, 0);
    });
  });

  describe('queryPoint', () => {
    it('finds entities near a point', () => {
      hash.insert(makeBody('a', 1, 1));
      hash.insert(makeBody('b', 2, 2));
      hash.insert(makeBody('c', 50, 50));

      const near = hash.queryPoint(1.5, 1.5, 3);
      assert.equal(near.length, 2); // a and b are within 3m
    });

    it('returns empty for far point', () => {
      hash.insert(makeBody('a', 1, 1));
      const near = hash.queryPoint(100, 100, 5);
      assert.equal(near.length, 0);
    });
  });

  describe('getCollisionPairs', () => {
    it('returns no pairs for single entity', () => {
      hash.insert(makeBody('a', 1, 1));
      assert.equal(hash.getCollisionPairs().length, 0);
    });

    it('returns pair for two entities in same cell', () => {
      hash.insert(makeBody('a', 1, 1));
      hash.insert(makeBody('b', 2, 2));
      const pairs = hash.getCollisionPairs();
      assert.equal(pairs.length, 1);
      assert.equal(pairs[0][0].id, 'a');
      assert.equal(pairs[0][1].id, 'b');
    });

    it('does not return pair for entities in different cells', () => {
      hash.insert(makeBody('a', 1, 1));
      hash.insert(makeBody('b', 50, 50));
      assert.equal(hash.getCollisionPairs().length, 0);
    });

    it('returns each pair exactly once even when spanning multiple cells', () => {
      // Two large overlapping entities spanning multiple cells.
      const a = new GameObject({
        id: 'a', name: 'A', type: 'dynamic',
        position: { x: 5, y: 0, z: 5 },
        halfExtents: { x: 4, y: 1, z: 4 },
        mass: 1, material: 'flesh',
      });
      const b = new GameObject({
        id: 'b', name: 'B', type: 'dynamic',
        position: { x: 6, y: 0, z: 6 },
        halfExtents: { x: 4, y: 1, z: 4 },
        mass: 1, material: 'flesh',
      });
      hash.insert(a);
      hash.insert(b);

      const pairs = hash.getCollisionPairs();
      assert.equal(pairs.length, 1, `expected 1 pair, got ${pairs.length}`);
    });

    it('returns all pairs for many entities in one cell', () => {
      for (let i = 0; i < 5; i++) {
        hash.insert(makeBody(`e${i}`, 1 + i * 0.1, 1));
      }
      const pairs = hash.getCollisionPairs();
      // 5 entities in same cell = C(5,2) = 10 pairs.
      assert.equal(pairs.length, 10);
    });
  });

  describe('getStats', () => {
    it('reports correct statistics', () => {
      hash.insert(makeBody('a', 2, 2)); // cell (0,0)
      hash.insert(makeBody('b', 3, 3)); // cell (0,0)
      hash.insert(makeBody('c', 52, 52)); // cell (10,10)

      const stats = hash.getStats();
      assert.equal(stats.cellsUsed, 2);
      assert.equal(stats.totalInsertions, 3);
      assert.equal(stats.avgEntitiesPerCell, 1.5);
      assert.equal(stats.maxEntitiesInCell, 2);
    });
  });

  describe('performance: pair reduction', () => {
    it('reduces pair checks for uniformly distributed entities', () => {
      // 100 entities in a 100x100 world with 10m cells = 10x10 grid.
      const largeHash = new SpatialHash(10);
      const bodies: GameObject[] = [];
      for (let i = 0; i < 100; i++) {
        const x = (i % 10) * 10 + 1;
        const z = Math.floor(i / 10) * 10 + 1;
        const body = makeBody(`e${i}`, x, z, 0.3, 0.3);
        bodies.push(body);
        largeHash.insert(body);
      }

      const bruteForcePairs = 100 * 99 / 2; // 4950
      const hashPairs = largeHash.getCollisionPairs().length;

      // With 1 entity per cell, hash should find 0 pairs (no two in same cell).
      assert.ok(hashPairs < bruteForcePairs, `hash pairs (${hashPairs}) should be < brute force (${bruteForcePairs})`);
      assert.equal(hashPairs, 0); // Each entity in its own cell.
    });

    it('still finds all pairs when entities are clustered', () => {
      // 10 entities all in the same cell.
      const bodies: GameObject[] = [];
      for (let i = 0; i < 10; i++) {
        bodies.push(makeBody(`e${i}`, 1 + i * 0.2, 1));
        hash.insert(bodies[i]);
      }

      const pairs = hash.getCollisionPairs();
      assert.equal(pairs.length, 45); // C(10,2) = 45
    });
  });
});
