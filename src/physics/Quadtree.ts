// Quadtree: 2D spatial partition for broad-phase collision detection.
//
// Reduces pair checks from O(n^2) to O(n log n) on average by only
// testing bodies that share a leaf node. Bodies that span multiple
// quadrants are stored at the lowest ancestor that fully contains them.
//
// This is the v0.1 reference implementation; a BVH or grid-hybrid can
// replace it later without changing the IPhysicsBackend contract.

import { GameObject } from '../entity/Entity.js';

export interface AABB {
  minX: number; minY: number; maxX: number; maxY: number;
}

export interface QuadtreeConfig {
  /** Maximum bodies per node before splitting. */
  maxObjects?: number;
  /** Maximum recursion depth. */
  maxLevels?: number;
}

const DEFAULT_MAX_OBJECTS = 8;
const DEFAULT_MAX_LEVELS = 12;

function aabbContains(outer: AABB, inner: AABB): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX &&
         inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}

function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY;
}

export class Quadtree {
  private readonly bounds: AABB;
  private readonly level: number;
  private readonly maxObjects: number;
  private readonly maxLevels: number;
  private objects: GameObject[] = [];
  private nodes: Quadtree[] | null = null;

  constructor(bounds: AABB, level = 0, config: QuadtreeConfig = {}) {
    this.bounds = bounds;
    this.level = level;
    this.maxObjects = config.maxObjects ?? DEFAULT_MAX_OBJECTS;
    this.maxLevels = config.maxLevels ?? DEFAULT_MAX_LEVELS;
  }

  /** Insert a body. Returns true if inserted, false if out of bounds. */
  insert(body: GameObject): boolean {
    const box = this.bodyAABB(body);
    if (!aabbIntersects(this.bounds, box)) return false;

    // If this node is not split and has room, store here.
    if (this.nodes === null) {
      if (this.objects.length < this.maxObjects || this.level >= this.maxLevels) {
        this.objects.push(body);
        return true;
      }
      this.split();
    }

    // Try to place in a child that fully contains the body.
    for (const child of this.nodes!) {
      if (aabbContains(child.bounds, box)) {
        return child.insert(body);
      }
    }
    // Body spans multiple quadrants: store at this level.
    this.objects.push(body);
    return true;
  }

  /** Return all bodies that may collide with the given body. */
  query(body: GameObject): GameObject[] {
    const box = this.bodyAABB(body);
    const results: GameObject[] = [];
    this.queryInternal(box, results, new Set<string>());
    return results;
  }

  /** Return all unique collision pairs as [i, j] index pairs. */
  queryAllPairs(bodies: GameObject[]): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    const seen = new Set<string>();
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!a.active || !a.hittable) continue;
      const candidates = this.query(a);
      for (const b of candidates) {
        if (b.id === a.id) continue;
        if (!b.active || !b.hittable) continue;
        const j = bodies.indexOf(b);
        if (j <= i) continue;
        const key = `${a.id}:${b.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([i, j]);
      }
    }
    return pairs;
  }

  /** Clear all objects and child nodes. */
  clear(): void {
    this.objects = [];
    if (this.nodes) {
      for (const child of this.nodes) child.clear();
      this.nodes = null;
    }
  }

  /** Total number of bodies stored across all nodes. */
  get size(): number {
    let count = this.objects.length;
    if (this.nodes) for (const child of this.nodes) count += child.size;
    return count;
  }

  private split(): void {
    const { minX, minY, maxX, maxY } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const nextLevel = this.level + 1;
    const cfg = { maxObjects: this.maxObjects, maxLevels: this.maxLevels };
    this.nodes = [
      new Quadtree({ minX, minY, maxX: midX, maxY: midY }, nextLevel, cfg), // NW
      new Quadtree({ minX: midX, minY, maxX, maxY: midY }, nextLevel, cfg), // NE
      new Quadtree({ minX, minY: midY, maxX: midX, maxY }, nextLevel, cfg), // SW
      new Quadtree({ minX: midX, minY: midY, maxX, maxY }, nextLevel, cfg), // SE
    ];
    // Re-insert objects that fit into a child.
    const remaining: GameObject[] = [];
    for (const obj of this.objects) {
      const box = this.bodyAABB(obj);
      let placed = false;
      for (const child of this.nodes) {
        if (aabbContains(child.bounds, box)) {
          child.insert(obj);
          placed = true;
          break;
        }
      }
      if (!placed) remaining.push(obj);
    }
    this.objects = remaining;
  }

  private queryInternal(box: AABB, results: GameObject[], visited: Set<string>): void {
    if (!aabbIntersects(this.bounds, box)) return;
    for (const obj of this.objects) {
      if (!visited.has(obj.id)) {
        visited.add(obj.id);
        results.push(obj);
      }
    }
    if (this.nodes) {
      for (const child of this.nodes) child.queryInternal(box, results, visited);
    }
  }

  private bodyAABB(body: GameObject): AABB {
    const min = body.aabbMin();
    const max = body.aabbMax();
    return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
  }
}