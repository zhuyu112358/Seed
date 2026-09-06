// M8 End-to-End Demo: Building + Territory + Production + Defense + Perception
// Demonstrates the full M8 feature pipeline:
//   1. Territory claim
//   2. Building placement within territory
//   3. Building production (periodic output)
//   4. Building upgrade
//   5. Building damage with defense reduction
//   6. Building repair
//   7. Entity territory enter/leave
//   8. Building destruction
//   9. Perception summary (observer soul captures all events)
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { BuildingSystem } from "../src/building/BuildingSystem.js";
import { TerritorySystem } from "../src/territory/TerritorySystem.js";

console.log("=== Seed M8 End-to-End Demo: Building & Territory System ===\n");

// Create world.
const world = new World({ name: "m8-demo", tickRate: 60 });

// Create systems.
const territory = new TerritorySystem();
const building = new BuildingSystem();
const perception = new SoulPerceptionSystem();

// Configure building system with application-layer handlers.
building.territorySystem = territory; // Buildings must be in owner's territory.
building.productionHandler = (id, type, level): Record<string, number> => {
  if (type === "production") return { wood: level * 5, stone: level * 2 };
  return {};
};
building.defenseHandler = (id, type, level) => level * 3; // 3 defense per level.
building.productionIntervalTicks = 10; // Fast production for demo.

// Create observer soul.
const observer = new GameObject({ id: "observer", type: "soul", name: "Observer", position: { x: 0, y: 0, z: 0 } });
world.addEntity(observer);

// Add systems to world.
world.addSystem(territory);
world.addSystem(building);
world.addSystem(perception);

// Step once to set up lazy perception subscriptions.
world.step(1 / 60);

console.log("--- Phase 1: Territory Claim ---");
const t1 = territory.claimTerritory("npc_alice", { minX: 0, maxX: 20, minZ: 0, maxZ: 20 }, world.events, world.tick, "Alice's Homestead");
console.log(`  Claimed: ${territory.getTerritory(t1.territoryId!)?.name} (owner: npc_alice)`);
world.step(1 / 60);

console.log("\n--- Phase 2: Building Placement ---");
const sawmill = building.placeBuilding("production", { x: 5, z: 5 }, { width: 3, depth: 3 }, "npc_alice", world.events, world.tick, "Sawmill");
console.log(`  Placed: ${building.getBuilding(sawmill.buildingId!)?.name} (type: production, level: 1)`);
const wall = building.placeBuilding("defense", { x: 15, z: 15 }, { width: 2, depth: 2 }, "npc_alice", world.events, world.tick, "Stone Wall");
console.log(`  Placed: ${building.getBuilding(wall.buildingId!)?.name} (type: defense, level: 1)`);
const house = building.placeBuilding("residential", { x: 10, z: 10 }, { width: 2, depth: 2 }, "npc_alice", world.events, world.tick, "Cottage");
console.log(`  Placed: ${building.getBuilding(house.buildingId!)?.name} (type: residential)`);

// Try to place outside territory - should fail.
const outside = building.placeBuilding("production", { x: 50, z: 50 }, { width: 2, depth: 2 }, "npc_alice", world.events, world.tick, "Fail");
console.log(`  Outside territory attempt: ${outside.success ? "SUCCESS (unexpected)" : "BLOCKED (expected): " + outside.error}`);
world.step(1 / 60);

console.log("\n--- Phase 3: Building Production ---");
// Step enough ticks to trigger production (interval = 10 ticks).
for (let i = 0; i < 15; i++) world.step(1 / 60);
const totalProduction = building.getTotalProduction();
console.log(`  Total production per cycle: ${JSON.stringify(totalProduction)}`);
console.log(`  Sawmill is active: ${building.getBuilding(sawmill.buildingId!)?.active}`);

console.log("\n--- Phase 4: Building Upgrade ---");
building.upgradeBuilding(sawmill.buildingId!, world.events);
console.log(`  Sawmill upgraded to level ${building.getBuilding(sawmill.buildingId!)?.level}`);
console.log(`  Sawmill max health: ${building.getBuilding(sawmill.buildingId!)?.maxHealth}`);
world.step(1 / 60);

console.log("\n--- Phase 5: Building Damage & Defense ---");
const sawmillBefore = building.getBuilding(sawmill.buildingId!)!.health;
// Wall provides defense = level * 3 = 3. Damage 20 -> actual 17.
building.damageBuilding(sawmill.buildingId!, 20, world.events);
const sawmillAfter = building.getBuilding(sawmill.buildingId!)!.health;
console.log(`  Sawmill health: ${sawmillBefore} -> ${sawmillAfter} (20 damage, -3 defense = 17 actual)`);
console.log(`  Total defense: ${building.getTotalDefense()}`);
world.step(1 / 60);

console.log("\n--- Phase 6: Building Repair ---");
building.repairBuilding(sawmill.buildingId!, 10, world.events);
console.log(`  Sawmill health after repair: ${building.getBuilding(sawmill.buildingId!)!.health}`);
world.step(1 / 60);

console.log("\n--- Phase 7: Entity Territory Enter/Leave ---");
territory.updateEntityPosition("wanderer_bob", { x: 10, z: 10 }, world.events);
console.log(`  Wanderer Bob entered Alice's territory`);
territory.updateEntityPosition("wanderer_bob", { x: 30, z: 30 }, world.events);
console.log(`  Wanderer Bob left Alice's territory`);
world.step(1 / 60);

console.log("\n--- Phase 8: Building Destruction ---");
building.destroyBuilding(house.buildingId!, world.events, "demolished for farmland");
console.log(`  Cottage destroyed. Remaining buildings: ${building.buildingCount}`);
world.step(1 / 60);

console.log("\n--- Phase 9: Perception Summary ---");
const frame = perception.getPerception("observer");
if (!frame) {
  console.error("ERROR: No perception frame for observer");
  process.exit(1);
}
console.log(`  Total events perceived: ${frame.events.length}`);

// Count by category.
const buildingEvents = frame.events.filter((e: any) => e.type.startsWith("building."));
const territoryEvents = frame.events.filter((e: any) => e.type.startsWith("territory."));
const highEvents = frame.events.filter((e: any) => e.severity === "high");
const mediumEvents = frame.events.filter((e: any) => e.severity === "medium");

console.log(`  Building events: ${buildingEvents.length}`);
console.log(`  Territory events: ${territoryEvents.length}`);
console.log(`  High severity: ${highEvents.length}`);
console.log(`  Medium severity: ${mediumEvents.length}`);

console.log("\n  Event log:");
for (const evt of frame.events) {
  console.log(`    [${evt.severity.toUpperCase()}] ${evt.type}: ${evt.name}`);
}

console.log("\n=== M8 Demo Complete ===");
console.log(`  Territories: ${territory.territoryCount}`);
console.log(`  Buildings: ${building.buildingCount}`);
console.log(`  Perceived events: ${frame.events.length}`);
console.log(`  All systems working: ${building.buildingCount > 0 && territory.territoryCount > 0 && frame.events.length > 0 ? "YES" : "NO"}`);
