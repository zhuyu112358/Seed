import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { PathFollowerSystem } from "../src/pathfinding/PathFollowerSystem.js";
import { PathfinderSystem } from "../src/pathfinding/PathfinderSystem.js";
import { PhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { MovementController } from "../src/physics/MovementController.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";

function makeWorld(withReplanning = true): { world: World; follower: PathFollowerSystem; pathfinder: PathfinderSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const pathfinder = new PathfinderSystem({
    cellSize: 1, width: 30, height: 30,
    originX: -15, originZ: -15,
    blockingTypes: ["static"],
  });
  const follower = new PathFollowerSystem({
    moveSpeed: 3,
    enableDynamicAiming: true,
    enableReplanning: withReplanning,
    replanningCheckInterval: 1,
    maxReplanningAttempts: 5,
  });
  const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 });
  const movement = new MovementController({ arrivalThreshold: 0.3 });
  world.addSystem(pathfinder);
  world.addSystem(physics);
  world.addSystem(movement);
  world.addSystem(follower);
  return { world, follower, pathfinder };
}

function makeMover(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, name: `Mover-${id}`, type: "dynamic",
    position: new Vector3(x, 0, z),
    halfExtents: new Vector3(0.3, 0.3, 0.3),
    active: true,
  });
}

function makeObstacle(id: string, x: number, z: number): GameObject {
  const obj = new GameObject({
    id, name: `Wall-${id}`, type: "static",
    position: new Vector3(x, 0, z),
    halfExtents: new Vector3(0.5, 0.5, 0.5),
    active: true,
  });
  obj.state.set("blocksPath", true);
  return obj;
}

function setPath(entity: GameObject, waypoints: Array<{ x: number; z: number }>): void {
  entity.state.set("movePath", waypoints);
  entity.state.set("movePathIndex", 0);
  entity.state.set("moveTarget", { x: waypoints[0].x, y: 0, z: waypoints[0].z });
  entity.state.set("movementMode", "physics");
}

describe("PathFollowerSystem dynamic replanning", () => {
  test("replans when new obstacle blocks the path segment", () => {
    const { world, follower, pathfinder } = makeWorld(true);

    // Create a mover at (0,0) with a straight path to (10,0).
    const mover = makeMover("mover_1", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Step a few ticks — mover should be moving toward (10,0).
    for (let i = 0; i < 10; i++) world.step(1 / 60);
    const posBeforeObstacle = mover.position.x;
    assert.ok(posBeforeObstacle > 0, `mover should have moved right, got x=${posBeforeObstacle}`);

    // Add an obstacle directly in the path at (5,0).
    const obstacle = makeObstacle("wall_1", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    // Step more ticks — replanning should detect the blocked segment and replan.
    for (let i = 0; i < 30; i++) world.step(1 / 60);

    // The mover should have replanned — its movePath should be different from the original.
    const newPath = mover.state.get("movePath") as Array<{ x: number; z: number }> | undefined;
    const replanningCount = mover.state.get("replanningCount") as number | undefined;

    // The path should have been replanned (more than 1 waypoint, going around the obstacle).
    assert.ok(newPath && newPath.length > 1, `replanned path should have >1 waypoint, got ${newPath?.length}`);
    assert.ok(replanningCount !== undefined && replanningCount >= 1, `should have replanned at least once, got ${replanningCount}`);

    // The new path should go around the obstacle (not straight through x=5,z=0).
    const goesAround = newPath.some(wp => Math.abs(wp.z) > 0.5);
    assert.ok(goesAround, "replanned path should go around the obstacle (z != 0)");
  });

  test("does not replan when enableReplanning is false", () => {
    const { world, pathfinder } = makeWorld(false);

    const mover = makeMover("mover_2", 0, 0);
    world.addEntity(mover);
    const originalPath = [{ x: 10, z: 0 }];
    setPath(mover, originalPath);

    // Add obstacle.
    const obstacle = makeObstacle("wall_2", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    for (let i = 0; i < 30; i++) world.step(1 / 60);

    // Path should be unchanged (no replanning).
    const currentPath = mover.state.get("movePath") as Array<{ x: number; z: number }> | undefined;
    const replanningCount = mover.state.get("replanningCount") as number | undefined;
    assert.equal(replanningCount, undefined, "should not have replanningCount when replanning disabled");
    // Path may be completed or still the original, but never a new multi-waypoint path.
    if (currentPath) {
      assert.equal(currentPath.length, 1, "path should still be the original single waypoint");
    }
  });

  test("respects maxReplanningAttempts limit", () => {
    const { world, follower, pathfinder } = makeWorld(true);
    // Override max attempts to 1 for testing.
    (follower as unknown as { config: { maxReplanningAttempts: number } }).config.maxReplanningAttempts = 1;

    const mover = makeMover("mover_3", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Add obstacle and step.
    const obstacle = makeObstacle("wall_3", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    for (let i = 0; i < 60; i++) world.step(1 / 60);

    const replanningCount = mover.state.get("replanningCount") as number | undefined;
    assert.ok(replanningCount !== undefined && replanningCount <= 1,
      `replanning count should not exceed max=1, got ${replanningCount}`);
  });

  test("replanning produces a path that reaches the goal", () => {
    const { world, pathfinder } = makeWorld(true);

    const mover = makeMover("mover_4", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Add obstacle blocking the direct path.
    const obstacle = makeObstacle("wall_4", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    // Run for enough ticks to potentially reach the goal.
    for (let i = 0; i < 200; i++) world.step(1 / 60);

    // The mover should be near the goal (10,0) or the path should be completed.
    const distToGoal = Math.sqrt(
      Math.pow(mover.position.x - 10, 2) + Math.pow(mover.position.z - 0, 2)
    );
    const pathCompleted = !mover.state.has("movePath");

    assert.ok(pathCompleted || distToGoal < 2.0,
      `mover should reach goal or complete path, got dist=${distToGoal.toFixed(2)}, pathCompleted=${pathCompleted}`);
  });

  test("no replanning when path segment is clear", () => {
    const { world, pathfinder } = makeWorld(true);

    const mover = makeMover("mover_5", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // No obstacles — path should be clear.
    for (let i = 0; i < 30; i++) world.step(1 / 60);

    const replanningCount = mover.state.get("replanningCount") as number | undefined;
    assert.equal(replanningCount, undefined, "should not replan when path is clear");
  });

  test("replanning clears replanningCount when path completes", () => {
    const { world, pathfinder } = makeWorld(true);

    const mover = makeMover("mover_6", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 5, z: 0 }]);

    // Add obstacle, replan, then run until path completes.
    const obstacle = makeObstacle("wall_6", 3, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    for (let i = 0; i < 200; i++) world.step(1 / 60);

    // After path completion, movePath should be deleted and replanningCount cleared.
    assert.ok(!mover.state.has("movePath"), "movePath should be cleared after completion");
    assert.ok(!mover.state.has("replanningCount"), "replanningCount should be cleared after completion");
  });
});
