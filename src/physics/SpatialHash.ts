// SpatialHash: Grid-based spatial hashing for broad-phase collision detection.
//
// Divides the world into uniform cells. Each entity is inserted into all cells
// its AABB overlaps. Querying an entity returns all entities in the same or
// neighboring cells, dramatically reducing the number of pair checks needed.
//
// Complexity:
//   - Insert: O(k) where k = number of cells the entity overlaps
//   - Query: O(k * avgEntitiesPerCell)
//   - Full broad phase: O(n * k * avg) vs brute-force O(n²)
//
// For uniformly distributed entities in a large world, this reduces pair checks
// from n*(n-1)/2 to roughly n * (entities per cell neighborhood).
//
// Design: generic utility, not bound to souls or specific world types.
// Works with any object that has an AABB (aabbMin/aabbMax).

import { GameObject } from '../entity/Entity.js';
import { Logger } from '../reliability/Logger.js';

const log = Logger.for('spatial-hash');

/** Statistics for SpatialHash. */
export interface SpatialHashStats {
  /** Number of cells that contain at least one entity. */
  cellsUsed: number;
  /** Total number of entity insertions (an entity spanning multiple cells counts multiple times). */
  totalInsertions: number;
  /** Average entities per occupied cell. */
  avgEntitiesPerCell: number;
  /** Maximum entities in a single cell. */
  maxEntitiesInCell: number;
}

/**
 * SpatialHash: uniform grid spatial partitioning for broad-phase queries.
 *
 * Usage:
 *   const hash = new SpatialHash(5); // 5m cells
 *   for (const entity of entities) hash.insert(entity);
 *   for (const entity of entities) {
 *     const candidates = hash.query(entity);
 *     for (const other of candidates) narrowPhaseCheck(entity, other);
 *   }
 */
export class SpatialHash {
  /** Cell size in world units. */
  public readonly cellSize: number;

  /** Map from cell key "cx,cz" to list of entities in that cell. */
  private cells: Map<string, GameObject[]> = new Map();

  /** Track which cells each entity is in, for efficient removal/refresh. */
  private entityCells: Map<string, string[]> = new Map();

  constructor(cellSize = 5) {
    if (cellSize <= 0) {
      throw new Error(`SpatialHash cellSize must be > 0, got ${cellSize}`);
    }
    this.cellSize = cellSize;
  }

  /** Remove all entities and cells. */
  clear(): void {
    this.cells.clear();
    this.entityCells.clear();
  }

  /**
   * Insert an entity into all cells its AABB overlaps.
   * If the entity was already inserted, it is re-inserted (refreshed).
   */
  insert(entity: GameObject): void {
    // Remove previous insertion if any.
    this.remove(entity.id);

    const min = entity.aabbMin();
    const max = entity.aabbMax();

    const minCellX = Math.floor(min.x / this.cellSize);
    const maxCellX = Math.floor(max.x / this.cellSize);
    const minCellZ = Math.floor(min.z / this.cellSize);
    const maxCellZ = Math.floor(max.z / this.cellSize);

    const cellKeys: string[] = [];

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        cellKeys.push(key);

        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        // Avoid duplicate insertion (shouldn't happen, but safe).
        if (!cell.includes(entity)) {
          cell.push(entity);
        }
      }
    }

    this.entityCells.set(entity.id, cellKeys);
  }

  /**
   * Remove an entity from all cells it was inserted into.
   * Returns true if the entity was found and removed.
   */
  remove(entityId: string): boolean {
    const cellKeys = this.entityCells.get(entityId);
    if (!cellKeys) return false;

    for (const key of cellKeys) {
      const cell = this.cells.get(key);
      if (cell) {
        const idx = cell.findIndex(e => e.id === entityId);
        if (idx >= 0) {
          cell.splice(idx, 1);
        }
        // Clean up empty cells.
        if (cell.length === 0) {
          this.cells.delete(key);
        }
      }
    }

    this.entityCells.delete(entityId);
    return true;
  }

  /**
   * Query all entities that could potentially collide with the given entity.
   * Returns entities in the same cells as the query entity (excluding the entity itself).
   *
   * Note: this is a broad-phase query — returned candidates may not actually overlap.
   * Caller must perform narrow-phase (AABB) check.
   */
  query(entity: GameObject): GameObject[] {
    const min = entity.aabbMin();
    const max = entity.aabbMax();

    const minCellX = Math.floor(min.x / this.cellSize);
    const maxCellX = Math.floor(max.x / this.cellSize);
    const minCellZ = Math.floor(min.z / this.cellSize);
    const maxCellZ = Math.floor(max.z / this.cellSize);

    const candidates: GameObject[] = [];
    const seen = new Set<string>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const other of cell) {
          if (other.id === entity.id) continue;
          if (!seen.has(other.id)) {
            seen.add(other.id);
            candidates.push(other);
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Query all entities within a radius of a point.
   * Uses cell-based broad phase — returned candidates may be slightly outside radius.
   * Caller should filter by exact distance if needed.
   */
  queryPoint(x: number, z: number, radius: number): GameObject[] {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellZ = Math.floor((z - radius) / this.cellSize);
    const maxCellZ = Math.floor((z + radius) / this.cellSize);

    const candidates: GameObject[] = [];
    const seen = new Set<string>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const other of cell) {
          if (!seen.has(other.id)) {
            seen.add(other.id);
            candidates.push(other);
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Get all unique collision pairs from the hash.
   * Each pair is returned exactly once (i < j by insertion order).
   * This is the main entry point for broad-phase collision detection.
   */
  getCollisionPairs(): Array<[GameObject, GameObject]> {
    const pairs: Array<[GameObject, GameObject]> = [];
    const seenPairs = new Set<string>();

    for (const [, cell] of this.cells) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i];
          const b = cell[j];
          // Create a canonical pair key to avoid duplicates across cells.
          const pairKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            pairs.push([a, b]);
          }
        }
      }
    }

    return pairs;
  }

  /** Get statistics about the hash state. */
  getStats(): SpatialHashStats {
    let totalInsertions = 0;
    let maxEntitiesInCell = 0;

    for (const [, cell] of this.cells) {
      totalInsertions += cell.length;
      if (cell.length > maxEntitiesInCell) {
        maxEntitiesInCell = cell.length;
      }
    }

    const cellsUsed = this.cells.size;
    const avgEntitiesPerCell = cellsUsed > 0 ? totalInsertions / cellsUsed : 0;

    return {
      cellsUsed,
      totalInsertions,
      avgEntitiesPerCell,
      maxEntitiesInCell,
    };
  }

  /** Get the number of unique entities currently in the hash. */
  get entityCount(): number {
    return this.entityCells.size;
  }
}
