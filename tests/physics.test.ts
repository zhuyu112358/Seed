import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';

test('PhysicsSystem integrates gravity (object falls)', () => {
  const world = new World({ name: 'p', tickRate: 60 });
  const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 10, z: 0 }, mass: 1 });
  world.addEntity(ball);
  const phys = new PhysicsSystem({ config: PhysicsConfig.builder().gravity(9.8).airResistance(0).friction(0).build() });
  world.addSystem(phys);
  const y0 = ball.position.y;
  world.step(1 / 60);
  world.step(1 / 60);
  assert.ok(ball.position.y < y0, `expected y to fall, got ${ball.position.y} vs ${y0}`);
});

test('PhysicsSystem fires collision events', () => {
  const world = new World({ name: 'p', tickRate: 60 });
  const ground = EntityFactory.staticBox('ground', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 });
  // Drop ball so it overlaps ground after a few ticks.
  const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 0.4, z: 0 }, mass: 1 });
  world.addEntity(ground).addEntity(ball);
  const phys = new PhysicsSystem({ config: PhysicsConfig.builder().gravity(9.8).build() });
  world.addSystem(phys);
  let hits = 0;
  world.events.on('physics.collision', () => hits++);
  for (let i = 0; i < 30; i++) world.step(1 / 60);
  assert.ok(hits > 0, 'expected at least one collision event');
});

test('applyImpulse changes velocity', () => {
  const world = new World({ name: 'p', tickRate: 60 });
  const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 0, z: 0 }, mass: 2 });
  world.addEntity(ball);
  const phys = new PhysicsSystem();
  phys.applyImpulse(ball, 4, 0, 0);
  assert.ok(Math.abs(ball.velocity.x - 2) < 1e-9, 'F/m = 4/2 = 2');
});
