// Collision detection performance benchmark: brute-force vs spatial-hash.
//
// Usage: npx tsx examples/benchmark-collision.ts [entityCount] [tickCount]
// Default: 500 entities, 100 ticks.
//
// Measures wall-clock time for collision detection tick with both broad-phase
// strategies and reports the speedup ratio.

import { World } from "../src/engine/World.js";
import { PhysicsSystem } from "../src/physics/PhysicsSystem.js";
import { PhysicsConfig } from "../src/physics/PhysicsConfig.js";
import { CollisionSystem } from "../src/physics/CollisionSystem.js";
import { GameObject } from "../src/entity/Entity.js";

const ENTITY_COUNT = parseInt(process.argv[2] ?? "500", 10);
const TICK_COUNT = parseInt(process.argv[3] ?? "100", 10);
const WORLD_SIZE = 100; // entities distributed in 100x100 area
const DENSE_SIZE = 20; // dense distribution in 20x20 area
const CELL_SIZE = 5;

function makeEntities(count: number, worldSize: number): GameObject[] {
  const entities: GameObject[] = [];
  for (let i = 0; i < count; i++) {
    entities.push(new GameObject({
      id: `ent_${i}`,
      type: "dynamic",
      name: `Entity ${i}`,
      position: {
        x: (Math.random() - 0.5) * worldSize,
        y: 0,
        z: (Math.random() - 0.5) * worldSize,
      },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    }));
  }
  return entities;
}

function runBenchmark(
  label: string,
  broadPhase: "brute-force" | "spatial-hash",
  entities: GameObject[],
): { totalMs: number; avgMs: number; pairsChecked: number } {
  const world = new World({ name: "benchmark", tickRate: 60 });
  const physics = new PhysicsSystem({ config: new PhysicsConfig({ gravity: 0, friction: 0, airResistance: 0 }) });
  const collision = new CollisionSystem({
    broadPhase,
    spatialHashCellSize: CELL_SIZE,
    collidableTypes: ["dynamic"],
    enableTriggers: false,
    enableCCD: false,
    maxPairsPerTick: 1000000,
  });
  world.addSystem(physics);
  world.addSystem(collision);

  for (const e of entities) world.addEntity(e);

  // Warmup: 5 ticks to let systems initialize.
  for (let i = 0; i < 5; i++) world.step(1 / 60);

  // Reset pair counter if available.
  const start = performance.now();
  for (let i = 0; i < TICK_COUNT; i++) world.step(1 / 60);
  const totalMs = performance.now() - start;

  // Read pairs checked from collision system stats if available.
  let pairsChecked = 0;
  const stats = (collision as unknown as { getStats?: () => { pairsChecked?: number } }).getStats?.();
  if (stats?.pairsChecked) pairsChecked = stats.pairsChecked;

  // Cleanup.
  for (const e of entities) world.removeEntity(e.id);

  return { totalMs, avgMs: totalMs / TICK_COUNT, pairsChecked };
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(1)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

console.log("=== Collision Detection Performance Benchmark ===");
console.log(`Entities: ${ENTITY_COUNT}, Ticks: ${TICK_COUNT}`);
console.log(`Cell size: ${CELL_SIZE}`);
console.log();

function runScenario(label: string, worldSize: number): void {
  console.log(`=== ${label} (${worldSize}x${worldSize} area) ===`);
  const entities = makeEntities(ENTITY_COUNT, worldSize);

  console.log("--- Brute-force (O(n²)) ---");
  const bfResult = runBenchmark("brute-force", "brute-force", entities);
  console.log(`  Total: ${formatMs(bfResult.totalMs)}`);
  console.log(`  Avg per tick: ${formatMs(bfResult.avgMs)}`);

  console.log("--- Spatial Hash (O(n)) ---");
  const shResult = runBenchmark("spatial-hash", "spatial-hash", entities);
  console.log(`  Total: ${formatMs(shResult.totalMs)}`);
  console.log(`  Avg per tick: ${formatMs(shResult.avgMs)}`);

  const speedup = bfResult.avgMs / shResult.avgMs;
  const pctFaster = ((bfResult.avgMs - shResult.avgMs) / bfResult.avgMs) * 100;
  console.log("--- Results ---");
  console.log(`  Speedup: ${speedup.toFixed(2)}x`);
  console.log(`  Spatial hash is ${pctFaster.toFixed(1)}% faster per tick`);
  console.log();
}

runScenario("Sparse distribution", WORLD_SIZE);
runScenario("Dense distribution", DENSE_SIZE);

const theoreticalPairs = (ENTITY_COUNT * (ENTITY_COUNT - 1)) / 2;
console.log(`Theoretical brute-force pairs (per tick): ${theoreticalPairs.toLocaleString()}`);
console.log(`(Spatial hash only checks nearby pairs, actual count depends on distribution)`);
