import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MovementController } from "../src/physics/MovementController.js";
import { PhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { PhysicsConfig } from "../src/physics/PhysicsConfig.js";
import { EntityArrivedEvent } from "../src/event/Event.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";

function makeBody(id: string, x = 0, y = 0, z = 0): GameObject {
  return new GameObject({ id, name: id, type: "dynamic", position: { x, y, z } });
}

function makeWorld(): World {
  return new World({ name: "test", tickRate: 60 });
}

describe("MovementController", () => {
  it("initializes with default config", () => {
    const mc = new MovementController();
    assert.equal(mc.name, "movement-controller");
    assert.equal(mc.enabled, true);
    assert.equal(mc.config.arrivalThreshold, 0.15);
    assert.equal(mc.config.enableEarlyStop, true);
    assert.equal(mc.config.minSpeed, 0.05);
  });

  it("accepts custom config", () => {
    const mc = new MovementController({ arrivalThreshold: 0.5, minSpeed: 0.1 });
    assert.equal(mc.config.arrivalThreshold, 0.5);
    assert.equal(mc.config.minSpeed, 0.1);
  });

  it("stops entity when it arrives within threshold of moveTarget", () => {
    const world = makeWorld();
    const mc = new MovementController({ arrivalThreshold: 0.2 });
    world.addSystem(mc);

    const body = makeBody("b1", 0.9, 0, 0);
    body.velocity = new Vector3(1, 0, 0);
    body.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    body.state.set("movementMode", "physics");
    world.addEntity(body);

    world.step(1 / 60);

    // Distance from (0.9,0,0) to (1.0,0,0) is 0.1, within threshold 0.2.
    assert.equal(body.velocity.x, 0);
    assert.equal(body.velocity.y, 0);
    assert.equal(body.velocity.z, 0);
    assert.equal(body.state.has("moveTarget"), false);
    assert.equal(body.state.get("movementMode"), "stopped");
    assert.equal(body.state.get("stopReason"), "arrived");
  });

  it("does not stop entity when far from moveTarget", () => {
    const world = makeWorld();
    const mc = new MovementController({ arrivalThreshold: 0.1, enableEarlyStop: false });
    world.addSystem(mc);

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(5, 0, 0);
    body.state.set("moveTarget", { x: 10, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    // Distance 10m, well beyond threshold. Velocity should be unchanged.
    assert.equal(body.velocity.x, 5);
    assert.equal(body.state.has("moveTarget"), true);
  });

  it("early-stops entity when speed drops below minSpeed", () => {
    const world = makeWorld();
    const mc = new MovementController({ enableEarlyStop: true, minSpeed: 0.1 });
    world.addSystem(mc);

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(0.03, 0, 0); // Below minSpeed 0.1
    body.state.set("moveTarget", { x: 5, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    assert.equal(body.velocity.x, 0);
    assert.equal(body.state.has("moveTarget"), false);
    assert.equal(body.state.get("stopReason"), "early-stop");
  });

  it("does not early-stop when enableEarlyStop is false", () => {
    const world = makeWorld();
    const mc = new MovementController({ enableEarlyStop: false, arrivalThreshold: 0.01 });
    world.addSystem(mc);

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(0.01, 0, 0); // Very slow but not at target
    body.state.set("moveTarget", { x: 5, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    // Should not stop: not arrived (5m away), early stop disabled.
    assert.equal(body.velocity.x, 0.01);
    assert.equal(body.state.has("moveTarget"), true);
  });

  it("ignores entities without moveTarget", () => {
    const world = makeWorld();
    const mc = new MovementController();
    world.addSystem(mc);

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(3, 0, 0);
    // No moveTarget set.
    world.addEntity(body);

    world.step(1 / 60);

    assert.equal(body.velocity.x, 3);
  });

  it("processes multiple entities independently", () => {
    const world = makeWorld();
    const mc = new MovementController({ arrivalThreshold: 0.2, enableEarlyStop: false });
    world.addSystem(mc);

    // Entity 1: near target (should stop).
    const b1 = makeBody("b1", 0.95, 0, 0);
    b1.velocity = new Vector3(1, 0, 0);
    b1.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    world.addEntity(b1);

    // Entity 2: far from target (should not stop).
    const b2 = makeBody("b2", 0, 0, 0);
    b2.velocity = new Vector3(5, 0, 0);
    b2.state.set("moveTarget", { x: 20, y: 0, z: 0 });
    world.addEntity(b2);

    world.step(1 / 60);

    assert.equal(b1.velocity.x, 0);
    assert.equal(b1.state.has("moveTarget"), false);
    assert.equal(b2.velocity.x, 5);
    assert.equal(b2.state.has("moveTarget"), true);
  });

  it("integrates with PhysicsSystem: entity moves and stops at target", () => {
    const world = makeWorld();
    // Use zero gravity so entity stays on y=0 plane (3d distance check works).
    const physics = new PhysicsSystem({ config: new PhysicsConfig({ gravity: 0 }) });
    const mc = new MovementController({ arrivalThreshold: 0.2 });
    world.addSystem(physics);
    world.addSystem(mc);

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(2, 0, 0); // 2 m/s toward +x
    body.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    body.state.set("movementMode", "physics");
    world.addEntity(body);

    // Step until stopped or max 120 ticks (2 seconds).
    let stopped = false;
    for (let i = 0; i < 120; i++) {
      world.step(1 / 60);
      if (body.velocity.length() === 0 && !body.state.has("moveTarget")) {
        stopped = true;
        break;
      }
    }

    assert.ok(stopped, "entity should be stopped by MovementController within 2 seconds");
    // Should be near the target (within a reasonable tolerance).
    assert.ok(Math.abs(body.position.x - 1.0) < 0.5,
      `entity should stop near x=1.0, got x=${body.position.x.toFixed(3)}`);
    assert.equal(body.state.get("stopReason"), "arrived");
  });

  it("2d distance mode ignores y difference when checking arrival", () => {
    const world = makeWorld();
    // 2d mode: only x,z distance matters, y is ignored.
    const mc = new MovementController({ distanceMode: '2d', arrivalThreshold: 0.2, enableEarlyStop: false });
    world.addSystem(mc);

    // Entity at (0, 10, 0), target at (0.1, 0, 0).
    // 3d distance = sqrt(0.1^2 + 10^2) ≈ 10.0 (not arrived)
    // 2d distance = 0.1 (arrived!)
    const body = makeBody("b1", 0, 10, 0);
    body.velocity = new Vector3(1, 0, 0);
    body.state.set("moveTarget", { x: 0.1, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    assert.equal(body.velocity.x, 0);
    assert.equal(body.state.has("moveTarget"), false);
    assert.equal(body.state.get("stopReason"), "arrived");
  });

  it("3d distance mode includes y difference when checking arrival", () => {
    const world = makeWorld();
    const mc = new MovementController({ distanceMode: '3d', arrivalThreshold: 0.2, enableEarlyStop: false });
    world.addSystem(mc);

    // Same setup as 2d test, but 3d mode should NOT arrive due to y difference.
    const body = makeBody("b1", 0, 10, 0);
    body.velocity = new Vector3(1, 0, 0);
    body.state.set("moveTarget", { x: 0.1, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    assert.equal(body.velocity.x, 1); // Not stopped.
    assert.equal(body.state.has("moveTarget"), true);
  });

  it("tracks statistics correctly", () => {
    const world = makeWorld();
    const mc = new MovementController({ arrivalThreshold: 0.2, enableEarlyStop: true, minSpeed: 0.1 });
    world.addSystem(mc);

    // Entity 1: arrives.
    const b1 = makeBody("b1", 0.95, 0, 0);
    b1.velocity = new Vector3(1, 0, 0);
    b1.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    world.addEntity(b1);

    // Entity 2: early stop (slow).
    const b2 = makeBody("b2", 0, 0, 0);
    b2.velocity = new Vector3(0.01, 0, 0);
    b2.state.set("moveTarget", { x: 5, y: 0, z: 0 });
    world.addEntity(b2);

    // Entity 3: no moveTarget (ignored, but still checked).
    const b3 = makeBody("b3", 0, 1, 0);
    b3.velocity = new Vector3(2, 0, 0);
    world.addEntity(b3);

    world.step(1 / 60);

    const stats = mc.getStats();
    assert.equal(stats.entitiesChecked, 3);
    assert.equal(stats.arrivalsStopped, 1);
    assert.equal(stats.earlyStops, 1);
  });

  it("resetStats clears counters", () => {
    const mc = new MovementController();
    const world = makeWorld();
    world.addSystem(mc);
    const body = makeBody("b1", 0.95, 0, 0);
    body.velocity = new Vector3(1, 0, 0);
    body.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    world.addEntity(body);
    world.step(1 / 60);

    assert.ok(mc.getStats().entitiesChecked > 0);
    mc.resetStats();
    assert.equal(mc.getStats().entitiesChecked, 0);
    assert.equal(mc.getStats().arrivalsStopped, 0);
  });

  it("does nothing when disabled", () => {
    const world = makeWorld();
    const mc = new MovementController();
    mc.enabled = false;
    world.addSystem(mc);

    const body = makeBody("b1", 0.95, 0, 0);
    body.velocity = new Vector3(1, 0, 0);
    body.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    // Should not stop because controller is disabled.
    assert.equal(body.velocity.x, 1);
    assert.equal(body.state.has("moveTarget"), true);
    assert.equal(mc.getStats().entitiesChecked, 0);
  });

  // --- EntityArrivedEvent emission tests ---

  it("emits EntityArrivedEvent when entity arrives at target", () => {
    const world = makeWorld();
    const mc = new MovementController({ arrivalThreshold: 0.2 });
    world.addSystem(mc);

    let receivedEvent: EntityArrivedEvent | null = null;
    world.events.on("movement.arrived", (evt: EntityArrivedEvent) => {
      receivedEvent = evt;
    });

    const body = makeBody("b1", 0.9, 0, 0);
    body.velocity = new Vector3(1, 0, 0);
    body.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    assert.ok(receivedEvent, "EntityArrivedEvent should be emitted");
    assert.equal(receivedEvent!.type, "movement.arrived");
    assert.equal(receivedEvent!.payload.entityId, "b1");
    assert.equal(receivedEvent!.payload.stopReason, "arrived");
    assert.equal(receivedEvent!.payload.targetPosition.x, 1.0);
    assert.ok(Math.abs(receivedEvent!.payload.actualPosition.x - 0.9) < 0.01);
    assert.ok(receivedEvent!.payload.distanceToTarget <= 0.2);
  });

  it("emits EntityArrivedEvent with stopReason early-stop", () => {
    const world = makeWorld();
    const mc = new MovementController({ enableEarlyStop: true, minSpeed: 0.1, arrivalThreshold: 0.01 });
    world.addSystem(mc);

    let receivedEvent: EntityArrivedEvent | null = null;
    world.events.on("movement.arrived", (evt: EntityArrivedEvent) => {
      receivedEvent = evt;
    });

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(0.03, 0, 0); // Below minSpeed
    body.state.set("moveTarget", { x: 5, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    assert.ok(receivedEvent, "EntityArrivedEvent should be emitted on early stop");
    assert.equal(receivedEvent!.payload.stopReason, "early-stop");
    assert.equal(receivedEvent!.payload.targetPosition.x, 5);
  });

  it("does not emit EntityArrivedEvent when entity does not arrive", () => {
    const world = makeWorld();
    const mc = new MovementController({ arrivalThreshold: 0.1, enableEarlyStop: false });
    world.addSystem(mc);

    let eventCount = 0;
    world.events.on("movement.arrived", () => { eventCount++; });

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(5, 0, 0);
    body.state.set("moveTarget", { x: 10, y: 0, z: 0 });
    world.addEntity(body);

    world.step(1 / 60);

    assert.equal(eventCount, 0, "no event should be emitted when not arrived");
  });

  it("does not emit EntityArrivedEvent for entity without moveTarget", () => {
    const world = makeWorld();
    const mc = new MovementController();
    world.addSystem(mc);

    let eventCount = 0;
    world.events.on("movement.arrived", () => { eventCount++; });

    const body = makeBody("b1", 0.95, 0, 0);
    body.velocity = new Vector3(1, 0, 0);
    // No moveTarget set.
    world.addEntity(body);

    world.step(1 / 60);

    assert.equal(eventCount, 0);
    assert.equal(body.velocity.x, 1); // Not stopped.
  });

  it("emits EntityArrivedEvent during physics integration with PhysicsSystem", () => {
    const world = makeWorld();
    const physics = new PhysicsSystem({ config: new PhysicsConfig({ gravity: 0 }) });
    const mc = new MovementController({ arrivalThreshold: 0.2 });
    world.addSystem(physics);
    world.addSystem(mc);

    let arrived = false;
    world.events.on("movement.arrived", () => { arrived = true; });

    const body = makeBody("b1", 0, 0, 0);
    body.velocity = new Vector3(2, 0, 0);
    body.state.set("moveTarget", { x: 1.0, y: 0, z: 0 });
    world.addEntity(body);

    for (let i = 0; i < 120; i++) {
      world.step(1 / 60);
      if (arrived) break;
    }

    assert.ok(arrived, "EntityArrivedEvent should be emitted during physics simulation");
  });
});
