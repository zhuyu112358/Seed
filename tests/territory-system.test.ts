// Tests for TerritorySystem (M8 phase 2).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { TerritorySystem } from "../src/territory/TerritorySystem.js";

function makeWorld(): World {
  return new World({ name: "territory-test", tickRate: 60 });
}

describe("TerritorySystem - Claim", () => {
  test("claim a territory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const result = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    assert.ok(result.success);
    const territory = system.getTerritory(result.territoryId!)!;
    assert.equal(territory.name, "Northfield");
    assert.equal(territory.ownerId, "npc_1");
    assert.equal(territory.boundary.minX, 0);
    assert.equal(territory.boundary.maxX, 10);
  });

  test("cannot claim overlapping territory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    const result = system.claimTerritory("npc_2", { minX: 5, maxX: 15, minZ: 5, maxZ: 15 }, world.events, world.tick);
    assert.ok(!result.success);
    assert.equal(result.error, "Boundary overlaps with existing territory");
  });

  test("cannot claim invalid boundary", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const result = system.claimTerritory("npc_1", { minX: 10, maxX: 0, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.ok(!result.success);
    assert.equal(result.error, "Invalid boundary: min must be less than max");
  });

  test("claim emits territory.claimed event", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    let claimed = false;
    world.events.on("territory.claimed", () => { claimed = true; });
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.ok(claimed);
  });

  test("territory with default name", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const result = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.ok(result.success);
    assert.ok(system.getTerritory(result.territoryId!)!.name.includes("npc_1"));
  });
});

describe("TerritorySystem - Abandon", () => {
  test("owner can abandon territory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    const result = system.abandonTerritory(claimed.territoryId!, "npc_1", world.events);
    assert.ok(result.success);
    assert.equal(system.getTerritory(claimed.territoryId!), undefined);
  });

  test("non-owner cannot abandon", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    const result = system.abandonTerritory(claimed.territoryId!, "npc_2", world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "Only the owner can abandon");
  });

  test("abandon emits territory.abandoned event", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    let abandoned = false;
    world.events.on("territory.abandoned", () => { abandoned = true; });
    system.abandonTerritory(claimed.territoryId!, "npc_1", world.events);
    assert.ok(abandoned);
  });
});

describe("TerritorySystem - Expand", () => {
  test("owner can expand territory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    const result = system.expandTerritory(claimed.territoryId!, "npc_1", { minX: -5, maxX: 15, minZ: -5, maxZ: 15 }, world.events);
    assert.ok(result.success);
    const territory = system.getTerritory(claimed.territoryId!)!;
    assert.equal(territory.boundary.minX, -5);
    assert.equal(territory.boundary.maxX, 15);
  });

  test("non-owner cannot expand", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    const result = system.expandTerritory(claimed.territoryId!, "npc_2", { minX: -5, maxX: 15, minZ: -5, maxZ: 15 }, world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "Only the owner can expand");
  });

  test("cannot expand into overlapping territory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const t1 = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    system.claimTerritory("npc_2", { minX: 20, maxX: 30, minZ: 0, maxZ: 10 }, world.events, world.tick);
    const result = system.expandTerritory(t1.territoryId!, "npc_1", { minX: 0, maxX: 25, minZ: 0, maxZ: 10 }, world.events);
    assert.ok(!result.success);
    assert.equal(result.error, "New boundary overlaps with existing territory");
  });

  test("expand emits territory.expanded event", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    let expanded = false;
    world.events.on("territory.expanded", () => { expanded = true; });
    system.expandTerritory(claimed.territoryId!, "npc_1", { minX: -5, maxX: 15, minZ: -5, maxZ: 15 }, world.events);
    assert.ok(expanded);
  });
});

