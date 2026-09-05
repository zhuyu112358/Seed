import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { InteractionSystem, createDoorDef, createToggleDef } from "../src/entity/InteractionSystem.js";
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

  // === InteractionSystem integration tests ===

  it("interact triggers InteractionSystem state transition (door opens)", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const interaction = new InteractionSystem();
    const action = new SoulActionSystem();
    world.addSystem(interaction);
    world.addSystem(action);

    const door = new GameObject({ id: "door1", name: "Wooden Door", type: "interactive", position: { x: 1, y: 0, z: 0 } });
    world.addEntity(door);
    world.addEntity(makeSoul("vex", 0, 0, 0));
    interaction.register(createDoorDef("door1"));

    assert.equal(interaction.getState("door1"), "closed");
    const result = action.executeAction({
      soulId: "vex", action: "interact", targetId: "door1",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.ok(result.success);
    assert.equal(interaction.getState("door1"), "open");
    assert.equal((result.data as { newState: string }).newState, "open");
    assert.equal((result.data as { previousState: string }).previousState, "closed");
    assert.equal((result.data as { transitioned: boolean }).transitioned, true);
  });

  it("interact toggles door open -> closed on second interaction", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const interaction = new InteractionSystem();
    const action = new SoulActionSystem();
    world.addSystem(interaction);
    world.addSystem(action);

    const door = new GameObject({ id: "door1", name: "Door", type: "interactive", position: { x: 1, y: 0, z: 0 } });
    world.addEntity(door);
    world.addEntity(makeSoul("vex", 0, 0, 0));
    interaction.register(createDoorDef("door1"));

    action.executeAction({ soulId: "vex", action: "interact", targetId: "door1", parameters: {}, timestamp: Date.now() }, world);
    assert.equal(interaction.getState("door1"), "open");
    action.executeAction({ soulId: "vex", action: "interact", targetId: "door1", parameters: {}, timestamp: Date.now() }, world);
    assert.equal(interaction.getState("door1"), "closed");
  });

  it("use triggers InteractionSystem use with counter", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const interaction = new InteractionSystem();
    const action = new SoulActionSystem();
    world.addSystem(interaction);
    world.addSystem(action);

    const torch = new GameObject({ id: "torch1", name: "Torch", type: "interactive", position: { x: 1, y: 0, z: 0 } });
    world.addEntity(torch);
    world.addEntity(makeSoul("vex", 0, 0, 0));
    interaction.register(createToggleDef("torch1"));

    const result = action.executeAction({
      soulId: "vex", action: "use", targetId: "torch1",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.ok(result.success);
    const runtime = interaction.getRuntime("torch1")!;
    assert.equal(runtime.useCount, 1);
  });

  it("interact falls back to counter-only when InteractionSystem not registered", () => {
    const { world, action } = makeWorld(); // no InteractionSystem
    const door = new GameObject({ id: "door1", name: "Door", type: "interactive", position: { x: 1, y: 0, z: 0 } });
    world.addEntity(door);
    world.addEntity(makeSoul("vex", 0, 0, 0));

    const result = action.executeAction({
      soulId: "vex", action: "interact", targetId: "door1",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.ok(result.success);
    assert.equal(door.state.get("interactionCount"), 1);
    // No state transition data when InteractionSystem is absent.
    assert.equal((result.data as { newState?: string }).newState, undefined);
  });

  it("interact emits interaction.state-change event via world.events", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const interaction = new InteractionSystem();
    const action = new SoulActionSystem();
    world.addSystem(interaction);
    world.addSystem(action);

    const door = new GameObject({ id: "door1", name: "Door", type: "interactive", position: { x: 1, y: 0, z: 0 } });
    world.addEntity(door);
    world.addEntity(makeSoul("vex", 0, 0, 0));
    interaction.register(createDoorDef("door1"));

    const emitted: unknown[] = [];
    world.events.on("interaction.state-change", (e: unknown) => { emitted.push(e); });

    action.executeAction({ soulId: "vex", action: "interact", targetId: "door1", parameters: {}, timestamp: Date.now() }, world);
    assert.equal(emitted.length, 1);
  });

  // --- Enhanced move format tests ---

  it("moves with targetPosition parameter", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { targetPosition: { x: 2, y: 0, z: 1 } }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "targetPosition");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 2);
    assert.equal(soul.position.z, 1);
  });

  it("moves with direction only (default distance)", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: { x: 1, y: 0, z: 0 } }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "direction-only");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 1); // defaultMoveDistance = 1
  });

  it("moves with direction and speed", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: { x: 0, y: 0, z: 1 }, speed: 3 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "direction+speed");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.z, 3); // speed * defaultMoveDistance = 3 * 1
  });

  it("moves with delta (dx, dy, dz)", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 1, 1, 1));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { dx: 2, dy: 0, dz: -1 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "delta");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 3); // 1 + 2
    assert.equal(soul.position.z, 0); // 1 - 1
  });

  it("returns success with zero distance when target equals current", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 5, 0, 5));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 5, y: 0, z: 5 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { distance: number }).distance, 0);
  });

  // --- Acoustic propagation communicate tests ---

  it("communicate with acoustic propagation reports heardBy listeners", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const perception = new SoulPerceptionSystem();
    const action = new SoulActionSystem({
      acoustic: { maxRadius: 50, minAudible: 0.01 },
    });
    world.addSystem(perception);
    world.addSystem(action);

    world.addEntity(makeSoul("speaker", 0, 0, 0));
    world.addEntity(makeSoul("listener1", 3, 0, 0)); // close, should hear
    world.addEntity(makeSoul("listener2", 40, 0, 0)); // far, may not hear

    const result = action.executeAction({
      soulId: "speaker", action: "communicate",
      parameters: { content: "Hello world", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    const heardBy = (result.data as { heardBy: Array<{ id: string; name: string; distance: number; intensity: number }> }).heardBy;
    assert.ok(Array.isArray(heardBy));
    // listener1 at 3m should definitely hear.
    const heardListener1 = heardBy.find(h => h.id === "soul_listener1");
    assert.ok(heardListener1, "listener1 should hear the message");
    assert.ok(heardListener1.intensity > 0);
    assert.ok(heardListener1.distance > 0);
  });

  it("communicate without acoustic config falls back to legacy behavior", () => {
    const { world, action, perception } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "test message" }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { content: string }).content, "test message");
    // heardBy should be empty array when acoustic not configured.
    assert.deepEqual((result.data as { heardBy: unknown[] }).heardBy, []);
  });
});