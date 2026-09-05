import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { PathFollowerSystem } from "../src/pathfinding/PathFollowerSystem.js";
import { PathfinderSystem } from "../src/pathfinding/PathfinderSystem.js";
import { PhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { MovementController } from "../src/physics/MovementController.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";

function makeWorld(): { world: World; follower: PathFollowerSystem; pathfinder: PathfinderSystem; perception: SoulPerceptionSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const pathfinder = new PathfinderSystem({
    cellSize: 1, width: 30, height: 30,
    originX: -15, originZ: -15,
    blockingTypes: ["static"],
  });
  const follower = new PathFollowerSystem({
    moveSpeed: 3,
    enableDynamicAiming: true,
    enableReplanning: true,
    replanningCheckInterval: 1,
    maxReplanningAttempts: 5,
  });
  const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 });
  const movement = new MovementController({ arrivalThreshold: 0.3 });
  const perception = new SoulPerceptionSystem({ viewDistance: 50, eventRetentionTicks: 600 });
  world.addSystem(pathfinder);
  world.addSystem(physics);
  world.addSystem(movement);
  world.addSystem(follower);
  world.addSystem(perception);
  return { world, follower, pathfinder, perception };
}

function makeMover(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, name: `Mover-${id}`, type: "soul",
    position: new Vector3(x, 0, z),
    halfExtents: new Vector3(0.3, 0.3, 0.3),
    material: "wind",
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

describe("PathFollowerSystem path_replanned event", () => {
  test("emits movement.path_replanned event on successful replanning", () => {
    const { world, pathfinder } = makeWorld();

    const mover = makeMover("soul_test1", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Collect events.
    const emittedEvents: Array<{ type: string; payload: unknown }> = [];
    world.events.on("movement.path_replanned", (evt: { type: string; payload: unknown }) => {
      emittedEvents.push(evt);
    });

    // Add obstacle blocking the path.
    const obstacle = makeObstacle("wall_1", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    // Step to trigger replanning.
    for (let i = 0; i < 20; i++) world.step(1 / 60);

    assert.ok(emittedEvents.length >= 1, `should emit at least 1 path_replanned event, got ${emittedEvents.length}`);
    const evt = emittedEvents[0] as { payload: { entityId: string; oldPathLength: number; newPathLength: number; goal: { x: number; z: number }; attempt: number } };
    assert.equal(evt.payload.entityId, "soul_test1");
    assert.equal(evt.payload.oldPathLength, 1);
    assert.ok(evt.payload.newPathLength > 1, "new path should have >1 waypoints (going around obstacle)");
    assert.equal(evt.payload.goal.x, 10);
    assert.equal(evt.payload.goal.z, 0);
    assert.equal(evt.payload.attempt, 1);
  });

  test("does not emit path_replanned when no replanning occurs", () => {
    const { world } = makeWorld();

    const mover = makeMover("soul_test2", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 5, z: 0 }]);

    const emittedEvents: Array<{ type: string }> = [];
    world.events.on("movement.path_replanned", () => emittedEvents.push({ type: "x" }));

    // No obstacles — path is clear, no replanning.
    for (let i = 0; i < 30; i++) world.step(1 / 60);

    assert.equal(emittedEvents.length, 0, "should not emit path_replanned when path is clear");
  });

  test("path_replanned event has correct payload fields", () => {
    const { world, pathfinder } = makeWorld();

    const mover = makeMover("soul_test3", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    let capturedEvent: { payload: { entityId: string; oldPathLength: number; newPathLength: number; goal: { x: number; z: number }; attempt: number } } | null = null;
    world.events.on("movement.path_replanned", (evt: { payload: { entityId: string; oldPathLength: number; newPathLength: number; goal: { x: number; z: number }; attempt: number } }) => {
      capturedEvent = evt;
    });

    // Step once to set up subscriptions, then add obstacle.
    world.step(1 / 60);
    const obstacle = makeObstacle("wall_3", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();
    for (let i = 0; i < 10; i++) world.step(1 / 60);

    assert.ok(capturedEvent, "event should be captured");
    assert.equal(capturedEvent!.payload.entityId, "soul_test3");
    assert.equal(capturedEvent!.payload.oldPathLength, 1);
    assert.ok(capturedEvent!.payload.newPathLength > 1, "new path should have multiple waypoints");
    assert.equal(capturedEvent!.payload.goal.x, 10);
    assert.equal(capturedEvent!.payload.goal.z, 0);
    assert.equal(capturedEvent!.payload.attempt, 1);
  });
});

describe("SoulPerceptionSystem path_replanned integration", () => {
  test("records path_replanned event in soul perception frame", () => {
    const { world, pathfinder, perception } = makeWorld();

    const mover = makeMover("soul_test4", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Step once to set up all lazy event subscriptions in SoulPerceptionSystem.
    world.step(1 / 60);

    // Add obstacle to trigger replanning.
    const obstacle = makeObstacle("wall_4", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    // Step to trigger replanning and build perception frame.
    for (let i = 0; i < 20; i++) world.step(1 / 60);

    const frame = perception.getPerception("soul_test4");
    assert.ok(frame, "perception frame should exist");

    const replannedEvents = frame!.events.filter(e => e.type === "movement.path_replanned");
    assert.ok(replannedEvents.length >= 1, `should have at least 1 path_replanned event in perception, got ${replannedEvents.length}`);
    assert.ok(replannedEvents[0].name.includes("Path replanned"));
    assert.equal(replannedEvents[0].severity, "medium");
  });

  test("path_replanned event includes waypoint count change", () => {
    const { world, pathfinder, perception } = makeWorld();

    const mover = makeMover("soul_test5", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Step once to set up lazy subscriptions.
    world.step(1 / 60);

    const obstacle = makeObstacle("wall_5", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    for (let i = 0; i < 20; i++) world.step(1 / 60);

    const frame = perception.getPerception("soul_test5");
    const replannedEvents = frame!.events.filter(e => e.type === "movement.path_replanned");
    assert.ok(replannedEvents.length >= 1);
    // Event name should contain old→new waypoint count like "1→5 waypoints".
    assert.ok(/\d+→\d+/.test(replannedEvents[0].name),
      `event name should contain waypoint count change, got: ${replannedEvents[0].name}`);
  });

  test("stop() unsubscribes path_replanned listener", () => {
    const { world, pathfinder, perception } = makeWorld();

    const mover = makeMover("soul_test6", 0, 0);
    world.addEntity(mover);
    setPath(mover, [{ x: 10, z: 0 }]);

    // Stop perception before adding obstacle.
    perception.stop();

    const obstacle = makeObstacle("wall_6", 5, 0);
    world.addEntity(obstacle);
    pathfinder.markDirty();

    for (let i = 0; i < 20; i++) world.step(1 / 60);

    const frame = perception.getPerception("soul_test6");
    assert.ok(frame);
    // After stop(), no new path_replanned events should be recorded.
    const replannedEvents = frame!.events.filter(e => e.type === "movement.path_replanned");
    assert.equal(replannedEvents.length, 0, "should not record path_replanned after stop()");
  });
});
