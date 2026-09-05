import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder, RunningWorld } from '../src/sdk/WorldBuilder.js';

test('build() assembles a declarative WorldConfig from fluent calls', () => {
  const builder = new WorldBuilder().createWorld({ name: 'demo', tickRate: 30 });
  builder.addEntity({ id: 'e1', type: 'dynamic', name: 'crate', position: { x: 0, y: 0, z: 0 } });
  builder.setPhysicsConfig({ gravity: 5 });
  const cfg = builder.build();
  assert.equal(cfg.name, 'demo');
  assert.equal(cfg.tickRate, 30);
  assert.ok(cfg.bounds.max.x > cfg.bounds.min.x);
  assert.equal(cfg.communication.defaultStrategy, 'none');
});

test('addEntity returns stable ids for each declared entity', () => {
  const builder = new WorldBuilder().createWorld({ name: 'ids' });
  const id1 = builder.addEntity({ id: 'a', type: 'dynamic', name: 'a' });
  const id2 = builder.addEntity({ type: 'dynamic', name: 'b' });
  assert.equal(id1, 'a');
  assert.ok(typeof id2 === 'string' && id2.length > 0);
  const ids = builder.addEntities([
    { type: 'dynamic', name: 'c' },
    { type: 'dynamic', name: 'd' },
  ]);
  assert.equal(ids.length, 2);
});

test('buildAndStart returns a running RunningWorld whose stats and tick work', async () => {
  const builder = new WorldBuilder().createWorld({ name: 'live', tickRate: 60 });
  builder.addEntity({ id: 'p1', type: 'dynamic', name: 'player' });
  const world: RunningWorld = await builder.buildAndStart();
  try {
    assert.equal(world.isRunning, true);
    assert.ok(world.getEntity('p1'));
    world.tick(1 / 60);
    const stats = world.getStats();
    assert.equal(stats.entityCount, 1);
    assert.equal(stats.tickCount, 1);
    assert.equal(stats.fps, 60);
  } finally {
    world.destroy();
  }
  assert.equal(world.isRunning, false);
});
