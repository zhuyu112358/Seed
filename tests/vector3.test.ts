import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from '../src/entity/Vector3.js';

test('Vector3 add/sub', () => {
  const a = new Vector3(1, 2, 3);
  const b = new Vector3(3, 2, 1);
  assert.deepEqual(a.add(b).toObject(), { x: 4, y: 4, z: 4 });
  assert.deepEqual(a.sub(b).toObject(), { x: -2, y: 0, z: 2 });
});

test('Vector3 mul/div/dot/cross', () => {
  const a = new Vector3(1, 0, 0);
  const b = new Vector3(0, 1, 0);
  assert.deepEqual(a.mul(2).toObject(), { x: 2, y: 0, z: 0 });
  assert.equal(a.div(2).x, 0.5);
  assert.equal(a.div(0).length(), 0);
  assert.equal(a.dot(b), 0);
  assert.deepEqual(a.cross(b).toObject(), { x: 0, y: 0, z: 1 });
});

test('Vector3 length/normalize/distance/lerp/clamp', () => {
  const a = new Vector3(3, 4, 0);
  assert.equal(a.length(), 5);
  assert.ok(Math.abs(a.normalize().length() - 1) < 1e-9);
  assert.equal(new Vector3(0, 0, 0).distance(new Vector3(3, 4, 0)), 5);
  assert.deepEqual(new Vector3(0, 0, 0).lerp(new Vector3(10, 0, 0), 0.5).toObject(), { x: 5, y: 0, z: 0 });
  assert.deepEqual(new Vector3(5, -5, 2).clamp(-1, 1).toObject(), { x: 1, y: -1, z: 1 });
});
