import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from '../src/entity/Vector3.js';
test('add sub mul div', () => { const a = new Vector3(1,2,3); const b = new Vector3(4,5,6); assert.deepEqual(a.add(b).toObject(),{x:5,y:7,z:9}); assert.deepEqual(a.sub(b).toObject(),{x:-3,y:-3,z:-3}); assert.deepEqual(a.mul(2).toObject(),{x:2,y:4,z:6}); });
test('dot cross length normalize', () => { assert.equal(new Vector3(1,0,0).dot(new Vector3(0,1,0)),0); assert.equal(new Vector3(3,4,0).length(),5); assert.deepEqual(new Vector3(0,5,0).normalize().toObject(),{x:0,y:1,z:0}); });
test('distance', () => { assert.equal(new Vector3(0,0,0).distance(new Vector3(3,4,0)),5); });
