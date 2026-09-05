// Unit tests for collision layers/masks on GameObject and CollisionSystem.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameObject, CollisionLayer } from '../src/entity/Entity.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { World } from '../src/engine/World.js';

function makeSoul(id: string, x: number, z: number, opts?: { collisionLayer?: number; collisionMask?: number }): GameObject {
  return new GameObject({
    id,
    name: id,
    type: 'soul',
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    mass: 1,
    material: 'flesh',
    collisionLayer: opts?.collisionLayer,
    collisionMask: opts?.collisionMask,
  });
}

function makeWorld(): World {
  return new World({ name: 'test', tickRate: 60 });
}

describe('CollisionLayer constants', () => {
  it('defines standard layers as distinct bits', () => {
    assert.equal(CollisionLayer.DEFAULT, 1 << 0);
    assert.equal(CollisionLayer.PLAYER, 1 << 1);
    assert.equal(CollisionLayer.ENEMY, 1 << 2);
    assert.equal(CollisionLayer.WORLD, 1 << 3);
    assert.equal(CollisionLayer.INTERACTABLE, 1 << 4);
    assert.equal(CollisionLayer.PROJECTILE, 1 << 5);
    assert.equal(CollisionLayer.TRIGGER, 1 << 6);
    assert.equal(CollisionLayer.HAZARD, 1 << 7);
    assert.equal(CollisionLayer.ALL, 0xFFFF);
    assert.equal(CollisionLayer.NONE, 0);
  });

  it('layers can be combined with bitwise OR', () => {
    const combined = CollisionLayer.PLAYER | CollisionLayer.ENEMY;
    assert.ok((combined & CollisionLayer.PLAYER) !== 0);
    assert.ok((combined & CollisionLayer.ENEMY) !== 0);
    assert.ok((combined & CollisionLayer.WORLD) === 0);
  });
});

describe('GameObject collision layers', () => {
  it('defaults collisionLayer to ALL (0xFFFF)', () => {
    const obj = makeSoul('a', 0, 0);
    assert.equal(obj.collisionLayer, 0xFFFF);
  });

  it('defaults collisionMask to ALL (0xFFFF)', () => {
    const obj = makeSoul('a', 0, 0);
    assert.equal(obj.collisionMask, 0xFFFF);
  });

  it('accepts custom collisionLayer and collisionMask', () => {
    const obj = makeSoul('a', 0, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.WORLD | CollisionLayer.ENEMY,
    });
    assert.equal(obj.collisionLayer, CollisionLayer.PLAYER);
    assert.equal(obj.collisionMask, CollisionLayer.WORLD | CollisionLayer.ENEMY);
  });

  describe('canCollideWith', () => {
    it('returns true for two default entities (ALL layers)', () => {
      const a = makeSoul('a', 0, 0);
      const b = makeSoul('b', 0, 0);
      assert.equal(a.canCollideWith(b), true);
      assert.equal(b.canCollideWith(a), true);
    });

    it('returns true when layers overlap both ways', () => {
      // A is PLAYER, can collide with ENEMY.
      const a = makeSoul('a', 0, 0, {
        collisionLayer: CollisionLayer.PLAYER,
        collisionMask: CollisionLayer.ENEMY,
      });
      // B is ENEMY, can collide with PLAYER.
      const b = makeSoul('b', 0, 0, {
        collisionLayer: CollisionLayer.ENEMY,
        collisionMask: CollisionLayer.PLAYER,
      });
      assert.equal(a.canCollideWith(b), true);
      assert.equal(b.canCollideWith(a), true);
    });

    it('returns false when A cannot see B (mask mismatch)', () => {
      // A is PLAYER, mask only WORLD — cannot see ENEMY.
      const a = makeSoul('a', 0, 0, {
        collisionLayer: CollisionLayer.PLAYER,
        collisionMask: CollisionLayer.WORLD,
      });
      // B is ENEMY, mask PLAYER — B can see A, but A cannot see B.
      const b = makeSoul('b', 0, 0, {
        collisionLayer: CollisionLayer.ENEMY,
        collisionMask: CollisionLayer.PLAYER,
      });
      // Collision requires BOTH directions to overlap.
      assert.equal(a.canCollideWith(b), false);
      assert.equal(b.canCollideWith(a), false);
    });

    it('returns false when layers are completely different', () => {
      const a = makeSoul('a', 0, 0, {
        collisionLayer: CollisionLayer.PLAYER,
        collisionMask: CollisionLayer.PLAYER,
      });
      const b = makeSoul('b', 0, 0, {
        collisionLayer: CollisionLayer.ENEMY,
        collisionMask: CollisionLayer.ENEMY,
      });
      assert.equal(a.canCollideWith(b), false);
    });

    it('returns true for trigger layer detecting player (one-way detection)', () => {
      // Trigger volume: layer TRIGGER, mask PLAYER — detects players.
      const trigger = makeSoul('trigger', 0, 0, {
        collisionLayer: CollisionLayer.TRIGGER,
        collisionMask: CollisionLayer.PLAYER,
      });
      // Player: layer PLAYER, mask TRIGGER — player also detects triggers.
      const player = makeSoul('player', 0, 0, {
        collisionLayer: CollisionLayer.PLAYER,
        collisionMask: CollisionLayer.TRIGGER,
      });
      assert.equal(trigger.canCollideWith(player), true);
    });

    it('returns false when entity has NONE mask', () => {
      const a = makeSoul('a', 0, 0, { collisionMask: CollisionLayer.NONE });
      const b = makeSoul('b', 0, 0);
      assert.equal(a.canCollideWith(b), false);
    });
  });
});

