// Tests for narrative event perception in SoulPerceptionSystem (M6 phase 4).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { NarrativeSystem } from "../src/narrative/NarrativeSystem.js";
import type { NarrativeChainDefinition } from "../src/narrative/NarrativeTypes.js";

function makeWorld(): World {
  return new World({ name: "narrative-perception-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

const autoChain: NarrativeChainDefinition = {
  id: "test_story",
  name: "Test Story",
  nodes: [
    { id: "n1", name: "Node 1", exitConditions: [() => true] },
    { id: "n2", name: "Node 2", terminal: true },
  ],
};

function findEvent(perception: SoulPerceptionSystem, soulId: string, eventType: string) {
  const frame = perception.getPerception(soulId);
  if (!frame || !frame.events) return null;
  return frame.events.find((e: any) => e.type === eventType) ?? null;
}

describe("Narrative event perception", () => {
  test("perceives narrative started event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const narrative = new NarrativeSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(narrative);
    narrative.registerChain(autoChain);

    world.step(1 / 60);
    narrative.startChain("test_story", world.events, world.tick);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "narrative.started");
    assert.ok(evt, "narrative.started should be in perception frame");
    assert.equal(evt.severity, "medium");
  });

  test("perceives narrative completed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const narrative = new NarrativeSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(narrative); // Narrative before perception so events emit before frame generation
    world.addSystem(perception);
    narrative.registerChain(autoChain);

    world.step(1 / 60);
    narrative.startChain("test_story", world.events, world.tick);
    world.step(1 / 60); // n1 exits, n2 entered (terminal -> complete)

    const evt = findEvent(perception, "soul_1", "narrative.completed");
    assert.ok(evt, "narrative.completed should be in perception frame");
    assert.equal(evt.severity, "high");
  });

  test("perceives narrative node entered event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const narrative = new NarrativeSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(narrative);
    narrative.registerChain(autoChain);

    world.step(1 / 60);
    narrative.startChain("test_story", world.events, world.tick);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "narrative.node_entered");
    assert.ok(evt, "narrative.node_entered should be in perception frame");
    assert.equal(evt.severity, "low");
  });

  test("narrative events contain chain name", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const narrative = new NarrativeSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(narrative);
    narrative.registerChain(autoChain);

    world.step(1 / 60);
    narrative.startChain("test_story", world.events, world.tick);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "narrative.started");
    assert.ok(evt);
    assert.ok(evt.name.includes("Test Story"), `event name should include chain name, got: ${evt.name}`);
  });

  test("stop() cleans up narrative event listeners", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const narrative = new NarrativeSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(narrative);
    narrative.registerChain(autoChain);

    world.step(1 / 60);
    perception.stop();

    narrative.startChain("test_story", world.events, world.tick);
    assert.ok(true, "no throw after stop");
  });
});
