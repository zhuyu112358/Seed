import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder } from '../src/sdk/WorldBuilder.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
test('build', () => { const w = new WorldBuilder('t').setConfig({tickRate:30}).addEntity(EntityFactory.staticBox('g',{x:0,y:0,z:0},{x:1,y:1,z:1})).build(); assert.equal(w.config.name,'t'); assert.equal(w.entities.size,1); });
test('usePhysics', () => { const b = new WorldBuilder('p').usePhysics(PhysicsConfig.defaults()); assert.ok(b.physicsSystem); });
