// Unit tests for World / WorldEngine / WorldBuilder (src/engine, src/sdk).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { WorldEngine } from '../src/engine/WorldEngine.js';
import { WorldBuilder } from '../src/sdk/WorldBuilder.js';
import { PhysicsSystem } from '../src/physics/PhysicsSystem.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';

describe('World container', () => {
  it('add / get / remove entity', () => {
    const w = new World({ name: 'w', tickRate: 60 });
    const e = EntityFactory.dynamicBox({ name: 'e', position: { x: 0, y: 0, z: 0 } });
    w.addEntity(e);
    assert.equal(w.getEntity(e.id), e);
    assert.equal(w.entities.size, 1);
    w.removeEntity(e.id);
    assert.equal(w.getEntity(e.id), undefined);
  });
  it('queryByType and iterate', () => {
    const w = new World({ name: 'w', tickRate: 60 });
    w.addEntity(EntityFactory.staticBox('g', { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }));
    w.addEntity(EntityFactory.dynamicBox({ name: 'b', position: { x: 0, y: 5, z: 0 } }));
    assert.equal(w.queryByType('static').length, 1);
    const names: string[] = [];
    w.iterate((e) => names.push(e.name));
    assert.equal(names.length, 2);
  });
  it('step advances tick/worldTime and drives systems', () => {
    const w = new World({ name: 'w', tickRate: 60 });
    let ticks = 0;
    w.events.on('world.tick', () => ticks++);
    let systemRan = 0;
    w.addSystem({ name: 'spy', enabled: true, start: () => undefined, stop: () => undefined, tick: () => systemRan++ });
    assert.equal(w.tick, 0);
    w.step(1 / 60);
    w.step(1 / 60);
    assert.equal(w.tick, 2);
    assert.ok(w.worldTime > 0);
    assert.equal(ticks, 2);
    assert.equal(systemRan, 2);
  });
});

describe('WorldEngine', () => {
  it('load + runTicks advances the loaded world', () => {
    const eng = new WorldEngine({ fixedDt: 1 / 60 });
    const w = new World({ name: 'eng', tickRate: 60 });
    eng.load(w);
    assert.equal(eng.currentWorld, w);
    eng.runTicks(3);
    assert.equal(w.tick, 3);
    eng.stop();
  });
});

describe('WorldBuilder', () => {
  it('builds a world with physics attached', () => {
    const w = new WorldBuilder('built').setConfig({ tickRate: 60 }).usePhysics().build();
    assert.equal(w.config.name, 'built');
    assert.ok(w.systems.some((s) => s instanceof PhysicsSystem));
  });
});
