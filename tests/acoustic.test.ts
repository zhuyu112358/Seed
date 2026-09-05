// Unit tests for AcousticPropagation / Message (src/communication/*).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Message } from '../src/communication/Message.js';
import { AcousticPropagation } from '../src/communication/AcousticPropagation.js';
import type { WorldView } from '../src/communication/CommunicationStrategy.js';
import { EntityFactory } from '../src/entity/EntityFactory.js';
import type { GameObject } from '../src/entity/Entity.js';

describe('Message', () => {
  it('auto-generates an id and applies defaults', () => {
    const m = new Message({ content: 'hello', sourceId: 's1', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic' });
    assert.ok(typeof m.id === 'string' && m.id.length > 0);
    assert.equal(m.intensity, 1);
    assert.equal(typeof m.timestamp, 'number');
  });

  it('honours explicit options', () => {
    const m = new Message({ id: 'fixed-1', content: 'hi', sourceId: 's1', position: { x: 1, y: 2, z: 3 }, medium: 'acoustic', intensity: 0.5, timestamp: 123 });
    assert.equal(m.id, 'fixed-1');
    assert.equal(m.intensity, 0.5);
  });
});

describe('AcousticPropagation.intensityAt', () => {
  it('returns the source intensity at distance zero', () => {
    const ac = new AcousticPropagation({ attenuation: 0.02, absorption: 0.01, maxRadius: 50 });
    assert.equal(ac.intensityAt(1, 0), 1);
  });

  it('decays as distance grows and is zero beyond maxRadius', () => {
    const ac = new AcousticPropagation({ attenuation: 0.02, absorption: 0.01, maxRadius: 50 });
    assert.ok(ac.intensityAt(1, 1) > ac.intensityAt(1, 10));
    assert.equal(new AcousticPropagation({ maxRadius: 10 }).intensityAt(1, 11), 0);
  });
});

describe('AcousticPropagation.transmit', () => {
  const ac = new AcousticPropagation({ attenuation: 0, absorption: 0, maxRadius: 10, minAudible: 0.05 });
  function buildWorld(entities: GameObject[]): WorldView {
    const byId = new Map(entities.map((e) => [e.id, e]));
    return { entities, byId: (id: string) => byId.get(id) };
  }

  it('delivers to active nearby listeners and skips the source, far and inactive entities', () => {
    const source = EntityFactory.dynamicBox({ name: 'source', position: { x: 0, y: 0, z: 0 } });
    const near = EntityFactory.dynamicBox({ name: 'near', position: { x: 1, y: 0, z: 0 } });
    const far = EntityFactory.dynamicBox({ name: 'far', position: { x: 100, y: 0, z: 0 } });
    const inactive = EntityFactory.dynamicBox({ name: 'inactive', position: { x: 2, y: 0, z: 0 } });
    inactive.active = false;
    const msg = new Message({ content: 'ping', sourceId: source.id, position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });
    const received = ac.transmit(msg, source, buildWorld([source, near, far, inactive]));
    assert.equal(received.length, 1);
    assert.equal(received[0].distance, 1);
    assert.equal(received[0].receivedIntensity, 1);
  });

  it('drops messages below the minAudible threshold', () => {
    const quiet = new AcousticPropagation({ attenuation: 0, absorption: 0, maxRadius: 10, minAudible: 0.5 });
    const source = EntityFactory.dynamicBox({ name: 's', position: { x: 0, y: 0, z: 0 } });
    const listener = EntityFactory.dynamicBox({ name: 'l', position: { x: 3, y: 0, z: 0 } });
    const msg = new Message({ content: 'shh', sourceId: source.id, position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 0.1 });
    assert.equal(quiet.transmit(msg, source, buildWorld([source, listener])).length, 0);
  });
});
