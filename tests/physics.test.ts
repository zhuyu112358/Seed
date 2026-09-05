import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { World } from '../src/engine/World.js';
test('gravity', () => { const w = new World({name:'p',tickRate:60}); w.addSystem(new PhysicsSystem({config:PhysicsConfig.defaults()})); const b = EntityFactory.dynamicBox({name:'b',position:{x:0,y:10,z:0}}); w.addEntity(b); w.step(1/60); assert.ok(b.position.y < 10); });
