// Integration test for the bottom-level composition WorldBuilder should wrap.
//
// NOTE: src/sdk/WorldBuilder.ts has a broken import (./PhysicsConfig.js does not
// exist on that path) so it cannot be imported directly. This test exercises the
// real building blocks the builder itself uses: an engine World container +
// EntityFactory + PhysicsSystem + EventSystem. (src/engine/WorldEngine.ts is
// also broken, so World.step advances the simulation instead of runTicks.)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { GameObject } from '../src/entity/Entity.js';

describe('World composition (WorldBuilder building blocks)', () => {
  it('constructs a world and manages its entities', () => {
    const world = new World({ name: 'demo', tickRate: 60 });
    assert.equal(world.config.name, 'demo');
    const box = EntityFactory.dynamicBox({ name: 'crate', position: { x: 0, y: 5, z: 0 } });
    world.addEntity(box);
    assert.equal(world.getEntity(box.id), box);
    assert.equal(world.removeEntity(box.id), true);
    assert.equal(world.getEntity(box.id), undefined);
  });

  it('step advances the tick counter and world time', () => {
    const world = new World({ name: 'demo', tickRate: 60 });
    world.step(1 / 60);
    world.step(1 / 60);
    assert.equal(world.tick, 2);
    assert.ok(Math.abs(world.worldTime - 2 / 60) < 1e-9);
  });

  it('emits a tick event on every step', () => {
    const world = new World({ name: 'demo', tickRate: 60 });
    let ticks = 0;
    world.events.on('world.tick', () => ticks++);
    world.step(1 / 60);
    world.step(1 / 60);
    assert.equal(ticks, 2);
  });

  it('runs a PhysicsSystem plugged in as a world system', () => {
    const world = new World({ name: 'demo', tickRate: 60 });
    world.addSystem(new PhysicsSystem());
    const floor = EntityFactory.staticBox('floor', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 });
    const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 5, z: 0 } });
    world.addEntity(floor);
    world.addEntity(ball);
    const startY = ball.position.y;
    world.step(1 / 60);
    assert.ok(ball.position.y < startY);
  });

  it('queryByType / bodies / iterate work over the entity set', () => {
    const world = new World({ name: 'demo', tickRate: 60 });
    const floor = EntityFactory.staticBox('floor', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const ball = EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 5, z: 0 } });
    const zone = EntityFactory.zoneTrigger({ name: 'zone', center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } });
    world.addEntity(floor).addEntity(ball).addEntity(zone);
    assert.equal(world.queryByType('static').length, 1);
    assert.equal(world.queryByType('dynamic').length, 1);
    assert.equal(world.queryByType('trigger').length, 1);
    assert.ok(world.bodies().every((b) => b instanceof GameObject));
    let seen = 0;
    world.iterate(() => seen++);
    assert.equal(seen, 3);
  });
});
