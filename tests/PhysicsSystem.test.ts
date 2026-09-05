import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { aabbOverlap } from '../src/physics/IPhysicsBackend.js';
import { GameObject } from '../src/entity/Entity.js';
import { World } from '../src/engine/World.js';
import { EventSystem } from '../src/event/EventSystem.js';

function makeWorld(...bodies: GameObject[]): { world: World; events: EventSystem } {
  const world = new World({ name: 'phys-test', tickRate: 60 });
  const events = new EventSystem();
  for (const b of bodies) world.addEntity(b);
  return { world, events };
}

test('PhysicsConfig exposes defaults and a fluent builder', () => {
  const d = PhysicsConfig.defaults();
  assert.equal(d.gravity, 9.8);
  assert.equal(d.enabled, true);
  const built = PhysicsConfig.builder().gravity(3.2).restitution(0.2).build();
  assert.equal(built.gravity, 3.2);
  assert.equal(built.restitution, 0.2);
});

test('aabbOverlap detects overlapping and disjoint boxes', () => {
  const min = { x: 0, y: 0, z: 0 };
  const max = { x: 1, y: 1, z: 1 };
  assert.equal(aabbOverlap(min, max, { x: 0.5, y: 0.5, z: 0.5 }, { x: 2, y: 2, z: 2 }), true);
  assert.equal(aabbOverlap(min, max, { x: 2, y: 2, z: 2 }, { x: 3, y: 3, z: 3 }), false);
});

test('start/stop toggles whether the backend runs', () => {
  const sys = new PhysicsSystem();
  sys.stop();
  assert.equal(sys.enabled, false);
  const body = new GameObject({ name: 'm', position: { x: 0, y: 5, z: 0 } });
  const { world, events } = makeWorld(body);
  const yBefore = body.position.y;
  sys.tick(1 / 60, world, events);
  assert.equal(body.position.y, yBefore); // disabled -> no movement
  sys.start();
  assert.equal(sys.enabled, true);
});

test('applyImpulse changes a dynamic body velocity, and tick emits collision events', () => {
  const sys = new PhysicsSystem();
  const a = new GameObject({ id: 'a', name: 'a', position: { x: 0, y: 0, z: 0 }, mass: 1 });
  const b = new GameObject({ id: 'b', name: 'b', position: { x: 0.5, y: 0, z: 0 }, mass: 1 });
  const { world, events } = makeWorld(a, b);

  sys.applyImpulse(a, 10, 0, 0);
  assert.equal(a.velocity.x, 10);

  const collisions: number[] = [];
  events.on('physics.collision', () => collisions.push(1));
  sys.tick(1 / 60, world, events);
  assert.ok(collisions.length >= 1, 'expected at least one collision event');
  assert.ok(sys.counters.collisions >= 1);
});

test('tick fires zone.enter when a body enters a trigger region', () => {
  const sys = new PhysicsSystem();
  const zone = new GameObject({
    id: 'zone', name: 'zone', type: 'trigger',
    position: { x: 10, y: 0, z: 0 }, halfExtents: { x: 2, y: 2, z: 2 },
  });
  const body = new GameObject({ id: 'walker', name: 'walker', position: { x: 10, y: 0, z: 0 } });
  const { world, events } = makeWorld(zone, body);

  let entered = 0;
  events.on('zone.enter', () => entered++);
  sys.tick(1 / 60, world, events);
  assert.equal(entered, 1);
});
