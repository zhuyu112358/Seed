import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldBuilder } from '../../src/sdk/WorldBuilder.js';

test('createWorld applies options and fluent chaining returns this', () => {
  const builder = new WorldBuilder();
  const result = builder.createWorld({ name: 'demo', tickRate: 30 });
  assert.equal(result, builder);
  builder.setTickRate(60);
  builder.enableClock(120);
  builder.enableWeather('rain');
  builder.enableEvents(7);
  const config = builder.build();
  assert.equal(config.name, 'demo');
  assert.equal(config.tickRate, 60);
  assert.equal(config.clock.dayLengthSeconds, 120);
  assert.equal(config.weather.enabled, true);
  assert.equal(config.weather.initialState, 'rain');
  assert.equal(config.events.maxActiveEvents, 7);
});

test('build() produces a complete WorldConfig with defaults', () => {
  const config = new WorldBuilder().createWorld({ name: 'c' }).build();
  assert.ok(config.id);
  assert.ok(config.bounds.min && config.bounds.max);
  assert.equal(config.physics.gravity.y, -9.8);
  assert.equal(config.maxEntities, 10000);
  assert.ok(config.snapshot.directory);
});

test('addEntity stores pending entities and returns ids', () => {
  const builder = new WorldBuilder().createWorld({ name: 'e' });
  const id1 = builder.addEntity({ type: 'static', name: 'a' });
  const id2 = builder.addEntity({ type: 'dynamic', name: 'b' });
  assert.ok(id1);
  assert.ok(id2);
  assert.notEqual(id1, id2);
  const ids = builder.addEntities([
    { type: 'dynamic', name: 'c' },
    { type: 'dynamic', name: 'd' },
  ]);
  assert.equal(ids.length, 2);
});

test('setPhysicsConfig merges overrides over defaults', () => {
  const config = new WorldBuilder()
    .createWorld({ name: 'p' })
    .setPhysicsConfig({ gravity: { x: 0, y: -1.62, z: 0 } })
    .build();
  assert.equal(config.physics.gravity.y, -1.62);
  assert.equal(config.physics.substeps, 2);
});

test('registerSoul queues a soul anchor for startup', async () => {
  const builder = new WorldBuilder()
    .createWorld({ name: 'soul' })
    .registerSoul('alpha', { x: 1, y: 2, z: 3 });
  const world = await builder.buildAndStart();
  try {
    const soul = world.getEntity('soul_alpha');
    assert.ok(soul);
    assert.equal(soul?.position.x, 1);
    assert.equal(world.getStats().entityCount, 1);
  } finally {
    world.destroy();
  }
});
