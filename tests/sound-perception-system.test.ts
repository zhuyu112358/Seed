// Tests for SoundPerceptionSystem (M10 phase 2).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SoundPerceptionSystem } from "../src/sound/SoundPerceptionSystem.js";

function makeSystem(): SoundPerceptionSystem {
  return new SoundPerceptionSystem();
}

describe("SoundPerceptionSystem - Source Management", () => {
  test("add a sound source", () => {
    const system = makeSystem();
    const result = system.addSource("speech", { x: 0, z: 0 }, 0.8, 0, 440);
    assert.ok(result.success);
    const source = system.getSource(result.sourceId!)!;
    assert.equal(source.type, "speech");
    assert.equal(source.intensity, 0.8);
    assert.equal(source.frequency, 440);
    assert.equal(source.duration, 0);
    assert.equal(source.active, true);
  });

  test("add source with each type", () => {
    const system = makeSystem();
    for (const type of ["speech", "noise", "music", "footstep", "impact", "alert", "custom"] as const) {
      const result = system.addSource(type, { x: 0, z: 0 }, 0.5);
      assert.ok(result.success, `Should add ${type} source`);
    }
    assert.equal(system.sourceCount, 7);
  });

  test("reject invalid intensity", () => {
    const system = makeSystem();
    assert.ok(!system.addSource("noise", { x: 0, z: 0 }, -0.1).success);
    assert.ok(!system.addSource("noise", { x: 0, z: 0 }, 1.1).success);
  });

  test("remove source", () => {
    const system = makeSystem();
    const added = system.addSource("noise", { x: 0, z: 0 }, 0.5);
    const result = system.removeSource(added.sourceId!);
    assert.ok(result.success);
    assert.equal(system.getSource(added.sourceId!), undefined);
  });

  test("set source position", () => {
    const system = makeSystem();
    const added = system.addSource("noise", { x: 0, z: 0 }, 0.5);
    system.setSourcePosition(added.sourceId!, { x: 10, z: 20 });
    assert.equal(system.getSource(added.sourceId!)!.position.x, 10);
    assert.equal(system.getSource(added.sourceId!)!.position.z, 20);
  });

  test("set source intensity", () => {
    const system = makeSystem();
    const added = system.addSource("noise", { x: 0, z: 0 }, 0.5);
    system.setSourceIntensity(added.sourceId!, 0.9);
    assert.equal(system.getSource(added.sourceId!)!.intensity, 0.9);
  });

  test("set source active state", () => {
    const system = makeSystem();
    const added = system.addSource("noise", { x: 0, z: 0 }, 0.5);
    system.setSourceActive(added.sourceId!, false);
    assert.equal(system.getSource(added.sourceId!)!.active, false);
    assert.equal(system.getActiveSources().length, 0);
  });

  test("get sources by type", () => {
    const system = makeSystem();
    system.addSource("speech", { x: 0, z: 0 }, 0.5);
    system.addSource("speech", { x: 1, z: 1 }, 0.5);
    system.addSource("noise", { x: 2, z: 2 }, 0.5);
    assert.equal(system.getSourcesByType("speech").length, 2);
    assert.equal(system.getSourcesByType("noise").length, 1);
  });
});

