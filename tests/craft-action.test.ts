import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { HarvestSystem } from "../src/resource/HarvestSystem.js";
import { CraftingSystem } from "../src/resource/CraftingSystem.js";
import { ResourceNode } from "../src/resource/ResourceNode.js";
import type { ActionRequest } from "../src/types/index.js";

function makeWorld(): {
  world: World;
  action: SoulActionSystem;
  perception: SoulPerceptionSystem;
  harvest: HarvestSystem;
  crafting: CraftingSystem;
} {
  const world = new World({ name: "test", tickRate: 60 });
  const action = new SoulActionSystem();
  const perception = new SoulPerceptionSystem();
  const harvest = new HarvestSystem({ harvestRange: 3 });
  const crafting = new CraftingSystem();
  world.addSystem(action);
  world.addSystem(perception);
  world.addSystem(harvest);
  world.addSystem(crafting);

  // Register a plank recipe: 2 wood -> 4 planks, craftTime=2
  crafting.recipes.register({
    id: "planks",
    name: "Wooden Planks",
    inputs: [{ resourceTypeId: "wood", amount: 2 }],
    outputResourceTypeId: "plank",
    outputAmount: 4,
    craftTime: 2,
  });

  return { world, action, perception, harvest, crafting };
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id, type: "soul", name: id,
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  });
}

function makeTree(id: string, x: number, z: number): { entity: GameObject; node: ResourceNode } {
  const entity = new GameObject({
    id, type: "resource", name: id,
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  });
  const node = new ResourceNode({ resourceTypeId: "wood", harvestTime: 1, maxAmount: 10, regenRate: 0 });
  return { entity, node };
}

function craftRequest(soulId: string, recipeId: string): ActionRequest {
  return {
    soulId,
    action: "craft",
    parameters: { recipeId },
    timestamp: Date.now(),
  };
}

describe("SoulActionSystem craft action", () => {
  test("craft action starts crafting a recipe", () => {
    const { world, action, harvest, crafting } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Harvest 2 wood (recipe needs 2)
    for (let i = 0; i < 2; i++) {
      action.executeAction({ soulId: "soul_1", action: "harvest", targetId: "tree_1", parameters: {}, timestamp: Date.now() }, world);
      world.step(1 / 60);
    }

    // Now craft planks
    const result = action.executeAction(craftRequest("soul_1", "planks"), world);
    assert.equal(result.success, true);
    assert.equal(crafting.getActiveCrafts("soul_1").length, 1);

    // Tick to complete craft (craftTime=2)
    world.step(1 / 60);
    world.step(1 / 60);

    // Check inventory: 2 wood consumed, 4 planks produced
    const inv = harvest.getInventory("soul_1")!;
    assert.equal(inv.getAmount("wood"), 0);
    assert.equal(inv.getAmount("plank"), 4);
  });

  test("craft action fails with insufficient resources", () => {
    const { world, action, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Harvest 1 wood (not enough for 2 wood recipe)
    action.executeAction({ soulId: "soul_1", action: "harvest", targetId: "tree_1", parameters: {}, timestamp: Date.now() }, world);
    world.step(1 / 60);

    const result = action.executeAction(craftRequest("soul_1", "planks"), world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("insufficient"));
  });

  test("craft action fails with nonexistent recipe", () => {
    const { world, action } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);

    const result = action.executeAction(craftRequest("soul_1", "nonexistent"), world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("not found"));
  });

  test("craft action requires recipeId", () => {
    const { world, action } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);

    const req: ActionRequest = { soulId: "soul_1", action: "craft", parameters: {}, timestamp: Date.now() };
    const result = action.executeAction(req, world);
    assert.equal(result.success, false);
    assert.ok(result.message.includes("recipeId"));
  });

  test("craft action with targetId as recipeId", () => {
    const { world, action, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Harvest 2 wood
    action.executeAction({ soulId: "soul_1", action: "harvest", targetId: "tree_1", parameters: {}, timestamp: Date.now() }, world);
    world.step(1 / 60);
    action.executeAction({ soulId: "soul_1", action: "harvest", targetId: "tree_1", parameters: {}, timestamp: Date.now() }, world);
    world.step(1 / 60);

    // Craft using targetId as recipeId (no parameters.recipeId)
    const req: ActionRequest = { soulId: "soul_1", action: "craft", targetId: "planks", parameters: {}, timestamp: Date.now() };
    const result = action.executeAction(req, world);
    assert.equal(result.success, true);
  });

  test("full harvest -> craft pipeline produces output", () => {
    const { world, action, harvest, crafting } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Harvest 2 wood
    for (let i = 0; i < 2; i++) {
      action.executeAction({ soulId: "soul_1", action: "harvest", targetId: "tree_1", parameters: {}, timestamp: Date.now() }, world);
      world.step(1 / 60);
    }

    const inv = harvest.getInventory("soul_1")!;
    assert.equal(inv.getAmount("wood"), 2);

    // Craft planks
    const result = action.executeAction(craftRequest("soul_1", "planks"), world);
    assert.equal(result.success, true);
    assert.equal(inv.getAmount("wood"), 0); // consumed 2

    // Complete craft
    world.step(1 / 60);
    world.step(1 / 60);

    assert.equal(inv.getAmount("plank"), 4);
    assert.equal(crafting.getActiveCrafts("soul_1").length, 0);
  });
});

describe("SoulPerceptionSystem craft events", () => {
  test("perceives craft complete events", () => {
    const { world, action, perception, harvest } = makeWorld();
    const soul = makeSoul("soul_1", 0, 0);
    const { entity: tree, node } = makeTree("tree_1", 1, 0);
    world.addEntity(soul);
    world.addEntity(tree);
    harvest.registerNode(tree, node);

    // Step once to set up perception subscriptions
    world.step(1 / 60);

    // Harvest 2 wood
    for (let i = 0; i < 2; i++) {
      action.executeAction({ soulId: "soul_1", action: "harvest", targetId: "tree_1", parameters: {}, timestamp: Date.now() }, world);
      world.step(1 / 60);
    }

    // Craft and complete
    action.executeAction(craftRequest("soul_1", "planks"), world);
    world.step(1 / 60);
    world.step(1 / 60);
    world.step(1 / 60); // extra tick for perception

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const events = frame!.events ?? [];
    const craftEvents = events.filter((e: { type?: string }) => e.type === "crafting.complete");
    assert.ok(craftEvents.length > 0, "should perceive craft complete event");
  });
});
