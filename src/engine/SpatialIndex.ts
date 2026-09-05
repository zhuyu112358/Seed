import { Vector3 } from './Vector3.js';
import type { IEntity, ISpatialIndex, IVector3 } from '../types/index.js';
export interface QuadtreeConfig { maxObjectsPerNode?: number; maxDepth?: number; bounds: { min: IVector3; max: IVector3 }; }
interface Node { minX: number; maxX: number; minZ: number; maxZ: number; depth: number; objects: string[]; children: Node[] | null; }
function fp(e: IEntity) { const c = e.collisionShape; const p = e.position;
  if (c.type === 'sphere' && c.sphere) { const r = c.sphere.radius; return { minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r }; }
  if (c.type === 'aabb' && c.aabb) { return { minX: p.x + c.aabb.min.x, maxX: p.x + c.aabb.max.x, minZ: p.z + c.aabb.min.z, maxZ: p.z + c.aabb.max.z }; }
  return { minX: p.x, maxX: p.x, minZ: p.z, maxZ: p.z }; }
function mn(a: number, b: number, c: number, d: number, dep: number): Node { return { minX: a, maxX: b, minZ: c, maxZ: d, depth: dep, objects: [], children: null }; }
export class Quadtree implements ISpatialIndex {
  private root: Node; private readonly mo: number; private readonly md: number;
  private readonly byId = new Map<string, IEntity>(); private readonly nodeOf = new Map<string, Node>();
  constructor(cfg: QuadtreeConfig) { this.mo = cfg.maxObjectsPerNode ?? 8; this.md = cfg.maxDepth ?? 6; const b = cfg.bounds; this.root = mn(b.min.x, b.max.x, b.min.z, b.max.z, 0); }
  insert(e: IEntity): void { this.byId.set(e.id, e); this.remove(e.id); this.put(this.root, e.id, fp(e)); }
  remove(id: string): void { this.byId.delete(id); const n = this.nodeOf.get(id); if (n) { const i = n.objects.indexOf(id); if (i >= 0) n.objects.splice(i, 1); this.nodeOf.delete(id); } }
  update(e: IEntity): void { this.insert(e); }
  queryRange(min: IVector3, max: IVector3): IEntity[] { const out: IEntity[] = []; const seen = new Set<string>(); this.walk(this.root, min.x, max.x, min.z, max.z, out, seen); return out; }
  queryNear(p: IVector3, r: number): IEntity[] { return this.queryRange({ x: p.x - r, y: 0, z: p.z - r }, { x: p.x + r, y: 0, z: p.z + r }).filter((e) => { const dx = e.position.x - p.x; const dz = e.position.z - p.z; return dx*dx + dz*dz <= r*r; }); }
  queryRay(o: IVector3, d: IVector3, md: number): IEntity[] { const dir = new Vector3(d.x, d.y, d.z); const len = dir.length(); if (len < 1e-9) return []; const dx = dir.x / len; const dz = dir.z / len; const tx = o.x + dx * md; const tz = o.z + dz * md; return this.queryRange({ x: Math.min(o.x, tx), y: 0, z: Math.min(o.z, tz) }, { x: Math.max(o.x, tx), y: 0, z: Math.max(o.z, tz) }); }
  clear(): void { this.root = mn(this.root.minX, this.root.maxX, this.root.minZ, this.root.maxZ, 0); this.byId.clear(); this.nodeOf.clear(); }
  size(): number { return this.byId.size; }
  private put(n: Node, id: string, f: ReturnType<typeof fp>): void { if (n.children) { const t = this.child(n, f); if (t) { this.put(t, id, f); return; } } n.objects.push(id); this.nodeOf.set(id, n); if (n.objects.length > this.mo && n.depth < this.md) this.split(n); }
  private child(n: Node, f: ReturnType<typeof fp>): Node | null { const mx = (n.minX + n.maxX) / 2; const mz = (n.minZ + n.maxZ) / 2; if (!n.children) return null;
    if (f.maxX <= mx && f.maxZ <= mz) return n.children[0];
    if (f.minX >= mx && f.maxZ <= mz) return n.children[1];
    if (f.maxX <= mx && f.minZ >= mz) return n.children[2];
    if (f.minX >= mx && f.minZ >= mz) return n.children[3]; return null; }
  private split(n: Node): void { if (n.children) return; const mx = (n.minX + n.maxX) / 2; const mz = (n.minZ + n.maxZ) / 2;
    n.children = [ mn(n.minX, mx, n.minZ, mz, n.depth+1), mn(mx, n.maxX, n.minZ, mz, n.depth+1), mn(n.minX, mx, mz, n.maxZ, n.depth+1), mn(mx, n.maxX, mz, n.maxZ, n.depth+1) ];
    const stuck: string[] = [];
    for (const id of n.objects) { const e = this.byId.get(id); if (!e) continue; const f = fp(e); const t = this.child(n, f); if (t) this.put(t, id, f); else stuck.push(id); }
    n.objects = stuck; }
  private walk(n: Node, a: number, b: number, c: number, d: number, out: IEntity[], seen: Set<string>): void {
    if (b < n.minX || a > n.maxX || d < n.minZ || c > n.maxZ) return;
    for (const id of n.objects) { if (seen.has(id)) continue; const e = this.byId.get(id); if (e) { seen.add(id); out.push(e); } }
    if (n.children) for (const ch of n.children) this.walk(ch, a, b, c, d, out, seen); }
}
export { Quadtree as SpatialIndex };
