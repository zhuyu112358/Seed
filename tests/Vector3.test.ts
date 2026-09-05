// Unit tests for the Vector3 math library (src/entity/Vector3.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, clamp } from '../src/entity/Vector3.js';

describe('Vector3 construction', () => {
  it('defaults to (0,0,0)', () => {
    const v = new Vector3();
    assert.deepEqual(v.toObject(), { x: 0, y: 0, z: 0 });
  });

  it('stores the supplied components', () => {
    const v = new Vector3(1, -2, 3.5);
    assert.equal(v.x, 1);
    assert.equal(v.y, -2);
    assert.equal(v.z, 3.5);
  });

  it('exposes a zero static getter that returns a fresh vector', () => {
    const a = Vector3.zero;
    const b = Vector3.zero;
    assert.deepEqual(a.toObject(), { x: 0, y: 0, z: 0 });
    assert.notEqual(a, b);
  });

  it('from() copies components from a plain object', () => {
    const v = Vector3.from({ x: 4, y: 5, z: 6 });
    assert.deepEqual(v.toObject(), { x: 4, y: 5, z: 6 });
  });
});

describe('Vector3 arithmetic (immutability)', () => {
  it('add/sub/mul/div return new vectors and do not mutate the receiver', () => {
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(3, 2, 1);
    assert.deepEqual(a.add(b).toObject(), { x: 4, y: 4, z: 4 });
    assert.deepEqual(a.sub(b).toObject(), { x: -2, y: 0, z: 2 });
    assert.deepEqual(a.mul(2).toObject(), { x: 2, y: 4, z: 6 });
    assert.deepEqual(a.div(2).toObject(), { x: 0.5, y: 1, z: 1.5 });
    assert.deepEqual(a.toObject(), { x: 1, y: 2, z: 3 });
  });

  it('div by zero returns the zero vector', () => {
    assert.equal(new Vector3(5, 5, 5).div(0).length(), 0);
  });

  it('computes dot and cross products', () => {
    const a = new Vector3(1, 0, 0);
    const b = new Vector3(0, 1, 0);
    assert.equal(a.dot(b), 0);
    assert.deepEqual(a.cross(b).toObject(), { x: 0, y: 0, z: 1 });
    assert.deepEqual(b.cross(a).toObject(), { x: 0, y: 0, z: -1 });
  });
});

describe('Vector3 length / normalize / distance', () => {
  it('computes length and lengthSquared', () => {
    const v = new Vector3(3, 4, 0);
    assert.equal(v.lengthSquared(), 25);
    assert.equal(v.length(), 5);
  });

  it('normalize() returns a unit vector; zero normalises to zero', () => {
    assert.ok(Math.abs(new Vector3(0, 3, 4).normalize().length() - 1) < 1e-9);
    assert.equal(Vector3.zero.normalize().length(), 0);
  });

  it('distance / distanceSquared to another vector', () => {
    assert.equal(new Vector3(0, 0, 0).distance(new Vector3(3, 4, 0)), 5);
    assert.equal(new Vector3(0, 0, 0).distanceSquared(new Vector3(3, 4, 0)), 25);
  });
});

describe('Vector3 lerp and clamp', () => {
  it('lerp interpolates and clamps t to [0,1]', () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(10, 20, 30);
    assert.deepEqual(a.lerp(b, 0.5).toObject(), { x: 5, y: 10, z: 15 });
    assert.ok(a.lerp(b, -5).equals(a));
    assert.ok(a.lerp(b, 5).equals(b));
  });

  it('clamp() clamps each component to [min, max]', () => {
    assert.deepEqual(new Vector3(5, -5, 0.5).clamp(-1, 1).toObject(), { x: 1, y: -1, z: 0.5 });
  });
});

describe('Vector3 conversion helpers', () => {
  it('clone / equals / toArray / toObject / toString', () => {
    const a = new Vector3(1, 2, 3);
    assert.ok(a.clone().equals(a));
    assert.ok(new Vector3(1, 2, 3).equals(new Vector3(1, 2, 3)));
    assert.ok(!new Vector3(1, 2, 3).equals(new Vector3(1, 2, 4)));
    assert.deepEqual(new Vector3(1, 2, 3).toArray(), [1, 2, 3]);
    assert.deepEqual(new Vector3(1, 2, 3).toObject(), { x: 1, y: 2, z: 3 });
    assert.match(new Vector3(1, 2, 3).toString(), /^Vector3\(/);
  });
});

describe('exported scalar clamp()', () => {
  it('clamps numbers and returns min for NaN', () => {
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(clamp(-2, 0, 1), 0);
    assert.equal(clamp(Number.NaN, 2, 5), 2);
  });
});
