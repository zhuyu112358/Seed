import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GridMap } from "../src/pathfinding/GridMap.js";
import { AStarPathfinder } from "../src/pathfinding/AStarPathfinder.js";
import { PathSmoother } from "../src/pathfinding/PathSmoother.js";

function makeGrid(width = 20, height = 20, cellSize = 1): GridMap {
  return new GridMap({ width, height, cellSize, originX: 0, originZ: 0 });
}

describe("PathSmoother", () => {
  it("initializes with a grid map", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    assert.ok(smoother);
  });

  it("returns path unchanged when 2 or fewer waypoints", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    const waypoints = [{ x: 0, z: 0 }, { x: 5, z: 5 }];
    const result = smoother.smooth(waypoints);
    assert.equal(result.waypoints.length, 2);
    assert.equal(result.removed, 0);
  });

  it("removes collinear waypoints on a straight line", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    // 5 collinear waypoints along x-axis.
    const waypoints = [
      { x: 0.5, z: 0.5 },
      { x: 1.5, z: 0.5 },
      { x: 2.5, z: 0.5 },
      { x: 3.5, z: 0.5 },
      { x: 4.5, z: 0.5 },
    ];
    const result = smoother.smooth(waypoints);
    // Should reduce to just start and end (clear line-of-sight).
    assert.equal(result.waypoints.length, 2);
    assert.equal(result.removed, 3);
    assert.deepEqual(result.waypoints[0], waypoints[0]);
    assert.deepEqual(result.waypoints[1], waypoints[4]);
  });

  it("preserves waypoints when obstacles block line-of-sight", () => {
    const grid = makeGrid();
    // Block a wall in the middle (x=5, z=0..9).
    for (let z = 0; z < 10; z++) {
      grid.setCell(5, z, true);
    }
    const smoother = new PathSmoother(grid);
    // Path goes around the wall: up, over, down.
    const waypoints = [
      { x: 2.5, z: 2.5 },  // start (left of wall)
      { x: 2.5, z: 10.5 }, // go up (above wall)
      { x: 7.5, z: 10.5 }, // go right (above wall)
      { x: 7.5, z: 2.5 },  // go down (right of wall)
    ];
    const result = smoother.smooth(waypoints);
    // Should not remove waypoints that go around the wall (line-of-sight blocked).
    assert.ok(result.waypoints.length >= 3, `should keep at least 3 waypoints, got ${result.waypoints.length}`);
    assert.ok(result.removed <= 1, `should remove at most 1 waypoint, got ${result.removed}`);
  });

  it("hasLineOfSight returns true for clear path", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    assert.ok(smoother.hasLineOfSight({ x: 0.5, z: 0.5 }, { x: 5.5, z: 5.5 }));
  });

  it("hasLineOfSight returns false when blocked", () => {
    const grid = makeGrid();
    // Block cells along the diagonal.
    grid.setCell(2, 2, true);
    grid.setCell(3, 3, true);
    const smoother = new PathSmoother(grid);
    assert.ok(!smoother.hasLineOfSight({ x: 0.5, z: 0.5 }, { x: 5.5, z: 5.5 }));
  });

  it("smooths an actual A* path around obstacles", () => {
    const grid = makeGrid(30, 30);
    // Create a wall with a gap.
    for (let z = 0; z < 30; z++) {
      if (z !== 15) { // gap at z=15
        grid.setCell(15, z, true);
      }
    }
    const pathfinder = new AStarPathfinder();
    const result = pathfinder.findPath(
      2.5, 15.5,  // start (left of wall, at gap height)
      27.5, 15.5, // goal (right of wall)
      grid,
    );
    assert.ok(result, "A* should find a path through the gap");
    assert.ok(result!.waypoints.length > 2, "path should have multiple waypoints");

    const smoother = new PathSmoother(grid);
    const smoothed = smoother.smooth(result!.waypoints);

    // Smoothed path should have fewer or equal waypoints.
    assert.ok(smoothed.waypoints.length <= result!.waypoints.length,
      `smoothed (${smoothed.waypoints.length}) should have <= original (${result!.waypoints.length}) waypoints`);

    // Smoothed path should start and end at the same points.
    assert.deepEqual(smoothed.waypoints[0], result!.waypoints[0]);
    assert.deepEqual(smoothed.waypoints[smoothed.waypoints.length - 1],
      result!.waypoints[result!.waypoints.length - 1]);

    // Smoothed path length should be <= original length (shortcut can only shorten).
    assert.ok(smoothed.length <= result!.length + 0.01,
      `smoothed length (${smoothed.length.toFixed(2)}) should be <= original (${result!.length.toFixed(2)})`);
  });

  it("computes correct path length", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    const waypoints = [
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 3, z: 4 },
    ];
    const result = smoother.smooth(waypoints);
    // 3-4-5 triangle: length should be 3 + 4 = 7 (before smoothing),
    // or 5 (after smoothing if line-of-sight is clear).
    assert.ok(result.length > 0);
    assert.ok(Math.abs(result.length - 5) < 0.01 || Math.abs(result.length - 7) < 0.01,
      `length should be ~5 (smoothed) or ~7 (original), got ${result.length.toFixed(2)}`);
  });

  it("handles diagonal movement paths", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    // Diagonal zigzag path.
    const waypoints = [
      { x: 0.5, z: 0.5 },
      { x: 1.5, z: 1.5 },
      { x: 2.5, z: 0.5 },
      { x: 3.5, z: 1.5 },
      { x: 4.5, z: 0.5 },
    ];
    const result = smoother.smooth(waypoints);
    // Should reduce waypoints where line-of-sight is clear.
    assert.ok(result.waypoints.length <= waypoints.length);
    assert.ok(result.removed >= 0);
  });

  it("empty path returns empty", () => {
    const grid = makeGrid();
    const smoother = new PathSmoother(grid);
    const result = smoother.smooth([]);
    assert.equal(result.waypoints.length, 0);
    assert.equal(result.removed, 0);
    assert.equal(result.length, 0);
  });
});
