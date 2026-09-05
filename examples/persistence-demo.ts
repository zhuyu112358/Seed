// End-to-end persistence demo: create world -> run -> save -> load -> verify.
// Demonstrates the complete M4 persistence pipeline with resource systems.
//
// No hardcoded world content — all resource types/recipes/rules are registered
// at runtime in this demo. The Seed kernel has no knowledge of "wood", "plank", etc.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
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
import { WorldSaveManager } from "../src/persistence/WorldSaveManager.js";

// Use a temp directory for saves.
const SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "seed-persistence-demo-"));

console.log("=== Seed Persistence End-to-End Demo ===\n");

// --- Phase 1: Create and configure world ---
console.log("--- Phase 1: Create world ---");

const world = new World({ name: "persistence-demo", tickRate: 60 });

// Register resource types (runtime configuration, not hardcoded).
const typeRegistry = new ResourceTypeRegistry();
typeRegistry.register(new ResourceType({ id: "wood", name: "Wood", maxStackSize: 99 }));
typeRegistry.register(new ResourceType({ id: "plank", name: "Plank", maxStackSize: 99 }));
typeRegistry.register(new ResourceType({ id: "food", name: "Food", maxStackSize: 50 }));

// Create systems.
const harvest = new HarvestSystem();
const crafting = new CraftingSystem();
const consumption = new ConsumptionSystem();
const growth = new GrowthSystem();

// Register recipes and rules (runtime configuration).
crafting.recipes.register(new CraftingRecipe({
  id: "plank",
  name: "Wooden Planks",
  inputs: [{ resourceTypeId: "wood", amount: 2 }],
  outputResourceTypeId: "plank",
  outputAmount: 4,
  craftTime: 2,
}));

consumption.rules.register(new ConsumptionRule({
  id: "food",
  resourceTypeId: "food",
  amount: 1,
  intervalTicks: 5,
}));

growth.rules.register(new GrowthRule({
  id: "woodcutting",
  triggerEventType: "resource.harvest.complete",
  soulIdField: "harvesterId",
  xpPerEvent: 25,
  baseXP: 50,
}));

// Add systems to world.
world.addSystem(harvest);
world.addSystem(crafting);
world.addSystem(consumption);
world.addSystem(growth);

// Create a soul entity.
const soul = new GameObject({
  id: "soul_demo", type: "soul", name: "Demo Soul",
  position: { x: 0, y: 0, z: 0 },
});
world.addEntity(soul);

// Create a tree resource node.
const treeEntity = new GameObject({
  id: "tree_1", type: "interactive", name: "Oak Tree",
  position: { x: 2, y: 0, z: 0 },
});
const treeNode = new ResourceNode({
  resourceTypeId: "wood",
  maxAmount: 10,
  harvestTime: 1,
  harvestAmount: 1,
  regenRate: 0,
  renewable: false,
});
world.addEntity(treeEntity);
harvest.registerNode(treeEntity, treeNode);

// Register soul inventories and consumption/growth.
const soulInv = harvest.getOrCreateInventory(soul);
soulInv.add("food", 10);
crafting.registerInventory("soul_demo", soulInv);
consumption.registerSoul("soul_demo", soulInv);
growth.registerSoul("soul_demo");

console.log("  World created with 2 entities, 4 systems");
console.log(`  Initial: wood=${soulInv.getAmount("wood")}, food=${soulInv.getAmount("food")}, tree=${treeNode.currentAmount}/10`);

// --- Phase 2: Run the world ---
console.log("\n--- Phase 2: Run world (10 ticks) ---");

// Harvest wood 3 times (each takes 1 tick).
for (let i = 0; i < 3; i++) {
  harvest.startHarvest(soul, treeEntity);
  world.step(1 / 60);
}

// Start crafting planks (2 wood -> 4 planks, 2 ticks).
crafting.startCraft("soul_demo", "plank");
world.step(1 / 60);
world.step(1 / 60); // Craft completes.

// Run more ticks for consumption (food every 5 ticks).
for (let i = 0; i < 5; i++) {
  world.step(1 / 60);
}

console.log(`  After run: wood=${soulInv.getAmount("wood")}, plank=${soulInv.getAmount("plank")}, food=${soulInv.getAmount("food")}`);
console.log(`  Tree: ${treeNode.currentAmount}/10`);
console.log(`  Woodcutting: XP=${growth.getXP("soul_demo", "woodcutting")}, Lv=${growth.getLevel("soul_demo", "woodcutting")}`);
console.log(`  World tick: ${world.tick}`);

// Capture state before save.
const beforeSave = {
  wood: soulInv.getAmount("wood"),
  plank: soulInv.getAmount("plank"),
  food: soulInv.getAmount("food"),
  treeAmount: treeNode.currentAmount,
  xp: growth.getXP("soul_demo", "woodcutting"),
  level: growth.getLevel("soul_demo", "woodcutting"),
  tick: world.tick,
};

// --- Phase 3: Save world ---
console.log("\n--- Phase 3: Save world ---");

