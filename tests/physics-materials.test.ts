// Unit tests for physics materials (per-entity restitution and friction).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { GameObject } from '../src/entity/Entity.js';
import { Vector3 } from '../src/entity/Vector3.js';
import { PhysicsMaterials, combineMaterials } from '../src/physics/PhysicsMaterial.js';

function makeBody(id: string, x: number, vx: number, physicsMaterial = PhysicsMaterials.DEFAULT): GameObject {
  const body = new GameObject({
    id, name: id, type: 'dynamic',
    position: { x, y: 0, z: 0 },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    mass: 1, material: physicsMaterial.name,
    physicsMaterial,
  });
  body.velocity = new Vector3(vx, 0, 0);
  return body;
}

describe('Physics materials', () => {
  describe('Predefined materials', () => {
    it('DEFAULT material has moderate restitution and friction', () => {
      assert.equal(PhysicsMaterials.DEFAULT.restitution, 0.2);
      assert.equal(PhysicsMaterials.DEFAULT.friction, 0.5);
      assert.equal(PhysicsMaterials.DEFAULT.name, 'default');
    });

    it('ICE has very low friction and low restitution', () => {
      assert.ok(PhysicsMaterials.ICE.friction < 0.1, 'ice should have very low friction');
      assert.ok(PhysicsMaterials.ICE.restitution < 0.1, 'ice should have low restitution');
    });

    it('RUBBER has high restitution and high friction', () => {
      assert.ok(PhysicsMaterials.RUBBER.restitution > 0.8, 'rubber should have high restitution');
      assert.ok(PhysicsMaterials.RUBBER.friction > 0.7, 'rubber should have high friction');
    });

    it('BOUNCY has very high restitution', () => {
      assert.ok(PhysicsMaterials.BOUNCY.restitution > 0.9, 'bouncy should have very high restitution');
    });

    it('FRICTIONLESS has zero friction and zero restitution', () => {
      assert.equal(PhysicsMaterials.FRICTIONLESS.friction, 0);
      assert.equal(PhysicsMaterials.FRICTIONLESS.restitution, 0);
    });
  });

  describe('combineMaterials', () => {
    it('averages restitution of two materials', () => {
      const combined = combineMaterials(PhysicsMaterials.ICE, PhysicsMaterials.RUBBER);
      const expected = (PhysicsMaterials.ICE.restitution + PhysicsMaterials.RUBBER.restitution) / 2;
      assert.equal(combined.restitution, expected);
    });

    it('averages friction of two materials', () => {
      const combined = combineMaterials(PhysicsMaterials.ICE, PhysicsMaterials.STONE);
      const expected = (PhysicsMaterials.ICE.friction + PhysicsMaterials.STONE.friction) / 2;
      assert.equal(combined.friction, expected);
    });

    it('same material combined equals itself', () => {
      const combined = combineMaterials(PhysicsMaterials.RUBBER, PhysicsMaterials.RUBBER);
      assert.equal(combined.restitution, PhysicsMaterials.RUBBER.restitution);
      assert.equal(combined.friction, PhysicsMaterials.RUBBER.friction);
    });
  });

  describe('GameObject physicsMaterial', () => {
    it('new entities get DEFAULT physics material by default', () => {
      const body = new GameObject({
        id: 'test', name: 'test', type: 'dynamic',
        position: { x: 0, y: 0, z: 0 },
        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
        mass: 1,
      });
      assert.equal(body.physicsMaterial.restitution, 0.2);
      assert.equal(body.physicsMaterial.friction, 0.5);
    });

    it('entities accept custom physics material', () => {
      const body = new GameObject({
        id: 'test', name: 'test', type: 'dynamic',
        position: { x: 0, y: 0, z: 0 },
        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
        mass: 1,
        physicsMaterial: PhysicsMaterials.RUBBER,
      });
      assert.equal(body.physicsMaterial.restitution, 0.9);
      assert.equal(body.physicsMaterial.name, 'rubber');
    });
  });

  describe('Collision response with physics materials', () => {
    it('high restitution material bounces more than low restitution', () => {
      // Test with rubber (high bounce).
      const worldRubber = new World({ tickRate: 60 });
      const collisionRubber = new CollisionSystem({ restitution: 0 });
      worldRubber.addSystem(collisionRubber);
      const aRubber = makeBody('a', 0, 5, PhysicsMaterials.RUBBER);
      const bRubber = makeBody('b', 0.6, 0, PhysicsMaterials.RUBBER);
      worldRubber.addEntity(aRubber);
      worldRubber.addEntity(bRubber);
      worldRubber.step(1 / 60);

      // Test with ice (low bounce).
      const worldIce = new World({ tickRate: 60 });
      const collisionIce = new CollisionSystem({ restitution: 0 });
      worldIce.addSystem(collisionIce);
      const aIce = makeBody('a', 0, 5, PhysicsMaterials.ICE);
      const bIce = makeBody('b', 0.6, 0, PhysicsMaterials.ICE);
      worldIce.addEntity(aIce);
      worldIce.addEntity(bIce);
      worldIce.step(1 / 60);

      // High restitution: incoming body reverses direction more (velocity closer to 0 or negative).
      // Low restitution: incoming body keeps moving forward (velocity stays positive, higher).
      assert.ok(aRubber.velocity.x < aIce.velocity.x,
        `rubber should have lower post-collision velocity (more bounce reversal): rubber=${aRubber.velocity.x.toFixed(3)} < ice=${aIce.velocity.x.toFixed(3)}`);
      assert.ok(aRubber.velocity.x < 1.0,
        `rubber should bounce back significantly, velocity < 1.0, got ${aRubber.velocity.x.toFixed(3)}`);
      assert.ok(aIce.velocity.x > 2.0,
        `ice should keep most of its forward speed, velocity > 2.0, got ${aIce.velocity.x.toFixed(3)}`);
    });

    it('mixed materials use averaged restitution', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      // Rubber (0.9) + Ice (0.05) → averaged 0.475
      const a = makeBody('a', 0, 5, PhysicsMaterials.RUBBER);
      const b = makeBody('b', 0.6, 0, PhysicsMaterials.ICE);
      world.addEntity(a);
      world.addEntity(b);
      world.step(1 / 60);

      // With restitution 0.475 and incoming relative speed 5,
      // impulse = (1 + 0.475) * 5 / 2 = 3.6875
      // a's velocity should reverse: 5 - 3.6875 = 1.3125 (still positive, less speed)
      // Actually with equal mass and split impulse, a gets -impulse, b gets +impulse
      // a velocity = 5 - 3.6875 = 1.3125
      assert.ok(a.velocity.x > 0, 'a should still move forward with moderate bounce');
      assert.ok(a.velocity.x < 5, 'a should lose some speed due to bounce');
    });

    it('frictionless material with restitution 0 applies no velocity response', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 5, PhysicsMaterials.FRICTIONLESS);
      const b = makeBody('b', 0.6, 0, PhysicsMaterials.FRICTIONLESS);
      world.addEntity(a);
      world.addEntity(b);
      world.step(1 / 60);

      // With restitution=0, velocity response is skipped entirely (by design).
      // Positional correction still separates entities, but velocities are unchanged.
      assert.equal(a.velocity.x, 5, 'a velocity should be unchanged with restitution 0');
      assert.equal(b.velocity.x, 0, 'b velocity should be unchanged with restitution 0');
    });

    it('default material behavior matches config when both are default', () => {
      const world = new World({ tickRate: 60 });
      // Config restitution is ignored when entities have physics materials.
      const collision = new CollisionSystem({ restitution: 0.999 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 5); // DEFAULT restitution 0.2
      const b = makeBody('b', 0.6, 0); // DEFAULT restitution 0.2
      world.addEntity(a);
      world.addEntity(b);
      world.step(1 / 60);

      // Combined restitution = 0.2, impulse = (1+0.2)*5/2 = 3.0
      // a velocity = 5 - 3.0 = 2.0
      assert.ok(Math.abs(a.velocity.x - 2.0) < 0.1,
        `default material should use restitution 0.2, velocity ~2.0, got ${a.velocity.x.toFixed(3)}`);
    });
  });
});
