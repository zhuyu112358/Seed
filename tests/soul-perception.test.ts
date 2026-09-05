import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { EntityArrivedEvent } from "../src/event/Event.js";
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
});