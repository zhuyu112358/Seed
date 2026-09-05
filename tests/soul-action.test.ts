import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { InteractionSystem, createDoorDef, createToggleDef } from "../src/entity/InteractionSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { PhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { MovementController } from "../src/physics/MovementController.js";
import { PathfinderSystem } from "../src/pathfinding/PathfinderSystem.js";
import { PathFollowerSystem } from "../src/pathfinding/PathFollowerSystem.js";
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

  // --- Physics movement mode tests ---

  it("physics movement mode sets velocity instead of teleporting", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const action = new SoulActionSystem({ movementMode: "physics", physicsMoveSpeed: 4 });
    world.addSystem(action);
    world.addEntity(makeSoul("vex", 0, 0, 0));

    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 3, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    const soul = world.getEntity("soul_vex")!;
    // Position should NOT have changed (physics mode applies velocity).
    assert.equal(soul.position.x, 0);
    // Velocity should be set toward +x at 4 m/s.
    assert.equal(soul.velocity.x, 4);
    assert.equal(soul.velocity.y, 0);
    assert.equal(soul.velocity.z, 0);
    assert.equal((result.data as { mode: string }).mode, "physics:absolute");
    assert.equal((result.data as { speed: number }).speed, 4);
  });

  it("physics movement mode velocity direction is normalized", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const action = new SoulActionSystem({ movementMode: "physics", physicsMoveSpeed: 5 });
    world.addSystem(action);
    world.addEntity(makeSoul("vex", 0, 0, 0));

    action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 3, y: 4, z: 0 }, timestamp: Date.now(),
    }, world);

    const soul = world.getEntity("soul_vex")!;
    // Direction (3,4,0) has length 5, normalized is (0.6, 0.8, 0).
    // At speed 5, velocity should be (3, 4, 0).
    assert.equal(Math.round(soul.velocity.x * 100) / 100, 3);
    assert.equal(Math.round(soul.velocity.y * 100) / 100, 4);
    assert.equal(soul.velocity.z, 0);
  });

  it("physics movement with PhysicsSystem actually moves soul over ticks", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const physics = new PhysicsSystem();
    const action = new SoulActionSystem({ movementMode: "physics", physicsMoveSpeed: 6, maxMoveDistance: 20 });
    world.addSystem(physics);
    world.addSystem(action);
    world.addEntity(makeSoul("vex", 0, 0, 0));

    // Apply velocity toward +x.
    action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 10, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);

    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.velocity.x, 6);

    // Step the world 30 ticks at 1/60 dt = 0.5 seconds.
    // At 6 m/s, should move ~3m (minus friction).
    for (let i = 0; i < 30; i++) {
      world.step(1 / 60);
    }

    assert.ok(soul.position.x > 2, `soul should have moved >2m, got ${soul.position.x.toFixed(2)}m`);
    assert.ok(soul.position.x < 4, `soul should not have moved >4m in 0.5s at 6m/s, got ${soul.position.x.toFixed(2)}m`);
  });

  it("stop action zeroes velocity", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const action = new SoulActionSystem({ movementMode: "physics", physicsMoveSpeed: 5 });
    world.addSystem(action);
    world.addEntity(makeSoul("vex", 0, 0, 0));

    // First apply velocity.
    action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 5, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.velocity.x, 5);

    // Then stop.
    const result = action.executeAction({
      soulId: "vex", action: "stop",
      parameters: {}, timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    assert.equal(soul.velocity.x, 0);
    assert.equal(soul.velocity.y, 0);
    assert.equal(soul.velocity.z, 0);
    assert.equal((result.data as { previousSpeed: number }).previousSpeed, 5);
  });

  it("stop action when already stationary reports zero previous speed", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "stop",
      parameters: {}, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { previousSpeed: number }).previousSpeed, 0);
  });

  it("instant movement mode remains default when config not specified", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 2, y: 0, z: 0 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    const soul = world.getEntity("soul_vex")!;
    // Default mode is instant: position changes immediately.
    assert.equal(soul.position.x, 2);
    assert.equal((result.data as { mode: string }).mode, "absolute");
  });

  // --- String direction support tests ---

  it("moves with string direction 'south' and speed", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: "south", speed: 2 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "direction+speed");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.z, 2); // south = +z, speed * defaultMoveDistance = 2 * 1
    assert.equal(soul.position.x, 0);
  });

  it("moves with string direction 'east' only", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: "east" }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "direction-only");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 1); // east = +x, defaultMoveDistance = 1
  });

  it("moves with string direction 'north' and distance", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: "north", distance: 5 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    assert.equal((result.data as { mode: string }).mode, "direction+distance");
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.z, -5); // north = -z
  });

  it("supports diagonal string directions", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: "northeast", distance: Math.SQRT2 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    const soul = world.getEntity("soul_vex")!;
    // northeast = (0.707, 0, -0.707) * sqrt(2) = (1, 0, -1)
    assert.ok(Math.abs(soul.position.x - 1) < 0.01, `x should be ~1, got ${soul.position.x}`);
    assert.ok(Math.abs(soul.position.z + 1) < 0.01, `z should be ~-1, got ${soul.position.z}`);
  });

  it("fails gracefully on invalid string direction", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 0, 0, 0));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: "sideways", speed: 1 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("invalid direction"));
    const soul = world.getEntity("soul_vex")!;
    assert.equal(soul.position.x, 0); // position unchanged
    assert.equal(soul.position.z, 0);
  });

  it("does not produce NaN with string direction (regression test)", () => {
    const { world, action } = makeWorld();
    world.addEntity(makeSoul("vex", 5, 0, 3));
    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { direction: "south", speed: 0.3 }, timestamp: Date.now(),
    }, world);
    assert.equal(result.success, true);
    const soul = world.getEntity("soul_vex")!;
    assert.ok(!isNaN(soul.position.x), "x should not be NaN");
    assert.ok(!isNaN(soul.position.y), "y should not be NaN");
    assert.ok(!isNaN(soul.position.z), "z should not be NaN");
    assert.equal(soul.position.z, 3.3); // 3 + 0.3 * 1
  });

  // --- Pathfinding mode tests ---

  it("pathfinding mode finds path around obstacles", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({ width: 30, height: 30, cellSize: 1 });
    const action = new SoulActionSystem({ pathfindingEnabled: true, movementMode: "physics" });
    world.addSystem(pathfinder);
    world.addSystem(action);

    // Add a wall obstacle.
    for (let i = 0; i < 6; i++) {
      const wall = new GameObject({
        id: `wall_${i}`, name: "Wall", type: "static",
        position: { x: 10, y: 0, z: 5 + i }, mass: 100, material: "stone",
      });
      world.addEntity(wall);
    }
    world.addEntity(makeSoul("vex", 5, 0, 8));
    world.step(1 / 60); // build grid

    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 15, y: 0, z: 8 }, timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    const data = result.data as { waypoints: number; pathLength: number };
    assert.ok(data.waypoints > 1, `should have multiple waypoints to go around wall, got ${data.waypoints}`);
    assert.ok(data.pathLength > 10, `path should detour around wall, length=${data.pathLength}`);

    const soul = world.getEntity("soul_vex")!;
    const movePath = soul.state.get("movePath") as Array<{ x: number; z: number }>;
    assert.ok(movePath, "movePath should be set");
    assert.ok(movePath.length > 1, "movePath should have multiple waypoints");
  });

  it("pathfinding mode returns failure when no path exists", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const pathfinder = new PathfinderSystem({ width: 20, height: 20, cellSize: 1 });
    const action = new SoulActionSystem({ pathfindingEnabled: true });
    world.addSystem(pathfinder);
    world.addSystem(action);

    // Surround goal with walls (box at 10-14, 10-14).
    for (let x = 10; x <= 14; x++) {
      for (let z = 10; z <= 14; z++) {
        if (x === 10 || x === 14 || z === 10 || z === 14) {
          const wall = new GameObject({
            id: `wall_${x}_${z}`, name: "Wall", type: "static",
            position: { x, y: 0, z }, mass: 100, material: "stone",
          });
          world.addEntity(wall);
        }
      }
    }
    world.addEntity(makeSoul("vex", 2, 0, 2));
    world.step(1 / 60);

    const result = action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 12, y: 0, z: 12 }, timestamp: Date.now(),
    }, world);

    assert.equal(result.success, false);
    assert.ok(result.message.includes("no path found"));
  });

  it("full pathfinding follow cycle: move around wall and reach destination", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const physics = new PhysicsSystem({ gravity: 0 });
    const pathfinder = new PathfinderSystem({ width: 30, height: 30, cellSize: 1 });
    const action = new SoulActionSystem({ pathfindingEnabled: true, movementMode: "physics", physicsMoveSpeed: 8 });
    const controller = new MovementController({ distanceMode: "2d", enableEarlyStop: false });
    const follower = new PathFollowerSystem({ moveSpeed: 8 });
    world.addSystem(physics);
    world.addSystem(pathfinder);
    world.addSystem(action);
    world.addSystem(controller);
    world.addSystem(follower);

    // Wall obstacle at x=10, z=5-12.
    for (let i = 5; i <= 12; i++) {
      const wall = new GameObject({
        id: `wall_${i}`, name: "Wall", type: "static",
        position: { x: 10, y: 0, z: i }, mass: 100, material: "stone",
      });
      world.addEntity(wall);
    }
    world.addEntity(makeSoul("vex", 5, 0, 8));
    world.step(1 / 60); // build grid

    // Issue move to other side of wall.
    action.executeAction({
      soulId: "vex", action: "move",
      parameters: { x: 15, y: 0, z: 8 }, timestamp: Date.now(),
    }, world);

    // Run world until path completes or max ticks.
    let completed = false;
    for (let i = 0; i < 300; i++) {
      world.step(1 / 60);
      const soul = world.getEntity("soul_vex")!;
      if (!soul.state.get("movePath")) {
        completed = true;
        break;
      }
    }

    assert.ok(completed, "path should be completed within 300 ticks");
    const soul = world.getEntity("soul_vex")!;
    assert.ok(Math.abs(soul.position.x - 15) < 1.5, `should be near x=15, got ${soul.position.x.toFixed(2)}`);
    assert.ok(Math.abs(soul.position.z - 8) < 1.5, `should be near z=8, got ${soul.position.z.toFixed(2)}`);
  });
});