import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AcousticPropagation } from '../src/communication/AcousticPropagation.js';

describe('AcousticPropagation', () => {
  it('should create with default config', () => {
    const ap = new AcousticPropagation();
    assert.equal(ap.medium, 'acoustic');
    assert.ok(ap.name.length > 0);
  });

  it('should initialize', () => {
    const ap = new AcousticPropagation();
    ap.initialize({ speedOfSound: 343, baseAttenuation: 0.1 });
    assert.ok(ap);
  });

  it('should compute distance-based attenuation', () => {
    const ap = new AcousticPropagation();
    ap.initialize({});
    const sender = { x: 0, y: 0, z: 0 };
    const near = { x: 1, y: 0, z: 0 };
    const far = { x: 100, y: 0, z: 0 };
    const nearResult = ap.canReach(sender, near, []);
    const farResult = ap.canReach(sender, far, []);
    assert.ok(nearResult.reachable);
    assert.ok(nearResult.signalStrength > farResult.signalStrength);
  });

  it('should return unreachable beyond max distance', () => {
    const ap = new AcousticPropagation();
    ap.initialize({ maxDistance: 10 });
    const sender = { x: 0, y: 0, z: 0 };
    const far = { x: 20, y: 0, z: 0 };
    const result = ap.canReach(sender, far, []);
    assert.ok(!result.reachable);
  });

  it('should compute propagation delay', () => {
    const ap = new AcousticPropagation();
    ap.initialize({ speedOfSound: 343 });
    const sender = { x: 0, y: 0, z: 0 };
    const receiver = { x: 343, y: 0, z: 0 };
    const delay = ap.getPropagationDelay(sender, receiver);
    assert.ok(delay >= 0.9 && delay <= 1.1); // ~1 second for 343m
  });

  it('should send message and return result', () => {
    const ap = new AcousticPropagation();
    ap.initialize({});
    const message = {
      id: 'msg_1',
      senderId: 'soul_1',
      senderType: 'soul' as const,
      medium: 'acoustic' as const,
      content: 'Hello',
      metadata: {},
      position: { x: 0, y: 0, z: 0 },
      timestamp: Date.now(),
      priority: 0,
      ttl: 100,
    };
    const entities: any[] = [];
    const result = ap.send(message, entities);
    assert.equal(result.messageId, 'msg_1');
    assert.ok(Array.isArray(result.deliveredTo));
  });

  it('should update without error', () => {
    const ap = new AcousticPropagation();
    ap.initialize({});
    assert.doesNotThrow(() => ap.update(0.016));
  });

  it('should destroy without error', () => {
    const ap = new AcousticPropagation();
    ap.initialize({});
    assert.doesNotThrow(() => ap.destroy());
  });
});
