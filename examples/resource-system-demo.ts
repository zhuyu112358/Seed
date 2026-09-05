/**
 * Resource System End-to-End Demo / Integration Test
 *
 * Demonstrates the complete M3 resource system pipeline:
 * 1. Harvest resources from resource nodes
 * 2. Craft items from harvested resources
 * 3. Consume resources over time (hunger/thirst)
 * 4. Gain XP and level up from actions
 *
 * This is a standalone demo that does not require SoulArena.
 * Run: npx tsx examples/resource-system-demo.ts
 */

import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { HarvestSystem } from "../src/resource/HarvestSystem.js";
import { ResourceNode } from "../src/resource/ResourceNode.js";
import { CraftingSystem } from "../src/resource/CraftingSystem.js";
import { ConsumptionSystem } from "../src/resource/ConsumptionSystem.js";
import { GrowthSystem } from "../src/resource/GrowthSystem.js";
import type { ActionRequest } from "../src/types/index.js";

// --- World Setup ---
const world = new World({ name: "resource-demo", tickRate: 60 });
const action = new SoulActionSystem();
const perception = new SoulPerceptionSystem();
const harvest = new HarvestSystem({ harvestRange: 3 });
const crafting = new CraftingSystem();
const consumption = new ConsumptionSystem();
const growth = new GrowthSystem();

world.addSystem(action);
world.addSystem(perception);
world.addSystem(harvest);
world.addSystem(crafting);
world.addSystem(consumption);
world.addSystem(growth);

// --- Register Recipes ---
// 2 wood -> 4 planks, craftTime = 2 ticks
crafting.recipes.register({
  id: "planks",
  name: "Wooden Planks",
  inputs: [{ resourceTypeId: "wood", amount: 2 }],
  outputResourceTypeId: "plank",
  outputAmount: 4,
  craftTime: 2,
});

// --- Register Consumption Rules ---
// Consume 1 food every 10 ticks
consumption.rules.register({
  id: "hunger",
  name: "Hunger",
  resourceTypeId: "food",
  amount: 1,
  intervalTicks: 10,
});

// --- Register Growth Rules ---
// Gain 25 XP per harvest completion (HarvestCompleteEvent uses harvesterId)
growth.rules.register({
  id: "woodcutting",
  name: "Woodcutting",
  triggerEventType: "resource.harvest.complete",
  soulIdField: "harvesterId",
  xpPerEvent: 25,
  baseXP: 50,
  growthMultiplier: 1.5,
  maxLevel: 10,
});

// Gain 50 XP per craft completion (CraftCompleteEvent uses soulId)
growth.rules.register({
  id: "crafting",
  name: "Crafting",
  triggerEventType: "crafting.complete",
  soulIdField: "soulId",
  xpPerEvent: 50,
  baseXP: 100,
  growthMultiplier: 2,
  maxLevel: 10,
});

// --- Create Soul ---
const soul = new GameObject({
  id: "soul_demo",
  type: "soul",
  name: "Demo Soul",
  position: { x: 0, y: 0, z: 0 },
  halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
});
world.addEntity(soul);

// Register soul for consumption and growth
consumption.registerSoul("soul_demo", harvest.getOrCreateInventory(soul));
growth.registerSoul("soul_demo");

// --- Create Resource Nodes ---
function makeTree(id: string, x: number, z: number): { entity: GameObject; node: ResourceNode } {
  const entity = new GameObject({
    id, type: "resource", name: id,
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  });
  const node = new ResourceNode({
    resourceTypeId: "wood",
    harvestTime: 1,
    harvestAmount: 1,
    maxAmount: 10,
    regenRate: 0,
  });
  return { entity, node };
}

const tree1 = makeTree("tree_1", 1, 0);
const tree2 = makeTree("tree_2", 2, 0);
world.addEntity(tree1.entity);
world.addEntity(tree2.entity);
harvest.registerNode(tree1.entity, tree1.node);
harvest.registerNode(tree2.entity, tree2.node);

// --- Add some initial food for consumption ---
const inv = harvest.getOrCreateInventory(soul);
inv.add("food", 5);

