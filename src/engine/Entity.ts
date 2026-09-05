import { randomUUID } from 'node:crypto';
import { Vector3 } from './Vector3.js';
import type { CollisionShape, EntityComponent, EntityConfig, EntityState, EntityType, IEntity, IVector3, MaterialType } from '../types/index.js';
function dcs(): CollisionShape { return { type: 'sphere', sphere: { center: { x: 0, y: 0, z: 0 }, radius: 0.5 } }; }
function tv(v: IVector3 | undefined): Vector3 { return v ? new Vector3(v.x, v.y, v.z) : Vector3.zero; }
export class Entity implements IEntity {
  public readonly id: string; public readonly type: EntityType; public name: string;
  public position: Vector3; public velocity: Vector3; public rotation: Vector3;
  public mass: number; public material: MaterialType; public collisionShape: CollisionShape;
  public state: EntityState; public readonly properties: Map<string, unknown>;
  public components: EntityComponent[]; public active: boolean;
  public readonly createdAt: number; public updatedAt: number;
  public isStatic: boolean; public isTrigger: boolean; public destroyedAt: number | null;
  constructor(config: EntityConfig) {
    this.id = config.id ?? randomUUID(); this.type = config.type; this.name = config.name;
    this.position = tv(config.position); this.velocity = tv(config.velocity); this.rotation = tv(config.rotation);
    this.mass = config.mass ?? 1; this.material = config.material ?? 'wood';
    this.collisionShape = config.collisionShape ?? dcs();
    this.state = { ...(config.state ?? {}) };
    this.properties = new Map<string, unknown>();
    if (config.properties) for (const [k, val] of Object.entries(config.properties)) this.properties.set(k, val);
    this.components = config.components ? [...config.components] : [];
    this.isStatic = config.isStatic ?? false; this.isTrigger = config.isTrigger ?? false;
    this.active = true; const now = Date.now(); this.createdAt = now; this.updatedAt = now; this.destroyedAt = null;
  }
  destroy(): void { this.active = false; this.destroyedAt = Date.now(); this.updatedAt = Date.now(); }
  addComponent(c: EntityComponent): void { const ex = this.getComponent(c.type); if (ex) { ex.data = c.data; ex.enabled = c.enabled; } else this.components.push({ ...c }); this.updatedAt = Date.now(); }
  removeComponent(type: string): void { const i = this.components.findIndex((c) => c.type === type); if (i >= 0) { this.components.splice(i, 1); this.updatedAt = Date.now(); } }
  getComponent(type: string): EntityComponent | undefined { return this.components.find((c) => c.type === type); }
  setProperty(key: string, value: unknown): void { this.properties.set(key, value); this.updatedAt = Date.now(); }
  getProperty<T>(key: string): T | undefined { const v = this.properties.get(key); return v === undefined ? undefined : (v as T); }
  toJSON(): Record<string, unknown> { return { id: this.id, type: this.type, name: this.name, position: this.position.toArray(), velocity: this.velocity.toArray(), rotation: this.rotation.toArray(), mass: this.mass, material: this.material, collisionShape: this.collisionShape, state: { ...this.state }, properties: Object.fromEntries(this.properties), components: this.components.map((c) => ({ ...c })), active: this.active, createdAt: this.createdAt, updatedAt: this.updatedAt, destroyedAt: this.destroyedAt, isStatic: this.isStatic, isTrigger: this.isTrigger }; }
}
