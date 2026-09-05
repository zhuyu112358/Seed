// Unit tests for EventSystem / Event (src/event/*).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import {
  Event,
  CollisionEvent,
  EntityEnterZone,
  WorldTickEvent,
  WeatherEvent,
} from '../src/event/Event.js';

describe('EventSystem subscription', () => {
  it('on() delivers events and returns an unsubscribe function', () => {
    const bus = new EventSystem();
    const seen: number[] = [];
    const unsub = bus.on('test.e', (e) => seen.push((e.payload as { n: number }).n));
    assert.equal(bus.listenerCount('test.e'), 1);
    bus.emit(new Event({ type: 'test.e', payload: { n: 1 } }));
    assert.deepEqual(seen, [1]);
    unsub();
    assert.equal(bus.listenerCount('test.e'), 0);
  });

  it('off() removes a named handler', () => {
    const bus = new EventSystem();
    const h = () => undefined;
    bus.on('test.e', h);
    bus.off('test.e', h);
    assert.equal(bus.listenerCount('test.e'), 0);
  });

  it('once() fires exactly one time', () => {
    const bus = new EventSystem();
    let calls = 0;
    bus.once('test.e', () => calls++);
    bus.emit(new Event({ type: 'test.e', payload: {} }));
    bus.emit(new Event({ type: 'test.e', payload: {} }));
    assert.equal(calls, 1);
    assert.equal(bus.listenerCount('test.e'), 0);
  });

  it('clear() removes every subscription', () => {
    const bus = new EventSystem();
    bus.on('a', () => undefined);
    bus.on('b', () => undefined);
    bus.clear();
    assert.equal(bus.listenerCount('a'), 0);
    assert.equal(bus.listenerCount('b'), 0);
  });
});

describe('EventSystem priority and cancellation', () => {
  it('runs higher priority handlers first', () => {
    const bus = new EventSystem();
    const order: string[] = [];
    bus.on('e', () => order.push('low'), 0);
    bus.on('e', () => order.push('high'), 10);
    bus.on('e', () => order.push('mid'), 5);
    bus.emit(new Event({ type: 'e', payload: {} }));
    assert.deepEqual(order, ['high', 'mid', 'low']);
  });

  it('cancelling an event stops propagation to lower priority handlers', () => {
    const bus = new EventSystem();
    const order: string[] = [];
    bus.on('e', (evt) => {
      order.push('high');
      evt.cancel();
    }, 10);
    bus.on('e', () => order.push('mid'), 5);
    bus.on('e', () => order.push('low'), 0);
    bus.emit(new Event({ type: 'e', payload: {} }));
    assert.deepEqual(order, ['high']);
  });
});

describe('Event envelope and concrete events', () => {
  it('carries type, payload, sourceId and propagation defaults', () => {
    const e = new Event({ type: 'x', payload: { a: 1 }, sourceId: 's1' });
    assert.equal(e.type, 'x');
    assert.equal(e.sourceId, 's1');
    assert.equal(e.propagation.remainingRadius, Infinity);
    assert.equal(e.propagation.intensity, 1);
    assert.equal(e.isCancelled(), false);
    e.cancel();
    assert.equal(e.isCancelled(), true);
  });

  it('exposes concrete event types', () => {
    assert.equal(new CollisionEvent('a', 'b', { x: 0, y: 0, z: 0 }, 1).type, 'physics.collision');
    assert.equal(new EntityEnterZone('z', 'e', { x: 0, y: 0, z: 0 }).type, 'zone.enter');
    assert.equal(new WorldTickEvent(1, 0.016).type, 'world.tick');
    assert.equal(new WeatherEvent('rain', 0.5).type, 'world.weather');
  });
});
