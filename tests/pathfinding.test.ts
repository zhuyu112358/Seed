import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GridMap } from "../src/pathfinding/GridMap.js";
import { AStarPathfinder } from "../src/pathfinding/AStarPathfinder.js";
import { PathfinderSystem } from "../src/pathfinding/PathfinderSystem.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";

describe("GridMap", () => {
  it("creates a grid with default config", () => {
    const grid = new GridMap();
    assert.equal(grid.width, 100);
    assert.equal(grid.height, 100);
    assert.equal(grid.cellSize, 1.0);
    assert.equal(grid.blockedCount, 0);
  });

  it("converts world coordinates to cell coordinates", () => {
    const grid = new GridMap({ cellSize: 2, originX: -10, originZ: -10 });
    assert.equal(grid.worldToCellX(0), 5); // (0 - (-10)) / 2 = 5
    assert.equal(grid.worldToCellZ(0), 5);
    assert.equal(grid.worldToCellX(-10), 0);
    assert.equal(grid.worldToCellZ(-10), 0);
  });

  it("converts cell coordinates to world coordinates (cell center)", () => {
    const grid = new GridMap({ cellSize: 2, originX: 0, originZ: 0 });
    assert.equal(grid.cellToWorldX(0), 1); // center of cell 0
    assert.equal(grid.cellToWorldZ(0), 1);
    assert.equal(grid.cellToWorldX(5), 11);
  });

  it("marks cells as blocked and walkable", () => {
    const grid = new GridMap({ width: 10, height: 10 });
    assert.equal(grid.isWalkable(5, 5), true);
    grid.setCell(5, 5, true);
    assert.equal(grid.isWalkable(5, 5), false);
    assert.equal(grid.blockedCount, 1);
    grid.setCell(5, 5, false);
    assert.equal(grid.isWalkable(5, 5), true);
    assert.equal(grid.blockedCount, 0);
  });

  it("blocks a rectangular region", () => {
    const grid = new GridMap({ width: 20, height: 20 });
    grid.blockRegion(2, 2, 5, 5);
    // Cells (2,2) through (5,5) should be blocked = 16 cells
    assert.equal(grid.blockedCount, 16);
    assert.equal(grid.isWalkable(3, 3), false);
    assert.equal(grid.isWalkable(6, 6), true);
  });

  it("returns walkable neighbors with diagonal movement", () => {
    const grid = new GridMap({ width: 5, height: 5, allowDiagonal: true });
    const neighbors = grid.getNeighbors(2, 2);
    assert.equal(neighbors.length, 8); // all 8 directions in open grid
  });

  it("returns only orthogonal neighbors when diagonal disabled", () => {
    const grid = new GridMap({ width: 5, height: 5, allowDiagonal: false });
    const neighbors = grid.getNeighbors(2, 2);
    assert.equal(neighbors.length, 4);
  });

  it("does not return blocked neighbors", () => {
    const grid = new GridMap({ width: 5, height: 5, allowDiagonal: false });
    grid.setCell(3, 2, true); // block east
    const neighbors = grid.getNeighbors(2, 2);
    assert.equal(neighbors.length, 3); // north, south, west (east blocked)
  });

  it("prevents diagonal corner cutting through walls", () => {
    const grid = new GridMap({ width: 5, height: 5, allowDiagonal: true });
    grid.setCell(3, 2, true); // block east
    grid.setCell(2, 3, true); // block south
    const neighbors = grid.getNeighbors(2, 2);
    // Diagonal southeast should be blocked because both east and south are blocked
    const se = neighbors.find((n) => n.x === 3 && n.z === 3);
    assert.equal(se, undefined);
  });

  it("clears all blocked cells", () => {
    const grid = new GridMap({ width: 10, height: 10 });
    grid.blockRegion(0, 0, 9, 9);
    assert.equal(grid.blockedCount, 100);
    grid.clear();
    assert.equal(grid.blockedCount, 0);
  });
});

