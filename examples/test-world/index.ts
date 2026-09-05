import { WorldEngine } from "../../src/engine/WorldEngine.js";
import { Logger } from "../../src/reliability/Logger.js";
const log = Logger.for("test-world");
function ts(): string { return new Date().toISOString(); }
async function main(): Promise<void> {
  console.log("[" + ts() + "] Building test world...");
  const engine = new WorldEngine({ name: "test-world", tickRate: 30 });
  engine.createEntity({ type: "static", name: "ground", position: { x: 0, y: -0.5, z: 0 }, mass: 10000, material: "stone" });
  engine.createEntity({ type: "static", name: "wall-n", position: { x: 0, y: 2, z: -50 }, mass: 1000, material: "stone" });
  engine.createEntity({ type: "static", name: "wall-s", position: { x: 0, y: 2, z: 50 }, mass: 1000, material: "stone" });
  engine.createEntity({ type: "static", name: "wall-w", position: { x: -50, y: 2, z: 0 }, mass: 1000, material: "stone" });
  engine.createEntity({ type: "static", name: "wall-e", position: { x: 50, y: 2, z: 0 }, mass: 1000, material: "stone" });
  const boxes = [{ x: -4, y: 3, z: -3 }, { x: 3, y: 2, z: 4 }, { x: 0, y: 5, z: 0 }, { x: 6, y: 2, z: -5 }, { x: -6, y: 4, z: 5 }];
  for (let i = 0; i < boxes.length; i++) { engine.createEntity({ type: "dynamic", name: "box-" + i, position: boxes[i], mass: 1, material: "wood" }); }
  engine.createEntity({ type: "interactive", name: "light-1", position: { x: -8, y: 6, z: -8 }, mass: 0.5, material: "glass" });
  engine.createEntity({ type: "interactive", name: "light-2", position: { x: 8, y: 6, z: 8 }, mass: 0.5, material: "glass" });
  engine.createEntity({ type: "soul", name: "soul:local-test", position: { x: 0, y: 1, z: 0 }, mass: 1, material: "energy" });
  console.log("[" + ts() + "] World created with " + engine.getAllEntities().length + " entities");
  const TICKS = 150; const dt = 1 / 30;
  for (let i = 0; i < TICKS; i++) {
    engine.tick(dt);
    if (i % 30 === 0) { const stats = engine.getStats(); const soul = engine.getEntity("soul:local-test"); const pos = soul ? "(" + soul.position.x.toFixed(1) + ", " + soul.position.y.toFixed(1) + ", " + soul.position.z.toFixed(1) + ")" : "(none)"; console.log("[" + ts() + "] tick=" + i + " entities=" + stats.entityCount + " soul=" + pos); }
  }
  const stats = engine.getStats();
  console.log("\n[" + ts() + "] === Test World Summary ===");
  console.log("entities:   " + stats.entityCount);
  console.log("ticks:      " + stats.tickCount);
  console.log("avg tick:   " + stats.avgTickTimeMs.toFixed(3) + " ms");
  console.log("fps:        " + stats.fps.toFixed(1));
  console.log("memory:     " + stats.memoryUsageMB.toFixed(1) + " MB");
  engine.destroy();
  console.log("[" + ts() + "] Cleanup complete.");
  process.exit(0);
}
main().catch((err) => { console.error("demo failed:", err); process.exit(1); });