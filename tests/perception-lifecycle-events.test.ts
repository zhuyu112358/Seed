import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";
import {
  CollisionEnterEvent,
  CollisionExitEvent,
  TriggerEnterEvent,
  TriggerExitEvent,
} from "../src/event/Event.js";

function makeWorld(): { world: World; perception: SoulPerceptionSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const perception = new SoulPerceptionSystem({ viewDistance: 50, eventRetentionTicks: 600 });
  world.addSystem(perception);
  return { world, perception };
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id,
    name: `Soul-${id}`,
    type: "soul",
    position: new Vector3(x, 0, z),
    material: "wind",
    active: true,
  });
}

describe("SoulPerceptionSystem collision lifecycle events", () => {
  test("records CollisionEnterEvent in event buffer", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test1", 0, 0);
    world.addEntity(soul);

    // First tick sets up lazy subscriptions.
    world.step(1 / 60);

    // Emit a collision enter event (positional args: a, b, point, relativeSpeed, normal, penetration).
    world.events.emit(new CollisionEnterEvent(
      "soul_test1", "wall_1",
      { x: 0.5, y: 0, z: 0 },
      3.0, { x: 1, z: 0 }, 0.1,
    ));

    // Next tick builds the frame with the event.
    world.step(1 / 60);

    const frame = perception.getPerception("soul_test1");
    assert.ok(frame, "perception frame should exist");
    const collisionEvents = frame!.events.filter(e => e.type === "physics.collision.enter");
    assert.equal(collisionEvents.length, 1, "should have 1 collision enter event");
    assert.ok(collisionEvents[0].name.includes("wall_1"), "event name should mention wall");
    assert.equal(collisionEvents[0].severity, "high", "3 m/s should be high severity");
  });

  test("records CollisionExitEvent in event buffer", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test2", 0, 0);
    world.addEntity(soul);

    world.step(1 / 60);

    // CollisionExitEvent(a, b, lastContactPoint, contactDurationTicks)
    world.events.emit(new CollisionExitEvent(
      "soul_test2", "wall_1",
      { x: 0.5, y: 0, z: 0 },
      30,
    ));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_test2");
    assert.ok(frame);
    const exitEvents = frame!.events.filter(e => e.type === "physics.collision.exit");
    assert.equal(exitEvents.length, 1);
    assert.ok(exitEvents[0].name.includes("separated"));
    assert.ok(exitEvents[0].name.includes("30"));
    assert.equal(exitEvents[0].severity, "low");
  });

  test("collision enter severity scales with impact speed", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test3", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    // Gentle collision (< 1 m/s) -> low
    world.events.emit(new CollisionEnterEvent(
      "soul_test3", "obj_a", { x: 0, y: 0, z: 0 },
      0.5, { x: 1, z: 0 }, 0.05,
    ));
    // Medium collision (1-2 m/s) -> medium
    world.events.emit(new CollisionEnterEvent(
      "soul_test3", "obj_b", { x: 1, y: 0, z: 0 },
      1.5, { x: 1, z: 0 }, 0.1,
    ));
    // Hard collision (>= 2 m/s) -> high
    world.events.emit(new CollisionEnterEvent(
      "soul_test3", "obj_c", { x: 2, y: 0, z: 0 },
      5.0, { x: 1, z: 0 }, 0.2,
    ));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_test3");
    assert.ok(frame);
    const enterEvents = frame!.events.filter(e => e.type === "physics.collision.enter");
    assert.equal(enterEvents.length, 3);
    const gentle = enterEvents.find(e => e.name.includes("obj_a"))!;
    const medium = enterEvents.find(e => e.name.includes("obj_b"))!;
    const hard = enterEvents.find(e => e.name.includes("obj_c"))!;
    assert.equal(gentle.severity, "low");
    assert.equal(medium.severity, "medium");
    assert.equal(hard.severity, "high");
  });
});

