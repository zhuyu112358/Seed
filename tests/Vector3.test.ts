// Unit tests for src/entity/Vector3.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, clamp } from '../src/entity/Vector3.js';

describe('Vector3', () => {
  it('constructor applies default values', () => {
    const v = new Vector3();
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
    assert.equal(v.z, 0);

    const w = new Vector3(1, 2, 3);
    assert.deepEqual([w.x, w.y, w.z], [1, 2, 3]);
  });

  it('add / sub / mul / div return new vectors', () => {
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, 5, 6);
    assert.deepEqual(a.add(b).toArray(), [5, 7, 9]);
    assert.deepEqual(a.sub(b).toArray(), [-3, -3, -3]);
    assert.deepEqual(a.mul(2).toArray(), [2, 4, 6]);
    assert.deepEqual(a.div(2).toArray(), [0.5, 1, 1.5]);
  });

  it('div by zero returns the zero vector', () => {
    const a = new Vector3(3, 4, 5);
    const r = a.div(0);
    assert.ok(r.equals(Vector3.zero));
  });

  it('dot and cross products', () => {
    const a = new Vector3(1, 0, 0);
    const b = new Vector3(0, 1, 0);
    assert.equal(a.dot(b), 0);
    assert.equal(a.dot(a), 1);
    assert.deepEqual(a.cross(b).toArray(), [0, 0, 1]);
  });

  it('length / normalize', () => {
    const v = new Vector3(3, 4, 0);
    assert.equal(v.length(), 5);
    assert.equal(v.lengthSquared(), 25);
    const n = v.normalize();
    assert.ok(Math.abs(n.length() - 1) < 1e-9);
    // zero vector normalizes to zero
    assert.ok(Vector3.zero.normalize().equals(Vector3.zero));
  });

  it('distance / distanceSquared', () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(3, 4, 0);
    assert.equal(a.distance(b), 5);
    assert.equal(a.distanceSquared(b), 25);
    assert.equal(a.distanceTo(b), 5);
  });

  it('lerp clamps t and interpolates', () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(10, 10, 10);
    assert.deepEqual(a.lerp(b, 0.5).toArray(), [5, 5, 5]);
    // t outside [0,1] is clamped
    assert.deepEqual(a.lerp(b, 2).toArray(), [10, 10, 10]);
    assert.deepEqual(a.lerp(b, -1).toArray(), [0, 0, 0]);
  });

  it('clamp constrains each component', () => {
    const v = new Vector3(-5, 2, 10);
    const c = v.clamp(0, 5);
    assert.deepEqual(c.toArray(), [0, 2, 5]);
  });

  it('equals / clone / toArray / toObject', () => {
    const v = new Vector3(1, 2, 3);
    assert.ok(v.equals(new Vector3(1, 2, 3)));
    assert.ok(!v.equals(new Vector3(1, 2, 4)));
    const c = v.clone();
    assert.ok(c.equals(v));
    assert.notEqual(c, v);
    assert.deepEqual(v.toArray(), [1, 2, 3]);
    assert.deepEqual(v.toObject(), { x: 1, y: 2, z: 3 });
  });

  it('static zero and from', () => {
    assert.deepEqual(Vector3.zero.toArray(), [0, 0, 0]);
    const v = Vector3.from({ x: 9, y: 8, z: 7 });
    assert.deepEqual(v.toArray(), [9, 8, 7]);
  });

  it('exported clamp scalar function', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
    assert.equal(clamp(NaN, 0, 10), 0);
  });
});
