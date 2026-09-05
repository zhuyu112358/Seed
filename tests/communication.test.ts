import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AcousticPropagation } from '../src/communication/AcousticPropagation.js';
import { Message } from '../src/communication/Message.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';

test('AcousticPropagation intensity decays with distance', () => {
  const ac = new AcousticPropagation({ attenuation: 0.02, absorption: 0.01, maxRadius: 50, minAudible: 0.05 });
  const near = ac.intensityAt(1, 1);
  const far = ac.intensityAt(1, 20);
  assert.ok(near > far, `near (${near}) should be louder than far (${far})`);
  assert.equal(ac.intensityAt(1, 1000), 0, 'beyond maxRadius -> 0');
});

test('AcousticPropagation transmit reaches nearby listeners', () => {
  const ac = new AcousticPropagation({ maxRadius: 30, attenuation: 0.01, absorption: 0, minAudible: 0.05 });
  const src = EntityFactory.soulProxy({ soulId: 'a', name: 'A', element: 'wind', position: { x: 0, y: 0, z: 0 } });
  const near = EntityFactory.soulProxy({ soulId: 'b', name: 'B', element: 'fire', position: { x: 2, y: 0, z: 0 } });
  const far = EntityFactory.soulProxy({ soulId: 'c', name: 'C', element: 'water', position: { x: 100, y: 0, z: 0 } });
  const world = {
    entities: [src, near, far],
    byId: (id: string) => [src, near, far].find((e) => e.id === id),
  };
  const msg = new Message({ content: 'hi', sourceId: src.id, position: { x: 0, y: 0, z: 0 }, medium: 'acoustic' });
  const received = ac.transmit(msg, src, world);
  assert.equal(received.length, 1);
  assert.equal(received[0].original.sourceId, src.id);
  assert.ok(received[0].distance < 5);
});
