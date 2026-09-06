// Tests for M11 Phase 2: ActionPresets + action event perception integration.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createAttackPreset,
  createDefendPreset,
  createInteractPreset,
  createHarvestPreset,
  createBuildPreset,
  createMovePreset,
  createCommunicatePreset,
  getAllPresets,
} from "../src/action/ActionPresets.js";
import { ActionSystem } from "../src/action/ActionSystem.js";
import { World } from "../src/engine/World.js";
import { EventSystem } from "../src/event/EventSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): { world: World; events: EventSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  return { world, events: world.events };
}

describe("ActionPresets - Factory Functions", () => {
  test("createAttackPreset returns valid attack definition", () => {
    const def = createAttackPreset();
    assert.equal(def.type, "attack");
    assert.equal(def.category, "attack");
    assert.equal(def.castTime, 3);
    assert.equal(def.duration, 5);
    assert.equal(def.cooldown, 10);
    assert.equal(def.range, 3);
    assert.equal(def.cancellable, true);
    assert.equal(def.animationEvent, "attack");
  });

  test("createDefendPreset returns valid defend definition", () => {
    const def = createDefendPreset();
    assert.equal(def.type, "defend");
    assert.equal(def.category, "defend");
    assert.equal(def.duration, 30);
    assert.equal(def.cancellable, true);
  });

  test("createInteractPreset returns valid interact definition", () => {
    const def = createInteractPreset();
    assert.equal(def.type, "interact");
    assert.equal(def.category, "interact");
    assert.equal(def.range, 2);
  });

  test("createHarvestPreset returns valid harvest definition", () => {
    const def = createHarvestPreset();
    assert.equal(def.type, "harvest");
    assert.equal(def.category, "harvest");
    assert.equal(def.castTime, 5);
    assert.equal(def.duration, 10);
  });

  test("createBuildPreset returns valid build definition", () => {
    const def = createBuildPreset();
    assert.equal(def.type, "build");
    assert.equal(def.category, "build");
    assert.equal(def.cancellable, false);
    assert.equal(def.castTime, 10);
  });

  test("createMovePreset returns valid move definition", () => {
    const def = createMovePreset();
    assert.equal(def.type, "move");
    assert.equal(def.category, "move");
    assert.equal(def.castTime, 0);
    assert.equal(def.duration, 0);
    assert.equal(def.cooldown, 0);
  });

  test("createCommunicatePreset returns valid communicate definition", () => {
    const def = createCommunicatePreset();
    assert.equal(def.type, "communicate");
    assert.equal(def.category, "communicate");
    assert.equal(def.range, 10);
    assert.equal(def.animationEvent, "speak");
  });

  test("preset options override defaults", () => {
    const def = createAttackPreset({ castTime: 10, cooldown: 30, range: 5 });
    assert.equal(def.castTime, 10);
    assert.equal(def.cooldown, 30);
    assert.equal(def.range, 5);
  });

  test("getAllPresets returns 7 standard presets", () => {
    const presets = getAllPresets();
    assert.equal(presets.length, 7);
    const types = presets.map(p => p.type);
    assert.ok(types.includes("attack"));
    assert.ok(types.includes("defend"));
    assert.ok(types.includes("interact"));
    assert.ok(types.includes("harvest"));
    assert.ok(types.includes("build"));
    assert.ok(types.includes("move"));
    assert.ok(types.includes("communicate"));
  });
});

describe("ActionPresets - Integration with ActionSystem", () => {
  test("register default presets and start action", () => {
    const system = new ActionSystem();
    for (const def of getAllPresets()) {
      system.registerDefaultDefinition(def);
    }
    system.registerEntity("npc_1");
    const result = system.startAction("npc_1", "attack", "target_1");
    assert.ok(result.success);
    assert.equal(system.getActionState("npc_1"), "casting");
  });

  test("preset action completes and emits events", () => {
    const { world, events } = makeWorld();
    const system = new ActionSystem();
    system.registerDefaultDefinition(createMovePreset());
    system.registerEntity("npc_1");
    world.addSystem(system as any);

    const eventTypes: string[] = [];
    events.on("action.started", () => eventTypes.push("started"));
    events.on("action.completed", () => eventTypes.push("completed"));

    // First tick sets up event listeners in ActionSystem.
    world.step(1 / 60);
    system.startAction("npc_1", "move");
    // Move is instant, second tick completes it.
    world.step(1 / 60);
    assert.ok(eventTypes.includes("started"));
    assert.ok(eventTypes.includes("completed"));
  });
});

describe("Action Event Perception Integration", () => {
  test("SoulPerceptionSystem receives action.started events", () => {
    const { world, events } = makeWorld();
    const actionSystem = new ActionSystem();
    actionSystem.registerDefaultDefinition(createAttackPreset());
    actionSystem.registerEntity("npc_1");
    world.addSystem(actionSystem as any);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception as any);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    // First tick sets up lazy event listeners.
    world.step(1 / 60);
    // Start action and step to emit event.
    actionSystem.startAction("npc_1", "attack", "target_1");
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const actionEvents = frame.events.filter((e: any) => e.type === "action.started");
    assert.ok(actionEvents.length > 0, "Should have at least one action.started event");
    assert.ok(actionEvents[0].name.toLowerCase().includes("attack"));
  });

  test("SoulPerceptionSystem receives action.interrupted events", () => {
    const { world, events } = makeWorld();
    const actionSystem = new ActionSystem();
    actionSystem.registerDefaultDefinition(createAttackPreset());
    actionSystem.registerEntity("npc_1");
    world.addSystem(actionSystem as any);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception as any);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    world.step(1 / 60);
    actionSystem.startAction("npc_1", "attack");
    world.step(1 / 60);
    // Interrupt during casting.
    actionSystem.interruptAction("npc_1");
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    const interruptEvents = frame.events.filter((e: any) => e.type === "action.interrupted");
    assert.ok(interruptEvents.length > 0, "Should have at least one action.interrupted event");
  });

  test("SoulPerceptionSystem receives action.completed events", () => {
    const { world, events } = makeWorld();
    const actionSystem = new ActionSystem();
    actionSystem.registerDefaultDefinition(createMovePreset());
    actionSystem.registerEntity("npc_1");
    world.addSystem(actionSystem as any);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception as any);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    world.step(1 / 60);
    actionSystem.startAction("npc_1", "move");
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    const completedEvents = frame.events.filter((e: any) => e.type === "action.completed");
    assert.ok(completedEvents.length > 0, "Should have at least one action.completed event");
  });

  test("action events have correct severity for attacks", () => {
    const { world, events } = makeWorld();
    const actionSystem = new ActionSystem();
    actionSystem.registerDefaultDefinition(createAttackPreset());
    actionSystem.registerEntity("npc_1");
    world.addSystem(actionSystem as any);

    const perception = new SoulPerceptionSystem();
    world.addSystem(perception as any);
    const soul = new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(soul);

    world.step(1 / 60);
    actionSystem.startAction("npc_1", "attack");
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    const attackEvents = frame.events.filter((e: any) => e.type === "action.started" && e.name.includes("Attack"));
    assert.ok(attackEvents.length > 0);
    assert.equal(attackEvents[0].severity, "high");
  });
});