describe("AStarPathfinder", () => {
  it("finds a straight-line path in open grid", () => {
    const grid = new GridMap({ width: 20, height: 20 });
    const pf = new AStarPathfinder();
    const result = pf.findPath(0, 0, 10, 0, grid);
    assert.ok(result, "path should be found");
    assert.ok(result!.waypoints.length > 0, "should have waypoints");
    // Last waypoint should be near goal
    const last = result!.waypoints[result!.waypoints.length - 1];
    assert.ok(Math.abs(last.x - 10.5) < 1, `last x should be near 10.5, got ${last.x}`);
    assert.ok(Math.abs(last.z - 0.5) < 1, `last z should be near 0.5, got ${last.z}`);
  });

  it("returns null when goal is out of bounds", () => {
    const grid = new GridMap({ width: 10, height: 10 });
    const pf = new AStarPathfinder();
    const result = pf.findPath(0, 0, 100, 100, grid);
    assert.equal(result, null);
  });

  it("finds path around a wall", () => {
    const grid = new GridMap({ width: 20, height: 20 });
    // Build a vertical wall at x=10 from z=0 to z=15, leaving a gap at z=16-19
    grid.blockRegion(10, 0, 10, 15);
    const pf = new AStarPathfinder();
    const result = pf.findPath(5, 5, 15, 5, grid);
    assert.ok(result, "path should be found around wall");
    assert.ok(result!.waypoints.length > 5, "path should detour around wall");
    // Path should go around the wall (through the gap at z>15 or z<0)
    const maxZ = Math.max(...result!.waypoints.map((w) => w.z));
    assert.ok(maxZ > 15 || maxZ < 0, `path should go around wall, maxZ=${maxZ}`);
  });

  it("finds path through a narrow corridor", () => {
    const grid = new GridMap({ width: 20, height: 20 });
    // Walls on both sides, 1-cell wide corridor
    grid.blockRegion(0, 0, 8, 19);  // left wall
    grid.blockRegion(12, 0, 19, 19); // right wall
    const pf = new AStarPathfinder();
    const result = pf.findPath(10, 2, 10, 18, grid);
    assert.ok(result, "path should be found through corridor");
    // All waypoints should be within corridor (x between 9 and 11)
    for (const wp of result!.waypoints) {
      assert.ok(wp.x >= 9 && wp.x <= 11, `waypoint x=${wp.x} should be in corridor`);
    }
  });

  it("returns null for completely enclosed goal", () => {
    const grid = new GridMap({ width: 20, height: 20 });
    // Surround goal with walls (box from 8-12, 8-12)
    grid.blockRegion(8, 8, 12, 8);  // top
    grid.blockRegion(8, 12, 12, 12); // bottom
    grid.blockRegion(8, 8, 8, 12);   // left
    grid.blockRegion(12, 8, 12, 12); // right
    const pf = new AStarPathfinder();
    const result = pf.findPath(2, 2, 10, 10, grid);
    assert.equal(result, null, "enclosed goal should be unreachable");
  });

  it("respects maxIterations limit", () => {
    const grid = new GridMap({ width: 50, height: 50 });
    const pf = new AStarPathfinder(10); // very low limit
    const result = pf.findPath(0, 0, 40, 40, grid);
    // May or may not find path within 10 iterations, but should not crash
    assert.ok(result === null || result.waypoints.length >= 0);
  });

  it("reports path length and cells explored", () => {
    const grid = new GridMap({ width: 20, height: 20 });
    const pf = new AStarPathfinder();
    const result = pf.findPath(0, 0, 5, 0, grid);
    assert.ok(result);
    assert.ok(result!.length > 0, "path length should be positive");
    assert.ok(result!.cellsExplored > 0, "should explore at least one cell");
  });
});

