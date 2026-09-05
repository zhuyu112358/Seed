import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { World } from '../engine/World.js';
import type { EvalReport } from '../types/index.js';
import { Logger } from '../reliability/Logger.js';
const log = Logger.for('evaluator');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');
export interface EvalCounters { events: number; collisions: number; messages: number; moved: number; soulActions: number; soulActionsSucceeded: number; perceivedEvents: number; }
export class WorldEvaluator {
  private readonly tickSamples: number[] = [];
  private readonly counters: EvalCounters = { events: 0, collisions: 0, messages: 0, moved: 0, soulActions: 0, soulActionsSucceeded: 0, perceivedEvents: 0 };
  recordTick(ms: number): void { this.tickSamples.push(ms); }
  bump(field: keyof EvalCounters, by = 1): void { this.counters[field] += by; }
  buildReport(world: World): EvalReport {
    const samples = [...this.tickSamples].sort((a, b) => a - b);
    const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
    const p95 = samples.length ? samples[Math.floor(samples.length * 0.95)] ?? avg : 0;
    const p99 = samples.length ? samples[Math.floor(samples.length * 0.99)] ?? avg : 0;
    const perTick = Math.max(1, world.tick);
    return { generatedAt: new Date().toISOString(), world: { name: world.config.name, tick: world.tick, worldTime: world.worldTime, entityCount: world.entities.size }, performance: { tickTimeAvgMs: round(avg), tickTimeP95Ms: round(p95), tickTimeP99Ms: round(p99), fps: avg > 0 ? round(1000 / avg) : 0, rssBytes: process.memoryUsage().rss }, subsystems: world.systems.map((s) => ({ name: s.name, enabled: s.enabled })), activity: { eventsPerTick: round(this.counters.events / perTick), collisionsPerTick: round(this.counters.collisions / perTick), messagesPerTick: round(this.counters.messages / perTick), movedEntitiesPerTick: round(this.counters.moved / perTick) }, soulInteraction: { actionSuccessRate: this.counters.soulActions === 0 ? 1 : round(this.counters.soulActionsSucceeded / this.counters.soulActions), perceivedEvents: this.counters.perceivedEvents, connectedSouls: world.queryByType('soul-proxy').length } };
  }
  flush(world: World): string {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const report = this.buildReport(world);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(LOG_DIR, `eval-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
    console.log(`--- Seed Eval: ${report.world.name} tick=${report.world.tick} entities=${report.world.entityCount} avg=${report.performance.tickTimeAvgMs}ms fps=${report.performance.fps} ---`);
    log.info({ file }, 'eval report written');
    return file;
  }
}
function round(n: number): number { return Math.round(n * 1000) / 1000; }
