// Entity hierarchy. Entity is the root; GameObject adds interaction properties;
// soul proxies and regions are built on top of GameObject / Entity.

import { Vector3 } from './Vector3.js';
import type { EntityType, IVector3 } from '../types/index.js';

let nextEntityId = 1;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(nextEntityId++).toString(36)}`;
}

export class Entity {
  public readonly id: string;
  public name: string;
  public readonly type: EntityType;
  public position: Vector3;
  public velocity: Vector3;
  public mass: number;
  public material: string;
  public readonly state: Map<string, unknown>;
  public readonly properties: Map<string, unknown>;
  public active: boolean;
  public readonly createdAt: number;
  public readonly children: Entity[] = [];
  public parent: Entity | null = null;

  constructor(opts: {
    id?: string;
    name: string;
    type: EntityType;
    position?: IVector3;
    velocity?: IVector3;
    mass?: number;
    material?: string;
  }) {
    this.id = opts.id ?? genId('ent');
    this.name = opts.name;
    this.type = opts.type;
    this.position = Vector3.from(opts.position ?? { x: 0, y: 0, z: 0 });
    this.velocity = Vector3.from(opts.velocity ?? { x: 0, y: 0, z: 0 });
    this.mass = opts.mass ?? 1;
    this.material = opts.material ?? 'default';
    this.state = new Map();
    this.properties = new Map();
    this.active = true;
    this.createdAt = Date.now();
  }

  attach(child: Entity): void {
    if (child.parent === this) return;
    child.detach();
    this.children.push(child);
    child.parent = this;
  }

  detach(): void {
    if (this.parent) {
      const idx = this.parent.children.indexOf(this);
      if (idx >= 0) this.parent.children.splice(idx, 1);
      this.parent = null;
    }
  }

  /** BFS over the whole subtree rooted at this entity. */
  walk(fn: (e: Entity) => void): void {
    fn(this);
    for (const c of this.children) c.walk(fn);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position: this.position.toObject(),
      velocity: this.velocity.toObject(),
      mass: this.mass,
      material: this.material,
      active: this.active,
      createdAt: this.createdAt,
      children: this.children.map((c) => c.id),
      properties: Object.fromEntries(this.properties),
      state: Object.fromEntries(this.state),
    };
  }
}

/** A physical/interactive entity: adds AABB half-extents and interaction flags. */
export class GameObject extends Entity {
  public halfExtents: Vector3;
  public interactable: boolean;
  public hittable: boolean;

  constructor(opts: {
    id?: string;
    name: string;
    type?: EntityType;
    position?: IVector3;
    velocity?: IVector3;
    mass?: number;
    material?: string;
    halfExtents?: IVector3;
    interactable?: boolean;
    hittable?: boolean;
  }) {
    super({
      ...opts,
      type: opts.type ?? 'dynamic',
    });
    this.halfExtents = Vector3.from(opts.halfExtents ?? { x: 0.5, y: 0.5, z: 0.5 });
    this.interactable = opts.interactable ?? false;
    this.hittable = opts.hittable ?? true;
  }

  /** Axis-aligned bounding box (min corner). */
  aabbMin(): Vector3 {
    return this.position.sub(this.halfExtents);
  }

  /** Axis-aligned bounding box (max corner). */
  aabbMax(): Vector3 {
    return this.position.add(this.halfExtents);
  }
}