describe("SoulPerceptionSystem trigger events", () => {
  test("records TriggerEnterEvent", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test4", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    // TriggerEnterEvent(triggerId, otherId, point)
    world.events.emit(new TriggerEnterEvent(
      "zone_safe", "soul_test4", { x: 1, y: 0, z: 1 },
    ));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_test4");
    assert.ok(frame);
    const triggerEvents = frame!.events.filter(e => e.type === "physics.trigger.enter");
    assert.equal(triggerEvents.length, 1);
    assert.ok(triggerEvents[0].name.includes("zone_safe"));
    assert.equal(triggerEvents[0].severity, "medium");
  });

  test("records TriggerExitEvent with duration", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test5", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    // TriggerExitEvent(triggerId, otherId, lastContactPoint, contactDurationTicks)
    world.events.emit(new TriggerExitEvent(
      "zone_safe", "soul_test5", { x: 1, y: 0, z: 1 }, 120,
    ));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_test5");
    assert.ok(frame);
    const exitEvents = frame!.events.filter(e => e.type === "physics.trigger.exit");
    assert.equal(exitEvents.length, 1);
    assert.ok(exitEvents[0].name.includes("zone_safe"));
    assert.ok(exitEvents[0].name.includes("120"));
    assert.equal(exitEvents[0].severity, "low");
  });
});

describe("SoulPerceptionSystem lifecycle event integration", () => {
  test("full collision lifecycle (enter + exit) appears in perception", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test6", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    // Enter collision.
    world.events.emit(new CollisionEnterEvent(
      "soul_test6", "door", { x: 0.5, y: 0, z: 0 },
      2.5, { x: 1, z: 0 }, 0.15,
    ));
    world.step(1 / 60);

    let frame = perception.getPerception("soul_test6")!;
    assert.equal(frame.events.filter(e => e.type === "physics.collision.enter").length, 1);
    assert.equal(frame.events.filter(e => e.type === "physics.collision.exit").length, 0);

    // Exit collision.
    world.events.emit(new CollisionExitEvent(
      "soul_test6", "door", { x: 0.5, y: 0, z: 0 }, 5,
    ));
    world.step(1 / 60);

    frame = perception.getPerception("soul_test6")!;
    assert.equal(frame.events.filter(e => e.type === "physics.collision.enter").length, 1);
    assert.equal(frame.events.filter(e => e.type === "physics.collision.exit").length, 1);
  });

  test("stop() unsubscribes all lifecycle event listeners", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test7", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    // Stop should unsubscribe all listeners.
    perception.stop();

    // Emit events after stop — they should not be recorded.
    world.events.emit(new CollisionEnterEvent(
      "soul_test7", "wall", { x: 0, y: 0, z: 0 },
      1.0, { x: 1, z: 0 }, 0.1,
    ));
    world.events.emit(new TriggerEnterEvent(
      "zone", "soul_test7", { x: 0, y: 0, z: 0 },
    ));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_test7");
    assert.ok(frame);
    assert.equal(frame!.events.filter(e =>
      e.type === "physics.collision.enter" || e.type === "physics.trigger.enter"
    ).length, 0);
  });

  test("events are filtered by distance in perception frame", () => {
    const { world, perception } = makeWorld();
    const soul = makeSoul("soul_test8", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    // Near event (within viewDistance * 2 = 100).
    world.events.emit(new CollisionEnterEvent(
      "soul_test8", "near_obj", { x: 5, y: 0, z: 0 },
      1.0, { x: 1, z: 0 }, 0.1,
    ));
    // Far event (beyond viewDistance * 2 = 100).
    world.events.emit(new CollisionEnterEvent(
      "soul_test8", "far_obj", { x: 200, y: 0, z: 0 },
      1.0, { x: 1, z: 0 }, 0.1,
    ));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_test8")!;
    const enterEvents = frame.events.filter(e => e.type === "physics.collision.enter");
    assert.equal(enterEvents.length, 1, "only near event should be in frame");
    assert.ok(enterEvents[0].name.includes("near_obj"));
  });
});
