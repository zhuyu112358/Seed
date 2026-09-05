import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder } from '../../src/sdk/WorldBuilder.js';
import { EntityFactory } from '../../src/sdk/EntityFactory.js';
import { PhysicsConfig } from '../../src/physics/PhysicsConfig.js';

test('constructor creates a World with default name and tickRate', () => {
  const builder = new WorldBuilder('test-world');
  const world = builder.build();
  assert.equal(world.config.name, 'test-world');
  assert.equal(world.config.tickRate, 60);
});

test('setConfig updates world config and returns this for chaining', () => {
  const builder = new WorldBuilder();
  const result = builder.setConfig({ name: 'renamed', tickRate: 30 });
  assert.equal(result, builder);
  const world = builder.build();
  assert.equal(world.config.name, 'renamed');
  assert.equal(world.config.tickRate, 30);
});

test('addEntity adds entity to world and returns this', () => {
  const builder = new WorldBuilder('e');
  const box = EntityFactory.dynamicBox({ name: 'box', position: { x: 0, y: 0, z: 0 } });
  const result = builder.addEntity(box);
  assert.equal(result, builder);
  const world = builder.build();
  assert.equal(world.entities.size, 1);
  assert.equal(world.getEntity(box.id)?.name, 'box');
});

test('usePhysics adds PhysicsSystem and returns this', () => {
  const builder = new WorldBuilder('p');
  const config = PhysicsConfig.builder().gravity(9.8).build();
  const result = builder.usePhysics(config);
  assert.equal(result, builder);
  assert.ok(builder.physicsSystem);
  const world = builder.build();
  assert.equal(world.systems.length, 1);
});

test('build returns the World instance', () => {
  const builder = new WorldBuilder('b');
  const world = builder.build();
  assert.equal(world.constructor.name, 'World');
  assert.equal(world.state, 'created');
});

test('fluent chaining works across multiple methods', () => {
  const world = new WorldBuilder('chain')
    .setConfig({ tickRate: 120 })
    .addEntity(EntityFactory.staticBox('ground', { x: 0, y: -0.5, z: 0 }, { x: 10, y: 0.5, z: 10 }))
    .addEntity(EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 5, z: 0 } }))
    .usePhysics(PhysicsConfig.defaults())
    .build();
  assert.equal(world.config.name, 'chain');
  assert.equal(world.config.tickRate, 120);
  assert.equal(world.entities.size, 2);
  assert.equal(world.systems.length, 1);
});
