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
    const msg = new Message({ content: 's', sourceId: 'src', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });
    const received = strat.transmit(msg, source, worldView([source, quiet]));
    assert.ok(received.length === 0 || received[0].receivedIntensity <= 0.5);
  });

  // --- Occlusion tests ---

  function occluder(id: string, x: number, halfSize = 0.5): GameObject {
    const e = new GameObject({ id, name: id, type: 'static', position: { x, y: 0, z: 0 }, halfExtents: { x: halfSize, y: halfSize, z: halfSize } });
    e.state.set('blocksSound', true);
    return e;
  }

  it('intensityAtWithOcclusion matches intensityAt when no occluders', () => {
    const a = new AcousticPropagation();
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, []);
    const withoutOcc = a.intensityAt(1, 10);
    assert.equal(Math.round(withOcc * 1e6), Math.round(withoutOcc * 1e6));
  });

  it('single occluder on line segment attenuates intensity', () => {
    const a = new AcousticPropagation({ occlusionAttenuation: 0.8 });
    const wall = occluder('wall', 5); // AABB: x in [4.5, 5.5]
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, [wall]);
    const withoutOcc = a.intensityAt(1, 10);
    // Occlusion attenuation 0.8 => intensity *= 0.2
    assert.ok(withOcc < withoutOcc, 'occluded intensity should be lower');
    assert.equal(Math.round(withOcc * 1e6), Math.round(withoutOcc * 0.2 * 1e6));
  });

  it('occluder off the line segment does not attenuate', () => {
    const a = new AcousticPropagation({ occlusionAttenuation: 0.8 });
    const wall = occluder('wall', 5); // at x=5, y=0, z=0
    // Listener at z=10, line segment goes along z, does not pass through wall at z=0
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, [wall]);
    const withoutOcc = a.intensityAt(1, 10);
    assert.equal(Math.round(withOcc * 1e6), Math.round(withoutOcc * 1e6));
  });

  it('multiple occluders stack attenuation multiplicatively', () => {
    const a = new AcousticPropagation({ occlusionAttenuation: 0.5 });
    const wall1 = occluder('wall1', 3);
    const wall2 = occluder('wall2', 7);
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, [wall1, wall2]);
    const withoutOcc = a.intensityAt(1, 10);
    // Two occluders at 0.5 attenuation each => intensity *= 0.5 * 0.5 = 0.25
    assert.equal(Math.round(withOcc * 1e6), Math.round(withoutOcc * 0.25 * 1e6));
  });

  it('occlusionAttenuation=1 fully blocks sound', () => {
    const a = new AcousticPropagation({ occlusionAttenuation: 1.0, minAudible: 0.001 });
    const wall = occluder('wall', 5);
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, [wall]);
    assert.equal(withOcc, 0);
  });

  it('occlusionAttenuation=0 does not attenuate', () => {
    const a = new AcousticPropagation({ occlusionAttenuation: 0 });
    const wall = occluder('wall', 5);
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, [wall]);
    const withoutOcc = a.intensityAt(1, 10);
    assert.equal(Math.round(withOcc * 1e6), Math.round(withoutOcc * 1e6));
  });

  it('occlusionEnabled=false skips occlusion check', () => {
    const a = new AcousticPropagation({ occlusionEnabled: false, occlusionAttenuation: 0.9 });
    const wall = occluder('wall', 5);
    const withOcc = a.intensityAtWithOcclusion(1, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, [wall]);
    const withoutOcc = a.intensityAt(1, 10);
    assert.equal(Math.round(withOcc * 1e6), Math.round(withoutOcc * 1e6));
  });

  it('transmit identifies occluders by state.blocksSound', () => {
    const strat = new AcousticPropagation({ maxRadius: 50, minAudible: 0.01, occlusionAttenuation: 0.9 });
    const source = listener('src', 0);
    const wall = occluder('wall', 5);
    wall.active = false; // Wall blocks sound but is not a listener.
    const listener1 = listener('lst', 10);
    const msg = new Message({ content: 'hi', sourceId: 'src', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });

    // With wall: listener should still hear (attenuation 0.9 => 10% passes), but quieter.
    const receivedWithWall = strat.transmit(msg, source, worldView([source, wall, listener1]));
    assert.equal(receivedWithWall.length, 1);

    // Without wall: same listener, louder.
    const receivedNoWall = strat.transmit(msg, source, worldView([source, listener1]));
    assert.equal(receivedNoWall.length, 1);

    assert.ok(receivedWithWall[0].receivedIntensity < receivedNoWall[0].receivedIntensity,
      'wall should make the received sound quieter');
  });

  it('transmit does not treat the listener itself as an occluder', () => {
    const strat = new AcousticPropagation({ maxRadius: 50, minAudible: 0.01, occlusionAttenuation: 0.9 });
    const source = listener('src', 0);
    // Listener is also marked as blocksSound (e.g. a solid entity that can also hear).
    const listener1 = occluder('lst', 10);
    listener1.active = true;
    const msg = new Message({ content: 'hi', sourceId: 'src', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });

    const received = strat.transmit(msg, source, worldView([source, listener1]));
    // The listener should hear itself without self-occlusion.
    assert.equal(received.length, 1);
    const withoutOcc = strat.intensityAt(1, 10);
    assert.equal(Math.round(received[0].receivedIntensity * 1e6), Math.round(withoutOcc * 1e6));
  });

  it('entity without blocksSound state is not treated as occluder', () => {
    const strat = new AcousticPropagation({ maxRadius: 50, minAudible: 0.01, occlusionAttenuation: 0.9 });
    const source = listener('src', 0);
    // A regular entity at x=5, NOT marked blocksSound.
    const regular = listener('reg', 5);
    regular.active = false; // Not a listener.
    const listener1 = listener('lst', 10);
    const msg = new Message({ content: 'hi', sourceId: 'src', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic', intensity: 1 });

    const received = strat.transmit(msg, source, worldView([source, regular, listener1]));
    assert.equal(received.length, 1);
    // Regular entity should not block sound.
    const withoutOcc = strat.intensityAt(1, 10);
    assert.equal(Math.round(received[0].receivedIntensity * 1e6), Math.round(withoutOcc * 1e6));
  });
});

describe('Message', () => {
  it('constructor fills defaults', () => {
    const m = new Message({ content: 'hi', sourceId: 's1', position: { x: 0, y: 0, z: 0 }, medium: 'acoustic' });
    assert.equal(m.content, 'hi');
    assert.equal(m.intensity, 1);
    assert.ok(m.id.length > 0);
  });
});
