// Unit tests for collision lifecycle events (Enter/Stay/Exit).

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { GameObject } from '../src/entity/Entity.js';
import { Vector3 } from '../src/entity/Vector3.js';
import {
  CollisionEnterEvent,
  CollisionStayEvent,
  CollisionExitEvent,
  CollisionEvent,
} from '../src/event/Event.js';

function makeBody(id: string, x: number, z: number, vx = 0, vz = 0): GameObject {
  const body = new GameObject({
    id, name: id, type: 'dynamic',
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    mass: 1, material: 'flesh',
  });
  body.velocity = new Vector3(vx, 0, vz);
  return body;
}

function makeWorld(): { world: World } {
  const world = new World({ tickRate: 60 });
  return { world };
}

describe('Collision lifecycle events (Enter/Stay/Exit)', () => {
  describe('CollisionEnterEvent', () => {
    it('emits CollisionEnterEvent when two bodies first touch', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0); // Overlapping (halfExtents 0.5 each)
      world.addEntity(a);
      world.addEntity(b);

      const enterEvents: CollisionEnterEvent[] = [];
      world.events.on('physics.collision.enter', (e: CollisionEnterEvent) => {
        enterEvents.push(e);
      });

      world.step(1 / 60);

      assert.equal(enterEvents.length, 1, 'should emit exactly one enter event');
      assert.ok(enterEvents[0] instanceof CollisionEnterEvent);
      assert.equal(enterEvents[0].payload.a, 'a');
      assert.equal(enterEvents[0].payload.b, 'b');
      assert.ok(enterEvents[0].payload.point);
      assert.ok(enterEvents[0].payload.normal);
      assert.ok(enterEvents[0].payload.penetration > 0);
    });

    it('does not emit CollisionEnterEvent on subsequent ticks (only first contact)', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0);
      world.addEntity(a);
      world.addEntity(b);

      let enterCount = 0;
      world.events.on('physics.collision.enter', () => { enterCount++; });

      world.step(1 / 60); // First tick: enter
      world.step(1 / 60); // Second tick: still colliding, no enter
      world.step(1 / 60); // Third tick: still colliding, no enter

      assert.equal(enterCount, 1, 'enter should fire only once per contact');
    });

    it('emits CollisionEnterEvent again after bodies separate and re-collide', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0);
      world.addEntity(a);
      world.addEntity(b);

      let enterCount = 0;
      world.events.on('physics.collision.enter', () => { enterCount++; });

      world.step(1 / 60); // First contact: enter #1
      assert.equal(enterCount, 1);

      // Move b far away to separate.
      b.position = new Vector3(100, 0, 0);
      world.step(1 / 60); // Exit
      assert.equal(enterCount, 1, 'no enter on separation');

      // Move b back to collide again.
      b.position = new Vector3(0.5, 0, 0);
      world.step(1 / 60); // Re-contact: enter #2
      assert.equal(enterCount, 2, 'should emit enter again after re-collision');
    });
  });

  describe('CollisionStayEvent', () => {
    it('emits CollisionStayEvent on subsequent ticks of continuous contact', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0);
      world.addEntity(a);
      world.addEntity(b);

      const stayEvents: CollisionStayEvent[] = [];
      world.events.on('physics.collision.stay', (e: CollisionStayEvent) => {
        stayEvents.push(e);
      });

      world.step(1 / 60); // Tick 1: enter (no stay)
      assert.equal(stayEvents.length, 0, 'no stay on first contact');

      world.step(1 / 60); // Tick 2: stay
      assert.equal(stayEvents.length, 1, 'stay on second tick');
      assert.equal(stayEvents[0].payload.contactDurationTicks, 2);

      world.step(1 / 60); // Tick 3: stay
      assert.equal(stayEvents.length, 2, 'stay on third tick');
      assert.equal(stayEvents[1].payload.contactDurationTicks, 3);
    });

    it('stay event includes collision normal and penetration', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0); // Overlap on x axis
      world.addEntity(a);
      world.addEntity(b);

      let stayEvent: CollisionStayEvent | null = null;
      world.events.on('physics.collision.stay', (e: CollisionStayEvent) => {
        stayEvent = e;
      });

      world.step(1 / 60); // enter
      world.step(1 / 60); // stay

      assert.ok(stayEvent, 'stay event should be emitted');
      assert.ok(stayEvent!.payload.normal.x !== 0 || stayEvent!.payload.normal.z !== 0);
      assert.ok(stayEvent!.payload.penetration >= 0);
    });
  });

  describe('CollisionExitEvent', () => {
    it('emits CollisionExitEvent when bodies separate', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0);
      world.addEntity(a);
      world.addEntity(b);

      const exitEvents: CollisionExitEvent[] = [];
      world.events.on('physics.collision.exit', (e: CollisionExitEvent) => {
        exitEvents.push(e);
      });

      world.step(1 / 60); // enter
      assert.equal(exitEvents.length, 0, 'no exit on first contact');

      // Move b far away.
      b.position = new Vector3(100, 0, 0);
      world.step(1 / 60); // exit

      assert.equal(exitEvents.length, 1, 'should emit exit on separation');
      assert.ok(exitEvents[0] instanceof CollisionExitEvent);
      assert.equal(exitEvents[0].payload.a, 'a');
      assert.equal(exitEvents[0].payload.b, 'b');
      assert.equal(exitEvents[0].payload.contactDurationTicks, 1);
      assert.ok(exitEvents[0].payload.lastContactPoint);
    });

    it('does not emit CollisionExitEvent if bodies never collided', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 100, 0); // Far apart, never collide
      world.addEntity(a);
      world.addEntity(b);

      let exitCount = 0;
      world.events.on('physics.collision.exit', () => { exitCount++; });

      world.step(1 / 60);
      world.step(1 / 60);
      world.step(1 / 60);

      assert.equal(exitCount, 0, 'no exit if never collided');
    });

    it('exit event reports correct contact duration', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0);
      world.addEntity(a);
      world.addEntity(b);

      let exitDuration = 0;
      world.events.on('physics.collision.exit', (e: CollisionExitEvent) => {
        exitDuration = e.payload.contactDurationTicks;
      });

      world.step(1 / 60); // tick 1: enter
      world.step(1 / 60); // tick 2: stay
      world.step(1 / 60); // tick 3: stay
      world.step(1 / 60); // tick 4: stay

      b.position = new Vector3(100, 0, 0);
      world.step(1 / 60); // tick 5: exit

      assert.equal(exitDuration, 4, 'contact duration should be 4 ticks');
    });
  });

  describe('Backward compatibility', () => {
    it('still emits generic CollisionEvent for backward compatibility', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0);
      world.addEntity(a);
      world.addEntity(b);

      const genericEvents: CollisionEvent[] = [];
      world.events.on('physics.collision', (e: CollisionEvent) => {
        genericEvents.push(e);
      });

      world.step(1 / 60); // enter + generic
      world.step(1 / 60); // stay + generic

      assert.ok(genericEvents.length >= 2, 'generic collision event should still fire every tick');
      assert.ok(genericEvents[0] instanceof CollisionEvent);
    });
  });

  describe('Multiple collision pairs', () => {
    it('tracks lifecycle independently for each pair', () => {
      const { world } = makeWorld();
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const a = makeBody('a', 0, 0);
      const b = makeBody('b', 0.5, 0); // collides with a
      const c = makeBody('c', 0, 5); // far from both, no collision initially
      world.addEntity(a);
      world.addEntity(b);
      world.addEntity(c);

      let enterCount = 0;
      let exitCount = 0;
      world.events.on('physics.collision.enter', () => { enterCount++; });
      world.events.on('physics.collision.exit', () => { exitCount++; });

      world.step(1 / 60); // a-b enter only
      assert.equal(enterCount, 1, 'only a-b enters on tick 1');

      // Move c to collide with a only (opposite side from b).
      c.position = new Vector3(-0.5, 0, 0); // collides with a (at 0,0), not b (at ~0.7,0 after correction)
      world.step(1 / 60); // a-c enter, a-b stay

      assert.equal(enterCount, 2, 'a-c enters on tick 2');
      assert.equal(exitCount, 0, 'no exits yet');

      // Move c away (x axis, since y doesn't affect top-down collision).
      c.position = new Vector3(100, 0, 0);
      world.step(1 / 60); // a-c exit, a-b stay

      assert.equal(exitCount, 1, 'a-c exits');
      assert.equal(enterCount, 2, 'no new enters');
    });
  });
});




