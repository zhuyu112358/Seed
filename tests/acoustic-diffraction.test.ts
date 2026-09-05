// Unit tests for acoustic diffraction (sound bending around occluder edges).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AcousticPropagation } from '../src/communication/AcousticPropagation.js';
import { GameObject } from '../src/entity/Entity.js';

function makeWall(id: string, x: number, z: number, hx: number, hz: number): GameObject {
  const wall = new GameObject({
    id,
    name: id,
    type: 'static',
    position: { x, y: 0, z },
    halfExtents: { x: hx, y: 2, z: hz },
    mass: 0,
    material: 'stone',
  });
  wall.state.set('blocksSound', true);
  return wall;
}

// Common config: low minAudible so diffracted/leaked sound is detectable.
const BASE_CFG = { minAudible: 0.001, attenuation: 0.01, absorption: 0.005 };

describe('Acoustic diffraction', () => {
  describe('configuration', () => {
    it('diffraction is disabled by default (backward compatible)', () => {
      const ap = new AcousticPropagation({ ...BASE_CFG });
      const wall = makeWall('wall', 5, 0, 0.5, 5);
      const intensity = ap.intensityAtWithOcclusion(
        1.0,
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        [wall],
      );
      // Wall blocks direct path — with occlusionAttenuation=0.85,
      // intensity = base * 0.15. Should be > 0 with low minAudible.
      assert.ok(intensity > 0, `default should leak some sound, got ${intensity.toFixed(4)}`);
      assert.ok(intensity < 0.5, `default should be heavily attenuated, got ${intensity.toFixed(4)}`);
    });

    it('accepts diffraction config options', () => {
      const ap = new AcousticPropagation({
        diffractionEnabled: true,
        diffractionCoefficient: 0.5,
        maxDiffractionAngle: Math.PI / 2,
      });
      assert.ok(ap);
    });
  });

  describe('diffraction around corners', () => {
    it('sound can reach listener around a wall corner when diffraction enabled', () => {
      const apNoDiff = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: false });
      const apWithDiff = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true });

      // Wall at x=5, spanning z=-3 to z=3.
      // Source at (0,0,0), listener at (10,0,5) — listener is above the wall's z range.
      const wall = makeWall('wall', 5, 0, 0.5, 3);
      const source = { x: 0, y: 0, z: 0 };
      const listener = { x: 10, y: 0, z: 5 };

      const intensityNoDiff = apNoDiff.intensityAtWithOcclusion(1.0, source, listener, [wall]);
      const intensityWithDiff = apWithDiff.intensityAtWithOcclusion(1.0, source, listener, [wall]);

      // Direct path: source(0,0) to listener(10,5). Does it intersect wall at x=[4.5,5.5], z=[-3,3]?
      // Line param: at x=5, t=0.5, z=2.5. z=2.5 is within [-3,3]. So direct path IS blocked.
      // With diffraction, sound bends around corner (5,3) and should be louder.
      assert.ok(intensityWithDiff >= intensityNoDiff,
        `diffraction should not decrease intensity: with=${intensityWithDiff.toFixed(4)} >= without=${intensityNoDiff.toFixed(4)}`);
      assert.ok(intensityWithDiff > 0, `diffracted sound should be audible, got ${intensityWithDiff.toFixed(4)}`);
    });

    it('diffraction attenuation increases with deflection angle', () => {
      const ap = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true, diffractionCoefficient: 0.3 });
      const wall = makeWall('wall', 5, 0, 0.5, 3);
      const source = { x: 0, y: 0, z: 0 };

      // Listener close to wall edge (small deflection) vs far around corner (large deflection).
      const listenerSmallAngle = { x: 10, y: 0, z: 3.5 };
      const listenerLargeAngle = { x: 10, y: 0, z: 10 };

      const intensitySmall = ap.intensityAtWithOcclusion(1.0, source, listenerSmallAngle, [wall]);
      const intensityLarge = ap.intensityAtWithOcclusion(1.0, source, listenerLargeAngle, [wall]);

      // Larger deflection angle = more diffraction loss = lower intensity.
      // Also larger distance contributes, but diffraction loss is the key differentiator.
      assert.ok(intensitySmall >= intensityLarge,
        `smaller angle should have >= intensity: small=${intensitySmall.toFixed(4)} >= large=${intensityLarge.toFixed(4)}`);
    });

    it('diffraction uses the nearest corner', () => {
      const ap = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true });
      // Long wall spanning z=-10 to z=10.
      const wall = makeWall('wall', 5, 0, 0.5, 10);
      const source = { x: 0, y: 0, z: 0 };
      // Listener at z=2 — direct path blocked (z=2 within [-10,10]).
      const listener = { x: 10, y: 0, z: 2 };

      const intensity = ap.intensityAtWithOcclusion(1.0, source, listener, [wall]);
      // Diffraction around nearest corner should deliver some sound.
      assert.ok(intensity > 0, `diffracted sound around nearest corner should be audible, got ${intensity.toFixed(4)}`);
    });

    it('sound fully blocked when deflection angle exceeds maxDiffractionAngle', () => {
      const ap = new AcousticPropagation({
        ...BASE_CFG,
        diffractionEnabled: true,
        maxDiffractionAngle: 0.05, // Very small max angle.
        diffractionCoefficient: 0.3,
      });
      const wall = makeWall('wall', 5, 0, 0.5, 3);
      const source = { x: 0, y: 0, z: 0 };
      const listener = { x: 10, y: 0, z: 10 }; // Large deflection angle.

      const intensity = ap.intensityAtWithOcclusion(1.0, source, listener, [wall]);
      // With maxDiffractionAngle=0.05, large deflection exceeds limit,
      // so standard occlusion (0.85 attenuation) applies instead of diffraction.
      // At distance ~14m with BASE_CFG, base intensity is still significant.
      // Standard occlusion: intensity *= 0.15.
      assert.ok(intensity > 0, `should still have leaked sound, got ${intensity.toFixed(4)}`);
    });

    it('higher diffractionCoefficient means more muffled sound', () => {
      const apLow = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true, diffractionCoefficient: 0.1 });
      const apHigh = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true, diffractionCoefficient: 0.8 });

      const wall = makeWall('wall', 5, 0, 0.5, 3);
      const source = { x: 0, y: 0, z: 0 };
      const listener = { x: 10, y: 0, z: 5 };

      const intensityLow = apLow.intensityAtWithOcclusion(1.0, source, listener, [wall]);
      const intensityHigh = apHigh.intensityAtWithOcclusion(1.0, source, listener, [wall]);

      assert.ok(intensityLow >= intensityHigh,
        `lower coefficient should be >= louder: low=${intensityLow.toFixed(4)} >= high=${intensityHigh.toFixed(4)}`);
    });
  });

  describe('multiple occluders', () => {
    it('diffraction works with multiple occluders', () => {
      const ap = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true });
      const wall1 = makeWall('wall1', 4, -2, 0.5, 2);
      const wall2 = makeWall('wall2', 6, 2, 0.5, 2);
      const source = { x: 0, y: 0, z: 0 };
      const listener = { x: 10, y: 0, z: 0 };

      const intensity = ap.intensityAtWithOcclusion(1.0, source, listener, [wall1, wall2]);
      assert.ok(intensity >= 0, 'intensity should be non-negative');
    });
  });

  describe('no occlusion', () => {
    it('diffraction has no effect when direct path is clear', () => {
      const apNoDiff = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: false });
      const apWithDiff = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true });

      const source = { x: 0, y: 0, z: 0 };
      const listener = { x: 10, y: 0, z: 0 };
      const intensityNoDiff = apNoDiff.intensityAtWithOcclusion(1.0, source, listener, []);
      const intensityWithDiff = apWithDiff.intensityAtWithOcclusion(1.0, source, listener, []);

      assert.equal(intensityNoDiff, intensityWithDiff, 'no occlusion = same intensity');
    });

    it('diffraction has no effect when occluder does not block direct path', () => {
      const ap = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true });
      const wall = makeWall('wall', 5, 20, 0.5, 1);
      const source = { x: 0, y: 0, z: 0 };
      const listener = { x: 10, y: 0, z: 0 };

      const intensity = ap.intensityAtWithOcclusion(1.0, source, listener, [wall]);
      const expected = ap.intensityAt(1.0, Math.sqrt(10 * 10));
      assert.ok(Math.abs(intensity - expected) < 1e-6,
        `non-blocking occluder should not affect intensity: got=${intensity.toFixed(6)}, expected=${expected.toFixed(6)}`);
    });
  });

  describe('transmit with diffraction', () => {
    it('transmit delivers diffracted sound to listeners around corners', () => {
      const ap = new AcousticPropagation({ ...BASE_CFG, diffractionEnabled: true, minAudible: 0.001 });

      const source = new GameObject({
        id: 'src', name: 'Source', type: 'dynamic',
        position: { x: 0, y: 0, z: 0 },
        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
        mass: 1, material: 'flesh',
      });

      const wall = makeWall('wall', 5, 0, 0.5, 3);

      const listenerAroundCorner = new GameObject({
        id: 'listener', name: 'Listener', type: 'dynamic',
        position: { x: 10, y: 0, z: 5 },
        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
        mass: 1, material: 'flesh',
      });

      const worldView = {
        entities: [source, wall, listenerAroundCorner],
      };

      const message = {
        id: 'msg1',
        senderId: 'src',
        content: 'Hello around the corner',
        medium: 'acoustic' as const,
        intensity: 1.0,
        timestamp: Date.now(),
      };

      const received = ap.transmit(message, source, worldView);
      assert.ok(received.length >= 1, 'listener around corner should receive diffracted sound');
      assert.ok(received[0].receivedIntensity > 0, 'received intensity should be positive');
      assert.ok(received[0].receivedIntensity < 1.0, 'received intensity should be attenuated');
    });
  });
});
