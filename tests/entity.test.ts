import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entity, GameObject } from '../src/entity/Entity.js';
test('entity creation and props', () => { const e = new Entity({name:'test',type:'dynamic'}); assert.ok(e.id); assert.equal(e.name,'test'); assert.equal(e.type,'dynamic'); e.properties.set('hp',100); assert.equal(e.properties.get('hp'),100); });
test('gameobject aabb', () => { const g = new GameObject({name:'box',position:{x:0,y:0,z:0},halfExtents:{x:1,y:1,z:1}}); assert.deepEqual(g.aabbMin().toObject(),{x:-1,y:-1,z:-1}); assert.deepEqual(g.aabbMax().toObject(),{x:1,y:1,z:1}); });
test('toJSON', () => { const e = new Entity({name:'j',type:'static'}); const j = e.toJSON(); assert.equal(j.name,'j'); assert.equal(j.type,'static'); });
