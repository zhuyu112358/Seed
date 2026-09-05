import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import { Event } from '../src/event/Event.js';

test('EventSystem on/emit/off', () => {
  const bus = new EventSystem();
  let hits = 0;
  const off = bus.on('test.x', () => hits++);
  bus.emit(new Event({ type: 'test.x', payload: {} }));
  bus.emit(new Event({ type: 'test.x', payload: {} }));
  assert.equal(hits, 2);
  off();
  bus.emit(new Event({ type: 'test.x', payload: {} }));
  assert.equal(hits, 2);
});

test('EventSystem priority ordering', () => {
  const bus = new EventSystem();
  const order: string[] = [];
  bus.on('ev', () => order.push('low'), 0);
  bus.on('ev', () => order.push('high'), 10);
  bus.emit(new Event({ type: 'ev', payload: {} }));
  assert.deepEqual(order, ['high', 'low']);
});

test('Event cancellation stops downstream handlers', () => {
  const bus = new EventSystem();
  let downstream = false;
  bus.on('ev', (e) => e.cancel(), 10);
  bus.on('ev', () => { downstream = true; }, 0);
  bus.emit(new Event({ type: 'ev', payload: {} }));
  assert.equal(downstream, false);
});

test('EventSystem once fires only once', () => {
  const bus = new EventSystem();
  let hits = 0;
  bus.once('ev', () => hits++);
  bus.emit(new Event({ type: 'ev', payload: {} }));
  bus.emit(new Event({ type: 'ev', payload: {} }));
  assert.equal(hits, 1);
});
