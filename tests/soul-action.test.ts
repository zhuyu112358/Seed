import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): { world: World; action: SoulActionSystem; perception: SoulPerceptionSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const weather = new WeatherSimulator();
  const perception = new SoulPerceptionSystem();
  const action = new SoulActionSystem();
  world.addSystem(weather);
  world.addSystem(perception);
  world.addSystem(action);
  return { world, action, perception };
}

function makeSoul(id: string, x = 0, y = 0, z = 0): GameObject {
  return new GameObject({ id: `soul_${id}`, name: id, type: "soul", position: { x, y, z }, mass: 1, material: "fire" });
}

describe("SoulActionSystem", () => {
  it("moves a soul to a target position", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 3, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 3);
  });

  it("rejects move exceeding max distance", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 100, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("exceeds max"));
  });

  it("interacts with an interactive entity", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const lever = new GameObject({ id: "lever1", name: "lever", type: "interactive", position: { x: 1, y: 0, z: 0 }, mass: 1, material: "metal" });
    world.addEntity(lever);
    const result = action.executeAction({
      soulId: "vex", action: "interact", targetId: "lever1",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal(lever.state.get("interactionCount"), 1);
  });

  it("rejects interaction with non-interactive entity", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const wall = new GameObject({ id: "wall1", name: "wall", type: "static", position: { x: 1, y: 0, z: 0 }, mass: 1000, material: "stone" });
    world.addEntity(wall);
    const result = action.executeAction({
      soulId: "vex", action: "interact", targetId: "wall1",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("not interactive"));
  });

  it("communicates and records in perception system", () => {
    const { world, action, perception } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    world.addEntity(makeSoul("nova", 3, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "hello nova", medium: "acoustic" }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    world.step(1 / 60);
    const novaFrame = perception.getPerception("soul_nova");
    assert.ok(novaFrame);
    assert.ok(novaFrame!.communications.some(c => c.content === "hello nova"));
  });

  it("uses a target entity", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const item = new GameObject({ id: "item1", name: "potion", type: "interactive", position: { x: 1, y: 0, z: 0 }, mass: 0.5, material: "glass" });
    world.addEntity(item);
    const result = action.executeAction({
      soulId: "vex", action: "use", targetId: "item1",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal(item.state.get("useCount"), 1);
  });

  it("attacks a target and applies knockback", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const target = new GameObject({ id: "target1", name: "dummy", type: "dynamic", position: { x: 2, y: 0, z: 0 }, mass: 1, material: "wood" });
    world.addEntity(target);
    const result = action.executeAction({
      soulId: "vex", action: "attack", targetId: "target1",
      parameters: { force: 10 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.ok(target.velocity.x > 0, "target should be knocked back in +x direction");
  });

  it("wait action always succeeds", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "wait",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.ok(result.message.includes("waits"));
  });

  it("fails for non-existent soul", () => {
    const { world, action } = makeWorld();
    const result = action.executeAction({
      soulId: "nonexistent", action: "move",
      parameters: { x: 1, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("not found"));
  });

  it("queues and processes actions on tick", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const queued = action.queueAction({
      soulId: "vex", action: "move",
      parameters: { x: 2, y: 0, z: 0 }, timestamp: Date.now(),
    });
    assert.equal(queued, true);
    assert.equal(action.queueLength, 1);
    world.step(1 / 60);
    assert.equal(action.queueLength, 0);
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 2);
  });

  it("records action history", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    action.executeAction({ soulId: "vex", action: "wait", parameters: {}, timestamp: Date.now() }, world);
    action.executeAction({ soulId: "vex", action: "move", parameters: { x: 1, y: 0, z: 0 }, timestamp: Date.now() }, world);
    const history = action.getHistory("vex");
    assert.equal(history.length, 2);
    assert.equal(history[0].request.action, "wait");
    assert.equal(history[1].request.action, "move");
  });

  it("tracks executed and failed counts", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    action.executeAction({ soulId: "vex", action: "wait", parameters: {}, timestamp: Date.now() }, world);
    action.executeAction({ soulId: "vex", action: "move", parameters: { x: 999, y: 0, z: 0 }, timestamp: Date.now() }, world);
    assert.equal(action.executedCount, 1);
    assert.equal(action.failedCount, 1);
  });
});