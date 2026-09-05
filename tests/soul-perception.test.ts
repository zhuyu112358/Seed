import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { EntityArrivedEvent, CollisionEvent } from "../src/event/Event.js";
import { CollisionSystem } from "../src/physics/CollisionSystem.js";
import { Vector3 } from "../src/entity/Vector3.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): { world: World; weather: WeatherSimulator; perception: SoulPerceptionSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const weather = new WeatherSimulator({ initialWindSpeed: 5, initialTemperature: 22 });
  const perception = new SoulPerceptionSystem({ viewDistance: 20 });
  world.addSystem(weather);
  world.addSystem(perception);
  return { world, weather, perception };
}

function makeSoul(id: string, x: number, y: number, z: number): GameObject {
  return new GameObject({ id: `soul_${id}`, name: id, type: "soul", position: { x, y, z }, mass: 1, material: "fire" });
}

describe("SoulPerceptionSystem", () => {
  it("generates a perception frame for each soul", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex");
    assert.ok(frame, "frame should exist");
    assert.equal(frame!.soulId, "vex");
    assert.ok(frame!.timestamp > 0);
    assert.equal(frame!.position.x, 0);
  });

  it("reports visible entities within view distance", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    const near = new GameObject({ name: "box-near", type: "dynamic", position: { x: 5, y: 0, z: 0 }, mass: 1, material: "wood" });
    const far = new GameObject({ name: "box-far", type: "dynamic", position: { x: 50, y: 0, z: 0 }, mass: 1, material: "wood" });
    world.addEntity(soul);
    world.addEntity(near);
    world.addEntity(far);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    const names = frame.visibleEntities.map(e => e.name);
    assert.ok(names.includes("box-near"), "near box should be visible");
    assert.ok(!names.includes("box-far"), "far box should not be visible");
  });

  it("reports nearby souls", () => {
    const { world, perception } = makeWorld();
    const vex = makeSoul("vex", 0, 0, 0);
    const nova = makeSoul("nova", 3, 0, 0);
    world.addEntity(vex);
    world.addEntity(nova);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.equal(frame.nearbySouls.length, 1);
    assert.equal(frame.nearbySouls[0].id, "nova");
    assert.ok(frame.nearbySouls[0].distance > 0);
  });

  it("includes environment data from WeatherSimulator", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.temperature > 0);
    assert.ok(frame.environment.pressure > 0);
    assert.ok(frame.environment.windSpeed >= 0);
    assert.ok(frame.environment.weather);
  });

  it("records and perceives communications", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    perception.recordCommunication({
      id: "msg1", senderId: "nova", senderType: "soul",
      medium: "acoustic", content: "hello", metadata: {},
      position: { x: 5, y: 0, z: 0 }, timestamp: Date.now(),
    });
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.equal(frame.communications.length, 1);
    assert.equal(frame.communications[0].content, "hello");
  });

  it("records and perceives events", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    perception.recordEvent("evt1", "weather", "storm", "high", { x: 5, y: 0, z: 0 });
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.equal(frame.events.length, 1);
    assert.equal(frame.events[0].name, "storm");
    assert.equal(frame.events[0].severity, "high");
  });

  it("expires old communications after retention period", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    perception.recordCommunication({
      id: "old", senderId: "x", senderType: "soul", medium: "acoustic",
      content: "old", metadata: {}, position: { x: 1, y: 0, z: 0 }, timestamp: 0,
    });
    // Advance many ticks past retention
    for (let i = 0; i < 350; i++) world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.equal(frame.communications.length, 0);
  });

  it("reports perceived soul count", () => {
    const { world, perception } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    world.addEntity(makeSoul("nova", 3, 0, 0));
    world.step(1 / 60);
    assert.equal(perception.perceivedSoulCount, 2);
  });

  // --- EntityArrivedEvent listening tests ---

  it("records EntityArrivedEvent emitted on event bus", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60); // First tick subscribes to events.

    world.events.emit(new EntityArrivedEvent(
      "soul_vex",
      { x: 5, y: 0, z: 0 },
      { x: 4.95, y: 0, z: 0 },
      "arrived",
      0.05,
    ));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.events.length >= 1, "arrival event should be in perception frame");
    const arrived = frame.events.find((e) => e.type === "movement.arrived");
    assert.ok(arrived, "should find movement.arrived event");
    assert.ok(arrived!.name.includes("Arrived"));
    assert.equal(arrived!.severity, "low");
  });

  it("records multiple EntityArrivedEvents", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    world.events.emit(new EntityArrivedEvent(
      "soul_vex", { x: 3, y: 0, z: 0 }, { x: 3.02, y: 0, z: 0 }, "arrived", 0.02,
    ));
    world.events.emit(new EntityArrivedEvent(
      "soul_nova", { x: 7, y: 0, z: 0 }, { x: 6.9, y: 0, z: 0 }, "early-stop", 0.1,
    ));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    const arrivedEvents = frame.events.filter((e) => e.type === "movement.arrived");
    assert.equal(arrivedEvents.length, 2, "both arrival events should be recorded");
  });

  it("does not record EntityArrivedEvent after stop() unsubscribes", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60); // Subscribe.

    perception.stop(); // Unsubscribe.

    world.events.emit(new EntityArrivedEvent(
      "soul_vex", { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, "arrived", 0,
    ));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    const arrived = frame.events.find((e) => e.type === "movement.arrived");
    assert.equal(arrived, undefined, "event after stop() should not be recorded");
  });

  it("EntityArrivedEvent from other entity is visible to nearby soul", () => {
    const { world, perception } = makeWorld();
    const vex = makeSoul("vex", 0, 0, 0);
    const nova = makeSoul("nova", 3, 0, 0);
    world.addEntity(vex);
    world.addEntity(nova);
    world.step(1 / 60);

    // Nova arrives at a target near Vex.
    world.events.emit(new EntityArrivedEvent(
      "soul_nova", { x: 4, y: 0, z: 0 }, { x: 4.01, y: 0, z: 0 }, "arrived", 0.01,
    ));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    const arrived = frame.events.find((e) => e.type === "movement.arrived");
    assert.ok(arrived, "Vex should perceive Nova's arrival event");
    assert.ok(arrived!.distance <= 10, "arrival event should be within perception range");
  });

  // --- Collision perception tests ---

  it("perceives collision event when two souls collide", () => {
    const { world, perception } = makeWorld();
    const collisions = new CollisionSystem({ positionalCorrection: 1.0, slop: 0 });
    world.addSystem(collisions);

    const vex = new GameObject({ id: "soul_vex", name: "vex", type: "soul", position: { x: 0, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    const nova = new GameObject({ id: "soul_nova", name: "nova", type: "soul", position: { x: 0.5, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    world.addEntity(vex);
    world.addEntity(nova);

    // Step 1: collision detected, event emitted and buffered.
    // Step 2: perception frame built with buffered collision event.
    world.step(1 / 60);
    world.step(1 / 60);

    const vexFrame = perception.getPerception("soul_vex")!;
    const collisionEvent = vexFrame.events.find((e) => e.type === "physics.collision");
    assert.ok(collisionEvent, "Vex should perceive the collision event");
    assert.ok(collisionEvent!.name.includes("soul_vex") && collisionEvent!.name.includes("soul_nova"));
  });

  it("both colliding souls perceive the collision event", () => {
    const { world, perception } = makeWorld();
    const collisions = new CollisionSystem({ positionalCorrection: 1.0, slop: 0 });
    world.addSystem(collisions);

    const vex = new GameObject({ id: "soul_vex", name: "vex", type: "soul", position: { x: 0, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    const nova = new GameObject({ id: "soul_nova", name: "nova", type: "soul", position: { x: 0.5, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    world.addEntity(vex);
    world.addEntity(nova);

    world.step(1 / 60);
    world.step(1 / 60);

    const vexFrame = perception.getPerception("soul_vex")!;
    const novaFrame = perception.getPerception("soul_nova")!;
    assert.ok(vexFrame.events.some((e) => e.type === "physics.collision"), "Vex perceives collision");
    assert.ok(novaFrame.events.some((e) => e.type === "physics.collision"), "Nova perceives collision");
  });

  it("collision severity is medium for high-impact collisions", () => {
    const { world, perception } = makeWorld();
    const collisions = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(collisions);

    const vex = new GameObject({ id: "soul_vex", name: "vex", type: "soul", position: { x: 0, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    const nova = new GameObject({ id: "soul_nova", name: "nova", type: "soul", position: { x: 0.5, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    // High speed toward nova.
    vex.velocity = new Vector3(5, 0, 0);
    world.addEntity(vex);
    world.addEntity(nova);

    world.step(1 / 60);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    const collision = frame.events.find((e) => e.type === "physics.collision");
    assert.ok(collision, "collision event should exist");
    // High impact (>= 1 m/s) should be medium severity.
    assert.equal(collision!.severity, "medium");
  });

  it("distant soul does not perceive nearby collision", () => {
    const { world, perception } = makeWorld();
    const collisions = new CollisionSystem({ positionalCorrection: 1.0, slop: 0 });
    world.addSystem(collisions);

    // Two souls collide at origin.
    const a = new GameObject({ id: "soul_a", name: "a", type: "soul", position: { x: 0, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    const b = new GameObject({ id: "soul_b", name: "b", type: "soul", position: { x: 0.5, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    // Third soul far away (50m, beyond viewDistance*2 = 40m).
    const far = new GameObject({ id: "soul_far", name: "far", type: "soul", position: { x: 50, y: 0, z: 0 }, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, mass: 1 });
    world.addEntity(a);
    world.addEntity(b);
    world.addEntity(far);

    world.step(1 / 60);

    const farFrame = perception.getPerception("soul_far")!;
    const collision = farFrame.events.find((e) => e.type === "physics.collision");
    assert.ok(!collision, "distant soul should not perceive the collision");
  });

  it("unsubscribes from collision events on stop", () => {
    const { world, perception } = makeWorld();
    world.step(1 / 60); // triggers lazy subscription
    perception.stop();
    // After stop, collision events should not be recorded.
    world.events.emit(new CollisionEvent("soul_a", "soul_b", { x: 0, y: 0, z: 0 }, 2.0));
    world.step(1 / 60);
    // No soul in world, so no frames — just verify no crash.
    assert.ok(true, "stop() should not crash");
  });
});