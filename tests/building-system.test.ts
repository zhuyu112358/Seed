// Tests for BuildingSystem (M8 phase 1).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { BuildingSystem } from "../src/building/BuildingSystem.js";
import type { BuildingType } from "../src/building/BuildingTypes.js";

function makeWorld(): World {
  return new World({ name: "building-test", tickRate: 60 });
}

describe("BuildingSystem - Place Building", () => {
  test("place a building", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const result = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Sawmill");
    assert.ok(result.success);
    const building = system.getBuilding(result.buildingId!)!;
    assert.equal(building.type, "production");
    assert.equal(building.name, "Sawmill");
    assert.equal(building.ownerId, "npc_1");
    assert.equal(building.level, 1);
    assert.equal(building.health, 100);
  });

  test("cannot place building on occupied position", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    const result = system.placeBuilding("defense", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.ok(!result.success);
    assert.equal(result.error, "Position is occupied by another building");
  });

  test("place building emits building.placed event", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    let placed = false;
    world.events.on("building.placed", () => { placed = true; });
    system.placeBuilding("residential", { x: 5, z: 5 }, { width: 3, depth: 3 }, "npc_1", world.events, world.tick);
    assert.ok(placed);
  });

  test("building with default name", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const result = system.placeBuilding("storage", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.ok(result.success);
    assert.ok(system.getBuilding(result.buildingId!)!.name.startsWith("storage_"));
  });
});

describe("BuildingSystem - Upgrade", () => {
  test("upgrade building increases level", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    const result = system.upgradeBuilding(placed.buildingId!, world.events);
    assert.ok(result.success);
    assert.equal(system.getBuilding(placed.buildingId!)!.level, 2);
  });

  test("upgrade increases max health and full heals", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("defense", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Wall", 100);
    system.damageBuilding(placed.buildingId!, 30, world.events);
    system.upgradeBuilding(placed.buildingId!, world.events);
    const building = system.getBuilding(placed.buildingId!)!;
    assert.equal(building.maxHealth, 125);
    assert.equal(building.health, 125);
  });

  test("upgrade emits building.upgraded event", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    let upgraded = false;
    world.events.on("building.upgraded", () => { upgraded = true; });
    system.upgradeBuilding(placed.buildingId!, world.events);
    assert.ok(upgraded);
  });
});

describe("BuildingSystem - Damage and Destroy", () => {
  test("damage building reduces health", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.damageBuilding(placed.buildingId!, 25, world.events);
    assert.equal(system.getBuilding(placed.buildingId!)!.health, 75);
  });

  test("damage to 0 destroys building", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.damageBuilding(placed.buildingId!, 100, world.events);
    assert.equal(system.getBuilding(placed.buildingId!), undefined);
  });

  test("destroy building removes it", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    const result = system.destroyBuilding(placed.buildingId!, world.events, "manual");
    assert.ok(result.success);
    assert.equal(system.getBuilding(placed.buildingId!), undefined);
  });

  test("damage emits building.damaged event", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    let damaged = false;
    world.events.on("building.damaged", () => { damaged = true; });
    system.damageBuilding(placed.buildingId!, 10, world.events);
    assert.ok(damaged);
  });

  test("destroy emits building.destroyed event", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    let destroyed = false;
    world.events.on("building.destroyed", () => { destroyed = true; });
    system.destroyBuilding(placed.buildingId!, world.events);
    assert.ok(destroyed);
  });
});

describe("BuildingSystem - Repair", () => {
  test("repair building increases health", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.damageBuilding(placed.buildingId!, 40, world.events);
    system.repairBuilding(placed.buildingId!, 20, world.events);
    assert.equal(system.getBuilding(placed.buildingId!)!.health, 80);
  });

  test("repair cannot exceed max health", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.repairBuilding(placed.buildingId!, 200, world.events);
    assert.equal(system.getBuilding(placed.buildingId!)!.health, 100);
  });

  test("repair emits building.repaired event", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    let repaired = false;
    world.events.on("building.repaired", () => { repaired = true; });
    system.repairBuilding(placed.buildingId!, 10, world.events);
    assert.ok(repaired);
  });
});

describe("BuildingSystem - Queries", () => {
  test("getBuildingsByOwner returns correct buildings", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.placeBuilding("defense", { x: 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.placeBuilding("residential", { x: 10, z: 0 }, { width: 2, depth: 2 }, "npc_2", world.events, world.tick);
    assert.equal(system.getBuildingsByOwner("npc_1").length, 2);
    assert.equal(system.getBuildingsByOwner("npc_2").length, 1);
  });

  test("getBuildingsByType filters correctly", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.placeBuilding("production", { x: 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.placeBuilding("defense", { x: 10, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.equal(system.getBuildingsByType("production").length, 2);
    assert.equal(system.getBuildingsByType("defense").length, 1);
  });

  test("getBuildingAtPosition returns correct building", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 4, depth: 4 }, "npc_1", world.events, world.tick);
    const found = system.getBuildingAtPosition({ x: 1, z: 1 });
    assert.ok(found);
    assert.equal(found?.type, "production");
    const notFound = system.getBuildingAtPosition({ x: 10, z: 10 });
    assert.equal(notFound, undefined);
  });

  test("supports all building types", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    const types: BuildingType[] = ["structure", "defense", "production", "residential", "storage", "custom"];
    for (let i = 0; i < types.length; i++) {
      system.placeBuilding(types[i], { x: i * 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    }
    assert.equal(system.buildingCount, types.length);
  });
});

describe("BuildingSystem - Production and Defense", () => {
  test("getTotalProduction sums production buildings", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.productionHandler = (id, type, level) => ({ wood: level * 10 });
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.placeBuilding("production", { x: 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    const total = system.getTotalProduction();
    assert.equal(total.wood, 20);
  });

  test("getTotalDefense sums defense buildings", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.defenseHandler = (id, type, level) => level * 5;
    system.placeBuilding("defense", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.placeBuilding("defense", { x: 5, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    assert.equal(system.getTotalDefense(), 10);
  });

  test("inactive buildings don't produce", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.productionHandler = () => ({ wood: 10 });
    const placed = system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.setBuildingActive(placed.buildingId!, false);
    assert.equal(system.getTotalProduction().wood, undefined);
  });
});

describe("BuildingSystem - Serialization", () => {
  test("serialize and deserialize preserves buildings", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick, "Sawmill");
    system.placeBuilding("defense", { x: 5, z: 0 }, { width: 3, depth: 3 }, "npc_2", world.events, world.tick, "Wall");
    const data = system.serialize();

    const system2 = new BuildingSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.buildingCount, 2);
    assert.equal(system2.getBuildingsByOwner("npc_1").length, 1);
    assert.equal(system2.getBuildingsByType("defense").length, 1);
  });
});

describe("BuildingSystem - WorldSystem", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const system = new BuildingSystem();
    world.addSystem(system);
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    world.step(1 / 60);
    assert.equal(system.buildingCount, 1);
  });

  test("stop clears all buildings", () => {
    const system = new BuildingSystem();
    const world = makeWorld();
    system.placeBuilding("production", { x: 0, z: 0 }, { width: 2, depth: 2 }, "npc_1", world.events, world.tick);
    system.stop();
    assert.equal(system.buildingCount, 0);
  });
});
