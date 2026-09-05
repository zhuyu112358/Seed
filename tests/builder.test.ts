import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder } from '../src/sdk/WorldBuilder.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
test('build world', () => { const w = new WorldBuilder('test').setConfig({tickRate:30}).addEntity(EntityFactory.staticBox('g',{x:0,y:0,z:0},{x:1,y:1,z:1})).build(); assert.equal(w.config.name,'test'); assert.equal(w.config.tickRate,30); assert.equal(w.entities.size,1); });
test('usePhysics', () => { const b = new WorldBuilder('p').usePhysics(PhysicsConfig.defaults()); assert.ok(b.physicsSystem); const w = b.build(); assert.equal(w.systems.length,1); });
