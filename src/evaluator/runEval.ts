import fs from "node:fs";
import path from "node:path";
import { WorldEngine } from "../engine/WorldEngine.js";
import { Logger } from "../reliability/Logger.js";
const log = Logger.for("eval-main");
function pct(sorted: number[], p: number): number { if (sorted.length === 0) return 0; return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0; }
function main(): void {
  const engine = new WorldEngine({ name: "eval-world", tickRate: 60 });
  engine.createEntity({ type: "static", name: "ground", position: { x: 0, y: -0.5, z: 0 }, mass: 1000, material: "stone" });
  engine.createEntity({ type: "dynamic", name: "box-a", position: { x: -2, y: 5, z: 0 }, mass: 1, material: "wood" });
  engine.createEntity({ type: "dynamic", name: "box-b", position: { x: 2, y: 7, z: 0 }, mass: 3, material: "metal" });
  engine.createEntity({ type: "soul", name: "soul:eval_vex", position: { x: -1, y: 1, z: 0 }, mass: 1, material: "energy" });
  const TICKS = 120; const dt = 1 / 60; const samples: number[] = []; const t0 = Date.now();
  for (let i = 0; i < TICKS; i++) { const s = performance.now(); engine.tick(dt); samples.push(performance.now() - s); }
  const durationMs = Date.now() - t0; const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length; const stats = engine.getStats();
  const report = { version: "0.1.0", timestamp: Date.now(), worldId: "eval-world", durationMs, tickCount: TICKS, entityCount: stats.entityCount, avgTickTimeMs: Math.round(avg * 1000) / 1000, p95TickTimeMs: Math.round(pct(sorted, 0.95) * 1000) / 1000, p99TickTimeMs: Math.round(pct(sorted, 0.99) * 1000) / 1000, fps: Math.round((TICKS / (durationMs / 1000)) * 100) / 100, memoryUsageMB: Math.round(stats.memoryUsageMB * 100) / 100, collisions: stats.collisionsPerSecond };
  const logDir = path.resolve(process.cwd(), "logs"); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const fp = path.join(logDir, `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(fp, JSON.stringify(report, null, 2), "utf8");
  console.log("--- Seed Evaluation Report ---");
  console.log("world:        " + report.worldId + " (tick=" + report.tickCount + ", entities=" + report.entityCount + ")");
  console.log("tick ms:      avg=" + report.avgTickTimeMs + " p95=" + report.p95TickTimeMs + " p99=" + report.p99TickTimeMs);
  console.log("fps:          " + report.fps);
  console.log("rss:          " + report.memoryUsageMB + " MB");
  console.log("report:       " + fp);
  log.info("eval complete", { received: TICKS });
  engine.destroy();
}
main();