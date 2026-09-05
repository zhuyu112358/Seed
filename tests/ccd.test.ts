// Unit tests for continuous collision detection (CCD) using swept AABB.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { GameObject } from '../src/entity/Entity.js';
import { Vector3 } from '../src/entity/Vector3.js';

function makeThinBody(id: string, x: number, vx: number): GameObject {
  const body = new GameObject({
    id, name: id, type: 'dynamic',
    position: { x, y: 0, z: 0 },
    halfExtents: { x: 0.1, y: 0.5, z: 0.5 }, // thin body (width 0.2)
    mass: 1, material: 'default',
  });
  body.velocity = new Vector3(vx, 0, 0);
  return body;
}

function makeThinWall(id: string, x: number): GameObject {
  const wall = new GameObject({
    id, name: id, type: 'static',
    position: { x, y: 0, z: 0 },
    halfExtents: { x: 0.1, y: 2, z: 5 }, // thin wall (width 0.2)
    mass: 0, material: 'stone',
  });
  return wall;
}

// CollisionSystem config that includes static walls in collidableTypes.
const ccdConfig = { enableCCD: true, ccdSpeedThreshold: 1.0, collidableTypes: ['dynamic', 'static'] };

describe('Continuous collision detection (CCD)', () => {
  describe('Swept AABB tunneling prevention', () => {
    it('CCD detects collision when fast body tunnels through thin wall', () => {
      // Setup: thin wall at x=5, spans [4.9, 5.1].
      // Body halfExtents.x=0.1, spans [pos-0.1, pos+0.1].
      // Simulate tunneling: prevPosition at x=4.7 (left of wall, no overlap),
      // current position at x=5.3 (right of wall, no overlap).
      // Body moved 0.6m in one tick — too fast for discrete detection.
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ ...ccdConfig });
      world.addSystem(collision);

      const wall = makeThinWall('wall', 5);
      const body = makeThinBody('body', 5.3, 36); // 36 m/s * 1/60 = 0.6m/tick
      body.prevPosition = new Vector3(4.7, 0, 0); // started left of wall
      world.addEntity(wall);
      world.addEntity(body);

      // Verify no overlap at current position (discrete detection would miss this).
      const bodyMin = body.position.x - body.halfExtents.x;
      const wallMax = wall.position.x + wall.halfExtents.x;
      assert.ok(bodyMin > wallMax, `body should be past wall at current position: bodyMin=${bodyMin} > wallMax=${wallMax}`);

      world.step(1 / 60);

      // With CCD, the swept AABB should detect the collision and push body back.
      assert.ok(body.position.x < 5.3,
        `CCD should push body back from tunneling position: x=${body.position.x.toFixed(3)} < 5.3`);
      assert.ok(body.position.x < 4.9,
        `body should be on left side of wall after collision resolution: x=${body.position.x.toFixed(3)} < 4.9`);
    });

    it('discrete detection (CCD off) misses tunneling collision', () => {
      // Same setup as above but with CCD disabled.
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ enableCCD: false, collidableTypes: ['dynamic', 'static'] });
      world.addSystem(collision);

      const wall = makeThinWall('wall', 5);
      const body = makeThinBody('body', 5.3, 36);
      body.prevPosition = new Vector3(4.7, 0, 0);
      world.addEntity(wall);
      world.addEntity(body);

      world.step(1 / 60);

      // Without CCD, the body should remain at x=5.3 (tunneled through wall).
      assert.ok(Math.abs(body.position.x - 5.3) < 0.01,
        `without CCD, body should tunnel through wall: x=${body.position.x.toFixed(3)} ≈ 5.3`);
    });

    it('CCD does not affect slow-moving bodies (regular AABB used)', () => {
      // Slow-moving body that overlaps the wall should be detected regardless of CCD.
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ enableCCD: true, ccdSpeedThreshold: 10.0, collidableTypes: ['dynamic', 'static'] });
      world.addSystem(collision);

      const wall = makeThinWall('wall', 5);
      const body = makeThinBody('body', 4.95, 1); // slow, overlapping wall
      body.prevPosition = new Vector3(4.93, 0, 0);
      world.addEntity(wall);
      world.addEntity(body);

      world.step(1 / 60);

      // Slow body should be pushed out of the wall.
      assert.ok(body.position.x < 4.9,
        `slow overlapping body should be pushed out: x=${body.position.x.toFixed(3)} < 4.9`);
    });

    it('CCD swept AABB works in z direction too', () => {
      // Test tunneling in z direction (wall oriented along x axis).
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ ...ccdConfig });
      world.addSystem(collision);

      // Wall along x axis, thin in z direction.
      const wall = new GameObject({
        id: 'wall', name: 'wall', type: 'static',
        position: { x: 0, y: 0, z: 5 },
        halfExtents: { x: 5, y: 2, z: 0.1 },
        mass: 0, material: 'stone',
      });
      // Body thin in z, moving fast in z.
      const body = new GameObject({
        id: 'body', name: 'body', type: 'dynamic',
        position: { x: 0, y: 0, z: 5.3 },
        halfExtents: { x: 0.5, y: 0.5, z: 0.1 },
        mass: 1, material: 'default',
      });
      body.velocity = new Vector3(0, 0, 36);
      body.prevPosition = new Vector3(0, 0, 4.7);
      world.addEntity(wall);
      world.addEntity(body);

      world.step(1 / 60);

      // With CCD, body should be pushed back to z < 4.9.
      assert.ok(body.position.z < 4.9,
        `CCD should detect z-direction tunneling: z=${body.position.z.toFixed(3)} < 4.9`);
    });
  });

  describe('CCD configuration', () => {
    it('ccdSpeedThreshold controls which bodies use swept AABB', () => {
      // Body moving at 3 m/s with threshold 5 m/s should NOT use swept AABB.
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ enableCCD: true, ccdSpeedThreshold: 5.0, collidableTypes: ['dynamic', 'static'] });
      world.addSystem(collision);

      const wall = makeThinWall('wall', 5);
      const body = makeThinBody('body', 5.3, 3); // 3 m/s < threshold 5
      body.prevPosition = new Vector3(4.7, 0, 0);
      world.addEntity(wall);
      world.addEntity(body);

      world.step(1 / 60);

      // Below threshold, body should tunnel through (no swept AABB).
      assert.ok(Math.abs(body.position.x - 5.3) < 0.01,
        `body below speed threshold should tunnel: x=${body.position.x.toFixed(3)} ≈ 5.3`);
    });

    it('CCD disabled by default (backward compatibility)', () => {
      const collision = new CollisionSystem();
      assert.equal(collision['config'].enableCCD, false, 'CCD should be disabled by default');
      assert.equal(collision['config'].ccdSpeedThreshold, 5.0, 'default threshold should be 5.0');
    });
  });

  describe('CCD with multiple bodies', () => {
    it('CCD detects collision between two fast-moving bodies', () => {
      // Two thin bodies moving toward each other, both tunnel past each other.
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ ...ccdConfig });
      world.addSystem(collision);

      // Body A: started at x=4.5, now at x=5.5 (moved right through center)
      const bodyA = makeThinBody('a', 5.5, 36);
      bodyA.prevPosition = new Vector3(4.5, 0, 0);
      // Body B: started at x=5.5, now at x=4.5 (moved left through center)
      const bodyB = makeThinBody('b', 4.5, -36);
      bodyB.prevPosition = new Vector3(5.5, 0, 0);

      world.addEntity(bodyA);
      world.addEntity(bodyB);

      // Verify no overlap at current positions (discrete would miss).
      assert.ok(bodyA.position.x - bodyA.halfExtents.x > bodyB.position.x + bodyB.halfExtents.x,
        'bodies should not overlap at current positions');

      world.step(1 / 60);

      // With CCD, swept AABBs should detect the collision and separate them.
      assert.ok(bodyA.position.x !== 5.5 || bodyB.position.x !== 4.5,
        'CCD should modify at least one body position');
    });
  });
});
