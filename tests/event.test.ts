import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventSystem } from '../src/event/EventSystem.js';
import { WorldTickEvent } from '../src/event/Event.js';
test('on and emit', () => {
  const es = new EventSystem();
  let c = 0;
  es.on('t', () => { c++; });
  es.emit({ type: 't', timestamp: 0, payload: {} });
  assert.equal(c, 1);
});
test('once fires once', () => {
  const es = new EventSystem();
  let c = 0;
  es.once('t', () => { c++; });
  es.emit({ type: 't', timestamp: 0, payload: {} });
  es.emit({ type: 't', timestamp: 0, payload: {} });
  assert.equal(c, 1);
});
test('off removes listener', () => {
  const es = new EventSystem();
  let c = 0;
  const fn = () => { c++; };
  es.on('t', fn);
  es.off('t', fn);
  es.emit({ type: 't', timestamp: 0, payload: {} });
  assert.equal(c, 0);
});
test('WorldTickEvent', () => {
  const e = new WorldTickEvent(5, 0.5);
  assert.equal(e.type, 'world.tick');
  assert.equal(e.payload.tick, 5);
});
