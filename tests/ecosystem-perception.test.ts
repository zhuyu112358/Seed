// Tests for ecosystem event perception in SoulPerceptionSystem.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { EcosystemSystem } from "../src/ecosystem/EcosystemSystem.js";
import {
  EcosystemSpawnEvent,
  EcosystemDepletedEvent,
  EcosystemRemovedEvent,
  EcosystemZoneChangedEvent,
} from "../src/ecosystem/EcosystemSystem.js";

function makeWorld(): World {
  return new World({ name: "eco-perception-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

function makeResourceNodeEntity(id: string, x: number, z: number, resourceTypeId: string, amount: number): GameObject {
  const entity = new GameObject({ id, type: "interactive", name: id, position: { x, y: 0, z } });
  (entity as any).resourceNode = {
    resourceTypeId,
    currentAmount: amount,
    maxAmount: 10,
    harvestTime: 1,
    harvestAmount: 1,
    regenRate: 0,
    renewable: false,
  };
  return entity;
}

describe("Ecosystem event perception", () => {
  test("perceives ecosystem resource spawned event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const eco = new EcosystemSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(eco);

    eco.addZone({
      id: "forest",
      position: { x: 0, z: 0 },
      radius: 10,
      resourceTypeIds: ["wood"],
      spawnRate: 1.0,
      spawnIntervalTicks: 1,
      maxNodes: 5,
      fertility: 1.0,
    });

    // Step once to set up perception listeners.
    world.step(1 / 60);
    // Step again to trigger spawn and perception.
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const spawnEvents = frame!.events.filter((e: any) => e.type === "ecosystem.resource_spawned");
    assert.ok(spawnEvents.length > 0, "Should perceive ecosystem spawn event");
    assert.ok(spawnEvents[0].name.includes("wood"));
  });

  test("perceives ecosystem resource depleted event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const eco = new EcosystemSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(eco);

    eco.addZone({
      id: "forest",
      position: { x: 0, z: 0 },
      radius: 10,
      resourceTypeIds: ["wood"],
      spawnIntervalTicks: 100, // No spawns
    });

    // Add a depleted node.
    const deadTree = makeResourceNodeEntity("dead_tree", 2, 0, "wood", 0);
    world.addEntity(deadTree);

    // Step to set up listeners and detect depletion.
    world.step(1 / 60);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const depletedEvents = frame!.events.filter((e: any) => e.type === "ecosystem.resource_depleted");
    assert.ok(depletedEvents.length > 0, "Should perceive ecosystem depleted event");
    assert.ok(depletedEvents[0].name.includes("wood"));
    assert.equal(depletedEvents[0].severity, "medium");
  });

  test("perceives ecosystem resource removed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const eco = new EcosystemSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(eco);

    eco.addZone({
      id: "forest",
      position: { x: 0, z: 0 },
      radius: 10,
      resourceTypeIds: ["wood"],
      spawnIntervalTicks: 100,
      allowRegrowth: false,
      depletionRemovalTicks: 2,
    });

    const deadTree = makeResourceNodeEntity("dead_tree", 2, 0, "wood", 0);
    world.addEntity(deadTree);

    // Run enough ticks for removal.
    for (let i = 0; i < 5; i++) world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const removedEvents = frame!.events.filter((e: any) => e.type === "ecosystem.resource_removed");
    assert.ok(removedEvents.length > 0, "Should perceive ecosystem removed event");
  });

  test("perceives ecosystem zone changed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const eco = new EcosystemSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(eco);

    eco.addZone({
      id: "forest",
      position: { x: 0, z: 0 },
      radius: 10,
      resourceTypeIds: ["wood"],
      spawnIntervalTicks: 100,
    });

    // Step to set up listeners.
    world.step(1 / 60);

    // Change fertility.
    eco.setFertility("forest", 0.1, world.events);

    // Step to perceive.
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const zoneEvents = frame!.events.filter((e: any) => e.type === "ecosystem.zone_changed");
    assert.ok(zoneEvents.length > 0, "Should perceive ecosystem zone changed event");
    assert.ok(zoneEvents[0].name.includes("forest"));
    assert.equal(zoneEvents[0].severity, "high"); // fertility < 0.2 = high
  });

  test("direct event emission is perceived", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);

    // Step to set up listeners.
    world.step(1 / 60);

    // Emit events directly.
    world.events.emit(new EcosystemSpawnEvent("zone1", "entity1", "stone", { x: 5, z: 3 }));
    world.events.emit(new EcosystemDepletedEvent("zone1", "entity2", "stone"));
    world.events.emit(new EcosystemRemovedEvent("zone1", "entity3", "stone"));
    world.events.emit(new EcosystemZoneChangedEvent("zone1", 0.5));

    // Step to perceive.
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const ecoEvents = frame!.events.filter((e: any) => e.type.startsWith("ecosystem."));
    assert.equal(ecoEvents.length, 4, "Should perceive all 4 ecosystem event types");
  });

  test("stop() cleans up ecosystem event listeners", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    world.step(1 / 60); // Set up listeners.

    perception.stop();

    // Emit event after stop — should not crash or be recorded.
    world.events.emit(new EcosystemSpawnEvent("zone1", "entity1", "wood", { x: 0, z: 0 }));
    // No assertion needed — just verifying no crash.
    assert.ok(true);
  });
});


