import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder, EntityFactory, PhysicsConfig } from '../src/sdk/index.js';
import { WorldEngine } from '../src/engine/WorldEngine.js';

test('WorldBuilder builds a runnable world', () => {
  const world = new WorldBuilder('b')
    .setConfig({ tickRate: 60 })
    .usePhysics(PhysicsConfig.defaults())
    .addEntity(EntityFactory.staticBox('g', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 }))
    .addEntity(EntityFactory.dynamicBox({ name: 'b', position: { x: 0, y: 2, z: 0 } }))
    .build();
  assert.equal(world.entities.size, 2);
  assert.equal(world.systems.length, 1);
  const engine = new WorldEngine();
  engine.load(world);
  engine.runTicks(5);
  assert.equal(world.tick, 5);
});

test('WorldBuilder attaches physics system', () => {
  const b = new WorldBuilder('b2').usePhysics(PhysicsConfig.builder().gravity(0).build());
  assert.ok(b.physicsSystem);
  assert.equal(b.physicsSystem!.config.gravity, 0);
});
