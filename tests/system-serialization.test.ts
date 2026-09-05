import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { ResourceTypeRegistry, ResourceType } from "../src/resource/ResourceType.js";
import { ResourceNode } from "../src/resource/ResourceNode.js";
import { ResourceInventory } from "../src/resource/ResourceInventory.js";
import { HarvestSystem } from "../src/resource/HarvestSystem.js";
import { CraftingRecipeRegistry, CraftingRecipe } from "../src/resource/CraftingRecipe.js";
import { CraftingSystem } from "../src/resource/CraftingSystem.js";
import { ConsumptionRuleRegistry, ConsumptionRule } from "../src/resource/ConsumptionRule.js";
import { ConsumptionSystem } from "../src/resource/ConsumptionSystem.js";
import { GrowthRuleRegistry, GrowthRule } from "../src/resource/GrowthRule.js";
import { GrowthSystem } from "../src/resource/GrowthSystem.js";
import { WorldSerializer } from "../src/persistence/WorldSerializer.js";
import { isSerializable } from "../src/persistence/WorldSerializer.js";

function makeWorld(): World {
  return new World({ name: "test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

function makeTree(id: string, x: number, z: number): { entity: GameObject; node: ResourceNode } {
  const entity = new GameObject({ id, type: "interactive", name: id, position: { x, y: 0, z } });
  const node = new ResourceNode({
    resourceTypeId: "wood",
    maxAmount: 10,
    harvestTime: 1,
    harvestAmount: 1,
    regenRate: 0,
    renewable: false,
  });
  return { entity, node };
}

describe("System ISerializable", () => {
  test("HarvestSystem implements ISerializable", () => {
    const harvest = new HarvestSystem();
    assert.equal(isSerializable(harvest), true);
  });

  test("CraftingSystem implements ISerializable", () => {
    const crafting = new CraftingSystem();
    assert.equal(isSerializable(crafting), true);
  });

  test("ConsumptionSystem implements ISerializable", () => {
    const consumption = new ConsumptionSystem();
    assert.equal(isSerializable(consumption), true);
  });

  test("GrowthSystem implements ISerializable", () => {
    const growth = new GrowthSystem();
    assert.equal(isSerializable(growth), true);
  });
});

describe("HarvestSystem serialization", () => {
  test("serialize/deserialize preserves inventories", () => {
    const world = makeWorld();
    const harvest = new HarvestSystem();
    world.addSystem(harvest);

    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    const inv = harvest.getOrCreateInventory(soul);
    inv.add("wood", 5);
    inv.add("stone", 3);

    const data = harvest.serialize() as any;
    assert.ok(data.inventories["soul_1"]);
    assert.equal(data.inventories["soul_1"].items.wood, 5);
    assert.equal(data.inventories["soul_1"].items.stone, 3);

    // Deserialize into a fresh system.
    const harvest2 = new HarvestSystem();
    harvest2.deserialize(data);
    const inv2 = harvest2.getInventory("soul_1")!;
    assert.equal(inv2.getAmount("wood"), 5);
    assert.equal(inv2.getAmount("stone"), 3);
  });

  test("serialize/deserialize preserves node amounts", () => {
    const world = makeWorld();
    const harvest = new HarvestSystem();
    world.addSystem(harvest);

    const { entity: tree, node } = makeTree("tree_1", 2, 0);
    world.addEntity(tree);
    harvest.registerNode(tree, node);
    node.currentAmount = 3; // depleted from 10 to 3

    const data = harvest.serialize() as any;
    assert.equal(data.nodeStates["tree_1"], 3);

    // Deserialize into a fresh system with the node re-registered.
    const harvest2 = new HarvestSystem();
    const { entity: tree2, node: node2 } = makeTree("tree_1", 2, 0);
    harvest2.registerNode(tree2, node2);
    harvest2.deserialize(data);
    assert.equal(node2.currentAmount, 3);
  });
});

describe("CraftingSystem serialization", () => {
  test("serialize/deserialize preserves inventories", () => {
    const crafting = new CraftingSystem();
    const soul = makeSoul("soul_1", 0, 0);
    const inv = new ResourceInventory();
    crafting.registerInventory("soul_1", inv);
    inv.add("plank", 4);

    const data = crafting.serialize() as any;
    assert.equal(data.inventories["soul_1"].items.plank, 4);

    const crafting2 = new CraftingSystem();
    crafting2.deserialize(data);
    assert.equal(crafting2.getInventory("soul_1")!.getAmount("plank"), 4);
  });

  test("serialize/deserialize preserves active crafts", () => {
    const crafting = new CraftingSystem();
    crafting.recipes.register(new CraftingRecipe({
      id: "plank",
      name: "Wooden Planks",
      inputs: [{ resourceTypeId: "wood", amount: 2 }],
      outputResourceTypeId: "plank",
      outputAmount: 4,
      craftTime: 5,
    }));
    const soul = makeSoul("soul_1", 0, 0);
    const inv = new ResourceInventory();
    crafting.registerInventory("soul_1", inv);
    inv.add("wood", 10);
    crafting.startCraft("soul_1", "plank");

    const data = crafting.serialize() as any;
    assert.ok(data.activeCrafts["soul_1"]);
    assert.equal(data.activeCrafts["soul_1"][0].recipeId, "plank");
    assert.equal(data.activeCrafts["soul_1"][0].ticksRemaining, 5);

    // Deserialize into fresh system with recipe re-registered.
    const crafting2 = new CraftingSystem();
    crafting2.recipes.register(new CraftingRecipe({
      id: "plank",
      name: "Wooden Planks",
      inputs: [{ resourceTypeId: "wood", amount: 2 }],
      outputResourceTypeId: "plank",
      outputAmount: 4,
      craftTime: 5,
    }));
    crafting2.deserialize(data);
    const active = crafting2.getActiveCrafts("soul_1");
    assert.equal(active.length, 1);
    assert.equal(active[0].recipe.id, "plank");
    assert.equal(active[0].ticksRemaining, 5);
  });
});

describe("ConsumptionSystem serialization", () => {
  test("serialize/deserialize preserves soul state and counters", () => {
    const consumption = new ConsumptionSystem();
    consumption.rules.register(new ConsumptionRule({
      id: "food",
      resourceTypeId: "food",
      amount: 1,
      intervalTicks: 10,
    }));
    const soul = makeSoul("soul_1", 0, 0);
    const inv = new ResourceInventory();
    consumption.registerSoul("soul_1", inv);
    inv.add("food", 5);

    // Advance counters by ticking a few times.
    const world = makeWorld();
    world.addSystem(consumption);
    world.step(1 / 60);
    world.step(1 / 60);

    const data = consumption.serialize() as any;
    assert.ok(data.souls["soul_1"]);
    assert.equal(data.souls["soul_1"].inventory.items.food, 5);
    assert.equal(data.souls["soul_1"].tickCounters["food"], 2);

    // Deserialize into fresh system.
    const consumption2 = new ConsumptionSystem();
    consumption2.rules.register(new ConsumptionRule({
      id: "food",
      resourceTypeId: "food",
      amount: 1,
      intervalTicks: 10,
    }));
    consumption2.deserialize(data);
    assert.equal(consumption2.isRegistered("soul_1"), true);
    assert.equal(consumption2.getSoulState("soul_1")!.inventory.getAmount("food"), 5);
  });
});

describe("GrowthSystem serialization", () => {
  test("serialize/deserialize preserves XP and levels", () => {
    const growth = new GrowthSystem();
    growth.rules.register(new GrowthRule({
      id: "woodcutting",
      triggerEventType: "resource.harvest.complete",
      soulIdField: "harvesterId",
      xpPerEvent: 25,
    }));
    growth.registerSoul("soul_1");
    growth.grantXP("soul_1", "woodcutting", 150); // Level 2 (needs 100 XP)

    const data = growth.serialize() as any;
    assert.ok(data.soulGrowth["soul_1"]);
    assert.equal(data.soulGrowth["soul_1"]["woodcutting"].totalXP, 150);
    assert.equal(data.soulGrowth["soul_1"]["woodcutting"].level, 2);

    // Deserialize into fresh system.
    const growth2 = new GrowthSystem();
    growth2.rules.register(new GrowthRule({
      id: "woodcutting",
      triggerEventType: "resource.harvest.complete",
      soulIdField: "harvesterId",
      xpPerEvent: 25,
    }));
    growth2.deserialize(data);
    assert.equal(growth2.getXP("soul_1", "woodcutting"), 150);
    assert.equal(growth2.getLevel("soul_1", "woodcutting"), 2);
  });
});

describe("WorldSerializer with ISerializable systems", () => {
  test("WorldSerializer captures system state via ISerializable", () => {
    const world = makeWorld();
    const harvest = new HarvestSystem();
    world.addSystem(harvest);

    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    harvest.getOrCreateInventory(soul).add("wood", 8);

    const serializer = new WorldSerializer();
    const data = serializer.serialize(world);

    assert.ok(data.systems["harvest"]);
    const harvestData = data.systems["harvest"] as any;
    assert.equal(harvestData.inventories["soul_1"].items.wood, 8);
  });

  test("WorldSerializer round-trip with system state", () => {
    const world1 = makeWorld();
    const harvest = new HarvestSystem();
    world1.addSystem(harvest);
    const soul = makeSoul("soul_1", 0, 0);
    world1.addEntity(soul);
    harvest.getOrCreateInventory(soul).add("wood", 12);

    const serializer = new WorldSerializer();
    const json = serializer.toJSON(world1);

    // Load into a new world with a fresh HarvestSystem.
    const world2 = makeWorld();
    const harvest2 = new HarvestSystem();
    world2.addSystem(harvest2);
    serializer.fromJSON(json, world2, (e) => new GameObject({
      id: e.id, name: e.name, type: e.type as any, position: e.position,
    }));

    assert.equal(harvest2.getInventory("soul_1")!.getAmount("wood"), 12);
  });
});
