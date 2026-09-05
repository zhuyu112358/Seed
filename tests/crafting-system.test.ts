import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { CraftingRecipe, CraftingRecipeRegistry } from "../src/resource/CraftingRecipe.js";
import { CraftingSystem } from "../src/resource/CraftingSystem.js";
import { ResourceInventory } from "../src/resource/ResourceInventory.js";

function makePlankRecipe(): CraftingRecipe {
  return new CraftingRecipe({
    id: "planks",
    name: "Wooden Planks",
    inputs: [{ resourceTypeId: "wood", amount: 2 }],
    outputResourceTypeId: "plank",
    outputAmount: 4,
    craftTime: 2,
  });
}

describe("CraftingRecipe", () => {
  test("creates recipe with default values", () => {
    const recipe = new CraftingRecipe({
      id: "test",
      name: "Test Recipe",
      inputs: [{ resourceTypeId: "wood", amount: 1 }],
      outputResourceTypeId: "plank",
    });
    assert.equal(recipe.id, "test");
    assert.equal(recipe.outputAmount, 1);
    assert.equal(recipe.craftTime, 60);
    assert.equal(recipe.totalInputCount, 1);
  });

  test("canCraft checks inventory resources", () => {
    const recipe = makePlankRecipe();
    const inv = new ResourceInventory({ initial: { wood: 5 } });
    assert.equal(recipe.canCraft(inv), true);

    const inv2 = new ResourceInventory({ initial: { wood: 1 } });
    assert.equal(recipe.canCraft(inv2), false);
  });
});

describe("CraftingRecipeRegistry", () => {
  test("registers and retrieves recipes", () => {
    const reg = new CraftingRecipeRegistry();
    const recipe = reg.register({
      id: "planks",
      name: "Planks",
      inputs: [{ resourceTypeId: "wood", amount: 2 }],
      outputResourceTypeId: "plank",
    });
    assert.equal(reg.size, 1);
    assert.equal(reg.get("planks"), recipe);
    assert.equal(reg.has("planks"), true);
    assert.equal(reg.has("nonexistent"), false);
  });

  test("getAll returns all recipes", () => {
    const reg = new CraftingRecipeRegistry();
    reg.register({ id: "r1", name: "R1", inputs: [], outputResourceTypeId: "out" });
    reg.register({ id: "r2", name: "R2", inputs: [], outputResourceTypeId: "out" });
    assert.equal(reg.getAll().length, 2);
  });

  test("remove and clear work", () => {
    const reg = new CraftingRecipeRegistry();
    reg.register({ id: "r1", name: "R1", inputs: [], outputResourceTypeId: "out" });
    assert.equal(reg.remove("r1"), true);
    assert.equal(reg.remove("r1"), false);
    reg.register({ id: "r2", name: "R2", inputs: [], outputResourceTypeId: "out" });
    reg.clear();
    assert.equal(reg.size, 0);
  });
});