describe('CollisionSystem with collision layers', () => {
  it('does not resolve collision when layers do not overlap', () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    // Player layer, mask only WORLD — won't collide with other souls.
    const a = makeSoul('a', 0, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.WORLD,
    });
    // Enemy layer, mask only WORLD — won't collide with player.
    const b = makeSoul('b', 0.5, 0, {
      collisionLayer: CollisionLayer.ENEMY,
      collisionMask: CollisionLayer.WORLD,
    });
    world.addEntity(a);
    world.addEntity(b);

    const origAX = a.position.x;
    const origBX = b.position.x;

    world.step(1 / 60);

    // No collision should have been resolved — positions unchanged.
    assert.equal(a.position.x, origAX, 'player should not move (no collision)');
    assert.equal(b.position.x, origBX, 'enemy should not move (no collision)');
    assert.equal(cs.getStats().collisionsDetected, 0, 'no collisions should be detected');
  });

  it('resolves collision when layers overlap', () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    // Player and enemy can see each other.
    const a = makeSoul('a', 0, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.ENEMY | CollisionLayer.WORLD,
    });
    const b = makeSoul('b', 0.5, 0, {
      collisionLayer: CollisionLayer.ENEMY,
      collisionMask: CollisionLayer.PLAYER | CollisionLayer.WORLD,
    });
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    // Collision should be resolved — entities separated.
    assert.ok(cs.getStats().collisionsDetected >= 1, 'collision should be detected');
    assert.ok(a.position.x < 0, `player should be pushed left, got x=${a.position.x.toFixed(3)}`);
    assert.ok(b.position.x > 0.5, `enemy should be pushed right, got x=${b.position.x.toFixed(3)}`);
  });

  it('backward compatible: default entities still collide', () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    // Default entities (ALL layers, ALL mask) — should collide as before.
    const a = makeSoul('a', 0, 0);
    const b = makeSoul('b', 0.5, 0);
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    assert.ok(cs.getStats().collisionsDetected >= 1, 'default entities should still collide');
  });

  it('projectile passes through player if player mask excludes projectiles', () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    // Player: mask WORLD | ENEMY — no PROJECTILE.
    const player = makeSoul('player', 0, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.WORLD | CollisionLayer.ENEMY,
    });
    // Projectile: layer PROJECTILE, mask PLAYER — projectile wants to hit player.
    const projectile = makeSoul('proj', 0.3, 0, {
      collisionLayer: CollisionLayer.PROJECTILE,
      collisionMask: CollisionLayer.PLAYER,
    });
    world.addEntity(player);
    world.addEntity(projectile);

    const origPlayerX = player.position.x;
    const origProjX = projectile.position.x;

    world.step(1 / 60);

    // Player cannot see projectile (mask excludes it), so no collision.
    assert.equal(cs.getStats().collisionsDetected, 0, 'player should not collide with projectile');
    assert.equal(player.position.x, origPlayerX, 'player should not move');
    assert.equal(projectile.position.x, origProjX, 'projectile should not move');
  });

  it('works with spatial hash broad phase', () => {
    const world = makeWorld();
    const cs = new CollisionSystem({
      broadPhase: 'spatial-hash',
      spatialHashCellSize: 5,
      restitution: 0,
      positionalCorrection: 1.0,
      slop: 0,
    });
    world.addSystem(cs);

    // Two entities on non-overlapping layers.
    const a = makeSoul('a', 0, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.WORLD,
    });
    const b = makeSoul('b', 0.5, 0, {
      collisionLayer: CollisionLayer.ENEMY,
      collisionMask: CollisionLayer.WORLD,
    });
    world.addEntity(a);
    world.addEntity(b);

    world.step(1 / 60);

    assert.equal(cs.getStats().collisionsDetected, 0, 'no collision with spatial hash + layer filter');
  });

  it('three entities with different layer interactions', () => {
    const world = makeWorld();
    const cs = new CollisionSystem({ restitution: 0, positionalCorrection: 1.0, slop: 0 });
    world.addSystem(cs);

    // Player collides with enemy and world, not other players.
    const player1 = makeSoul('p1', 0, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.ENEMY | CollisionLayer.WORLD,
    });
    const player2 = makeSoul('p2', 0.3, 0, {
      collisionLayer: CollisionLayer.PLAYER,
      collisionMask: CollisionLayer.ENEMY | CollisionLayer.WORLD,
    });
    // Enemy collides with players and world, not other enemies.
    const enemy = makeSoul('e1', 0.6, 0, {
      collisionLayer: CollisionLayer.ENEMY,
      collisionMask: CollisionLayer.PLAYER | CollisionLayer.WORLD,
    });
    world.addEntity(player1);
    world.addEntity(player2);
    world.addEntity(enemy);

    world.step(1 / 60);

    const stats = cs.getStats();
    // p1-p2: no (both PLAYER, mask excludes PLAYER)
    // p1-e1: yes (PLAYER sees ENEMY, ENEMY sees PLAYER)
    // p2-e1: yes
    assert.ok(stats.collisionsDetected >= 2, `should detect at least 2 collisions (player-enemy pairs), got ${stats.collisionsDetected}`);
  });
});
