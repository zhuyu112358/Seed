import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { World } from '../src/engine/World.js';
test('gravity integration', () => {
  const w = new World({ name: 'p', tickRate: 60 });
  const ps = new PhysicsSystem({ config: PhysicsConfig.defaults() });
  w.addSystem(ps);
  const b = EntityFactory.dynamicBox({ name: 'b', position: { x: 0, y: 10, z: 0 } });
  w.addEntity(b);
  w.step(1 / 60);
  assert.ok(b.position.y < 10);
});
test('velocity integration', () => {
  const w = new World({ name: 'v', tickRate: 60 });
  const ps = new PhysicsSystem({ config: new PhysicsConfig({ gravity: 0 }) });
  w.addSystem(ps);
  const b = EntityFactory.dynamicBox({ name: 'b', position: { x: 0, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } });
  w.addEntity(b);
  w.step(1);
  assert.ok(b.position.x > 0);
});
test('physics system name', () => {
  const ps = new PhysicsSystem({ config: PhysicsConfig.defaults() });
  assert.equal(ps.name, 'physics');
});
