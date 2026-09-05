// Unit tests for src/physics/PhysicsSystem.ts, SimplePhysics2D.ts, PhysicsConfig.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { SimplePhysics2D } from '../src/physics/SimplePhysics2D.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { aabbOverlap } from '../src/physics/IPhysicsBackend.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { World } from '../src/engine/World.js';

describe('PhysicsConfig', () => {
  it('exposes default SI-like values', () => {
    const c = new PhysicsConfig();
    assert.equal(c.gravity, 9.8);
    assert.equal(c.friction, 0.1);
    assert.equal(c.restitution, 0.6);
    assert.equal(c.enabled, true);
  });

  it('builder overrides selected values', () => {
    const c = PhysicsConfig.builder().gravity(20).restitution(0.9).build();
    assert.equal(c.gravity, 20);
    assert.equal(c.restitution, 0.9);
    assert.equal(c.friction, 0.1);
  });
});

describe('SimplePhysics2D', () => {
  it('integrates gravity: a free body falls on the Y axis', () => {
    const body = EntityFactory.dynamicBox({ name: 'faller', position: { x: 0, y: 10, z: 0 }, velocity: { x: 0, y: 0, z: 0 } });
    const before = body.position.y;
    new SimplePhysics2D().step(1 / 60, [body], new PhysicsConfig());
    assert.ok(body.position.y < before);
  });

  it('detects overlap and returns a CollisionPair', () => {
    const a = EntityFactory.dynamicBox({ name: 'a', position: { x: 0, y: 0, z: 0 } });
    const b = EntityFactory.dynamicBox({ name: 'b', position: { x: 0.1, y: 0, z: 0 } });
    const { collisions } = new SimplePhysics2D().step(1 / 60, [a, b], new PhysicsConfig());
    assert.ok(collisions.length >= 1);
    assert.equal(collisions[0].a, a);
    assert.equal(collisions[0].b, b);
  });

  it('applyImpulse divides force by mass', () => {
    const body = EntityFactory.dynamicBox({ name: 'p', position: { x: 0, y: 0, z: 0 }, mass: 2 });
    new SimplePhysics2D().applyImpulse(body, 10, 0, 0);
    assert.ok(Math.abs(body.velocity.x - 5) < 1e-9);
  });
});

describe('aabbOverlap', () => {
  it('reports overlapping and disjoint boxes', () => {
    assert.equal(aabbOverlap({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0.5, y: 0.5, z: 0.5 }, { x: 2, y: 2, z: 2 }), true);
    assert.equal(aabbOverlap({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 5, y: 5, z: 5 }, { x: 6, y: 6, z: 6 }), false);
  });
});

describe('PhysicsSystem (WorldSystem)', () => {
  it('constructs with defaults', () => {
    const sys = new PhysicsSystem();
    assert.equal(sys.name, 'physics');
    assert.equal(sys.enabled, true);
    assert.ok(sys.config instanceof PhysicsConfig);
  });

  it('tick steps bodies and emits CollisionEvent', () => {
    const world = new World({ name: 'w', tickRate: 60 });
    const a = EntityFactory.dynamicBox({ name: 'a', position: { x: 0, y: 0, z: 0 } });
    const b = EntityFactory.dynamicBox({ name: 'b', position: { x: 0.1, y: 0, z: 0 } });
    world.addEntity(a); world.addEntity(b);
    const sys = new PhysicsSystem();
    let collisions = 0;
    world.events.on('physics.collision', () => collisions++);
    sys.tick(1 / 60, world, world.events);
    assert.ok(collisions >= 1);
    assert.ok(sys.counters.collisions >= 1);
  });

  it('tick fires EntityEnterZone when a body enters a trigger region', () => {
    const world = new World({ name: 'w', tickRate: 60 });
    const zone = EntityFactory.zoneTrigger({ name: 'zone', center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 2, y: 2, z: 2 } });
    const body = EntityFactory.dynamicBox({ name: 'intruder', position: { x: 0, y: 0, z: 0 } });
    world.addEntity(zone); world.addEntity(body);
    const sys = new PhysicsSystem();
    let entered = false;
    world.events.on('zone.enter', (e) => { if (e.payload.zoneId === zone.id) entered = true; });
    sys.tick(1 / 60, world, world.events);
    assert.equal(entered, true);
  });

  it('applyImpulse delegates to the backend', () => {
    const sys = new PhysicsSystem();
    const body = EntityFactory.dynamicBox({ name: 'p', position: { x: 0, y: 0, z: 0 }, mass: 1 });
    sys.applyImpulse(body, 4, 0, 0);
    assert.ok(Math.abs(body.velocity.x - 4) < 1e-9);
  });
});
