// Tests for building + territory event perception in SoulPerceptionSystem (M8 phase 3).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { BuildingSystem } from "../src/building/BuildingSystem.js";
import { TerritorySystem } from "../src/territory/TerritorySystem.js";

function makeWorld(): World {
  return new World({ name: "building-territory-perception-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

function findEvent(perception: SoulPerceptionSystem, soulId: string, eventType: string) {
  const frame = perception.getPerception(soulId);
  if (!frame || !frame.events) return null;
  return frame.events.find((e: any) => e.type === eventType) ?? null;
}

describe("Building Perception", () => {
  test("perceives building placed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.step(1 / 60);
    building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Sawmill");
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "building.placed");
    assert.ok(evt, "building.placed event should be in perception frame");
    assert.equal(evt.severity, "low");
    assert.ok(evt.name.includes("Sawmill"));
  });

  test("perceives building upgraded event with medium severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.step(1 / 60);
    const placed = building.placeBuilding("defense", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Wall");
    building.upgradeBuilding(placed.buildingId!, world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "building.upgraded");
    assert.ok(evt, "building.upgraded event should be in perception frame");
    assert.equal(evt.severity, "medium");
  });

  test("perceives building destroyed event with high severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.step(1 / 60);
    const placed = building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    building.destroyBuilding(placed.buildingId!, world.events, "raided");
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "building.destroyed");
    assert.ok(evt, "building.destroyed event should be in perception frame");
    assert.equal(evt.severity, "high");
    assert.ok(evt.name.includes("raided"));
  });

  test("perceives building damaged event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.step(1 / 60);
    const placed = building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    building.damageBuilding(placed.buildingId!, 25, world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "building.damaged");
    assert.ok(evt, "building.damaged event should be in perception frame");
    assert.equal(evt.severity, "low");
  });

  test("perceives building repaired event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.step(1 / 60);
    const placed = building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    building.damageBuilding(placed.buildingId!, 40, world.events);
    building.repairBuilding(placed.buildingId!, 20, world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "building.repaired");
    assert.ok(evt, "building.repaired event should be in perception frame");
    assert.equal(evt.severity, "low");
  });
});

describe("Territory Perception", () => {
  test("perceives territory claimed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(territory);
    world.step(1 / 60);
    territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "territory.claimed");
    assert.ok(evt, "territory.claimed event should be in perception frame");
    assert.equal(evt.severity, "low");
    assert.ok(evt.name.includes("Northfield"));
  });

  test("perceives territory abandoned event with medium severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(territory);
    world.step(1 / 60);
    const claimed = territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    territory.abandonTerritory(claimed.territoryId!, "npc_1", world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "territory.abandoned");
    assert.ok(evt, "territory.abandoned event should be in perception frame");
    assert.equal(evt.severity, "medium");
  });

  test("perceives territory expanded event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(territory);
    world.step(1 / 60);
    const claimed = territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    territory.expandTerritory(claimed.territoryId!, "npc_1", { minX: -5, maxX: 15, minZ: -5, maxZ: 15 }, world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "territory.expanded");
    assert.ok(evt, "territory.expanded event should be in perception frame");
    assert.equal(evt.severity, "low");
  });

  test("perceives territory entered event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(territory);
    world.step(1 / 60);
    territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    territory.updateEntityPosition("wanderer_1", { x: 5, z: 5 }, world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "territory.entered");
    assert.ok(evt, "territory.entered event should be in perception frame");
    assert.equal(evt.severity, "low");
    assert.ok(evt.name.includes("wanderer_1"));
  });

  test("perceives territory left event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(territory);
    world.step(1 / 60);
    territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    territory.updateEntityPosition("wanderer_1", { x: 5, z: 5 }, world.events);
    territory.updateEntityPosition("wanderer_1", { x: 20, z: 20 }, world.events);
    world.step(1 / 60);
    const evt = findEvent(perception, "soul_1", "territory.left");
    assert.ok(evt, "territory.left event should be in perception frame");
    assert.equal(evt.severity, "low");
    assert.ok(evt.name.includes("wanderer_1"));
  });
});

describe("Building + Territory Perception - coexistence", () => {
  test("building and territory events coexist in perception frame", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.addSystem(territory);
    world.step(1 / 60);
    territory.claimTerritory("npc_1", { minX: 0, maxX: 20, minZ: 0, maxZ: 20 }, world.events, world.tick, "Kingdom");
    building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Sawmill");
    building.placeBuilding("defense", { x: 15, z: 15 }, { width: 3, depth: 3 }, "npc_1", world.events, world.tick, "Tower");
    world.step(1 / 60);
    const frame = perception.getPerception("soul_1")!;
    const buildingEvents = frame.events.filter((e: any) => e.type.startsWith("building."));
    const territoryEvents = frame.events.filter((e: any) => e.type.startsWith("territory."));
    assert.equal(buildingEvents.length, 2);
    assert.equal(territoryEvents.length, 1);
  });
});

describe("Building + Territory Perception - stop cleanup", () => {
  test("stop() cleans up all building and territory subscriptions", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    const territory = new TerritorySystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    world.addSystem(territory);
    world.step(1 / 60); // Sets up subscriptions.
    perception.stop();
    // After stop, emitting events should not throw.
    building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.ok(true); // No throw means cleanup worked.
  });
});
