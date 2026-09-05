import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createListener } from '../../src/sdk/WorldEventListener.js';
import type { WorldEvent } from '../../src/types/index.js';

function sampleEvent(type = 'tick'): WorldEvent {
  return {
    id: 'e1',
    type,
    name: type,
    severity: 'info',
    position: { x: 0, y: 0, z: 0 },
    radius: 0,
    status: 'active',
    createdAt: Date.now(),
    data: {},
  };
}

test('on / emit delivers events', async () => {
  const hub = createListener();
  let received = 0;
  hub.on('tick', () => received++);
  await hub.emit('tick', sampleEvent());
  assert.equal(received, 1);
});

test('off removes a handler', async () => {
  const hub = createListener();
  let received = 0;
  const handler = () => received++;
  hub.on('tick', handler);
  hub.off('tick', handler);
  await hub.emit('tick', sampleEvent());
  assert.equal(received, 0);
});

test('higher priority handlers run first', async () => {
  const hub = createListener();
  const order: string[] = [];
  hub.on('tick', () => order.push('low'), 1);
  hub.on('tick', () => order.push('high'), 10);
  await hub.emit('tick', sampleEvent());
  assert.deepEqual(order, ['high', 'low']);
});

test('async handlers are awaited', async () => {
  const hub = createListener();
  let done = false;
  hub.on('tick', async () => {
    await new Promise((r) => setTimeout(r, 5));
    done = true;
  });
  await hub.emit('tick', sampleEvent());
  assert.equal(done, true);
});

test('one throwing handler does not stop others', async () => {
  const hub = createListener();
  let secondRan = false;
  hub.on('tick', () => {
    throw new Error('boom');
  });
  hub.on('tick', () => {
    secondRan = true;
  });
  await hub.emit('tick', sampleEvent());
  assert.equal(secondRan, true);
});

test('once fires only once', async () => {
  const hub = createListener();
  let count = 0;
  hub.once('tick', () => count++);
  await hub.emit('tick', sampleEvent());
  await hub.emit('tick', sampleEvent());
  assert.equal(count, 1);
});

test('removeAll clears listeners', async () => {
  const hub = createListener();
  let count = 0;
  hub.on('tick', () => count++);
  hub.removeAll();
  await hub.emit('tick', sampleEvent());
  assert.equal(count, 0);
});
