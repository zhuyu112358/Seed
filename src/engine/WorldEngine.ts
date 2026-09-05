import { EntitySystem } from './EntitySystem.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { Quadtree } from './SpatialIndex.js';
import { ObjectPool } from './ObjectPool.js';
import { Vector3 } from './Vector3.js';
import type { CollisionResult, EntityConfig, ForceApplication, IEntity, ILogger, IVector3, RaycastHit, WorldConfig, WorldStats } from '../types/index.js';
export type WorldEngineEvent = 'tick' | 'entityCreated' | 'entityRemoved' | 'collision' | 'error';
export type WorldEngineCallback = (payload?: unknown) => void;
function cl(): ILogger { return { debug:(m)=>console.debug(m), info:(m)=>console.info(m), warn:(m)=>console.warn(m), error:(m)=>console.error(m), fatal:(m)=>console.error(m), child:()=>cl() }; }
export class WorldEngine {
  private readonly config: WorldConfig;
  private readonly es: EntitySystem; private readonly phys: PhysicsSystem; private readonly spatial: Quadtree;
  private readonly pool: ObjectPool<CollisionResult>;
  private readonly listeners = new Map<WorldEngineEvent, Set<WorldEngineCallback>>();
  private readonly logger: ILogger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false; private ticks = 0; private readonly started = Date.now(); private readonly samples: number[] = [];
  constructor(config: WorldConfig, logger?: ILogger) {
    this.config = config; this.logger = logger ?? cl();
    this.spatial = new Quadtree({ bounds: config.bounds });
    this.es = new EntitySystem({ spatialIndex: this.spatial, logger: this.logger.child('e') });
    this.phys = new PhysicsSystem(this.logger.child('p')); this.phys.initialize(config.physics);
    this.pool = new ObjectPool<CollisionResult>({ factory: () => ({ entityA:'', entityB:'', point: Vector3.zero, normal: Vector3.up, penetrationDepth: 0, relativeVelocity: Vector3.zero, timestamp: 0 }) });
    this.es.on('created', (e) => this.emit('entityCreated', e));
    this.es.on('removed', (e) => this.emit('entityRemoved', e));
  }
  start(): void { if (this.running) return; this.running = true; const ms = 1000/Math.max(1,this.config.tickRate); this.timer = setInterval(() => { try { this.tick(ms/1000); } catch (e) { this.emit('error', e); } }, ms); if (this.timer && typeof this.timer.unref === 'function') this.timer.unref(); }
  stop(): void { this.running = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  get isRunning(): boolean { return this.running; }
  tick(dt: number): void { const t0=Date.now(); const cols=this.phys.step(dt); for (const c of cols) this.emit('collision', c); this.ticks++; const el=Date.now()-t0; this.samples.push(el); if (this.samples.length>120) this.samples.shift(); this.emit('tick', { tick: this.ticks, deltaTime: dt, collisions: cols.length }); }
  getStats(): WorldStats { const s=[...this.samples].sort((a,b)=>a-b); const avg=s.length?s.reduce((a,b)=>a+b,0)/s.length:0; const p99=s.length?s[Math.min(s.length-1,Math.floor(s.length*0.99))]:0; const up=Date.now()-this.started; return { tickCount:this.ticks, uptimeMs:up, entityCount:this.es.count, activeEvents:0, avgTickTimeMs:avg, p99TickTimeMs:p99, fps:up>0?(this.ticks/up)*1000:0, memoryUsageMB:0, collisionsPerSecond:0, interactionsPerSecond:0 }; }
  createEntity(c: EntityConfig): IEntity { const e=this.es.createEntity(c); this.phys.addEntity(e); return e; }
  removeEntity(id: string): boolean { this.phys.removeEntity(id); return this.es.removeEntity(id); }
  getEntity(id: string): IEntity | undefined { return this.es.getEntity(id); }
  applyForce(a: ForceApplication): void { this.phys.applyForce(a); }
  raycast(o: IVector3, d: IVector3, md: number): RaycastHit | null { return this.phys.raycast(o,d,md); }
  on(ev: WorldEngineEvent, cb: WorldEngineCallback): void { let s=this.listeners.get(ev); if (!s) { s=new Set(); this.listeners.set(ev,s); } s.add(cb); }
  off(ev: WorldEngineEvent, cb: WorldEngineCallback): void { this.listeners.get(ev)?.delete(cb); }
  private emit(ev: WorldEngineEvent, payload?: unknown): void { this.listeners.get(ev)?.forEach((cb) => { try { cb(payload); } catch { /* swallow */ } }); }
  destroy(): void { this.stop(); this.phys.destroy(); this.es.clear(); this.spatial.clear(); this.pool.clear(); this.listeners.clear(); }
}
