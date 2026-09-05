import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder } from '../src/sdk/WorldBuilder.js';
import { World } from '../src/engine/World.js';
import { GameObject } from '../src/entity/Entity.js';

test('build returns a World with the configured name and tickRate', () => {
  const world = new WorldBuilder('demo').setConfig({ tickRate: 30 }).build();
  assert.ok(world instanceof World);
  assert.equal(world.config.name, 'demo');
  assert.equal(world.config.tickRate, 30);
});

test('addEntity places a body into the built world', () => {
  const box = new GameObject({ id: 'crate', name: 'crate', position: { x: 0, y: 0, z: 0 } });
  const world = new WorldBuilder('scene').addEntity(box).build();
  assert.equal(world.bodies().length, 1);
  assert.equal(world.getEntity('crate'), box);
});

test('usePhysics wires a PhysicsSystem into the world and exposes it', () => {
  const builder = new WorldBuilder('phys');
  const world = builder.usePhysics().build();
  assert.ok(builder.physicsSystem);
  assert.equal(world.systems.includes(builder.physicsSystem), true);
  assert.equal(builder.physicsSystem!.name, 'physics');
});

test('the built world can step and drive its systems', () => {
  const box = new GameObject({ id: 'dyn', name: 'dyn', position: { x: 0, y: 5, z: 0 }, mass: 1 });
  const world = new WorldBuilder('step').addEntity(box).usePhysics().build();
  world.step(1 / 60);
  assert.equal(world.tick, 1);
  assert.ok(world.worldTime > 0);
});