describe("SoundPerceptionSystem - Listener Management", () => {
  test("add a listener", () => {
    const system = makeSystem();
    const result = system.addListener({ x: 5, z: 5 }, 0.1);
    assert.ok(result.success);
    const listener = system.getListener(result.listenerId!)!;
    assert.equal(listener.position.x, 5);
    assert.equal(listener.hearingThreshold, 0.1);
    assert.equal(listener.active, true);
  });

  test("add listener with specific ID", () => {
    const system = makeSystem();
    const result = system.addListener({ x: 0, z: 0 }, undefined, "listener_1");
    assert.ok(result.success);
    assert.equal(result.listenerId, "listener_1");
  });

  test("reject duplicate listener ID", () => {
    const system = makeSystem();
    system.addListener({ x: 0, z: 0 }, undefined, "lis_1");
    const result = system.addListener({ x: 1, z: 1 }, undefined, "lis_1");
    assert.ok(!result.success);
  });

  test("remove listener", () => {
    const system = makeSystem();
    const added = system.addListener({ x: 0, z: 0 });
    const result = system.removeListener(added.listenerId!);
    assert.ok(result.success);
    assert.equal(system.getListener(added.listenerId!), undefined);
  });

  test("set listener position", () => {
    const system = makeSystem();
    const added = system.addListener({ x: 0, z: 0 });
    system.setListenerPosition(added.listenerId!, { x: 3, z: 4 });
    assert.equal(system.getListener(added.listenerId!)!.position.x, 3);
  });

  test("set listener threshold", () => {
    const system = makeSystem();
    const added = system.addListener({ x: 0, z: 0 }, 0.05);
    system.setListenerThreshold(added.listenerId!, 0.2);
    assert.equal(system.getListener(added.listenerId!)!.hearingThreshold, 0.2);
  });

  test("listener count", () => {
    const system = makeSystem();
    system.addListener({ x: 0, z: 0 });
    system.addListener({ x: 1, z: 1 });
    assert.equal(system.listenerCount, 2);
  });
});

