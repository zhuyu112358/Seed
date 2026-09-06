// Tests for M11 Phase 3: InteractionSessionSystem + interaction event perception.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { InteractionSessionSystem } from "../src/interaction/InteractionSessionSystem.js";
import { World } from "../src/engine/World.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): World {
  return new World({ name: "test", tickRate: 60 });
}

function makeDialogueDef() {
  return { type: "dialogue", name: "Dialogue", duration: 10, range: 5, minParticipants: 2, maxParticipants: 2, interruptible: true };
}

function makeTradeDef() {
  return { type: "trade", name: "Trade", duration: 20, range: 3, minParticipants: 2, maxParticipants: 2, interruptible: true };
}

function makeInspectDef() {
  return { type: "inspect", name: "Inspect", duration: 5, range: 2, minParticipants: 1, maxParticipants: 1, interruptible: true };
}

describe("InteractionSessionSystem - Definition Management", () => {
  test("register and get definition", () => {
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    assert.equal(system.getDefinition("dialogue")?.name, "Dialogue");
    assert.equal(system.getDefinition("dialogue")?.duration, 10);
  });

  test("definition defaults applied", () => {
    const system = new InteractionSessionSystem();
    system.registerDefinition({ type: "custom", name: "Custom" });
    const def = system.getDefinition("custom")!;
    assert.equal(def.duration, 0);
    assert.equal(def.range, 0);
    assert.equal(def.minParticipants, 1);
    assert.equal(def.interruptible, true);
  });

  test("get all definitions", () => {
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    system.registerDefinition(makeTradeDef());
    assert.equal(system.getDefinitions().length, 2);
  });
});

describe("InteractionSessionSystem - Session Lifecycle", () => {
  test("start instant interaction completes immediately", () => {
    const system = new InteractionSessionSystem();
    system.registerDefinition({ type: "greet", name: "Greet", duration: 0 });
    const result = system.startInteraction("greet", "npc_1", "npc_2");
    assert.ok(result.success);
    assert.equal(result.session?.state, "completed");
    assert.equal(result.session?.progress, 1);
  });

  test("start timed interaction is active", () => {
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    assert.ok(result.success);
    assert.equal(result.session?.state, "active");
    assert.equal(result.session?.progress, 0);
    assert.equal(result.session?.participants.length, 2);
  });

  test("fail to start unregistered interaction", () => {
    const system = new InteractionSessionSystem();
    const result = system.startInteraction("nonexistent", "npc_1");
    assert.equal(result.success, false);
    assert.ok(result.reason?.includes("not registered"));
  });

  test("fail to start when initiator is already interacting", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);
    system.startInteraction("dialogue", "npc_1", "npc_2");
    const result = system.startInteraction("dialogue", "npc_1", "npc_3");
    assert.equal(result.success, false);
    assert.ok(result.reason?.includes("already in an active interaction"));
  });

  test("fail when participant count below minimum", () => {
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef()); // minParticipants: 2
    const result = system.startInteraction("dialogue", "npc_1"); // only 1 participant
    assert.equal(result.success, false);
    assert.ok(result.reason?.includes("at least"));
  });

  test("timed interaction progresses and completes", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeInspectDef()); // duration: 5
    world.addSystem(system);
    const result = system.startInteraction("inspect", "npc_1");
    const sessionId = result.session!.id;

    // Progress halfway.
    for (let i = 0; i < 3; i++) world.step(1 / 60);
    let session = system.getSession(sessionId)!;
    assert.equal(session.state, "active");
    assert.ok(session.progress > 0 && session.progress < 1);

    // Complete.
    for (let i = 0; i < 5; i++) world.step(1 / 60);
    session = system.getSession(sessionId)!;
    assert.equal(session.state, "completed");
    assert.equal(session.progress, 1);
  });

  test("interrupt active session", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    const sessionId = result.session!.id;
    world.step(1 / 60);

    const interrupted = system.interruptSession(sessionId);
    assert.equal(interrupted, true);
    assert.equal(system.getSession(sessionId)?.state, "interrupted");
  });

  test("cannot interrupt non-interruptible session", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition({ type: "ritual", name: "Ritual", duration: 10, interruptible: false });
    world.addSystem(system);
    const result = system.startInteraction("ritual", "npc_1");
    const sessionId = result.session!.id;
    world.step(1 / 60);

    const interrupted = system.interruptSession(sessionId);
    assert.equal(interrupted, false);
    assert.equal(system.getSession(sessionId)?.state, "active");
  });

  test("cancel session", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    const sessionId = result.session!.id;

    const cancelled = system.cancelSession(sessionId);
    assert.equal(cancelled, true);
    assert.equal(system.getSession(sessionId)?.state, "cancelled");
  });

  test("isInteracting checks active sessions", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);
    assert.equal(system.isInteracting("npc_1"), false);
    system.startInteraction("dialogue", "npc_1", "npc_2");
    assert.equal(system.isInteracting("npc_1"), true);
    assert.equal(system.isInteracting("npc_2"), true);
  });
});