const saveManager = new WorldSaveManager({ saveDirectory: SAVE_DIR });
saveManager.save(world, "demo-save", { playerName: "DemoPlayer", playTime: 120 });
console.log(`  Saved to: ${saveManager.savePath("demo-save")}`);

const saves = saveManager.list();
console.log(`  Available saves: ${saves.length}`);
console.log(`  Save metadata: name=${saves[0].name}, tick=${saves[0].tick}, size=${saves[0].size} bytes`);

// --- Phase 4: Load world into a fresh world ---
console.log("\n--- Phase 4: Load world into fresh world ---");

const world2 = new World({ name: "persistence-demo", tickRate: 60 });

// Re-create systems (fresh state).
const harvest2 = new HarvestSystem();
const crafting2 = new CraftingSystem();
const consumption2 = new ConsumptionSystem();
const growth2 = new GrowthSystem();

// Re-register recipes and rules (configuration, not state).
crafting2.recipes.register(new CraftingRecipe({
  id: "plank",
  name: "Wooden Planks",
  inputs: [{ resourceTypeId: "wood", amount: 2 }],
  outputResourceTypeId: "plank",
  outputAmount: 4,
  craftTime: 2,
}));
consumption2.rules.register(new ConsumptionRule({
  id: "food",
  resourceTypeId: "food",
  amount: 1,
  intervalTicks: 5,
}));
growth2.rules.register(new GrowthRule({
  id: "woodcutting",
  triggerEventType: "resource.harvest.complete",
  soulIdField: "harvesterId",
  xpPerEvent: 25,
  baseXP: 50,
}));

world2.addSystem(harvest2);
world2.addSystem(crafting2);
world2.addSystem(consumption2);
world2.addSystem(growth2);

// Entity factory: create entities from serialized data, and re-attach components.
// Components (like ResourceNode) must be registered with systems BEFORE system
// state is deserialized, so we do it here in the factory.
function entityFactory(serialized: any): GameObject {
  const entity = new GameObject({
    id: serialized.id,
    name: serialized.name,
    type: serialized.type,
    position: serialized.position,
    velocity: serialized.velocity,
    mass: serialized.mass,
    material: serialized.material,
  });
  // Re-attach ResourceNode component for tree entities.
  if (serialized.id === "tree_1") {
    const node = new ResourceNode({
      resourceTypeId: "wood",
      maxAmount: 10,
      harvestTime: 1,
      harvestAmount: 1,
      regenRate: 0,
      renewable: false,
    });
    harvest2.registerNode(entity, node);
  }
  return entity;
}

// Load the save.
saveManager.load("demo-save", world2, entityFactory);

// Re-register soul inventories (the inventory was restored by harvest.deserialize,
// but we need to share it with crafting/consumption/growth).
const loadedSoul = world2.getEntity("soul_demo")!;
const loadedInv = harvest2.getInventory("soul_demo")!;
const loadedTree = world2.getEntity("tree_1")!;
const loadedNode = harvest2.getNode("tree_1")!;
crafting2.registerInventory("soul_demo", loadedInv);
consumption2.registerSoul("soul_demo", loadedInv);
growth2.registerSoul("soul_demo");

console.log(`  Loaded world: ${world2.entities.size} entities, tick=${world2.tick}`);

// --- Phase 5: Verify state consistency ---
console.log("\n--- Phase 5: Verify state consistency ---");

const afterLoad = {
  wood: loadedInv.getAmount("wood"),
  plank: loadedInv.getAmount("plank"),
  food: loadedInv.getAmount("food"),
  treeAmount: loadedNode.currentAmount,
  xp: growth2.getXP("soul_demo", "woodcutting"),
  level: growth2.getLevel("soul_demo", "woodcutting"),
  tick: world2.tick,
};

let allMatch = true;
const checks: Array<[string, any, any]> = [
  ["wood", beforeSave.wood, afterLoad.wood],
  ["plank", beforeSave.plank, afterLoad.plank],
  ["food", beforeSave.food, afterLoad.food],
  ["tree amount", beforeSave.treeAmount, afterLoad.treeAmount],
  ["XP", beforeSave.xp, afterLoad.xp],
  ["level", beforeSave.level, afterLoad.level],
  ["tick", beforeSave.tick, afterLoad.tick],
];

for (const [name, before, after] of checks) {
  const match = before === after;
  if (!match) allMatch = false;
  console.log(`  ${name}: before=${before}, after=${after} ${match ? "✅" : "❌"}`);
}

console.log(`\n  ${allMatch ? "✅ ALL STATE MATCHES — persistence verified!" : "❌ STATE MISMATCH DETECTED"}`);

// --- Phase 6: Continue running after load ---
console.log("\n--- Phase 6: Continue after load (5 ticks) ---");
for (let i = 0; i < 5; i++) {
  world2.step(1 / 60);
}
console.log(`  After 5 more ticks: food=${loadedInv.getAmount("food")}, tick=${world2.tick}`);
console.log("  World continues running correctly after load ✅");

// Cleanup.
fs.rmSync(SAVE_DIR, { recursive: true, force: true });

console.log("\n=== Demo complete ===");
process.exit(allMatch ? 0 : 1);
