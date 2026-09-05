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

  // --- Acceleration / deceleration curve tests ---

  it("acceleration mode: entity accelerates from rest to cruise speed", () => {
    const world = makeWorld();
    const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 } as PhysicsConfig);
    const mc = new MovementController({
      enableAcceleration: true,
      maxAcceleration: 5,
      maxDeceleration: 10,
      cruiseSpeed: 4,
      distanceMode: "2d",
      enableEarlyStop: false,
    });
    world.addSystem(physics);
    world.addSystem(mc);

    const body = makeBody("accel", 0, 0, 0);
    body.state.set("moveTarget", { x: 20, y: 0, z: 0 });
    world.addEntity(body);

    // After a few ticks, speed should be increasing but not yet at cruise.
    world.step(1 / 60);
    const speedAfter1 = body.velocity.length();
    assert.ok(speedAfter1 > 0, "should start accelerating");
    assert.ok(speedAfter1 < 4, "should not reach cruise speed in 1 tick at 5 m/s²");

    // After more ticks, should reach cruise speed.
    for (let i = 0; i < 60; i++) world.step(1 / 60);
    const speedAfter60 = body.velocity.length();
    assert.ok(speedAfter60 > 3.5, `should be near cruise speed, got ${speedAfter60.toFixed(2)}`);
    assert.ok(speedAfter60 <= 4.01, "should not exceed cruise speed");
  });

  it("acceleration mode: entity decelerates and stops precisely at target", () => {
    const world = makeWorld();
    const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 } as PhysicsConfig);
    const mc = new MovementController({
      enableAcceleration: true,
      maxAcceleration: 8,
      maxDeceleration: 12,
      cruiseSpeed: 5,
      distanceMode: "2d",
      enableEarlyStop: false,
    });
    world.addSystem(physics);
    world.addSystem(mc);

    const body = makeBody("decel", 0, 0, 0);
    body.state.set("moveTarget", { x: 10, y: 0, z: 0 });
    world.addEntity(body);

    let arrived = false;
    for (let i = 0; i < 300; i++) {
      world.step(1 / 60);
      if (!body.state.get("moveTarget")) {
        arrived = true;
        break;
      }
    }

    assert.ok(arrived, "should arrive at target");
    assert.ok(Math.abs(body.position.x - 10) < 0.2, `should stop near x=10, got ${body.position.x.toFixed(3)}`);
    assert.ok(body.velocity.length() < 0.1, `should be nearly stopped, speed=${body.velocity.length().toFixed(3)}`);
  });

  it("acceleration mode: does not overshoot target", () => {
    const world = makeWorld();
    const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 } as PhysicsConfig);
    const mc = new MovementController({
      enableAcceleration: true,
      maxAcceleration: 20,
      maxDeceleration: 5, // weak deceleration to test overshoot prevention
      cruiseSpeed: 8,
      distanceMode: "2d",
      enableEarlyStop: false,
    });
    world.addSystem(physics);
    world.addSystem(mc);

    const body = makeBody("overshoot", 0, 0, 0);
    body.state.set("moveTarget", { x: 5, y: 0, z: 0 });
    world.addEntity(body);

    let maxX = 0;
    for (let i = 0; i < 300; i++) {
      world.step(1 / 60);
      maxX = Math.max(maxX, body.position.x);
      if (!body.state.get("moveTarget")) break;
    }

    assert.ok(maxX <= 5.3, `should not overshoot target by more than 0.3m, maxX=${maxX.toFixed(3)}`);
  });

  it("acceleration mode disabled (default): original one-shot velocity behavior preserved", () => {
    const world = makeWorld();
    const physics = new PhysicsSystem({ gravity: 0, friction: 0.1, airResistance: 0.05 } as PhysicsConfig);
    const mc = new MovementController({ distanceMode: "2d" }); // enableAcceleration defaults false
    world.addSystem(physics);
    world.addSystem(mc);

    const body = makeBody("legacy", 0, 0, 0);
    body.velocity = new Vector3(5, 0, 0); // one-shot velocity
    body.state.set("moveTarget", { x: 3, y: 0, z: 0 });
    world.addEntity(body);

    // Should arrive and stop (original behavior).
    let arrived = false;
    for (let i = 0; i < 120; i++) {
      world.step(1 / 60);
      if (!body.state.get("moveTarget")) {
        arrived = true;
        break;
      }
    }
    assert.ok(arrived, "legacy mode should still arrive and stop");
  });

  it("acceleration mode: frame-rate independence (different dt, same arrival)", () => {
    function runWithDt(dt: number): { x: number; arrived: boolean } {
      const world = new World({ name: "test", tickRate: Math.round(1 / dt) });
      const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 } as PhysicsConfig);
      const mc = new MovementController({
        enableAcceleration: true,
        maxAcceleration: 10,
        maxDeceleration: 15,
        cruiseSpeed: 4,
        distanceMode: "2d",
        enableEarlyStop: false,
      });
      world.addSystem(physics);
      world.addSystem(mc);
      const body = makeBody("framerate", 0, 0, 0);
      body.state.set("moveTarget", { x: 8, y: 0, z: 0 });
      world.addEntity(body);
      for (let i = 0; i < 500; i++) {
        world.step(dt);
        if (!body.state.get("moveTarget")) break;
      }
      return { x: body.position.x, arrived: !body.state.get("moveTarget") };
    }

    const r60 = runWithDt(1 / 60);
    const r30 = runWithDt(1 / 30);

    assert.ok(r60.arrived, "60fps should arrive");
    assert.ok(r30.arrived, "30fps should arrive");
    // Both should stop near the target (frame-rate independent within tolerance).
    assert.ok(Math.abs(r60.x - 8) < 0.3, `60fps should stop near x=8, got ${r60.x.toFixed(3)}`);
    assert.ok(Math.abs(r30.x - 8) < 0.3, `30fps should stop near x=8, got ${r30.x.toFixed(3)}`);
  });

  it("acceleration mode: works with 3d distance mode", () => {
    const world = makeWorld();
    const physics = new PhysicsSystem({ gravity: 0, friction: 0, airResistance: 0 } as PhysicsConfig);
    const mc = new MovementController({
      enableAcceleration: true,
      maxAcceleration: 10,
      maxDeceleration: 15,
      cruiseSpeed: 5,
      distanceMode: "3d",
      enableEarlyStop: false,
    });
    world.addSystem(physics);
    world.addSystem(mc);

    const body = makeBody("3d", 0, 0, 0);
    body.state.set("moveTarget", { x: 3, y: 4, z: 0 }); // 5m away in 3D
    world.addEntity(body);

    let arrived = false;
    for (let i = 0; i < 300; i++) {
      world.step(1 / 60);
      if (!body.state.get("moveTarget")) {
        arrived = true;
        break;
      }
    }

    assert.ok(arrived, "should arrive at 3D target");
    const dist = Math.sqrt(
      Math.pow(body.position.x - 3, 2) +
      Math.pow(body.position.y - 4, 2) +
      Math.pow(body.position.z, 2),
    );
    assert.ok(dist < 0.2, `should stop near 3D target, dist=${dist.toFixed(3)}`);
  });
});
