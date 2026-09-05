// A* pathfinding algorithm over a GridMap.
//
// Uses a binary heap for the open set for O(log n) insert/extract-min.
// Heuristic: octile distance (optimal for 8-directional movement) or
// Manhattan distance when diagonal movement is disabled.
// Returns a list of world-space waypoints from start to goal, or null
// if no path exists.

import { GridMap } from "./GridMap.js";

export interface PathResult {
  /** World-space waypoints from start (exclusive) to goal (inclusive). */
  waypoints: Array<{ x: number; z: number }>;
  /** Total path length in world units. */
  length: number;
  /** Number of cells explored during search. */
  cellsExplored: number;
}

interface Node {
  x: number;
  z: number;
  g: number; // cost from start
  f: number; // g + heuristic
  parent: Node | null;
}

/** Simple binary min-heap keyed by node.f. */
class MinHeap {
  private heap: Node[] = [];

  get size(): number { return this.heap.length; }

  push(node: Node): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): Node | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].f <= this.heap[i].f) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].f < this.heap[smallest].f) smallest = left;
      if (right < n && this.heap[right].f < this.heap[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

export class AStarPathfinder {
  /** Maximum number of cells to explore before giving up. Prevents infinite loops. */
  maxIterations: number;

  constructor(maxIterations = 100000) {
    this.maxIterations = maxIterations;
  }

  /**
   * Find a path from start to goal on the given grid.
   * Returns waypoints in world space, or null if unreachable.
   */
  findPath(
    startX: number, startZ: number,
    goalX: number, goalZ: number,
    grid: GridMap,
  ): PathResult | null {
    const startCX = grid.worldToCellX(startX);
    const startCZ = grid.worldToCellZ(startZ);
    const goalCX = grid.worldToCellX(goalX);
    const goalCZ = grid.worldToCellZ(goalZ);

    // Bounds check.
    if (!grid.inBounds(startCX, startCZ) || !grid.inBounds(goalCX, goalCZ)) return null;

    // If goal is blocked, try to find nearest walkable cell.
    let actualGoalX = goalCX;
    let actualGoalZ = goalCZ;
    if (!grid.isWalkable(goalX, goalZ)) {
      const nearest = this.findNearestWalkable(goalCX, goalCZ, grid, 10);
      if (!nearest) return null;
      actualGoalX = nearest.x;
      actualGoalZ = nearest.z;
    }

    // If start is blocked, try nearest walkable.
    let actualStartX = startCX;
    let actualStartZ = startCZ;
    if (!grid.isWalkable(startX, startZ)) {
      const nearest = this.findNearestWalkable(startCX, startCZ, grid, 10);
      if (!nearest) return null;
      actualStartX = nearest.x;
      actualStartZ = nearest.z;
    }

    const open = new MinHeap();
    const gScore = new Map<number, number>(); // key = z * width + x
    const closed = new Set<number>();
    let cellsExplored = 0;

    const startNode: Node = {
      x: actualStartX, z: actualStartZ,
      g: 0,
      f: this.heuristic(actualStartX, actualStartZ, actualGoalX, actualGoalZ, grid),
      parent: null,
    };
    open.push(startNode);
    gScore.set(actualStartZ * grid.width + actualStartX, 0);

    while (open.size > 0 && cellsExplored < this.maxIterations) {
      const current = open.pop()!;
      cellsExplored++;
      const currentKey = current.z * grid.width + current.x;

      if (current.x === actualGoalX && current.z === actualGoalZ) {
        return this.reconstructPath(current, grid);
      }

      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      for (const neighbor of grid.getNeighbors(current.x, current.z)) {
        const neighborKey = neighbor.z * grid.width + neighbor.x;
        if (closed.has(neighborKey)) continue;

        const tentativeG = current.g + neighbor.cost * grid.cellSize;
        const existingG = gScore.get(neighborKey);
        if (existingG !== undefined && tentativeG >= existingG) continue;

        gScore.set(neighborKey, tentativeG);
        const neighborNode: Node = {
          x: neighbor.x, z: neighbor.z,
          g: tentativeG,
          f: tentativeG + this.heuristic(neighbor.x, neighbor.z, actualGoalX, actualGoalZ, grid),
          parent: current,
        };
        open.push(neighborNode);
      }
    }

    return null; // No path found or max iterations reached.
  }

  /** Octile distance heuristic (optimal for 8-directional grid). */
  private heuristic(x1: number, z1: number, x2: number, z2: number, grid: GridMap): number {
    const dx = Math.abs(x1 - x2);
    const dz = Math.abs(z1 - z2);
    if (grid.allowDiagonal) {
      return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * grid.cellSize;
    }
    return (dx + dz) * grid.cellSize;
  }

  /** Reconstruct world-space waypoints from the goal node back to start. */
  private reconstructPath(goal: Node, grid: GridMap): PathResult {
    const cells: Array<{ x: number; z: number }> = [];
    let current: Node | null = goal;
    while (current) {
      cells.push({ x: current.x, z: current.z });
      current = current.parent;
    }
    cells.reverse();

    // Convert to world space, skip the start cell (caller already there).
    const waypoints: Array<{ x: number; z: number }> = [];
    let length = 0;
    for (let i = 1; i < cells.length; i++) {
      const wx = grid.cellToWorldX(cells[i].x);
      const wz = grid.cellToWorldZ(cells[i].z);
      waypoints.push({ x: wx, z: wz });
      if (i > 1) {
        const prev = waypoints[waypoints.length - 2];
        length += Math.hypot(wx - prev.x, wz - prev.z);
      } else if (cells.length > 1) {
        // Distance from start cell center to first waypoint.
        const startWX = grid.cellToWorldX(cells[0].x);
        const startWZ = grid.cellToWorldZ(cells[0].z);
        length += Math.hypot(wx - startWX, wz - startWZ);
      }
    }

    return { waypoints, length, cellsExplored: cells.length };
  }

  /** BFS search for nearest walkable cell within maxRadius. */
  private findNearestWalkable(cx: number, cz: number, grid: GridMap, maxRadius: number): { x: number; z: number } | null {
    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // only perimeter
          const nx = cx + dx;
          const nz = cz + dz;
          if (grid.inBounds(nx, nz) && grid.isWalkable(grid.cellToWorldX(nx), grid.cellToWorldZ(nz))) {
            return { x: nx, z: nz };
          }
        }
      }
    }
    return null;
  }
}