describe("CraftingSystem", () => {
  function makeWorld(): { world: World; crafting: CraftingSystem } {
    const world = new World({ name: "test", tickRate: 60 });
    const crafting = new CraftingSystem();
    world.addSystem(crafting);
    return { world, crafting };
  }

  test("startCraft consumes inputs and produces output", () => {
    const { world, crafting } = makeWorld();
    crafting.recipes.register({
      id: "planks", name: "Planks",
      inputs: [{ resourceTypeId: "wood", amount: 2 }],
      outputResourceTypeId: "plank", outputAmount: 4, craftTime: 2,
    });
    const inv = new ResourceInventory({ initial: { wood: 5 } });
    crafting.registerInventory("soul_1", inv);

    assert.equal(crafting.startCraft("soul_1", "planks", world.events), true);
    assert.equal(inv.getAmount("wood"), 3); // consumed 2
    assert.equal(crafting.getActiveCrafts("soul_1").length, 1);

    // Tick to complete craft (craftTime=2)
    world.step(1 / 60);
    world.step(1 / 60);

    assert.equal(inv.getAmount("plank"), 4);
    assert.equal(crafting.getActiveCrafts("soul_1").length, 0);
  });

  test("startCraft fails with insufficient resources", () => {
    const { world, crafting } = makeWorld();
    crafting.recipes.register({
      id: "planks", name: "Planks",
      inputs: [{ resourceTypeId: "wood", amount: 10 }],
      outputResourceTypeId: "plank",
    });
    const inv = new ResourceInventory({ initial: { wood: 5 } });
    crafting.registerInventory("soul_1", inv);

    assert.equal(crafting.startCraft("soul_1", "planks", world.events), false);
    assert.equal(inv.getAmount("wood"), 5); // not consumed
  });

  test("startCraft fails with nonexistent recipe", () => {
    const { world, crafting } = makeWorld();
    const inv = new ResourceInventory();
    crafting.registerInventory("soul_1", inv);
    assert.equal(crafting.startCraft("soul_1", "nonexistent", world.events), false);
  });

  test("startCraft fails without inventory", () => {
    const { world, crafting } = makeWorld();
    crafting.recipes.register({
      id: "planks", name: "Planks",
      inputs: [], outputResourceTypeId: "plank",
    });
    assert.equal(crafting.startCraft("soul_1", "planks", world.events), false);
  });

  test("maxConcurrentPerSoul limits parallel crafts", () => {
    const { world, crafting } = makeWorld();
    crafting.recipes.register({
      id: "slow", name: "Slow Craft",
      inputs: [], outputResourceTypeId: "out", craftTime: 100,
    });
    const inv = new ResourceInventory();
    crafting.registerInventory("soul_1", inv);

    assert.equal(crafting.startCraft("soul_1", "slow", world.events), true);
    assert.equal(crafting.startCraft("soul_1", "slow", world.events), false); // max 1
  });

  test("canCraft returns reason for failures", () => {
    const { crafting } = makeWorld();
    crafting.recipes.register({
      id: "planks", name: "Planks",
      inputs: [{ resourceTypeId: "wood", amount: 2 }],
      outputResourceTypeId: "plank",
    });

    let result = crafting.canCraft("soul_1", "nonexistent");
    assert.equal(result.canCraft, false);
    assert.ok(result.reason?.includes("not found"));

    result = crafting.canCraft("soul_1", "planks");
    assert.equal(result.canCraft, false);
    assert.ok(result.reason?.includes("no inventory"));

    const inv = new ResourceInventory({ initial: { wood: 1 } });
    crafting.registerInventory("soul_1", inv);
    result = crafting.canCraft("soul_1", "planks");
    assert.equal(result.canCraft, false);
    assert.ok(result.reason?.includes("insufficient"));
  });

  test("emits craft start and complete events", () => {
    const { world, crafting } = makeWorld();
    crafting.recipes.register({
      id: "planks", name: "Planks",
      inputs: [], outputResourceTypeId: "plank", outputAmount: 1, craftTime: 1,
    });
    const inv = new ResourceInventory();
    crafting.registerInventory("soul_1", inv);

    const events: string[] = [];
    world.events.on("crafting.start", () => events.push("start"));
    world.events.on("crafting.complete", () => events.push("complete"));

    crafting.startCraft("soul_1", "planks", world.events);
    assert.ok(events.includes("start"));

    world.step(1 / 60);
    assert.ok(events.includes("complete"));
  });

  test("craft partially adds when inventory is near full", () => {
    const { world, crafting } = makeWorld();
    crafting.recipes.register({
      id: "planks", name: "Planks",
      inputs: [], outputResourceTypeId: "plank", outputAmount: 10, craftTime: 1,
    });
    const inv = new ResourceInventory({ maxCapacity: 5 });
    crafting.registerInventory("soul_1", inv);

    const completeEvents: string[] = [];
    world.events.on("crafting.complete", () => completeEvents.push("complete"));

    crafting.startCraft("soul_1", "planks", world.events);
    world.step(1 / 60);

    assert.ok(completeEvents.includes("complete"));
    assert.equal(inv.getAmount("plank"), 5); // only 5 fit in capacity
  });
});
