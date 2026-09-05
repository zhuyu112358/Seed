import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import { Event, CollisionEvent, WorldTickEvent } from '../src/event/Event.js';

test('on receives emitted events and listenerCount tracks subscriptions', () => {
  const bus = new EventSystem();
  const seen: number[] = [];
  bus.on('ping', () => seen.push(1));
  bus.on('ping', () => seen.push(2));
  assert.equal(bus.listenerCount('ping'), 2);
  bus.emit(new Event({ type: 'ping', payload: {} }));
  assert.equal(seen.length, 2);
});

test('once fires only a single time', () => {
  const bus = new EventSystem();
  let count = 0;
  bus.once('solo', () => count++);
  bus.emit(new Event({ type: 'solo', payload: {} }));
  bus.emit(new Event({ type: 'solo', payload: {} }));
  assert.equal(count, 1);
  assert.equal(bus.listenerCount('solo'), 0);
});

test('off removes a specific handler and unsubscribe function works', () => {
  const bus = new EventSystem();
  let hits = 0;
  const h = () => hits++;
  const off = bus.on('x', h);
  off();
  assert.equal(bus.listenerCount('x'), 0);

  const h2 = () => hits++;
  bus.on('x', h2);
  bus.off('x', h2);
  bus.emit(new Event({ type: 'x', payload: {} }));
  assert.equal(hits, 0);
});

test('priority order and concrete event envelopes carry payload', () => {
  const bus = new EventSystem();
  const order: string[] = [];
  bus.on('e', () => order.push('low'), 0);
  bus.on('e', () => order.push('high'), 10);
  bus.emit(new Event({ type: 'e', payload: {} }));
  assert.deepEqual(order, ['high', 'low']);

  const col = new CollisionEvent('a', 'b', { x: 0, y: 0, z: 0 }, 3);
  assert.equal(col.type, 'physics.collision');
  assert.equal(col.payload.a, 'a');
  const tick = new WorldTickEvent(3, 0.05);
  assert.equal(tick.payload.tick, 3);
});

test('clear removes all subscriptions', () => {
  const bus = new EventSystem();
  bus.on('a', () => {});
  bus.on('b', () => {});
  bus.clear();
  assert.equal(bus.listenerCount('a'), 0);
  assert.equal(bus.listenerCount('b'), 0);
});
