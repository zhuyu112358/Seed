// Tests for PathCostSystem + Navigation Events (M9 phase 4).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { PathCostSystem } from "../src/navigation/PathCostSystem.js";
import {
  PathChangedEvent,
  PathBlockedEvent,
  ArrivedEvent,
  WaypointReachedEvent,
} from "../src/navigation/NavigationEvents.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): World {
  return new World({ name: "nav-test", tickRate: 60 });
}

describe("PathCostSystem - Modifier Management", () => {
  test("add a terrain modifier", () => {
    const system = new PathCostSystem();
    const result = system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0, "Swamp");
    assert.ok(result.success);
    const modifier = system.getModifier(result.modifierId!)!;
    assert.equal(modifier.type, "terrain");
    assert.equal(modifier.name, "Swamp");
    assert.equal(modifier.radius, 5);
    assert.equal(modifier.costMultiplier, 2.0);
    assert.equal(modifier.active, true);
  });

  test("add modifier with each type", () => {
    const system = new PathCostSystem();
    for (const type of ["terrain", "danger", "building", "zone", "custom"] as const) {
      const result = system.addModifier(type, { x: 0, z: 0 }, 3, 1.5);
      assert.ok(result.success, `Should add ${type} modifier`);
    }
    assert.equal(system.modifierCount, 5);
  });

  test("reject invalid radius", () => {
    const system = new PathCostSystem();
    const result = system.addModifier("terrain", { x: 0, z: 0 }, 0, 2.0);
    assert.ok(!result.success);
  });

  test("reject invalid cost multiplier", () => {
    const system = new PathCostSystem();
    const result = system.addModifier("terrain", { x: 0, z: 0 }, 3, 0);
    assert.ok(!result.success);
  });

  test("remove modifier", () => {
    const system = new PathCostSystem();
    const added = system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0);
    const result = system.removeModifier(added.modifierId!);
    assert.ok(result.success);
    assert.equal(system.getModifier(added.modifierId!), undefined);
  });

  test("set modifier active state", () => {
    const system = new PathCostSystem();
    const added = system.addModifier("danger", { x: 0, z: 0 }, 5, 5.0);
    system.setModifierActive(added.modifierId!, false);
    assert.equal(system.getModifier(added.modifierId!)!.active, false);
    assert.equal(system.getActiveModifiers().length, 0);
  });

  test("set cost multiplier", () => {
    const system = new PathCostSystem();
    const added = system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0);
    system.setCostMultiplier(added.modifierId!, 3.5);
    assert.equal(system.getModifier(added.modifierId!)!.costMultiplier, 3.5);
  });

  test("get modifiers by type", () => {
    const system = new PathCostSystem();
    system.addModifier("terrain", { x: 0, z: 0 }, 3, 2.0);
    system.addModifier("terrain", { x: 10, z: 10 }, 3, 1.5);
    system.addModifier("danger", { x: 5, z: 5 }, 3, 5.0);
    assert.equal(system.getModifiersByType("terrain").length, 2);
    assert.equal(system.getModifiersByType("danger").length, 1);
  });
});

describe("PathCostSystem - Cost Calculation", () => {
  test("base cost with no modifiers", () => {
    const system = new PathCostSystem({ baseCost: 1.0 });
    assert.equal(system.computePathCost({ x: 0, z: 0 }), 1.0);
    assert.equal(system.computeCostMultiplier({ x: 0, z: 0 }), 1.0);
  });

  test("cost multiplier within modifier radius", () => {
    const system = new PathCostSystem();
    system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0);
    assert.equal(system.computeCostMultiplier({ x: 0, z: 0 }), 2.0);
    assert.equal(system.computeCostMultiplier({ x: 3, z: 0 }), 2.0); // Within radius 5.
  });

  test("no multiplier outside radius", () => {
    const system = new PathCostSystem();
    system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0);
    assert.equal(system.computeCostMultiplier({ x: 10, z: 0 }), 1.0); // Outside radius 5.
  });

  test("multiple modifiers multiply", () => {
    const system = new PathCostSystem();
    system.addModifier("terrain", { x: 0, z: 0 }, 10, 2.0);
    system.addModifier("danger", { x: 0, z: 0 }, 10, 3.0);
    // Both in range: 2.0 * 3.0 = 6.0.
    assert.equal(system.computeCostMultiplier({ x: 0, z: 0 }), 6.0);
  });

  test("inactive modifier does not affect cost", () => {
    const system = new PathCostSystem();
    const added = system.addModifier("danger", { x: 0, z: 0 }, 5, 5.0);
    system.setModifierActive(added.modifierId!, false);
    assert.equal(system.computeCostMultiplier({ x: 0, z: 0 }), 1.0);
  });

  test("get modifiers at position", () => {
    const system = new PathCostSystem();
    system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0);
    system.addModifier("danger", { x: 10, z: 10 }, 5, 5.0);
    const atOrigin = system.getModifiersAtPosition({ x: 0, z: 0 });
    assert.equal(atOrigin.length, 1);
    assert.equal(atOrigin[0].type, "terrain");
  });

  test("compute segment cost", () => {
    const system = new PathCostSystem({ baseCost: 1.0 });
    // Segment from (0,0) to (10,0), no modifiers -> cost = distance = 10.
    const cost = system.computeSegmentCost({ x: 0, z: 0 }, { x: 10, z: 0 });
    assert.ok(Math.abs(cost - 10) < 0.01, `Segment cost should be ~10, got ${cost}`);
  });

  test("compute segment cost with modifier", () => {
    const system = new PathCostSystem({ baseCost: 1.0 });
    system.addModifier("terrain", { x: 5, z: 0 }, 3, 2.0); // Swamp in middle.
    const cost = system.computeSegmentCost({ x: 0, z: 0 }, { x: 10, z: 0 });
    // Should be more than base 10 due to swamp multiplier.
    assert.ok(cost > 10, `Segment cost with swamp should be > 10, got ${cost}`);
  });

  test("aStar cost function", () => {
    const system = new PathCostSystem({ baseCost: 2.0 });
    const cost = system.aStarCostFunction({ x: 0, z: 0 }, { x: 3, z: 4 }); // Distance 5.
    assert.ok(Math.abs(cost - 10) < 0.01, `A* cost should be ~10 (2.0 * 5), got ${cost}`);
  });

  test("max cost multiplier cap", () => {
    const system = new PathCostSystem({ maxCostMultiplier: 10 });
    system.addModifier("danger", { x: 0, z: 0 }, 5, 100);
    assert.equal(system.computeCostMultiplier({ x: 0, z: 0 }), 10); // Capped at 10.
  });
});

