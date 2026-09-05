import { World } from './World.js';
import { Logger } from '../reliability/Logger.js';
const log = Logger.for('engine');
export interface EngineOptions { fixedDt?: number; }
export class WorldEngine {
  private world: World | null = null; private timer: NodeJS.Timeout | null = null; private readonly fixedDt: number; private running = false;
  constructor(opts: EngineOptions = {}) { this.fixedDt = opts.fixedDt ?? 1 / 60; }
  load(world: World): void { this.world = world; log.info('world loaded', { world: world.config.name, entities: world.entities.size }); }
  start(): void { if (!this.world) throw new Error('no world loaded'); if (this.running) return; this.running = true; this.world.start(); const dt = 1 / this.world.config.tickRate; this.timer = setInterval(() => this.world?.step(dt), dt * 1000); log.info('engine started', { tickRate: this.world.config.tickRate }); }
  stop(): void { this.running = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } this.world?.stop(); log.info('engine stopped'); }
  runTicks(n: number): void { if (!this.world) throw new Error('no world loaded'); const dt = 1 / this.world.config.tickRate; for (let i = 0; i < n; i++) this.world.step(dt); }
  get isRunning(): boolean { return this.running; }
  get currentWorld(): World | null { return this.world; }
}
