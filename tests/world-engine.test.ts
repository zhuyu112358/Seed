// Unit tests for World / WorldEngine / WorldBuilder (src/engine/* + src/sdk/WorldBuilder.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import type { WorldSystem } from '../src/engine/World.js';
import { WorldEngine } from '../src/engine/WorldEngine.js';
import { WorldBuilder } from '../src/sdk/WorldBuilder.js';
import { PhysicsConfig } from '../src/physics/PhysicsConfig.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import { GameObject } from '../src/entity/Entity.js';

/** A minimal recording system used to verify the world drives its systems. */
function recordingSystem(): WorldSystem & { calls: number; lastDt: number } {
  const sys = {
    name: 'recorder',
    enabled: true,
    calls: 0,
    lastDt: 0,
    tick(dt: number) {
      this.calls++;
      this.lastDt = dt;
    },
  };
  return sys;
}

describe('World entity container', () => {
  it('addEntity / getEntity / removeEntity', () => {
    const w = new World({ name: 't', tickRate: 60 });
    const e = EntityFactory.dynamicBox({ name: 'b', position: { x: 0, y: 0, z: 0 } });
    w.addEntity(e);
    assert.equal(w.entities.size, 1);
    assert.equal(w.getEntity(e.id), e);
    assert.equal(w.removeEntity(e.id), true);
    assert.equal(w.getEntity(e.id), undefined);
    assert.equal(w.removeEntity(e.id), false);
  });

  it('bodies() returns only GameObjects', () => {
    const w = new World({ name: 't', tickRate: 60 });
    const dyn = EntityFactory.dynamicBox({ name: 'd', position: { x: 0, y: 0, z: 0 } });
    const zone = EntityFactory.zoneTrigger({ name: 'z', center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } });
    w.addEntity(dyn).addEntity(zone);
    const bodies = w.bodies();
    assert.equal(bodies.length, 2);
    assert.ok(bodies.every((b) => b instanceof GameObject));
  });

  it('queryByType and iterate', () => {
    const w = new World({ name: 't', tickRate: 60 });
    w.addEntity(EntityFactory.dynamicBox({ name: 'd', position: { x: 0, y: 0, z: 0 } }));
    w.addEntity(EntityFactory.staticBox('s', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }));
    assert.equal(w.queryByType('dynamic').length, 1);
    assert.equal(w.queryByType('static').length, 1);

    let seen = 0;
    w.iterate(() => seen++);
    assert.equal(seen, 2);
  });
});

describe('World.step', () => {
  it('advances tick and worldTime and emits a WorldTickEvent', () => {
    const w = new World({ name: 't', tickRate: 60 });
    let tickPayload: { tick: number; worldTime: number } | undefined;
    w.events.on('world.tick', (e) => (tickPayload = e.payload as { tick: number; worldTime: number }));

    assert.equal(w.tick, 0);
    assert.equal(w.worldTime, 0);
    w.step(1 / 60);
    w.step(1 / 60);
    assert.equal(w.tick, 2);
    assert.ok(Math.abs(w.worldTime - 2 / 60) < 1e-9);
    assert.equal(tickPayload!.tick, 2);
    assert.ok(Math.abs(tickPayload!.worldTime - 2 / 60) < 1e-9);
  });

  it('drives every enabled system and skips disabled ones', () => {
    const w = new World({ name: 't', tickRate: 60 });
    const on = recordingSystem();
    const off = recordingSystem();
    off.enabled = false;
    w.addSystem(on);
    w.addSystem(off);
    w.step(1 / 60);
    assert.equal(on.calls, 1);
    assert.equal(off.calls, 0);
  });

  it('start/stop flip the world state', () => {
    const w = new World({ name: 't', tickRate: 60 });
    assert.equal(w.state, 'created');
    w.start();
    assert.equal(w.state, 'running');
    w.stop();
    assert.equal(w.state, 'stopped');
  });
});

describe('WorldEngine', () => {
  it('throws when running without a loaded world', () => {
    const eng = new WorldEngine();
    assert.equal(eng.currentWorld, null);
    assert.throws(() => eng.runTicks(1), /no world loaded/);
    assert.throws(() => eng.start(), /no world loaded/);
  });

  it('load() attaches the world and runTicks advances it', () => {
    const w = new World({ name: 'e', tickRate: 60 });
    const eng = new WorldEngine();
    eng.load(w);
    assert.equal(eng.currentWorld, w);
    eng.runTicks(5);
    assert.equal(w.tick, 5);
  });

  it('start()/stop() flip isRunning and toggle world state', () => {
    const w = new World({ name: 'e', tickRate: 60 });
    const eng = new WorldEngine();
    eng.load(w);
    eng.start();
    assert.equal(eng.isRunning, true);
    assert.equal(w.state, 'running');
    eng.stop();
    assert.equal(eng.isRunning, false);
    assert.equal(w.state, 'stopped');
  });
});

describe('WorldBuilder (SDK)', () => {
  it('builds a World with entities and systems', () => {
    const world = new WorldBuilder('b')
      .setConfig({ tickRate: 30 })
      .addEntity(EntityFactory.staticBox('g', { x: 0, y: 0, z: 0 }, { x: 5, y: 0.5, z: 5 }))
      .addEntity(EntityFactory.dynamicBox({ name: 'box', position: { x: 0, y: 2, z: 0 } }))
      .build();

    assert.equal(world.config.name, 'b');
    assert.equal(world.config.tickRate, 30);
    assert.equal(world.entities.size, 2);
  });

  it('usePhysics wires a PhysicsSystem into the world', () => {
    const builder = new WorldBuilder('b2').usePhysics(PhysicsConfig.builder().gravity(0).build());
    const world = builder.build();
    assert.ok(builder.physicsSystem);
    assert.equal(builder.physicsSystem!.config.gravity, 0);
    assert.equal(world.systems.length, 1);
    assert.equal(world.systems[0].name, 'physics');
  });

  it('addSystem registers a custom system on the built world', () => {
    const rec = recordingSystem();
    const world = new WorldBuilder('b3').addSystem(rec).build();
    world.step(1 / 60);
    assert.equal(rec.calls, 1);
  });
});
