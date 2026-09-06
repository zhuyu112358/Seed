// Tests for M12 Phase 8: Narrative Integration (event perception + world state + NPC bridge).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { WorldStateNarrativeSystem, NpcNarrativeBridge } from "../src/narrative/NarrativeIntegration.js";
import {
  DEFAULT_WORLD_STATE_NARRATIVE_CONFIG,
  DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG,
} from "../src/narrative/NarrativeIntegration.js";
import type { WorldStateSnapshot } from "../src/narrative/NarrativeIntegration.js";
import { DynamicNarrativeSystem } from "../src/narrative/DynamicNarrativeSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { Event } from "../src/event/Event.js";

describe("WorldStateNarrativeSystem - Rule Management", () => {
  test("addRule and getRules", () => {
    const system = new WorldStateNarrativeSystem();
    system.addRule({
      id: "rule_1",
      name: "Night Falls",
      condition: (s) => (s.timeOfDay ?? 0) > 1080,
      narrative: { type: "world", title: "Night", description: "Night has fallen" },
    });
    assert.equal(system.getRules().length, 1);
    assert.equal(system.getRules()[0].name, "Night Falls");
  });

  test("removeRule removes a rule", () => {
    const system = new WorldStateNarrativeSystem();
    system.addRule({ id: "r1", name: "R1", condition: () => true, narrative: { type: "world", title: "T", description: "D" } });
    assert.equal(system.removeRule("r1"), true);
    assert.equal(system.getRules().length, 0);
  });

  test("setRuleEnabled toggles rule", () => {
    const system = new WorldStateNarrativeSystem();
    system.addRule({ id: "r1", name: "R1", condition: () => true, narrative: { type: "world", title: "T", description: "D" } });
    assert.equal(system.setRuleEnabled("r1", false), true);
    assert.equal(system.getRules()[0].enabled, false);
  });

  test("custom state set and get", () => {
    const system = new WorldStateNarrativeSystem();
    system.setCustomState("king_alive", false);
    assert.equal(system.getCustomState("king_alive"), false);
  });
});

describe("WorldStateNarrativeSystem - Rule Evaluation", () => {
  test("rule triggers when condition is met", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new WorldStateNarrativeSystem();
    world.addSystem(system);
    system.addRule({
      id: "many_souls",
      name: "Many Souls",
      condition: (s) => s.soulCount >= 3,
      narrative: { type: "world", title: "Crowded", description: "Many souls present" },
    });

    let eventReceived = false;
    world.events.on("narrative.world_state", () => { eventReceived = true; });

    // Add 3 souls.
    for (let i = 0; i < 3; i++) {
      world.addEntity(new GameObject({ id: `soul_${i}`, type: "soul", name: `Soul ${i}`, position: { x: i, y: 0, z: 0 } }));
    }
    world.step(1 / 60);
    assert.equal(eventReceived, true);
  });

  test("rule does not trigger when condition is not met", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new WorldStateNarrativeSystem();
    world.addSystem(system);
    system.addRule({
      id: "impossible",
      name: "Impossible",
      condition: () => false,
      narrative: { type: "world", title: "T", description: "D" },
    });

    let eventReceived = false;
    world.events.on("narrative.world_state", () => { eventReceived = true; });
    world.step(1 / 60);
    assert.equal(eventReceived, false);
  });

  test("cooldown prevents repeated triggering", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new WorldStateNarrativeSystem();
    world.addSystem(system);
    system.addRule({
      id: "cooldown_rule",
      name: "Cooldown",
      condition: () => true,
      narrative: { type: "world", title: "T", description: "D" },
      cooldown: 10,
    });

    let count = 0;
    world.events.on("narrative.world_state", () => { count++; });
    for (let i = 0; i < 5; i++) world.step(1 / 60);
    // Should only trigger once (first tick), then cooldown blocks.
    assert.equal(count, 1);
  });

  test("disabled rule does not trigger", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new WorldStateNarrativeSystem();
    world.addSystem(system);
    system.addRule({
      id: "disabled",
      name: "Disabled",
      condition: () => true,
      narrative: { type: "world", title: "T", description: "D" },
      enabled: false,
    });

    let eventReceived = false;
    world.events.on("narrative.world_state", () => { eventReceived = true; });
    world.step(1 / 60);
    assert.equal(eventReceived, false);
  });
});

describe("WorldStateNarrativeSystem - Snapshot", () => {
  test("buildSnapshot contains world state", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new WorldStateNarrativeSystem();
    world.addSystem(system);
    world.addEntity(new GameObject({ id: "e1", type: "soul", name: "E1", position: { x: 0, y: 0, z: 0 } }));
    system.setCustomState("test_key", "test_value");
    world.step(1 / 60);
    const snapshot = system.buildSnapshot(world);
    assert.equal(snapshot.entityCount, 1);
    assert.equal(snapshot.soulCount, 1);
    assert.equal(snapshot.custom.test_key, "test_value");
  });
});

