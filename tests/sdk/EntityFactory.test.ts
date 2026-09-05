import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EntityFactory } from '../../src/sdk/EntityFactory.js';

const factory = new EntityFactory();
const origin = { x: 0, y: 0, z: 0 };

test('createGround is static with AABB shape', () => {
  const cfg = factory.createGround(origin, { x: 10, y: 1, z: 10 }, 'stone');
  assert.equal(cfg.type, 'static');
  assert.equal(cfg.isStatic, true);
  assert.equal(cfg.collisionShape?.type, 'aabb');
  assert.equal(cfg.collisionShape?.aabb?.max.x, 5);
});

test('createWall is static', () => {
  const cfg = factory.createWall({ x: 0, y: 2, z: -5 }, { x: 10, y: 4, z: 1 }, 'wood');
  assert.equal(cfg.type, 'static');
  assert.equal(cfg.material, 'wood');
});

test('createBox is dynamic with mass derived from density', () => {
  const cfg = factory.createBox(origin, 2, 'wood');
  assert.equal(cfg.type, 'dynamic');
  assert.equal(cfg.isStatic, false);
  assert.equal(cfg.mass, 8 * 600);
});

test('createLight carries interactive state', () => {
  const cfg = factory.createLight({ x: 1, y: 2, z: 3 }, 9, 1);
  assert.equal(cfg.type, 'interactive');
  assert.equal(cfg.state?.on, true);
  assert.equal(cfg.state?.radius, 9);
  assert.equal(cfg.state?.intensity, 1);
});

test('createDoor starts closed and unlocked', () => {
  const cfg = factory.createDoor(origin, 1.2, 2.2);
  assert.equal(cfg.type, 'interactive');
  assert.equal(cfg.state?.open, false);
  assert.equal(cfg.state?.locked, false);
  assert.equal(cfg.collisionShape?.type, 'aabb');
});

test('createTriggerZone is a sphere trigger', () => {
  const cfg = factory.createTriggerZone(origin, 4, 'wind-event');
  assert.equal(cfg.type, 'trigger');
  assert.equal(cfg.isTrigger, true);
  assert.equal(cfg.collisionShape?.type, 'sphere');
  assert.equal(cfg.collisionShape?.sphere?.radius, 4);
  assert.equal(cfg.state?.onEnter, 'wind-event');
});

test('createSoulAnchor is a soul sphere with soulId state', () => {
  const cfg = factory.createSoulAnchor('alpha', { x: 2, y: 1, z: 0 });
  assert.equal(cfg.type, 'soul');
  assert.equal(cfg.id, 'soul_alpha');
  assert.equal(cfg.state?.soulId, 'alpha');
  assert.equal(cfg.collisionShape?.sphere?.radius, 0.5);
});

test('custom merges defaults with overrides', () => {
  const cfg = factory.custom({ name: 'mine', type: 'dynamic' });
  assert.equal(cfg.name, 'mine');
  assert.equal(cfg.type, 'dynamic');
  assert.deepEqual(cfg.position, { x: 0, y: 0, z: 0 });
});
