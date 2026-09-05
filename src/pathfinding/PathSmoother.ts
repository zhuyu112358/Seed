// PathSmoother: smooth grid-based A* paths using string-pulling (line-of-sight shortcut).
//
// A* over a grid produces zigzag paths through cell centers. PathSmoother reduces
// the number of waypoints and produces smoother turns by finding the farthest
// waypoint visible from the current position (clear line-of-sight through the grid).
//
// Algorithm (string pulling / visibility shortcut):
//   1. Start at the first waypoint.
//   2. From the current point, scan from the last waypoint backward to find the
//      farthest waypoint with clear line-of-sight.
//   3. Add that waypoint to the smoothed path and set it as current.
//   4. Repeat until reaching the goal.
//
// Line-of-sight check uses a DDA (Digital Differential Analyzer) grid traversal
// to verify that no blocked cell lies between two points.
//
// Design: standalone utility, not a WorldSystem. Used by PathfinderSystem or
// SoulActionSystem to smooth paths before execution.

import { GridMap } from "./GridMap.js";

export interface SmoothedPathResult {
  /** Smoothed waypoints in world-space (x, z). */
  waypoints: Array<{ x: number; z: number }>;
  /** Number of waypoints removed from the original path. */
  removed: number;
  /** Total length of the smoothed path in world units. */
  length: number;
}

/**
 * PathSmoother: smooth grid paths using string-pulling with DDA line-of-sight.
 *
 * Usage:
 *   const smoother = new PathSmoother(gridMap);
 *   const result = smoother.smooth(pathResult.waypoints);
 *   // result.waypoints has fewer, smoother waypoints.
 */
export class PathSmoother {
  constructor(private readonly gridMap: GridMap) {}

  /**
   * Smooth a list of waypoints using string-pulling.
   * @param waypoints Original waypoints in world-space (x, z), from start to goal.
   * @returns Smoothed path result with fewer waypoints.
   */
  smooth(waypoints: Array<{ x: number; z: number }>): SmoothedPathResult {
    if (waypoints.length <= 2) {
      return {
        waypoints: [...waypoints],
        removed: 0,
        length: this.pathLength(waypoints),
      };
    }

    const smoothed: Array<{ x: number; z: number }> = [waypoints[0]];
    let currentIndex = 0;

    while (currentIndex < waypoints.length - 1) {
      const current = waypoints[currentIndex];
      let nextIndex = waypoints.length - 1; // start from the goal and scan backward

      // Find the farthest waypoint with clear line-of-sight.
      while (nextIndex > currentIndex + 1) {
        if (this.hasLineOfSight(current, waypoints[nextIndex])) {
          break;
        }
        nextIndex--;
      }

      // If no farther waypoint is visible, take the immediate next one.
      if (nextIndex === currentIndex + 1 && !this.hasLineOfSight(current, waypoints[nextIndex])) {
        // Should never happen for a valid path (adjacent cells are always visible),
        // but guard against it.
        nextIndex = currentIndex + 1;
      }

      smoothed.push(waypoints[nextIndex]);
      currentIndex = nextIndex;
    }

    return {
      waypoints: smoothed,
      removed: waypoints.length - smoothed.length,
      length: this.pathLength(smoothed),
    };
  }

  /**
   * Check if there is clear line-of-sight between two world-space points.
   * Uses DDA grid traversal to check every cell along the line.
   * @param from Start point (x, z) in world-space.
   * @param to End point (x, z) in world-space.
   * @returns true if no blocked cell lies between the points.
   */
  hasLineOfSight(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
    const grid = this.gridMap;

    // Convert to cell coordinates.
    let x0 = grid.worldToCellX(from.x);
    let z0 = grid.worldToCellZ(from.z);
    const x1 = grid.worldToCellX(to.x);
    const z1 = grid.worldToCellZ(to.z);

    // DDA grid traversal (Amanatides & Woo algorithm).
    const dx = x1 - x0;
    const dz = z1 - z0;
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

    // Distance to next cell boundary in units of cell size.
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

    // Fractional position within the starting cell.
    const fracX = (from.x - grid.originX) / grid.cellSize - x0;
    const fracZ = (from.z - grid.originZ) / grid.cellSize - z0;

    // tMax: distance along ray to next cell boundary.
    let tMaxX = stepX > 0 ? (1 - fracX) * tDeltaX : stepX < 0 ? fracX * tDeltaX : Infinity;
    let tMaxZ = stepZ > 0 ? (1 - fracZ) * tDeltaZ : stepZ < 0 ? fracZ * tDeltaZ : Infinity;

    // Check the starting cell.
    if (!this.isCellWalkable(x0, z0)) return false;

    // Traverse the grid.
    const maxSteps = Math.abs(dx) + Math.abs(dz) + 1;
    for (let i = 0; i < maxSteps; i++) {
      if (tMaxX < tMaxZ) {
        x0 += stepX;
        tMaxX += tDeltaX;
      } else {
        z0 += stepZ;
        tMaxZ += tDeltaZ;
      }

      if (x0 === x1 && z0 === z1) {
        // Reached the goal cell — check it and return.
        return this.isCellWalkable(x0, z0);
      }

      if (!this.isCellWalkable(x0, z0)) return false;
    }

    return true;
  }

  /**
   * Check if a cell is walkable (in bounds and not blocked).
   */
  private isCellWalkable(cellX: number, cellZ: number): boolean {
    const grid = this.gridMap;
    if (!grid.inBounds(cellX, cellZ)) return false;
    const wx = grid.cellToWorldX(cellX);
    const wz = grid.cellToWorldZ(cellZ);
    return grid.isWalkable(wx, wz);
  }

  /**
   * Compute total path length (sum of distances between consecutive waypoints).
   */
  private pathLength(waypoints: Array<{ x: number; z: number }>): number {
    let length = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x;
      const dz = waypoints[i].z - waypoints[i - 1].z;
      length += Math.sqrt(dx * dx + dz * dz);
    }
    return length;
  }
}