// --- Event Logging ---
const eventLog: string[] = [];
world.events.on("resource.harvest.complete", (e: any) => {
  eventLog.push(`[HARVEST] ${e.payload.harvesterId} got ${e.payload.amount} ${e.payload.resourceTypeId} from ${e.payload.nodeId}`);
});
world.events.on("crafting.complete", (e: any) => {
  eventLog.push(`[CRAFT] ${e.payload.soulId} crafted ${e.payload.outputAmount} ${e.payload.outputResourceTypeId} (${e.payload.recipeName})`);
});
world.events.on("resource.consumed", (e: any) => {
  eventLog.push(`[CONSUME] ${e.payload.soulId} consumed ${e.payload.amount} ${e.payload.resourceTypeId} (remaining: ${e.payload.remaining})`);
});
world.events.on("resource.consumption_failed", (e: any) => {
  eventLog.push(`[CONSUME FAIL] ${e.payload.soulId} needed ${e.payload.required} ${e.payload.resourceTypeId}, had ${e.payload.available}`);
});
world.events.on("growth.xp_gained", (e: any) => {
  eventLog.push(`[XP] ${e.payload.soulId} +${e.payload.amount} XP in ${e.payload.ruleName} (total: ${e.payload.totalXP}, level: ${e.payload.level})`);
});
world.events.on("growth.level_up", (e: any) => {
  eventLog.push(`[LEVEL UP] ${e.payload.soulId} ${e.payload.ruleName} Lv.${e.payload.oldLevel} -> Lv.${e.payload.newLevel}!`);
});

// --- Step 1: Initial tick to set up listeners ---
world.step(1 / 60);
console.log("=== Resource System Demo ===");
console.log("Initial state: food=5, wood=0, plank=0\n");

// --- Step 2: Harvest wood from tree_1 (3 times to get 3 wood) ---
console.log("--- Harvesting wood ---");
for (let i = 0; i < 3; i++) {
  const req: ActionRequest = {
    soulId: "soul_demo",
    action: "harvest",
    targetId: "tree_1",
    parameters: {},
    timestamp: Date.now(),
  };
  const result = action.executeAction(req, world);
  world.step(1 / 60); // complete harvest (harvestTime=1)
  console.log(`  Harvest ${i + 1}: success=${result.success}, wood=${inv.getAmount("wood")}`);
}

// --- Step 3: Craft planks (2 wood -> 4 planks) ---
console.log("\n--- Crafting planks (2 wood -> 4 planks) ---");
const craftReq: ActionRequest = {
  soulId: "soul_demo",
  action: "craft",
  parameters: { recipeId: "planks" },
  timestamp: Date.now(),
};
const craftResult = action.executeAction(craftReq, world);
console.log(`  Craft started: success=${craftResult.success}`);
world.step(1 / 60);
world.step(1 / 60); // complete craft (craftTime=2)
console.log(`  After craft: wood=${inv.getAmount("wood")}, plank=${inv.getAmount("plank")}`);

// --- Step 4: Run consumption ticks (10 ticks = 1 food consumed) ---
console.log("\n--- Running 12 ticks for consumption ---");
for (let i = 0; i < 12; i++) {
  world.step(1 / 60);
}
console.log(`  After consumption: food=${inv.getAmount("food")}`);

// --- Step 5: Check growth stats ---
console.log("\n--- Growth Stats ---");
console.log(`  Woodcutting: XP=${growth.getXP("soul_demo", "woodcutting")}, Lv=${growth.getLevel("soul_demo", "woodcutting")}`);
console.log(`  Crafting: XP=${growth.getXP("soul_demo", "crafting")}, Lv=${growth.getLevel("soul_demo", "crafting")}`);

// --- Step 6: Perception frame check ---
console.log("\n--- Perception Frame ---");
const frame = perception.getPerception("soul_demo");
if (frame) {
  console.log(`  Nearby resources: ${frame.nearbyResources?.length ?? 0}`);
  if (frame.nearbyResources) {
    for (const r of frame.nearbyResources) {
      console.log(`    - ${r.name}: ${r.resourceType} ${r.currentAmount}/${r.maxAmount} (dist=${r.distance.toFixed(2)}, available=${r.isAvailable})`);
    }
  }
  console.log(`  Recent events: ${frame.events?.length ?? 0}`);
}

// --- Event Log ---
console.log("\n--- Event Log ---");
for (const log of eventLog) {
  console.log(`  ${log}`);
}

// --- Final Summary ---
console.log("\n=== Final Summary ===");
console.log(`  Inventory: wood=${inv.getAmount("wood")}, plank=${inv.getAmount("plank")}, food=${inv.getAmount("food")}`);
console.log(`  Woodcutting: Lv.${growth.getLevel("soul_demo", "woodcutting")} (${growth.getXP("soul_demo", "woodcutting")} XP)`);
console.log(`  Crafting: Lv.${growth.getLevel("soul_demo", "crafting")} (${growth.getXP("soul_demo", "crafting")} XP)`);
console.log(`  Total events: ${eventLog.length}`);
console.log("\nDemo complete!");
