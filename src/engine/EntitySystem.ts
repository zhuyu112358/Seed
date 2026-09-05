import { Entity } from './Entity.js';
import { Quadtree } from './SpatialIndex.js';
import type { EntityConfig, EntityType, IEntity, ILogger, ISpatialIndex, IVector3 } from '../types/index.js';
export type EntityLifecycleEvent = 'created' | 'removed' | 'destroyed';
export type EntityLifecycleCallback = (entity: IEntity) => void;
function cl(): ILogger { return { debug:(m)=>console.debug(m), info:(m)=>console.info(m), warn:(m)=>console.warn(m), error:(m)=>console.error(m), fatal:(m)=>console.error(m), child:()=>cl() }; }
export class EntitySystem {
  private readonly entities = new Map<string, Entity>();
  private readonly spatial: ISpatialIndex;
  private readonly listeners = new Map<EntityLifecycleEvent, Set<EntityLifecycleCallback>>();
  private readonly logger: ILogger;
  constructor(o?: { spatialIndex?: ISpatialIndex; logger?: ILogger }) {
    this.logger = o?.logger ?? cl();
    this.spatial = o?.spatialIndex ?? new Quadtree({ bounds: { min: { x: -1000, y: 0, z: -1000 }, max: { x: 1000, y: 100, z: 1000 } } });
  }
  createEntity(cfg: EntityConfig): Entity { const e = new Entity(cfg); this.entities.set(e.id, e); this.spatial.insert(e); this.emit('created', e); return e; }
  removeEntity(id: string): boolean { const e = this.entities.get(id); if (!e) return false; this.entities.delete(id); this.spatial.remove(id); this.emit('removed', e); return true; }
  getEntity(id: string): Entity | undefined { return this.entities.get(id); }
  getAllEntities(): Entity[] { return Array.from(this.entities.values()); }
  getEntitiesByType(t: EntityType): Entity[] { return this.getAllEntities().filter((e) => e.type === t); }
  getEntitiesInArea(c: IVector3, r: number): Entity[] { return this.spatial.queryNear(c, r).map((e) => this.entities.get(e.id)).filter((e): e is Entity => e !== undefined); }
  updateEntity(e: IEntity): void { this.spatial.update(e); }
  clear(): void { for (const e of this.entities.values()) this.emit('destroyed', e); this.entities.clear(); this.spatial.clear(); }
  get count(): number { return this.entities.size; }
  on(ev: EntityLifecycleEvent, cb: EntityLifecycleCallback): void { let s = this.listeners.get(ev); if (!s) { s = new Set(); this.listeners.set(ev, s); } s.add(cb); }
  off(ev: EntityLifecycleEvent, cb: EntityLifecycleCallback): void { this.listeners.get(ev)?.delete(cb); }
  private emit(ev: EntityLifecycleEvent, e: Entity): void { this.listeners.get(ev)?.forEach((cb) => { try { cb(e); } catch { /* swallow */ } }); }
}