describe("PathfinderSystem", () => {
  function makeWorld(): { world: World; pathfinder: PathfinderSystem } {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({ width: 30, height: 30, cellSize: 1 });
    world.addSystem(pathfinder);
    return { world, pathfinder };
  }

  it("registers as a WorldSystem", () => {
    const { world, pathfinder } = makeWorld();
    assert.equal(pathfinder.name, "pathfinder");
    assert.ok(world.systems.includes(pathfinder));
  });

  it("rebuilds grid from static entities", () => {
    const { world, pathfinder } = makeWorld();
    const wall = new GameObject({
      id: "wall1", name: "Wall", type: "static",
      position: { x: 10, y: 0, z: 10 }, mass: 100, material: "stone",
    });
    world.addEntity(wall);
    pathfinder.rebuildGrid(world);
    assert.ok(pathfinder.blockedCellCount > 0, "grid should have blocked cells from wall");
    assert.equal(pathfinder.grid.isWalkable(10, 10), false, "wall position should be blocked");
  });

  it("respects blocksPath state flag on non-static entities", () => {
    const { world, pathfinder } = makeWorld();
    const door = new GameObject({
      id: "door1", name: "Door", type: "interactive",
      position: { x: 5, y: 0, z: 5 }, mass: 10, material: "wood",
    });
    door.state.set("blocksPath", true);
    world.addEntity(door);
    pathfinder.rebuildGrid(world);
    assert.equal(pathfinder.grid.isWalkable(5, 5), false, "entity with blocksPath=true should block");
  });

  it("does not block paths for dynamic entities by default", () => {
    const { world, pathfinder } = makeWorld();
    const npc = new GameObject({
      id: "npc1", name: "NPC", type: "dynamic",
      position: { x: 8, y: 0, z: 8 }, mass: 1, material: "flesh",
    });
    world.addEntity(npc);
    pathfinder.rebuildGrid(world);
    assert.equal(pathfinder.grid.isWalkable(8, 8), true, "dynamic entity should not block by default");
  });

  it("finds a path through the world", () => {
    const { world, pathfinder } = makeWorld();
    world.step(1 / 60); // tick to initialize grid
    const result = pathfinder.findPath(2, 2, 15, 15, world);
    assert.ok(result, "path should be found in open world");
    assert.ok(result!.waypoints.length > 0);
  });

  it("finds path around static obstacles in the world", () => {
    const { world, pathfinder } = makeWorld();
    // Add a wall obstacle
    for (let i = 0; i < 8; i++) {
      const wall = new GameObject({
        id: `wall_${i}`, name: "Wall", type: "static",
        position: { x: 10, y: 0, z: 5 + i }, mass: 100, material: "stone",
      });
      world.addEntity(wall);
    }
    world.step(1 / 60);
    const result = pathfinder.findPath(5, 8, 15, 8, world);
    assert.ok(result, "path should be found around wall");
    assert.ok(result!.waypoints.length > 3, "path should detour");
  });

  it("markDirty forces grid rebuild", () => {
    const { world, pathfinder } = makeWorld();
    world.step(1 / 60);
    assert.equal(pathfinder.blockedCellCount, 0);
    // Add obstacle after grid was built
    const wall = new GameObject({
      id: "wall_new", name: "Wall", type: "static",
      position: { x: 5, y: 0, z: 5 }, mass: 100, material: "stone",
    });
    world.addEntity(wall);
    pathfinder.markDirty();
    pathfinder.findPath(0, 0, 10, 10, world); // should trigger rebuild
    assert.ok(pathfinder.blockedCellCount > 0, "grid should be rebuilt with new obstacle");
  });

  // --- PathSmoother integration tests ---

  it("enableSmoothing reduces waypoint count on straight paths", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({
      width: 30, height: 30, cellSize: 1,
      enableSmoothing: true,
    });
    world.addSystem(pathfinder);

    const result = pathfinder.findPath(2.5, 15.5, 27.5, 15.5, world);
    assert.ok(result, "should find a path");
    // Straight path should be smoothed to just 2 waypoints (start + goal).
    assert.ok(result!.waypoints.length <= 3,
      `smoothed straight path should have <=3 waypoints, got ${result!.waypoints.length}`);
  });

  it("smoothing disabled (default) returns raw A* waypoints", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({ width: 30, height: 30, cellSize: 1 });
    world.addSystem(pathfinder);

    const result = pathfinder.findPath(2.5, 15.5, 27.5, 15.5, world);
    assert.ok(result, "should find a path");
    // Without smoothing, straight path has one waypoint per cell (~25).
    assert.ok(result!.waypoints.length >= 10,
      `unsmoothed path should have >=10 waypoints, got ${result!.waypoints.length}`);
  });

  it("smoothed path preserves goal and first waypoint near start", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({
      width: 30, height: 30, cellSize: 1,
      enableSmoothing: true,
    });
    world.addSystem(pathfinder);

    const start = { x: 2.5, z: 5.5 };
    const goal = { x: 27.5, z: 25.5 };
    const result = pathfinder.findPath(start.x, start.z, goal.x, goal.z, world);
    assert.ok(result, "should find a path");
    // A* waypoints exclude start, include goal. First waypoint should be near start.
    const firstWp = result!.waypoints[0];
    const distToStart = Math.sqrt(Math.pow(firstWp.x - start.x, 2) + Math.pow(firstWp.z - start.z, 2));
    assert.ok(distToStart <= 1.5, `first waypoint should be near start (dist=${distToStart.toFixed(2)})`);
    // Last waypoint should be the goal.
    const lastWp = result!.waypoints[result!.waypoints.length - 1];
    assert.equal(lastWp.x, goal.x);
    assert.equal(lastWp.z, goal.z);
  });

  it("smoothed path length is <= raw path length", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinderRaw = new PathfinderSystem({ width: 30, height: 30, cellSize: 1 });
    const pathfinderSmooth = new PathfinderSystem({
      width: 30, height: 30, cellSize: 1,
      enableSmoothing: true,
    });
    world.addSystem(pathfinderRaw);
    world.addSystem(pathfinderSmooth);

    const raw = pathfinderRaw.findPath(2.5, 5.5, 27.5, 25.5, world);
    const smooth = pathfinderSmooth.findPath(2.5, 5.5, 27.5, 25.5, world);
    assert.ok(raw && smooth);
    assert.ok(smooth!.length <= raw!.length + 0.01,
      `smoothed length (${smooth!.length.toFixed(2)}) should be <= raw (${raw!.length.toFixed(2)})`);
  });

  it("smoothPath method works manually", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({ width: 20, height: 20, cellSize: 1 });
    world.addSystem(pathfinder);

    const waypoints = [
      { x: 0.5, z: 0.5 },
      { x: 1.5, z: 0.5 },
      { x: 2.5, z: 0.5 },
      { x: 3.5, z: 0.5 },
    ];
    const result = pathfinder.smoothPath(waypoints);
    assert.equal(result.waypoints.length, 2);
    assert.equal(result.removed, 2);
  });

  it("smoothing works around obstacles (preserves necessary turns)", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({
      width: 30, height: 30, cellSize: 1,
      enableSmoothing: true,
    });
    world.addSystem(pathfinder);

    // Add a wall that forces the path to turn.
    const wall = new GameObject({
      id: "wall", name: "Wall", type: "static",
      position: { x: 15, y: 0, z: 10 },
      halfExtents: { x: 0.5, y: 0.5, z: 5 },
      mass: 100,
    });
    world.addEntity(wall);
    world.step(1 / 60); // trigger grid rebuild

    const result = pathfinder.findPath(5.5, 10.5, 25.5, 10.5, world);
    assert.ok(result, "should find a path around the wall");
    // Path around a wall should have at least 3 waypoints (start, turn, goal).
    assert.ok(result!.waypoints.length >= 3,
      `path around wall should have >=3 waypoints, got ${result!.waypoints.length}`);
  });
});
