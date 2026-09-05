import { Vector3 } from './Vector3.js';
import type { CollisionResult, ForceApplication, IEntity, ILogger, IPhysicsEngine, IVector3, PhysicsConfig, RaycastHit } from '../types/index.js';
interface AF { entityId: string; force: Vector3; remaining: number; }
interface BAABB { min: Vector3; max: Vector3; }
interface BSph { center: Vector3; radius: number; }
const DEF: PhysicsConfig = { gravity: { x: 0, y: -9.81, z: 0 }, airDensity: 0, frictionCoefficient: 0.1, restitutionCoefficient: 0.2, timeScale: 1, maxVelocity: 50, collisionEnabled: true, substeps: 1 };
function cl(): ILogger { return { debug:(m)=>console.debug(m), info:(m)=>console.info(m), warn:(m)=>console.warn(m), error:(m)=>console.error(m), fatal:(m)=>console.error(m), child:()=>cl() }; }
interface Man { normal: Vector3; depth: number; point: Vector3; }
export class PhysicsSystem implements IPhysicsEngine {
  private readonly ents = new Map<string, IEntity>();
  private cfg: PhysicsConfig;
  private readonly forces: AF[] = [];
  private readonly logger: ILogger;
  constructor(logger?: ILogger) { this.logger = logger ?? cl(); this.cfg = { ...DEF, gravity: { ...DEF.gravity } }; }
  initialize(c: PhysicsConfig): void { this.cfg = { ...c, gravity: { ...c.gravity } }; }
  addEntity(e: IEntity): void { this.ents.set(e.id, e); }
  removeEntity(id: string): void { this.ents.delete(id); for (let i = this.forces.length-1; i>=0; i--) if (this.forces[i].entityId===id) this.forces.splice(i,1); }
  updateEntity(_e: IEntity): void {}
  getConfig(): PhysicsConfig { return { ...this.cfg, gravity: new Vector3(this.cfg.gravity.x, this.cfg.gravity.y, this.cfg.gravity.z) }; }
  setConfig(p: Partial<PhysicsConfig>): void { if (p.gravity) this.cfg = { ...this.cfg, ...p, gravity: new Vector3(p.gravity.x, p.gravity.y, p.gravity.z) }; else this.cfg = { ...this.cfg, ...p }; }
  applyForce(a: ForceApplication): void {
    const e = this.ents.get(a.entityId); if (!e) return;
    const f = new Vector3(a.force.x, a.force.y, a.force.z);
    if (a.type === 'impulse') { if (!e.isStatic) (e.velocity as Vector3).addInPlace(f.div(e.mass)); return; }
    this.forces.push({ entityId: a.entityId, force: f, remaining: a.duration ?? Number.POSITIVE_INFINITY });
  }
  step(dt: number): CollisionResult[] {
    const out: CollisionResult[] = []; const scaled = dt * this.cfg.timeScale;
    const subs = Math.max(1, Math.floor(this.cfg.substeps)); const sdt = scaled / subs;
    for (let s=0; s<subs; s++) { this.integ(sdt); if (this.cfg.collisionEnabled) this.collideAll(out); }
    this.expire(sdt); return out;
  }
  raycast(o: IVector3, d: IVector3, md: number): RaycastHit | null {
    const dir = new Vector3(d.x, d.y, d.z).normalize(); if (dir.length() < 1e-9) return null;
    let best: RaycastHit | null = null;
    for (const e of this.ents.values()) { const h = this.rayEnt(o, dir, md, e); if (h && (!best || h.distance < best.distance)) best = h; }
    return best;
  }
  destroy(): void { this.ents.clear(); this.forces.length = 0; }
  private integ(dt: number): void {
    const g = this.cfg.gravity; const mv = this.cfg.maxVelocity; const damp = Math.max(0, 1 - this.cfg.frictionCoefficient * dt);
    for (const e of this.ents.values()) {
      if (e.isStatic || !e.active) continue;
      const v = e.velocity as Vector3;
      v.x += g.x*dt; v.y += g.y*dt; v.z += g.z*dt;
      for (const f of this.forces) { if (f.entityId !== e.id) continue; v.x += (f.force.x/e.mass)*dt; v.y += (f.force.y/e.mass)*dt; v.z += (f.force.z/e.mass)*dt; }
      v.mulInPlace(damp);
      const p = e.position as Vector3; p.x += v.x*dt; p.y += v.y*dt; p.z += v.z*dt;
      const sp = v.length(); if (sp > mv) v.mulInPlace(mv/sp);
    }
  }
  private expire(dt: number): void { for (let i=this.forces.length-1; i>=0; i--) { const f=this.forces[i]; if (Number.isFinite(f.remaining)) { f.remaining -= dt; if (f.remaining <= 0) this.forces.splice(i,1); } } }
  private aabb(e: IEntity): BAABB { const sh=e.collisionShape; const p=e.position; const mn=sh.aabb!.min; const mx=sh.aabb!.max; return { min: new Vector3(p.x+mn.x,p.y+mn.y,p.z+mn.z), max: new Vector3(p.x+mx.x,p.y+mx.y,p.z+mx.z) }; }
  private sph(e: IEntity): BSph { const sh=e.collisionShape; const p=e.position; const c=sh.sphere!.center; return { center: new Vector3(p.x+c.x,p.y+c.y,p.z+c.z), radius: sh.sphere!.radius }; }
  private collideAll(out: CollisionResult[]): void {
    const list = Array.from(this.ents.values()).filter((e) => e.active && !e.isTrigger);
    for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
      const a=list[i], b=list[j]; if (a.isStatic && b.isStatic) continue;
      const m=this.collide(a,b); if (!m) continue;
      out.push({ entityA:a.id, entityB:b.id, point:m.point, normal:m.normal, penetrationDepth:m.depth, relativeVelocity:(b.velocity as Vector3).sub(a.velocity as Vector3), timestamp:Date.now() });
      this.resolve(a,b,m);
    }
  }
  private collide(a: IEntity, b: IEntity): Man | null {
    const sa=a.collisionShape, sb=b.collisionShape;
    const aa=sa.type==='aabb'&&!!sa.aabb, ba=sb.type==='aabb'&&!!sb.aabb;
    const as=sa.type==='sphere'&&!!sa.sphere, bs=sb.type==='sphere'&&!!sb.sphere;
    if (aa&&ba) return this.aa(this.aabb(a), this.aabb(b));
    if (as&&bs) return this.ss(this.sph(a), this.sph(b));
    if (aa&&bs) return this.as(this.aabb(a), this.sph(b));
    if (as&&ba) { const m=this.as(this.aabb(b), this.sph(a)); return m ? { ...m, normal: m.normal.mul(-1) } : null; }
    return null;
  }
  private aa(a: BAABB, b: BAABB): Man | null {
    const ox=Math.min(a.max.x-b.min.x,b.max.x-a.min.x), oy=Math.min(a.max.y-b.min.y,b.max.y-a.min.y), oz=Math.min(a.max.z-b.min.z,b.max.z-a.min.z);
    if (ox<=0||oy<=0||oz<=0) return null;
    let n: Vector3, d: number;
    if (ox<=oy&&ox<=oz) { d=ox; n=new Vector3(a.min.x<b.min.x?1:-1,0,0); }
    else if (oy<=oz) { d=oy; n=new Vector3(0,a.min.y<b.min.y?1:-1,0); }
    else { d=oz; n=new Vector3(0,0,a.min.z<b.min.z?1:-1); }
    return { normal:n, depth:d, point:new Vector3((a.min.x+a.max.x+b.min.x+b.max.x)/4,(a.min.y+a.max.y+b.min.y+b.max.y)/4,(a.min.z+a.max.z+b.min.z+b.max.z)/4) };
  }
  private ss(a: BSph, b: BSph): Man | null {
    const del=b.center.sub(a.center); const dist=del.length(); const md=a.radius+b.radius;
    if (dist>=md) return null;
    const n = dist>1e-9 ? del.div(dist) : new Vector3(0,1,0);
    return { normal:n, depth:md-dist, point:a.center.add(n.mul(a.radius)) };
  }
  private as(box: BAABB, sp: BSph): Man | null {
    const cx=Math.max(box.min.x,Math.min(sp.center.x,box.max.x)), cy=Math.max(box.min.y,Math.min(sp.center.y,box.max.y)), cz=Math.max(box.min.z,Math.min(sp.center.z,box.max.z));
    const close=new Vector3(cx,cy,cz); const del=sp.center.sub(close); const dist=del.length();
    if (dist>=sp.radius) return null;
    const n = dist>1e-9 ? del.div(dist) : new Vector3(0,1,0);
    return { normal:n, depth:sp.radius-dist, point:close };
  }
  private resolve(a: IEntity, b: IEntity, m: Man): void {
    const ia=a.isStatic?0:1/a.mass, ib=b.isStatic?0:1/b.mass; const sum=ia+ib; if (sum===0) return;
    const corr=m.normal.mul(Math.max(m.depth-0.01,0)/sum*0.8);
    if (!a.isStatic) (a.position as Vector3).subInPlace(corr.mul(ia));
    if (!b.isStatic) (b.position as Vector3).addInPlace(corr.mul(ib));
    const rv=(b.velocity as Vector3).sub(a.velocity as Vector3); const vn=rv.dot(m.normal); if (vn>0) return;
    const j=(-(1+this.cfg.restitutionCoefficient)*vn)/sum; const imp=m.normal.mul(j);
    if (!a.isStatic) (a.velocity as Vector3).subInPlace(imp.mul(ia));
    if (!b.isStatic) (b.velocity as Vector3).addInPlace(imp.mul(ib));
  }
  private rayEnt(o: IVector3, dir: Vector3, md: number, e: IEntity): RaycastHit | null {
    const sh=e.collisionShape;
    if (sh.type==='sphere'&&sh.sphere) return this.rayS(o,dir,md,this.sph(e),e.id);
    if (sh.type==='aabb'&&sh.aabb) return this.rayB(o,dir,md,this.aabb(e),e.id);
    return null;
  }
  private rayS(o: IVector3, dir: Vector3, md: number, s: BSph, id: string): RaycastHit | null {
    const oc=new Vector3(o.x,o.y,o.z).sub(s.center); const b=2*oc.dot(dir); const c=oc.lengthSquared()-s.radius*s.radius; const disc=b*b-4*c;
    if (disc<0) return null; const sd=Math.sqrt(disc); let t=(-b-sd)/2; if (t<0) t=(-b+sd)/2;
    if (t<0||t>md) return null;
    const pt=new Vector3(o.x,o.y,o.z).add(dir.mul(t)); return { entityId:id, point:pt, normal:pt.sub(s.center).div(s.radius), distance:t };
  }
  private rayB(o: IVector3, dir: Vector3, md: number, box: BAABB, id: string): RaycastHit | null {
    let tmin=0, tmax=md; let axis:'x'|'y'|'z'|null=null; let sign=1;
    const axes: Array<'x'|'y'|'z'>=['x','y','z'];
    for (const ax of axes) {
      const d=ax==='x'?dir.x:ax==='y'?dir.y:dir.z, o2=ax==='x'?o.x:ax==='y'?o.y:o.z;
      const lo=ax==='x'?box.min.x:ax==='y'?box.min.y:box.min.z, hi=ax==='x'?box.max.x:ax==='y'?box.max.y:box.max.z;
      if (Math.abs(d)<1e-12) { if (o2<lo||o2>hi) return null; continue; }
      const inv=1/d; let t1=(lo-o2)*inv, t2=(hi-o2)*inv; let sg=-1;
      if (t1>t2) { const tmp=t1; t1=t2; t2=tmp; sg=1; }
      if (t1>tmin) { tmin=t1; axis=ax; sign=sg; }
      tmax=Math.min(tmax,t2); if (tmin>tmax) return null;
    }
    if (tmin<0||tmin>md) return null;
    const pt=new Vector3(o.x,o.y,o.z).add(dir.mul(tmin));
    const n = axis==='x'?new Vector3(sign,0,0):axis==='y'?new Vector3(0,sign,0):axis==='z'?new Vector3(0,0,sign):new Vector3(0,1,0);
    return { entityId:id, point:pt, normal:n, distance:tmin };
  }
}
