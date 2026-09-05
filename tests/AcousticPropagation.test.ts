import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AcousticPropagation } from '../src/communication/AcousticPropagation.js';
import { Message } from '../src/communication/Message.js';
import { GameObject } from '../src/entity/Entity.js';
import type { WorldView } from '../src/communication/CommunicationStrategy.js';

test('intensityAt decays with distance and is zero beyond maxRadius', () => {
  const ac = new AcousticPropagation({ attenuation: 0.02, absorption: 0.01, maxRadius: 50 });
  assert.equal(ac.intensityAt(1, 0), 1);
  assert.ok(ac.intensityAt(1, 5) < 1);
  assert.equal(ac.intensityAt(1, 100), 0);
});

test('transmit delivers only to active, in-range listeners', () => {
  const ac = new AcousticPropagation({ maxRadius: 50, minAudible: 0.05 });
  const source = new GameObject({ id: 'src', name: 'src', position: { x: 0, y: 0, z: 0 } });
  const near = new GameObject({ id: 'near', name: 'near', position: { x: 1, y: 0, z: 0 } });
  const far = new GameObject({ id: 'far', name: 'far', position: { x: 100, y: 0, z: 0 } });
  const asleep = new GameObject({ id: 'asleep', name: 'asleep', position: { x: 2, y: 0, z: 0 } });
  asleep.active = false;

  const world: WorldView = {
    entities: [source, near, far, asleep],
    byId: (id) => [source, near, far, asleep].find((e) => e.id === id),
  };
  const msg = new Message({
    content: 'hello', sourceId: 'src',
    position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1,
  });

  const received = ac.transmit(msg, source, world);
  assert.equal(received.length, 1);
  assert.equal(received[0].original.sourceId, 'src');
  assert.ok(received[0].receivedIntensity > 0.05);
  assert.equal(received[0].distance, 1);
});

test('a quiet message below minAudible is not delivered', () => {
  const ac = new AcousticPropagation({ maxRadius: 50, minAudible: 0.5 });
  const source = new GameObject({ id: 's', name: 's', position: { x: 0, y: 0, z: 0 } });
  const listener = new GameObject({ id: 'l', name: 'l', position: { x: 5, y: 0, z: 0 } });
  const world: WorldView = {
    entities: [source, listener],
    byId: (id) => (id === 'l' ? listener : source),
  };
  const msg = new Message({
    content: 'shh', sourceId: 's',
    position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 0.1,
  });
  const received = ac.transmit(msg, source, world);
  assert.equal(received.length, 0);
});
