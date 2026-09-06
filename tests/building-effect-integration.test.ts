// Tests for building effect integration (M8 phase 4): production tick, defense damage reduction, territory association.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { BuildingSystem } from "../src/building/BuildingSystem.js";
import { TerritorySystem } from "../src/territory/TerritorySystem.js";

function makeWorld(): World {
  return new World({ name: "building-effect-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

function findEvent(perception: SoulPerceptionSystem, soulId: string, eventType: string) {
  const frame = perception.getPerception(soulId);
  if (!frame || !frame.events) return null;
  return frame.events.find((e: any) => e.type === eventType) ?? null;
}

describe("Building Production Tick", () => {
  test("production building produces output on interval", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    building.productionHandler = () => ({ wood: 5 });
    building.productionIntervalTicks = 10; // Short interval for testing.
    world.addSystem(building);
    building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Sawmill");

    let productionCount = 0;
    world.events.on("building.production", () => { productionCount++; });

    // Step enough ticks to trigger production.
    for (let i = 0; i < 25; i++) world.step(1 / 60);

    assert.ok(productionCount >= 2, `Should have produced at least 2 times, got ${productionCount}`);
  });

  test("inactive production building does not produce", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    building.productionHandler = () => ({ wood: 5 });
    building.productionIntervalTicks = 5;
    world.addSystem(building);
    const placed = building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    building.setBuildingActive(placed.buildingId!, false);

    let productionCount = 0;
    world.events.on("building.production", () => { productionCount++; });

    for (let i = 0; i < 20; i++) world.step(1 / 60);
    assert.equal(productionCount, 0, "Inactive building should not produce");
  });

  test("production output scales with building level", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    building.productionHandler = (id, type, level) => ({ wood: level * 10 });
    building.productionIntervalTicks = 5;
    world.addSystem(building);
    const placed = building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    building.upgradeBuilding(placed.buildingId!, world.events); // Level 2.

    let lastOutput = 0;
    world.events.on("building.production", (evt: any) => { lastOutput = evt.payload.output.wood; });

    for (let i = 0; i < 10; i++) world.step(1 / 60);
    assert.equal(lastOutput, 20, "Level 2 building should produce 20 wood");
  });
});

describe("Building Defense Damage Reduction", () => {
  test("defense buildings reduce incoming damage", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    building.defenseHandler = () => 5; // 5 defense.
    world.addSystem(building);
    const target = building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Target", 100);
    building.placeBuilding("defense", { x: 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Wall");

    building.damageBuilding(target.buildingId!, 20, world.events);
    const damaged = building.getBuilding(target.buildingId!)!;
    // 20 damage - 5 defense = 15 actual damage.
    assert.equal(damaged.health, 85, `Expected 85 health, got ${damaged.health}`);
  });

  test("damage has minimum of 1 even with high defense", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    building.defenseHandler = () => 100; // Very high defense per building.
    world.addSystem(building);
    const target = building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Target", 100);
    building.placeBuilding("defense", { x: 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "BigWall");

    building.damageBuilding(target.buildingId!, 10, world.events);
    const damaged = building.getBuilding(target.buildingId!)!;
    assert.equal(damaged.health, 99, "Minimum damage should be 1");
  });

  test("no defense handler means full damage", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    // No defense handler set.
    world.addSystem(building);
    const target = building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Target", 100);

    building.damageBuilding(target.buildingId!, 30, world.events);
    const damaged = building.getBuilding(target.buildingId!)!;
    assert.equal(damaged.health, 70, "Full damage should apply without defense handler");
  });
});

describe("Building-Territory Association", () => {
  test("building can only be placed within owner's territory", () => {
    const world = makeWorld();
    const territory = new TerritorySystem();
    const building = new BuildingSystem();
    building.territorySystem = territory;
    world.addSystem(territory);
    world.addSystem(building);

    territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");

    // Place within territory - should succeed.
    const result1 = building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.ok(result1.success, "Building within territory should succeed");

    // Place outside territory - should fail.
    const result2 = building.placeBuilding("production", { x: 20, z: 20 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.ok(!result2.success, "Building outside territory should fail");
    assert.equal(result2.error, "Building must be placed within a territory");
  });

  test("building cannot be placed in another owner's territory", () => {
    const world = makeWorld();
    const territory = new TerritorySystem();
    const building = new BuildingSystem();
    building.territorySystem = territory;
    world.addSystem(territory);
    world.addSystem(building);

    territory.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");

    const result = building.placeBuilding("production", { x: 5, z: 5 }, { width: 2, depth: 2 }, "npc_2", world.events, world.tick);
    assert.ok(!result.success, "Building in another owner's territory should fail");
    assert.equal(result.error, "Building must be placed within owner's territory");
  });

  test("without territory system, buildings can be placed anywhere", () => {
    const world = makeWorld();
    const building = new BuildingSystem();
    // No territory system set.
    world.addSystem(building);

    const result = building.placeBuilding("production", { x: 100, z: 100 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.ok(result.success, "Building without territory system should succeed anywhere");
  });
});

describe("Building Production Perception", () => {
  test("building production event is perceived", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const building = new BuildingSystem();
    building.productionHandler = () => ({ wood: 5 });
    building.productionIntervalTicks = 5;
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(building);
    building.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Sawmill");

    for (let i = 0; i < 10; i++) world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "building.production");
    assert.ok(evt, "building.production event should be in perception frame");
    assert.equal(evt.severity, "low");
    assert.ok(evt.name.includes("Sawmill"));
  });
});
