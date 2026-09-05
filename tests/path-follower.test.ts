import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PathFollowerSystem } from "../src/pathfinding/PathFollowerSystem.js";
import { MovementController } from "../src/physics/MovementController.js";
import { PhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): { world: World; follower: PathFollowerSystem; controller: MovementController } {
  const world = new World({ name: "test", tickRate: 60 });
  const physics = new PhysicsSystem({ gravity: 0 });
  const follower = new PathFollowerSystem({ moveSpeed: 5 });
  const controller = new MovementController({ distanceMode: "2d", enableEarlyStop: false });
  world.addSystem(physics);
  world.addSystem(controller);
  world.addSystem(follower);
  return { world, follower, controller };
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, name: id, type: "soul", position: { x, y: 0, z }, mass: 1, material: "wind" });
}

describe("PathFollowerSystem", () => {
  it("registers as a WorldSystem", () => {
    const { world, follower } = makeWorld();
    assert.equal(follower.name, "path-follower");
    assert.ok(world.systems.includes(follower));
  });

  it("advances to next waypoint when current target is reached", () => {
    const { world, follower } = makeWorld();
    const soul = makeSoul("soul_test", 0, 0);
    world.addEntity(soul);

    // Set up a 3-waypoint path.
    const path = [{ x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }];
    soul.state.set("movePath", path);
    soul.state.set("movePathIndex", 0);
    // First waypoint already reached (simulate MovementController clearing moveTarget).
    soul.state.delete("moveTarget");
    soul.position.x = 2;
    soul.position.z = 0;

    world.step(1 / 60);

    // Should have advanced to waypoint index 1.
    assert.equal(soul.state.get("movePathIndex"), 1);
    const target = soul.state.get("moveTarget") as { x: number; z: number };
    assert.ok(target, "moveTarget should be set");
    assert.equal(target.x, 2);
    assert.equal(target.z, 2);
    // Velocity should be applied toward next waypoint.
    assert.ok(soul.velocity.z > 0, "velocity should point toward +z");
  });

  it("clears movePath when all waypoints are completed", () => {
    const { world } = makeWorld();
    const soul = makeSoul("soul_test", 0, 0);
    world.addEntity(soul);

    // Single-waypoint path, already at the waypoint.
    soul.state.set("movePath", [{ x: 0, z: 0 }]);
    soul.state.set("movePathIndex", 0);
    soul.state.delete("moveTarget");

    world.step(1 / 60);

    assert.equal(soul.state.get("movePath"), undefined);
    assert.equal(soul.state.get("movePathIndex"), undefined);
    assert.equal(soul.state.get("moveTarget"), undefined);
  });

  it("does not advance while moveTarget is still set", () => {
    const { world } = makeWorld();
    const soul = makeSoul("soul_test", 0, 0);
    world.addEntity(soul);

    soul.state.set("movePath", [{ x: 2, z: 0 }, { x: 2, z: 2 }]);
    soul.state.set("movePathIndex", 0);
    soul.state.set("moveTarget", { x: 2, y: 0, z: 0 }); // still navigating

    world.step(1 / 60);

    // Should not advance.
    assert.equal(soul.state.get("movePathIndex"), 0);
  });

  it("integrates with MovementController for full path following", () => {
    const { world } = makeWorld();
    const soul = makeSoul("soul_test", 0, 0);
    world.addEntity(soul);

    // Set up path and initial target (simulating SoulActionSystem pathfinding mode).
    const path = [{ x: 3, z: 0 }];
    soul.state.set("movePath", path);
    soul.state.set("movePathIndex", 0);
    soul.state.set("moveTarget", { x: 3, y: 0, z: 0 });
    soul.state.set("movementMode", "physics");
    soul.velocity.x = 5; // moving toward target

    // Step until arrival (should take ~0.6s at 5m/s for 3m).
    let arrived = false;
    for (let i = 0; i < 120; i++) {
      world.step(1 / 60);
      if (!soul.state.get("moveTarget")) {
        arrived = true;
        break;
      }
    }

    assert.ok(arrived, "MovementController should detect arrival and clear moveTarget");
    assert.ok(Math.abs(soul.position.x - 3) < 0.2, `should be near x=3, got ${soul.position.x.toFixed(2)}`);
    // PathFollowerSystem should clear the path after completion.
    assert.equal(soul.state.get("movePath"), undefined);
  });

  it("handles entities without movePath gracefully", () => {
    const { world } = makeWorld();
    const soul = makeSoul("soul_test", 0, 0);
    world.addEntity(soul);
    // No movePath set.
    assert.doesNotThrow(() => world.step(1 / 60));
    assert.equal(soul.state.get("movePath"), undefined);
  });
});