describe("TerritorySystem - Entity Enter/Leave", () => {
  test("entity entering territory emits entered event", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    let entered = false;
    world.events.on("territory.entered", () => { entered = true; });
    system.updateEntityPosition("entity_1", { x: 5, z: 5 }, world.events);
    assert.ok(entered);
  });

  test("entity leaving territory emits left event", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    system.updateEntityPosition("entity_1", { x: 5, z: 5 }, world.events);
    let left = false;
    world.events.on("territory.left", () => { left = true; });
    system.updateEntityPosition("entity_1", { x: 20, z: 20 }, world.events);
    assert.ok(left);
  });

  test("entity moving within territory does not emit events", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    system.updateEntityPosition("entity_1", { x: 5, z: 5 }, world.events);
    let entered = false;
    let left = false;
    world.events.on("territory.entered", () => { entered = true; });
    world.events.on("territory.left", () => { left = true; });
    system.updateEntityPosition("entity_1", { x: 6, z: 6 }, world.events);
    assert.ok(!entered);
    assert.ok(!left);
  });

  test("entity moving from one territory to another emits left+entered", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "T1");
    system.claimTerritory("npc_2", { minX: 20, maxX: 30, minZ: 0, maxZ: 10 }, world.events, world.tick, "T2");
    system.updateEntityPosition("entity_1", { x: 5, z: 5 }, world.events);
    let leftCount = 0;
    let enteredCount = 0;
    world.events.on("territory.left", () => { leftCount++; });
    world.events.on("territory.entered", () => { enteredCount++; });
    system.updateEntityPosition("entity_1", { x: 25, z: 5 }, world.events);
    assert.equal(leftCount, 1);
    assert.equal(enteredCount, 1);
  });
});

describe("TerritorySystem - Queries", () => {
  test("getTerritoriesByOwner returns correct territories", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    system.claimTerritory("npc_1", { minX: 20, maxX: 30, minZ: 0, maxZ: 10 }, world.events, world.tick);
    system.claimTerritory("npc_2", { minX: 40, maxX: 50, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.equal(system.getTerritoriesByOwner("npc_1").length, 2);
    assert.equal(system.getTerritoriesByOwner("npc_2").length, 1);
  });

  test("getTerritoryAtPosition returns correct territory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "T1");
    const found = system.getTerritoryAtPosition({ x: 5, z: 5 });
    assert.ok(found);
    assert.equal(found?.name, "T1");
    const notFound = system.getTerritoryAtPosition({ x: 20, z: 20 });
    assert.equal(notFound, undefined);
  });

  test("isPositionInTerritory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.ok(system.isPositionInTerritory({ x: 5, z: 5 }));
    assert.ok(!system.isPositionInTerritory({ x: 20, z: 20 }));
  });

  test("isPositionInSpecificTerritory", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    const claimed = system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    assert.ok(system.isPositionInSpecificTerritory({ x: 5, z: 5 }, claimed.territoryId!));
    assert.ok(!system.isPositionInSpecificTerritory({ x: 20, z: 20 }, claimed.territoryId!));
  });
});

describe("TerritorySystem - Serialization", () => {
  test("serialize and deserialize preserves territories", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick, "Northfield");
    system.claimTerritory("npc_2", { minX: 20, maxX: 30, minZ: 0, maxZ: 10 }, world.events, world.tick, "Southfield");
    const data = system.serialize();

    const system2 = new TerritorySystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.territoryCount, 2);
    assert.equal(system2.getTerritoriesByOwner("npc_1").length, 1);
    assert.equal(system2.getTerritoryAtPosition({ x: 5, z: 5 })?.name, "Northfield");
  });
});

describe("TerritorySystem - WorldSystem", () => {
  test("can be added to world and ticked", () => {
    const world = makeWorld();
    const system = new TerritorySystem();
    world.addSystem(system);
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    world.step(1 / 60);
    assert.equal(system.territoryCount, 1);
  });

  test("stop clears all territories", () => {
    const system = new TerritorySystem();
    const world = makeWorld();
    system.claimTerritory("npc_1", { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, world.events, world.tick);
    system.stop();
    assert.equal(system.territoryCount, 0);
  });
});
