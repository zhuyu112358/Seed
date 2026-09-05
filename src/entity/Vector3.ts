// Immutable-ish 3D vector math used across physics, events and communication.
// All operations return a new Vector3 so callers can freely reuse references.

import type { IVector3 } from '../types/index.js';

export class Vector3 implements IVector3 {
  public readonly x: number;
  public readonly y: number;
  public readonly z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static get zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static from(v: { x: number; y: number; z: number }): Vector3 {
    return new Vector3(v.x, v.y, v.z);
  }

  add(v: IVector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: IVector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  mul(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  div(s: number): Vector3 {
    if (s === 0) return Vector3.zero;
    return new Vector3(this.x / s, this.y / s, this.z / s);
  }

  dot(v: IVector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: IVector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) return Vector3.zero;
    return this.div(len);
  }

  distance(v: IVector3): number {
    return this.sub(v).length();
  }

  distanceSquared(v: IVector3): number {
    return this.sub(v).lengthSquared();
  }

  lerp(v: IVector3, t: number): Vector3 {
    const k = clamp(t, 0, 1);
    return new Vector3(
      this.x + (v.x - this.x) * k,
      this.y + (v.y - this.y) * k,
      this.z + (v.z - this.z) * k,
    );
  }

  /** Clamp each component to [min, max]. */
  clamp(min: number, max: number): Vector3 {
    return new Vector3(
      clamp(this.x, min, max),
      clamp(this.y, min, max),
      clamp(this.z, min, max),
    );
  }

  /** Distance to another vector (IVector3 contract). */
  distanceTo(v: IVector3): number {
    return this.distance(v);
  }

  /** Return an independent copy (IVector3 contract). */
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  /** Exact component-wise equality (IVector3 contract). */
  equals(v: IVector3): boolean {
    return this.x === v.x && this.y === v.y && this.z === v.z;
  }

  /** Tuple form (IVector3 contract). */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toObject(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  toString(): string {
    return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
}

/** Clamp a scalar to [min, max]. Exported for reuse across modules. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
