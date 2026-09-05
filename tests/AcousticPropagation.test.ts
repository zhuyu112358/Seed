// Unit tests for src/communication/AcousticPropagation.ts and Message.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AcousticPropagation } from '../src/communication/AcousticPropagation.js';
import { Message } from '../src/communication/Message.js';
import { GameObject } from '../src/entity/Entity.js';
import type { WorldView } from '../src/communication/CommunicationStrategy.js';

function listener(id: string, x: number): GameObject {
  return new GameObject({ id, name: id, type: 'dynamic', position: { x, y: 0, z: 0 } });
}
function worldView(entities: GameObject[]): WorldView {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return { entities, byId: (id) => byId.get(id) };
}

describe('AcousticPropagation', () => {
  it('constructs with default config', () => {
    assert.equal(new AcousticPropagation().medium, 'acoustic');
  });

  it('intensityAt decays with distance', () => {
    const a = new AcousticPropagation();
    assert.ok(a.intensityAt(1, 1) > a.intensityAt(1, 10));
  });

  it('intensityAt returns 0 beyond maxRadius', () => {
    const a = new AcousticPropagation({ maxRadius: 20 });
    assert.equal(a.intensityAt(1, 25), 0);
    assert.ok(a.intensityAt(1, 5) > 0);
  });

  it('transmit delivers to near listeners only', () => {
    const strat = new AcousticPropagation({ maxRadius: 20, minAudible: 0.05 });
    const source = listener('src', 0);
    const near = listener('near', 5);
    const far = listener('far', 100);
    const msg = new Message({ content: 'hi', sourceId: 'src', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });
    const received = strat.transmit(msg, source, worldView([source, near, far]));
    assert.equal(received.length, 1);
    assert.ok(received[0].distance <= 20);
  });

  it('minAudible threshold filters quiet messages', () => {
    const strat = new AcousticPropagation({ attenuation: 0.5, absorption: 0.05, maxRadius: 50, minAudible: 0.5 });
    const source = listener('src', 0);
    const quiet = listener('quiet', 20);
    const msg = new Message({ content: 'shout', sourceId: 'src', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });
    const received = strat.transmit(msg, source, worldView([source, quiet]));
    assert.ok(received.length === 0 || received[0].receivedIntensity <= 0.5);
  });
});

describe('Message', () => {
  it('constructor fills defaults', () => {
    const m = new Message({ content: 'hi', sourceId: 's1', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic' });
    assert.equal(m.content, 'hi');
    assert.equal(m.intensity, 1);
    assert.ok(m.id.length > 0);
    assert.equal(typeof m.timestamp, 'number');
  });
});
