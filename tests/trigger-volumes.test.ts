// Unit tests for trigger volumes (overlap without physical response).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/engine/World.js';
import { CollisionSystem } from '../src/physics/CollisionSystem.js';
import { GameObject } from '../src/entity/Entity.js';
import { Vector3 } from '../src/entity/Vector3.js';
import {
  TriggerEnterEvent,
  TriggerStayEvent,
  TriggerExitEvent,
} from '../src/event/Event.js';

function makeBody(id: string, x: number, z: number, isTrigger = false): GameObject {
  const body = new GameObject({
    id, name: id, type: isTrigger ? 'trigger' : 'dynamic',
    position: { x, y: 0, z },
    halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
    mass: isTrigger ? 0 : 1, material: isTrigger ? 'trigger' : 'flesh',
  });
  if (isTrigger) {
    body.state.set('isTrigger', true);
  }
  return body;
}

describe('Trigger volumes', () => {
  describe('TriggerEnterEvent', () => {
    it('emits TriggerEnterEvent when entity first overlaps trigger', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      const enterEvents: TriggerEnterEvent[] = [];
      world.events.on('physics.trigger.enter', (e: TriggerEnterEvent) => {
        enterEvents.push(e);
      });

      world.step(1 / 60);

      assert.equal(enterEvents.length, 1, 'should emit one enter event');
      assert.ok(enterEvents[0] instanceof TriggerEnterEvent);
      assert.equal(enterEvents[0].payload.triggerId, 'trigger1');
      assert.equal(enterEvents[0].payload.otherId, 'entity1');
      assert.ok(enterEvents[0].payload.point);
    });

    it('does not emit TriggerEnterEvent on subsequent ticks (only first overlap)', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      let enterCount = 0;
      world.events.on('physics.trigger.enter', () => { enterCount++; });

      world.step(1 / 60); // enter
      world.step(1 / 60); // stay
      world.step(1 / 60); // stay

      assert.equal(enterCount, 1, 'enter should fire only once per overlap');
    });

    it('trigger does not cause physical separation (entity stays inside)', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.3, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      const initialX = entity.position.x;
      world.step(1 / 60);
      world.step(1 / 60);

      // Entity should NOT be pushed out of the trigger.
      assert.ok(Math.abs(entity.position.x - initialX) < 0.1,
        `entity should stay inside trigger, x moved from ${initialX} to ${entity.position.x}`);
    });
  });

  describe('TriggerStayEvent', () => {
    it('emits TriggerStayEvent on subsequent ticks of continuous overlap', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      const stayEvents: TriggerStayEvent[] = [];
      world.events.on('physics.trigger.stay', (e: TriggerStayEvent) => {
        stayEvents.push(e);
      });

      world.step(1 / 60); // enter (no stay)
      assert.equal(stayEvents.length, 0, 'no stay on first overlap');

      world.step(1 / 60); // stay
      assert.equal(stayEvents.length, 1, 'stay on second tick');
      assert.equal(stayEvents[0].payload.contactDurationTicks, 2);

      world.step(1 / 60); // stay
      assert.equal(stayEvents.length, 2, 'stay on third tick');
      assert.equal(stayEvents[1].payload.contactDurationTicks, 3);
    });
  });

  describe('TriggerExitEvent', () => {
    it('emits TriggerExitEvent when entity leaves trigger', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      const exitEvents: TriggerExitEvent[] = [];
      world.events.on('physics.trigger.exit', (e: TriggerExitEvent) => {
        exitEvents.push(e);
      });

      world.step(1 / 60); // enter
      assert.equal(exitEvents.length, 0, 'no exit on first overlap');

      // Move entity far away.
      entity.position = new Vector3(100, 0, 0);
      world.step(1 / 60); // exit

      assert.equal(exitEvents.length, 1, 'should emit exit on separation');
      assert.ok(exitEvents[0] instanceof TriggerExitEvent);
      assert.equal(exitEvents[0].payload.triggerId, 'trigger1');
      assert.equal(exitEvents[0].payload.otherId, 'entity1');
      assert.equal(exitEvents[0].payload.contactDurationTicks, 1);
    });

    it('does not emit TriggerExitEvent if entity never overlapped trigger', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 100, 0); // Far away, never overlaps
      world.addEntity(trigger);
      world.addEntity(entity);

      let exitCount = 0;
      world.events.on('physics.trigger.exit', () => { exitCount++; });

      world.step(1 / 60);
      world.step(1 / 60);
      world.step(1 / 60);

      assert.equal(exitCount, 0, 'no exit if never overlapped');
    });

    it('exit event reports correct contact duration', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      let exitDuration = 0;
      world.events.on('physics.trigger.exit', (e: TriggerExitEvent) => {
        exitDuration = e.payload.contactDurationTicks;
      });

      world.step(1 / 60); // tick 1: enter
      world.step(1 / 60); // tick 2: stay
      world.step(1 / 60); // tick 3: stay
      world.step(1 / 60); // tick 4: stay

      entity.position = new Vector3(100, 0, 0);
      world.step(1 / 60); // tick 5: exit

      assert.equal(exitDuration, 4, 'contact duration should be 4 ticks');
    });
  });

  describe('Multiple triggers and entities', () => {
    it('tracks trigger lifecycle independently for each pair', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger1 = makeBody('trigger1', 0, 0, true);
      const trigger2 = makeBody('trigger2', 10, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger1);
      world.addEntity(trigger2);
      world.addEntity(entity);

      let enterCount = 0;
      let exitCount = 0;
      world.events.on('physics.trigger.enter', () => { enterCount++; });
      world.events.on('physics.trigger.exit', () => { exitCount++; });

      world.step(1 / 60); // entity enters trigger1 only
      assert.equal(enterCount, 1, 'entity enters trigger1 only');

      // Move entity to trigger2.
      entity.position = new Vector3(10.5, 0, 0);
      world.step(1 / 60); // exit trigger1, enter trigger2

      assert.equal(exitCount, 1, 'entity exits trigger1');
      assert.equal(enterCount, 2, 'entity enters trigger2');
    });

    it('two triggers overlapping each other emits events', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger1 = makeBody('trigger1', 0, 0, true);
      const trigger2 = makeBody('trigger2', 0.5, 0, true);
      world.addEntity(trigger1);
      world.addEntity(trigger2);

      let enterCount = 0;
      world.events.on('physics.trigger.enter', () => { enterCount++; });

      world.step(1 / 60);

      assert.equal(enterCount, 1, 'two overlapping triggers should emit enter event');
    });
  });

  describe('Configuration', () => {
    it('disable triggers with enableTriggers:false', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0, enableTriggers: false });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      let enterCount = 0;
      world.events.on('physics.trigger.enter', () => { enterCount++; });

      world.step(1 / 60);

      assert.equal(enterCount, 0, 'no trigger events when enableTriggers is false');
    });
  });

  describe('Trigger vs physical collision', () => {
    it('trigger does not emit physical collision events', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity = makeBody('entity1', 0.5, 0);
      world.addEntity(trigger);
      world.addEntity(entity);

      let collisionEnterCount = 0;
      world.events.on('physics.collision.enter', () => { collisionEnterCount++; });

      world.step(1 / 60);

      assert.equal(collisionEnterCount, 0, 'trigger overlap should not emit physical collision enter');
    });

    it('entity can physically collide with non-trigger while overlapping trigger', () => {
      const world = new World({ tickRate: 60 });
      const collision = new CollisionSystem({ restitution: 0 });
      world.addSystem(collision);

      const trigger = makeBody('trigger1', 0, 0, true);
      const entity1 = makeBody('entity1', 0.3, 0);
      const entity2 = makeBody('entity2', 0.6, 0);
      world.addEntity(trigger);
      world.addEntity(entity1);
      world.addEntity(entity2);

      let triggerEnterCount = 0;
      let collisionEnterCount = 0;
      world.events.on('physics.trigger.enter', () => { triggerEnterCount++; });
      world.events.on('physics.collision.enter', () => { collisionEnterCount++; });

      world.step(1 / 60);

      // entity1 and entity2 both overlap trigger (2 trigger enters).
      // entity1 and entity2 physically collide with each other (1 collision enter).
      assert.equal(triggerEnterCount, 2, 'both entities enter trigger');
      assert.equal(collisionEnterCount, 1, 'entities physically collide with each other');
    });
  });
});
