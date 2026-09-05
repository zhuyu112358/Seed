// Unit tests for src/event/EventSystem.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import { Event } from '../src/event/Event.js';

function makeEvent(type: string, payload: Record<string, unknown> = {}) {
  return new Event({ type, payload });
}

describe('EventSystem', () => {
  it('on subscribes and emit dispatches to handlers', () => {
    const bus = new EventSystem();
    let seen = 0;
    bus.on('ping', () => seen++);
    bus.emit(makeEvent('ping'));
    bus.emit(makeEvent('ping'));
    assert.equal(seen, 2);
  });

  it('once runs the handler exactly once', () => {
    const bus = new EventSystem();
    let n = 0;
    bus.once('ping', () => n++);
    bus.emit(makeEvent('ping'));
    bus.emit(makeEvent('ping'));
    assert.equal(n, 1);
    assert.equal(bus.listenerCount('ping'), 0);
  });

  it('off cancels a subscription', () => {
    const bus = new EventSystem();
    let n = 0;
    const handler = () => n++;
    bus.on('ping', handler);
    bus.off('ping', handler);
    bus.emit(makeEvent('ping'));
    assert.equal(n, 0);
  });

  it('on returns an unsubscribe function', () => {
    const bus = new EventSystem();
    let n = 0;
    const off = bus.on('ping', () => n++);
    off();
    bus.emit(makeEvent('ping'));
    assert.equal(n, 0);
  });

  it('handlers run in descending priority order', () => {
    const bus = new EventSystem();
    const order: string[] = [];
    bus.on('go', () => order.push('low'), 0);
    bus.on('go', () => order.push('high'), 10);
    bus.emit(makeEvent('go'));
    assert.deepEqual(order, ['high', 'low']);
  });

  it('cancelling an event stops later handlers', () => {
    const bus = new EventSystem();
    const order: string[] = [];
    bus.on('go', (e) => { order.push('first'); e.cancel(); }, 10);
    bus.on('go', () => order.push('second'), 0);
    bus.emit(makeEvent('go'));
    assert.deepEqual(order, ['first']);
  });

  it('listenerCount reflects active subscriptions', () => {
    const bus = new EventSystem();
    bus.on('a', () => {});
    bus.on('a', () => {});
    assert.equal(bus.listenerCount('a'), 2);
    assert.equal(bus.listenerCount('b'), 0);
  });

  it('clear removes every subscription', () => {
    const bus = new EventSystem();
    bus.on('a', () => {});
    bus.on('b', () => {});
    bus.clear();
    assert.equal(bus.listenerCount('a'), 0);
    assert.equal(bus.listenerCount('b'), 0);
  });

  it('a throwing async handler does not break the bus', () => {
    const bus = new EventSystem();
    let reached = false;
    bus.on('async', () => Promise.reject(new Error('boom')));
    bus.on('async', () => { reached = true; });
    bus.emit(makeEvent('async'));
    assert.equal(reached, true);
  });
});