describe("Navigation Events - Perception Integration", () => {
  test("path_changed event is perceived", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);
    world.addSystem(perception);
    world.step(1 / 60); // Set up lazy subscriptions.

    world.events.emit(new PathChangedEvent({
      entityId: "soul_1",
      eventType: "path_changed",
      position: { x: 0, z: 0 },
      target: { x: 10, z: 5 },
      pathCost: 15.5,
    }));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    const pathEvent = frame.events.find((e: any) => e.type === "navigation.path_changed");
    assert.ok(pathEvent, "Should perceive path_changed event");
    assert.ok(pathEvent.name.includes("soul_1"));
  });

  test("path_blocked event is perceived with high severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);
    world.addSystem(perception);
    world.step(1 / 60);

    world.events.emit(new PathBlockedEvent({
      entityId: "soul_1",
      eventType: "path_blocked",
      position: { x: 5, z: 3 },
      reason: "collapsed bridge",
    }));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    const blockedEvent = frame.events.find((e: any) => e.type === "navigation.path_blocked");
    assert.ok(blockedEvent);
    assert.equal(blockedEvent.severity, "high");
  });

  test("arrived event is perceived with medium severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);
    world.addSystem(perception);
    world.step(1 / 60);

    world.events.emit(new ArrivedEvent({
      entityId: "soul_1",
      eventType: "arrived",
      position: { x: 10, z: 10 },
    }));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    const arrivedEvent = frame.events.find((e: any) => e.type === "navigation.arrived");
    assert.ok(arrivedEvent);
    assert.equal(arrivedEvent.severity, "medium");
  });

  test("waypoint_reached event is perceived", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);
    world.addSystem(perception);
    world.step(1 / 60);

    world.events.emit(new WaypointReachedEvent({
      entityId: "soul_1",
      eventType: "waypoint_reached",
      position: { x: 3, z: 4 },
      waypointIndex: 2,
    }));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    const wpEvent = frame.events.find((e: any) => e.type === "navigation.waypoint_reached");
    assert.ok(wpEvent);
    assert.ok(wpEvent.name.includes("#2"));
  });

  test("stop() cleans up navigation subscriptions", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    world.step(1 / 60); // Set up subscriptions.
    perception.stop();
    // Should not throw when emitting after stop.
    world.events.emit(new PathChangedEvent({
      entityId: "test", eventType: "path_changed", position: { x: 0, z: 0 },
    }));
    assert.ok(true, "Should not throw after stop");
  });
});

describe("PathCostSystem - Serialization", () => {
  test("serialize and deserialize preserves modifiers", () => {
    const system = new PathCostSystem({ baseCost: 2.0, maxCostMultiplier: 50 });
    system.addModifier("terrain", { x: 1, z: 2 }, 5, 2.5, "Swamp");
    system.addModifier("danger", { x: 3, z: 4 }, 3, 4.0, "Lava");
    const data = system.serialize();

    const system2 = new PathCostSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.modifierCount, 2);
    assert.equal(system2.config.baseCost, 2.0);
    assert.equal(system2.config.maxCostMultiplier, 50);
    const swamp = system2.getModifiersByType("terrain")[0];
    assert.equal(swamp.name, "Swamp");
    assert.equal(swamp.costMultiplier, 2.5);
  });

  test("stop clears all modifiers", () => {
    const system = new PathCostSystem();
    system.addModifier("terrain", { x: 0, z: 0 }, 5, 2.0);
    system.addModifier("danger", { x: 10, z: 10 }, 5, 5.0);
    system.stop();
    assert.equal(system.modifierCount, 0);
  });
});