describe("InteractionSessionSystem - Participants", () => {
  test("add participant to active session", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition({ type: "group", name: "Group", duration: 10, maxParticipants: 4, minParticipants: 1 });
    world.addSystem(system);
    const result = system.startInteraction("group", "npc_1");
    const sessionId = result.session!.id;

    const added = system.addParticipant(sessionId, "npc_2", "participant");
    assert.equal(added, true);
    assert.equal(system.getSession(sessionId)?.participants.length, 2);
  });

  test("cannot add participant beyond max", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition({ type: "duel", name: "Duel", duration: 10, maxParticipants: 2, minParticipants: 2 });
    world.addSystem(system);
    const result = system.startInteraction("duel", "npc_1", "npc_2");
    const sessionId = result.session!.id;

    const added = system.addParticipant(sessionId, "npc_3", "observer");
    assert.equal(added, false);
  });

  test("remove participant cancels session if initiator leaves", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    const sessionId = result.session!.id;

    system.removeParticipant(sessionId, "npc_1");
    assert.equal(system.getSession(sessionId)?.state, "cancelled");
  });

  test("getEntitySessions returns all sessions for entity", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    system.registerDefinition(makeInspectDef());
    world.addSystem(system);

    system.startInteraction("inspect", "npc_1");
    // Complete inspect.
    for (let i = 0; i < 10; i++) world.step(1 / 60);
    system.startInteraction("dialogue", "npc_1", "npc_2");

    const sessions = system.getEntitySessions("npc_1");
    assert.ok(sessions.length >= 2);
  });
});

describe("InteractionSessionSystem - Events", () => {
  test("emits interaction.started event", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);

    let eventReceived = false;
    world.events.on("interaction.started", () => { eventReceived = true; });

    world.step(1 / 60);
    system.startInteraction("dialogue", "npc_1", "npc_2");
    assert.equal(eventReceived, true);
  });

  test("emits interaction.completed event", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeInspectDef());
    world.addSystem(system);

    let completedCount = 0;
    world.events.on("interaction.completed", () => { completedCount++; });

    world.step(1 / 60);
    system.startInteraction("inspect", "npc_1");
    for (let i = 0; i < 10; i++) world.step(1 / 60);
    assert.ok(completedCount >= 1);
  });

  test("emits interaction.interrupted event", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);

    let interrupted = false;
    world.events.on("interaction.interrupted", () => { interrupted = true; });

    world.step(1 / 60);
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    world.step(1 / 60);
    system.interruptSession(result.session!.id);
    assert.equal(interrupted, true);
  });
});

describe("Interaction Event Perception Integration", () => {
  test("SoulPerceptionSystem receives interaction.started events", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    world.step(1 / 60);
    system.startInteraction("dialogue", "npc_1", "npc_2");
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const interactionEvents = (frame.events as any[]).filter(e => e.type === "interaction.started");
    assert.ok(interactionEvents.length > 0, "Should have interaction.started event");
    assert.ok(interactionEvents[0].name.includes("Dialogue"));
  });

  test("SoulPerceptionSystem receives interaction.completed events", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeInspectDef());
    world.addSystem(system);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    world.step(1 / 60);
    system.startInteraction("inspect", "npc_1");
    for (let i = 0; i < 10; i++) world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    const completedEvents = (frame.events as any[]).filter(e => e.type === "interaction.completed");
    assert.ok(completedEvents.length > 0, "Should have interaction.completed event");
  });

  test("SoulPerceptionSystem receives interaction.interrupted events", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "Test", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    world.step(1 / 60);
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    world.step(1 / 60);
    system.interruptSession(result.session!.id);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    const interruptedEvents = (frame.events as any[]).filter(e => e.type === "interaction.interrupted");
    assert.ok(interruptedEvents.length > 0, "Should have interaction.interrupted event");
  });
});

describe("InteractionSessionSystem - Serialization", () => {
  test("serialize and deserialize preserves state", () => {
    const world = makeWorld();
    const system = new InteractionSessionSystem();
    system.registerDefinition(makeDialogueDef());
    world.addSystem(system);
    const result = system.startInteraction("dialogue", "npc_1", "npc_2");
    world.step(1 / 60);

    const data = system.serialize();
    const system2 = new InteractionSessionSystem();
    system2.deserialize(data as Record<string, unknown>);

    assert.equal(system2.getDefinition("dialogue")?.name, "Dialogue");
    assert.equal(system2.getSession(result.session!.id)?.state, "active");
    assert.equal(system2.isInteracting("npc_1"), true);
  });
});