describe("NpcNarrativeBridge - Mappings", () => {
  test("addMapping and getMappings", () => {
    const bridge = new NpcNarrativeBridge();
    bridge.addMapping({
      id: "map_1",
      npcId: "npc_1",
      behaviorType: "schedule.activity_started",
      narrativeTemplate: { type: "character", title: "NPC Working", description: "NPC started work" },
    });
    assert.equal(bridge.getMappings().length, 1);
  });

  test("removeMapping removes a mapping", () => {
    const bridge = new NpcNarrativeBridge();
    bridge.addMapping({ id: "m1", npcId: "*", behaviorType: "test", narrativeTemplate: { type: "character", title: "T", description: "D" } });
    assert.equal(bridge.removeMapping("m1"), true);
    assert.equal(bridge.getMappings().length, 0);
  });

  test("triggerNarrativeFromBehavior emits event for matching mapping", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const bridge = new NpcNarrativeBridge();
    world.addSystem(bridge);
    bridge.addMapping({
      id: "map_1",
      npcId: "npc_1",
      behaviorType: "action.completed",
      narrativeTemplate: { type: "character", title: "Action Done", description: "NPC completed action", severity: "medium" },
    });
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("narrative.npc_behavior", () => { eventReceived = true; });
    bridge.triggerNarrativeFromBehavior("action.completed", "npc_1", { action: "attack" });
    assert.equal(eventReceived, true);
  });

  test("triggerNarrativeFromBehavior does not emit for non-matching npc", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const bridge = new NpcNarrativeBridge();
    world.addSystem(bridge);
    bridge.addMapping({
      id: "map_1",
      npcId: "npc_1",
      behaviorType: "action.completed",
      narrativeTemplate: { type: "character", title: "T", description: "D" },
    });
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("narrative.npc_behavior", () => { eventReceived = true; });
    bridge.triggerNarrativeFromBehavior("action.completed", "npc_2", {});
    assert.equal(eventReceived, false);
  });

  test("wildcard npcId matches all NPCs", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const bridge = new NpcNarrativeBridge();
    world.addSystem(bridge);
    bridge.addMapping({
      id: "map_1",
      npcId: "*",
      behaviorType: "action.completed",
      narrativeTemplate: { type: "character", title: "T", description: "D" },
    });
    world.step(1 / 60);

    let count = 0;
    world.events.on("narrative.npc_behavior", () => { count++; });
    bridge.triggerNarrativeFromBehavior("action.completed", "npc_1", {});
    bridge.triggerNarrativeFromBehavior("action.completed", "npc_2", {});
    assert.equal(count, 2);
  });
});

describe("NpcNarrativeBridge - Influences", () => {
  test("applyInfluence and getActiveInfluences", () => {
    const bridge = new NpcNarrativeBridge();
    bridge.applyInfluence({
      id: "inf_1",
      narrativeEventType: "narrative.arc_started",
      npcId: "npc_1",
      modifier: { aggression: 0.5 },
      active: false,
    });
    const active = bridge.getActiveInfluences("npc_1");
    assert.equal(active.length, 1);
    assert.equal(active[0].modifier.aggression, 0.5);
  });

  test("getCombinedModifier merges multiple influences", () => {
    const bridge = new NpcNarrativeBridge();
    bridge.applyInfluence({ id: "i1", narrativeEventType: "t1", npcId: "npc_1", modifier: { a: 1 }, active: false });
    bridge.applyInfluence({ id: "i2", narrativeEventType: "t2", npcId: "npc_1", modifier: { b: 2 }, active: false });
    const combined = bridge.getCombinedModifier("npc_1");
    assert.equal(combined.a, 1);
    assert.equal(combined.b, 2);
  });

  test("influence expires after duration", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const bridge = new NpcNarrativeBridge();
    world.addSystem(bridge);
    bridge.applyInfluence({
      id: "inf_1",
      narrativeEventType: "t1",
      npcId: "npc_1",
      modifier: { x: 1 },
      duration: 3,
      active: false,
    });
    assert.equal(bridge.getActiveInfluences("npc_1").length, 1);
    for (let i = 0; i < 5; i++) world.step(1 / 60);
    assert.equal(bridge.getActiveInfluences("npc_1").length, 0);
  });

  test("removeInfluence removes influence", () => {
    const bridge = new NpcNarrativeBridge();
    bridge.applyInfluence({ id: "i1", narrativeEventType: "t1", npcId: "npc_1", modifier: {}, active: false });
    assert.equal(bridge.removeInfluence("i1"), true);
    assert.equal(bridge.getActiveInfluences("npc_1").length, 0);
  });
});

describe("Narrative Event Perception - SoulPerceptionSystem", () => {
  test("dynamic narrative event is perceived by souls", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const perception = new SoulPerceptionSystem();
    const narrative = new DynamicNarrativeSystem();
    world.addSystem(perception);
    world.addSystem(narrative);
    world.addEntity(new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } }));
    world.step(1 / 60); // Initialize event listeners.

    narrative.recordEvent("climax", "Final Battle", "The final battle begins");
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const narrativeEvents = frame.events.filter(e => e.type === "narrative.event_recorded");
    assert.ok(narrativeEvents.length >= 1, `Expected at least 1 narrative event, got ${narrativeEvents.length}`);
  });

  test("task chain completed event is perceived by souls", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    world.addEntity(new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } }));
    world.step(1 / 60);

    // Manually emit a task chain completed event.
    world.events.emit(new Event({
      type: "taskchain.chain_completed",
      payload: { chainId: "c1", chainName: "Test Chain" },
      sourceId: "c1",
    }));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const taskEvents = frame.events.filter(e => e.type === "taskchain.chain_completed");
    assert.ok(taskEvents.length >= 1, `Expected at least 1 task chain event, got ${taskEvents.length}`);
  });
});

describe("Configuration Defaults", () => {
  test("DEFAULT_WORLD_STATE_NARRATIVE_CONFIG has expected values", () => {
    assert.equal(DEFAULT_WORLD_STATE_NARRATIVE_CONFIG.emitEvents, true);
    assert.equal(DEFAULT_WORLD_STATE_NARRATIVE_CONFIG.maxRulesPerTick, 100);
  });

  test("DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG has expected values", () => {
    assert.equal(DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG.emitNarrativeFromNpc, true);
    assert.equal(DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG.applyInfluences, true);
  });
});
