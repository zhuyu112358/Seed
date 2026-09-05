// Unit tests for PhysicsConfig / PhysicsSystem / SimplePhysics2D (src/physics/*).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { SimplePhysics2D } from '../src/physics/SimplePhysics2D.js';
import { aabbOverlap } from '../src/physics/IPhysicsBackend.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';

describe('PhysicsConfig', () => {
  it('exposes sensible defaults', () => {
    const c = new PhysicsConfig();
    assert.equal(c.gravity, 9.8);
    assert.equal(c.friction, 0.1);
    assert.equal(c.airResistance, 0.05);
    assert.equal(c.fixedDt, 1 / 60);
    assert.equal(c.enabled, true);
    assert.equal(c.restitution, 0.6);
  });

  it('honours constructor overrides', () => {
    const c = new PhysicsConfig({ gravity: 2, friction: 0, airResistance: 0, restitution: 1 });
    assert.equal(c.gravity, 2);
    assert.equal(c.friction, 0);
    assert.equal(c.airResistance, 0);
    assert.equal(c.restitution, 1);
  });

  it('defaults() returns a fresh default config', () => {
    const c = PhysicsConfig.defaults();
    assert.equal(c.gravity, 9.8);
  });

  it('supports the fluent builder', () => {
    const c = PhysicsConfig.builder()
      .gravity(3.5)
      .friction(0.2)
      .airResistance(0.1)
      .fixedDt(1 / 30)
      .enabled(false)
      .restitution(0.9)
      .build();
    assert.equal(c.gravity, 3.5);
    assert.equal(c.friction, 0.2);
    assert.equal(c.airResistance, 0.1);
    assert.equal(c.fixedDt, 1 / 30);
    assert.equal(c.enabled, false);
    assert.equal(c.restitution, 0.9);
  });
});

describe('aabbOverlap helper', () => {
  it('detects overlapping boxes', () => {
    assert.equal(
      aabbOverlap(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 0.5, y: 0.5, z: 0.5 },
        { x: 2, y: 2, z: 2 },
      ),
      true,
    );
  });

  it('returns false for disjoint boxes', () => {
    assert.equal(
      aabbOverlap(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 2, y: 2, z: 2 },
        { x: 3, y: 3, z: 3 },
      ),
      false,
    );
  });
});

describe('SimplePhysics2D backend', () => {
  it('integrates gravity so a dynamic body falls', () => {
    const backend = new SimplePhysics2D();
    const body = EntityFactory.dynamicBox({ name: 'b', position: { x: 0, y: 10, z: 0 } });
    const cfg = new PhysicsConfig({ gravity: 9.8, airResistance: 0, friction: 0 });
    const y0 = body.position.y;
    backend.step(1 / 60, [body], cfg);
    assert.ok(body.position.y < y0, `expected y to fall: ${body.position.y} < ${y0}`);
  });

  it('reports collisions between overlapping bodies', () => {
    const backend = new SimplePhysics2D();
    const a = EntityFactory.dynamicBox({ name: 'a', position: { x: 0, y: 0, z: 0 } });
    const b = EntityFactory.dynamicBox({ name: 'b', position: { x: 0.6, y: 0, z: 0 } });
    const cfg = new PhysicsConfig({ gravity: 0 });
    const { collisions } = backend.step(1 / 60, [a, b], cfg);
    assert.ok(collisions.length >= 1);
    assert.ok(collisions[0].relativeSpeed >= 0);
  });
});

describe('PhysicsSystem', () => {
  it('is a named system that starts enabled from config', () => {
    const sys = new PhysicsSystem();
    assert.equal(sys.name, 'physics');
    assert.equal(sys.enabled, true);
    assert.deepEqual(sys.counters, { collisions: 0, moved: 0 });
  });

  it('tick() drives gravity and counts moved bodies', () => {
    const world = new World({ name: 'p', tickRate: 60 });
    const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 10, z: 0 } });
    world.addEntity(ball);
    const sys = new PhysicsSystem({
      config: new PhysicsConfig({ gravity: 9.8, airResistance: 0, friction: 0 }),
    });
    world.addSystem(sys);
    const y0 = ball.position.y;
    world.step(1 / 60);
    world.step(1 / 60);
    assert.ok(ball.position.y < y0);
    assert.ok(sys.counters.moved >= 1);
  });

  it('emits CollisionEvent and increments the collision counter', () => {
    const world = new World({ name: 'p', tickRate: 60 });
    const ground = EntityFactory.staticBox('ground', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 });
    const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 0.4, z: 0 } });
    world.addEntity(ground).addEntity(ball);
    const sys = new PhysicsSystem({ config: new PhysicsConfig({ gravity: 9.8 }) });
    world.addSystem(sys);

    let hits = 0;
    world.events.on('physics.collision', () => hits++);
    for (let i = 0; i < 30; i++) world.step(1 / 60);
    assert.ok(hits > 0, 'expected at least one collision event');
    assert.ok(sys.counters.collisions > 0);
  });

  it('does nothing when disabled', () => {
    const world = new World({ name: 'p', tickRate: 60 });
    const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 10, z: 0 } });
    world.addEntity(ball);
    const sys = new PhysicsSystem({ config: new PhysicsConfig({ gravity: 9.8 }) });
    sys.enabled = false;
    world.addSystem(sys);
    const y0 = ball.position.y;
    world.step(1 / 60);
    assert.equal(ball.position.y, y0);
  });

  it('applyImpulse changes velocity by F/m', () => {
    const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 0, z: 0 }, mass: 2 });
    const sys = new PhysicsSystem();
    sys.applyImpulse(ball, 4, 0, 0);
    assert.ok(Math.abs(ball.velocity.x - 2) < 1e-9, 'F/m = 4/2 = 2');
  });

  it('applyImpulse ignores static (infinite-mass) bodies', () => {
    const wall = EntityFactory.staticBox('wall', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const sys = new PhysicsSystem();
    const vx0 = wall.velocity.x;
    sys.applyImpulse(wall, 100, 0, 0);
    assert.equal(wall.velocity.x, vx0);
  });
});
