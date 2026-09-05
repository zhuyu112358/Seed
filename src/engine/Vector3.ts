import type { IVector3 } from '../types/index.js';
const EPS = 1e-9;
export class Vector3 implements IVector3 {
  public x: number; public y: number; public z: number;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  static get zero() { return new Vector3(0, 0, 0); }
  static get one() { return new Vector3(1, 1, 1); }
  static get up() { return new Vector3(0, 1, 0); }
  static fromArray(a: readonly number[]) { return new Vector3(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0); }
  add(v: IVector3) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: IVector3) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(s: number) { return new Vector3(this.x * s, this.y * s, this.z * s); }
  div(s: number) { if (s === 0) return Vector3.zero; return new Vector3(this.x / s, this.y / s, this.z / s); }
  dot(v: IVector3) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v: IVector3) { return new Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  lengthSquared() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize() { const l = this.length(); if (l < EPS) return Vector3.zero; return this.div(l); }
  distanceTo(v: IVector3) { return this.sub(v).length(); }
  distanceToSquared(v: IVector3) { return this.sub(v).lengthSquared(); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  equals(v: IVector3) { return Math.abs(this.x - v.x) < EPS && Math.abs(this.y - v.y) < EPS && Math.abs(this.z - v.z) < EPS; }
  toArray(): [number, number, number] { return [this.x, this.y, this.z]; }
  lerp(v: IVector3, t: number) { return new Vector3(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.z + (v.z - this.z) * t); }
  angleTo(v: IVector3) { const la = this.length(); const lb = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z); if (la < EPS || lb < EPS) return 0; return Math.acos(Math.max(-1, Math.min(1, this.dot(v)/(la*lb)))); }
  projectOnto(v: IVector3) { const d = v.x*v.x+v.y*v.y+v.z*v.z; if (d < EPS) return Vector3.zero; const s = (this.x*v.x+this.y*v.y+this.z*v.z)/d; return new Vector3(v.x*s, v.y*s, v.z*s); }
  reflect(n: IVector3) { const l = Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z)||1; const ux=n.x/l,uy=n.y/l,uz=n.z/l; const d=this.x*ux+this.y*uy+this.z*uz; return new Vector3(this.x-2*d*ux,this.y-2*d*uy,this.z-2*d*uz); }
  addInPlace(v: IVector3) { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
  subInPlace(v: IVector3) { this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; }
  mulInPlace(s: number) { this.x*=s; this.y*=s; this.z*=s; return this; }
}