describe("SoundPerceptionSystem - Intensity & Distance", () => {
  test("intensity decreases with distance", () => {
    const system = makeSystem();
    const near = system.computeReceivedIntensity(1.0, 1);
    const far = system.computeReceivedIntensity(1.0, 20);
    assert.ok(near > far, `Near (${near}) should be > far (${far})`);
  });

  test("intensity at distance 0 equals source intensity", () => {
    const system = makeSystem();
    assert.equal(system.computeReceivedIntensity(0.8, 0), 0.8);
  });

  test("intensity beyond maxRadius is 0", () => {
    const system = new SoundPerceptionSystem({ maxRadius: 10 });
    assert.equal(system.computeReceivedIntensity(1.0, 15), 0);
  });

  test("compute distance", () => {
    const system = makeSystem();
    assert.equal(system.computeDistance({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
  });

  test("compute direction angle", () => {
    const system = makeSystem();
    // Source at (5, 0), listener at (0, 0) → direction 0 degrees (+x).
    assert.ok(Math.abs(system.computeDirectionAngle({ x: 5, z: 0 }, { x: 0, z: 0 })) < 0.01);
    // Source at (0, 5), listener at (0, 0) → direction 90 degrees (+z).
    assert.ok(Math.abs(system.computeDirectionAngle({ x: 0, z: 5 }, { x: 0, z: 0 }) - 90) < 0.01);
  });

  test("higher attenuation reduces intensity faster", () => {
    const lowAtten = new SoundPerceptionSystem({ attenuation: 0.001 });
    const highAtten = new SoundPerceptionSystem({ attenuation: 0.1 });
    const low = lowAtten.computeReceivedIntensity(1.0, 10);
    const high = highAtten.computeReceivedIntensity(1.0, 10);
    assert.ok(low > high, `Low attenuation (${low}) should be > high attenuation (${high})`);
  });
});

describe("SoundPerceptionSystem - Audibility", () => {
  test("close loud sound is audible", () => {
    const system = makeSystem();
    const source = system.addSource("alert", { x: 0, z: 0 }, 1.0);
    const listener = system.addListener({ x: 1, z: 0 }, 0.05);
    assert.equal(system.isAudible(source.sourceId!, listener.listenerId!), true);
  });

  test("far quiet sound is not audible", () => {
    const system = makeSystem({ maxRadius: 50 });
    const source = system.addSource("whisper", { x: 0, z: 0 }, 0.1);
    const listener = system.addListener({ x: 40, z: 0 }, 0.5);
    assert.equal(system.isAudible(source.sourceId!, listener.listenerId!), false);
  });

  test("inactive source is not audible", () => {
    const system = makeSystem();
    const source = system.addSource("noise", { x: 0, z: 0 }, 1.0);
    const listener = system.addListener({ x: 1, z: 0 }, 0.05);
    system.setSourceActive(source.sourceId!, false);
    assert.equal(system.isAudible(source.sourceId!, listener.listenerId!), false);
  });

  test("higher threshold makes fewer sounds audible", () => {
    const system = makeSystem();
    const source = system.addSource("noise", { x: 5, z: 0 }, 0.3);
    const lowThreshold = system.addListener({ x: 0, z: 0 }, 0.01);
    const highThreshold = system.addListener({ x: 0, z: 0 }, 0.5);
    assert.equal(system.isAudible(source.sourceId!, lowThreshold.listenerId!), true);
    assert.equal(system.isAudible(source.sourceId!, highThreshold.listenerId!), false);
  });

  test("get heard sound returns details", () => {
    const system = makeSystem();
    const source = system.addSource("speech", { x: 3, z: 4 }, 0.8);
    const listener = system.addListener({ x: 0, z: 0 }, 0.05);
    const heard = system.getHeardSound(source.sourceId!, listener.listenerId!)!;
    assert.equal(heard.sourceId, source.sourceId);
    assert.equal(heard.type, "speech");
    assert.equal(heard.distance, 5);
    assert.ok(heard.receivedIntensity > 0);
    assert.ok(heard.audible);
  });

  test("get heard sounds sorted by intensity", () => {
    const system = makeSystem();
    system.addSource("loud", { x: 1, z: 0 }, 1.0);
    system.addSource("quiet", { x: 10, z: 0 }, 0.2);
    const listener = system.addListener({ x: 0, z: 0 }, 0.01);
    const heard = system.getHeardSounds(listener.listenerId!);
    assert.ok(heard.length >= 2);
    assert.ok(heard[0].receivedIntensity >= heard[1].receivedIntensity);
  });

  test("find listeners hearing source", () => {
    const system = makeSystem();
    const source = system.addSource("alert", { x: 0, z: 0 }, 1.0);
    system.addListener({ x: 1, z: 0 }, 0.05, "near");
    system.addListener({ x: 100, z: 0 }, 0.05, "far");
    const listeners = system.findListenersHearingSource(source.sourceId!);
    assert.ok(listeners.includes("near"));
    assert.ok(!listeners.includes("far"));
  });
});

describe("SoundPerceptionSystem - Temporal & Serialization", () => {
  test("temporary sound expires after duration", () => {
    const system = makeSystem();
    const source = system.addSource("impact", { x: 0, z: 0 }, 0.8, 10); // 10 ticks duration.
    const listener = system.addListener({ x: 1, z: 0 }, 0.05);
    assert.equal(system.isAudible(source.sourceId!, listener.listenerId!), true);

    // Simulate 15 ticks.
    for (let i = 0; i < 15; i++) {
      system.tick(1 / 60, null as any, null as any);
    }
    assert.equal(system.isAudible(source.sourceId!, listener.listenerId!), false);
  });

  test("persistent sound does not expire", () => {
    const system = makeSystem();
    const source = system.addSource("machine", { x: 0, z: 0 }, 0.5, 0); // duration 0 = persistent.
    for (let i = 0; i < 100; i++) {
      system.tick(1 / 60, null as any, null as any);
    }
    assert.equal(system.getSource(source.sourceId!)!.active, true);
  });

  test("serialize and deserialize preserves state", () => {
    const system = makeSystem();
    system.addSource("speech", { x: 1, z: 2 }, 0.7, 0, 440, { speaker: "NPC1" });
    system.addListener({ x: 3, z: 4 }, 0.1, "listener_1");
    const data = system.serialize();

    const system2 = new SoundPerceptionSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.sourceCount, 1);
    assert.equal(system2.listenerCount, 1);
    const source = system2.getSources()[0];
    assert.equal(source.type, "speech");
    assert.equal(source.intensity, 0.7);
    assert.equal(source.position.x, 1);
  });

  test("stop clears everything", () => {
    const system = makeSystem();
    system.addSource("noise", { x: 0, z: 0 }, 0.5);
    system.addListener({ x: 1, z: 1 });
    system.stop();
    assert.equal(system.sourceCount, 0);
    assert.equal(system.listenerCount, 0);
  });
});
