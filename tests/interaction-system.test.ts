import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  InteractionSystem,
  createDoorDef,
  createToggleDef,
  createButtonDef,
  createContainerDef,
  createLeverDef,
} from "../src/entity/InteractionSystem.js";
import type { InteractableDef } from "../src/entity/InteractionSystem.js";

describe("InteractionSystem", () => {
  it("initializes with no interactables", () => {
    const system = new InteractionSystem();
    assert.equal(system.name, "interaction");
    assert.equal(system.count, 0);
    assert.deepEqual(system.getAllIds(), []);
  });

  it("registers an interactive object", () => {
    const system = new InteractionSystem();
    const def = createDoorDef("door1", "Wooden Door");
    assert.ok(system.register(def));
    assert.equal(system.count, 1);
    assert.ok(system.isRegistered("door1"));
    assert.equal(system.getState("door1"), "closed");
  });

  it("rejects registration with invalid initialState", () => {
    const system = new InteractionSystem();
    const def: InteractableDef = {
      entityId: "bad1",
      type: "door",
      name: "Bad",
      initialState: "invalid",
      states: ["open", "closed"],
      transitions: [{ from: "closed", to: "open" }],
    };
    assert.equal(system.register(def), false);
    assert.equal(system.count, 0);
  });

  it("door transitions closed -> open on interact", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    const result = system.interact("door1", "soul_vex");
    assert.ok(result.success);
    assert.equal(result.previousState, "closed");
    assert.equal(result.newState, "open");
    assert.equal(result.transitioned, true);
    assert.equal(system.getState("door1"), "open");
  });

  it("door transitions open -> closed on second interact", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    system.interact("door1"); // closed -> open
    const result = system.interact("door1"); // open -> closed
    assert.ok(result.success);
    assert.equal(result.previousState, "open");
    assert.equal(result.newState, "closed");
  });

  it("toggle switches off -> on -> off", () => {
    const system = new InteractionSystem();
    system.register(createToggleDef("switch1", "Light Switch"));
    assert.equal(system.getState("switch1"), "off");
    let r = system.interact("switch1");
    assert.equal(r.newState, "on");
    r = system.interact("switch1");
    assert.equal(r.newState, "off");
  });

  it("button pressed -> released on each interact", () => {
    const system = new InteractionSystem();
    system.register(createButtonDef("btn1"));
    assert.equal(system.getState("btn1"), "released");
    let r = system.interact("btn1");
    assert.equal(r.newState, "pressed");
    r = system.interact("btn1");
    assert.equal(r.newState, "released");
  });

  it("lever down -> up -> down", () => {
    const system = new InteractionSystem();
    system.register(createLeverDef("lever1"));
    assert.equal(system.getState("lever1"), "down");
    let r = system.interact("lever1");
    assert.equal(r.newState, "up");
    r = system.interact("lever1");
    assert.equal(r.newState, "down");
  });

  it("container open -> closed", () => {
    const system = new InteractionSystem();
    system.register(createContainerDef("chest1", "Treasure Chest"));
    assert.equal(system.getState("chest1"), "closed");
    const r = system.interact("chest1");
    assert.equal(r.newState, "open");
  });

  it("fails when interacting with unregistered entity", () => {
    const system = new InteractionSystem();
    const result = system.interact("nonexistent");
    assert.equal(result.success, false);
    assert.equal(result.transitioned, false);
    assert.ok(result.message.includes("not registered"));
  });

  it("fails when no transition exists from current state", () => {
    const system = new InteractionSystem();
    const def: InteractableDef = {
      entityId: "oneway1",
      type: "custom",
      name: "OneWay",
      initialState: "initial",
      states: ["initial", "final"],
      transitions: [{ from: "initial", to: "final" }],
      // No transition from 'final' - stuck
    };
    system.register(def);
    system.interact("oneway1"); // initial -> final
    const result = system.interact("oneway1"); // final -> ???
    assert.equal(result.success, false);
    assert.ok(result.message.includes("no transition"));
  });

  it("tracks interaction count and actor", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    system.interact("door1", "soul_vex");
    system.interact("door1", "soul_nova");
    const runtime = system.getRuntime("door1")!;
    assert.equal(runtime.interactCount, 2);
    assert.equal(runtime.lastInteractedBy, "soul_nova");
    assert.ok(runtime.lastInteractedAt > 0);
  });

  it("use increments use count for usable objects", () => {
    const system = new InteractionSystem();
    system.register(createToggleDef("torch1", "Torch"));
    const r1 = system.use("torch1", "soul_vex");
    assert.ok(r1.success);
    const runtime = system.getRuntime("torch1")!;
    assert.equal(runtime.useCount, 1);
    assert.equal(runtime.lastUsedBy, "soul_vex");
  });

  it("use fails for non-usable objects", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1")); // doors are not usable by default
    const result = system.use("door1");
    assert.equal(result.success, false);
    assert.ok(result.message.includes("not usable"));
  });

  it("use respects maxUses and reports depletion", () => {
    const system = new InteractionSystem();
    const def: InteractableDef = {
      entityId: "torch1",
      type: "toggle",
      name: "Torch",
      initialState: "off",
      states: ["on", "off"],
      transitions: [{ from: "off", to: "on" }, { from: "on", to: "off" }],
      usable: true,
      maxUses: 3,
    };
    system.register(def);
    system.use("torch1");
    system.use("torch1");
    const r3 = system.use("torch1");
    assert.ok(r3.success);
    assert.ok(r3.message.includes("depleted"));
    const r4 = system.use("torch1");
    assert.equal(r4.success, false);
    assert.ok(r4.message.includes("depleted"));
  });

  it("reset restores initial state and clears counters", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    system.interact("door1", "soul_vex");
    system.interact("door1", "soul_nova");
    assert.equal(system.getState("door1"), "closed");
    const runtime = system.getRuntime("door1")!;
    assert.equal(runtime.interactCount, 2);
    system.reset("door1");
    assert.equal(system.getState("door1"), "closed");
    assert.equal(runtime.interactCount, 0);
    assert.equal(runtime.lastInteractedBy, null);
  });

  it("unregister removes interactive object", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    assert.ok(system.unregister("door1"));
    assert.equal(system.count, 0);
    assert.equal(system.isRegistered("door1"), false);
  });

  it("getStats returns aggregated statistics", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    system.register(createToggleDef("switch1"));
    system.register(createLeverDef("lever1"));
    system.interact("door1");
    system.interact("switch1");
    const stats = system.getStats();
    assert.equal(stats.totalRegistered, 3);
    assert.equal(stats.totalInteractions, 2);
    assert.equal(stats.byType.door, 1);
    assert.equal(stats.byType.toggle, 1);
    assert.equal(stats.byType.lever, 1);
  });

  it("emits events on state transition when EventSystem provided", () => {
    const system = new InteractionSystem();
    system.register(createDoorDef("door1"));
    const emitted: unknown[] = [];
    const mockEvents = { emit: (e: unknown) => { emitted.push(e); } };
    system.interact("door1", "soul_vex", mockEvents as never);
    assert.equal(emitted.length, 1);
    const event = emitted[0] as { type: string; data: Record<string, unknown> };
    assert.equal(event.type, "interaction.state-change");
    assert.equal(event.payload.entityId, "door1");
    assert.equal(event.payload.previousState, "closed");
    assert.equal(event.payload.newState, "open");
    assert.equal(event.payload.actorId, "soul_vex");
  });

  it("emits events on use when EventSystem provided", () => {
    const system = new InteractionSystem();
    system.register(createToggleDef("torch1"));
    const emitted: unknown[] = [];
    const mockEvents = { emit: (e: unknown) => { emitted.push(e); } };
    system.use("torch1", "soul_vex", mockEvents as never);
    assert.equal(emitted.length, 1);
    const event = emitted[0] as { type: string; data: Record<string, unknown> };
    assert.equal(event.type, "interaction.use");
    assert.equal(event.payload.useCount, 1);
  });

  it("respects maxInteractables config", () => {
    const system = new InteractionSystem({ maxInteractables: 2 });
    assert.ok(system.register(createDoorDef("d1")));
    assert.ok(system.register(createDoorDef("d2")));
    assert.equal(system.register(createDoorDef("d3")), false);
    assert.equal(system.count, 2);
  });

  it("custom state machine with 3 states", () => {
    const system = new InteractionSystem();
    const def: InteractableDef = {
      entityId: "lock1",
      type: "custom",
      name: "Combination Lock",
      initialState: "locked",
      states: ["locked", "unlocking", "unlocked"],
      transitions: [
        { from: "locked", to: "unlocking" },
        { from: "unlocking", to: "unlocked" },
        { from: "unlocked", to: "locked" },
      ],
    };
    system.register(def);
    assert.equal(system.getState("lock1"), "locked");
    system.interact("lock1");
    assert.equal(system.getState("lock1"), "unlocking");
    system.interact("lock1");
    assert.equal(system.getState("lock1"), "unlocked");
    system.interact("lock1");
    assert.equal(system.getState("lock1"), "locked");
  });

  it("WorldSystem tick does not throw", () => {
    const system = new InteractionSystem();
    const mockWorld = { tick: 0, worldTime: 0, entities: new Map(), systems: [], events: null } as never;
    const mockEvents = { emit: () => {} } as never;
    // Should not throw.
    system.tick(1 / 60, mockWorld, mockEvents);
    assert.ok(true);
  });
});
