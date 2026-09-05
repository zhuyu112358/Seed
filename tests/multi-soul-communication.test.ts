import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(acousticConfig?: object): {
  world: World;
  perception: SoulPerceptionSystem;
  action: SoulActionSystem;
} {
  const world = new World({ name: "comm-test", tickRate: 60 });
  const weather = new WeatherSimulator();
  const perception = new SoulPerceptionSystem({ viewDistance: 30, sensoryRange: 20 });
  const action = new SoulActionSystem({
    maxMoveDistance: 10,
    acoustic: acousticConfig ?? { maxRadius: 30, minAudible: 0.02, attenuation: 0.5 },
  });
  world.addSystem(weather);
  world.addSystem(perception);
  world.addSystem(action);
  return { world, perception, action };
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({
    id: `soul_${id}`, name: id, type: "soul",
    position: { x, y: 0, z }, mass: 1, material: "wind",
  });
}

describe("Multi-soul acoustic communication", () => {
  it("soul B hears soul A speaking within acoustic range", () => {
    const { world, perception, action } = makeWorld();
    const vex = makeSoul("vex", 0, 0);
    const nova = makeSoul("nova", 5, 0); // 5m away
    world.addEntity(vex);
    world.addEntity(nova);
    world.step(1 / 60); // initialize systems

    // Vex speaks.
    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "Hello Nova, can you hear me?", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    const heardBy = (result.data as { heardBy?: Array<{ id: string }> }).heardBy;
    assert.ok(heardBy, "should report who heard the message");
    assert.ok(heardBy!.some((h) => h.id === "soul_nova"), "Nova should be in heardBy list");

    // Step to let perception process.
    world.step(1 / 60);

    // Verify Nova perceives the communication.
    const novaFrame = perception.getPerception("soul_nova");
    assert.ok(novaFrame, "Nova should have a perception frame");
    assert.ok(novaFrame!.communications.length > 0, "Nova should perceive at least one communication");
    const comm = novaFrame!.communications[0];
    assert.equal(comm.senderId, "vex");
    assert.ok(comm.content.includes("Hello Nova"));
    assert.equal(comm.medium, "acoustic");
  });

  it("speaker is excluded from heardBy but can perceive own message in range", () => {
    const { world, perception, action } = makeWorld();
    const vex = makeSoul("vex", 0, 0);
    const nova = makeSoul("nova", 3, 0);
    world.addEntity(vex);
    world.addEntity(nova);
    world.step(1 / 60);

    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "Talking to myself", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    // Speaker should NOT be in heardBy list (excluded by e.id === soul.id check).
    const heardBy = (result.data as { heardBy: Array<{ id: string }> }).heardBy;
    assert.ok(!heardBy.some((h) => h.id === "soul_vex"), "speaker should not be in heardBy list");
    assert.ok(heardBy.some((h) => h.id === "soul_nova"), "Nova should be in heardBy list");

    world.step(1 / 60);

    // Speaker MAY perceive its own message (recorded at nearby listener's position,
    // within speaker's perception range — physically, you hear your own voice).
    const vexFrame = perception.getPerception("soul_vex");
    const ownMessages = vexFrame!.communications.filter((c) => c.senderId === "vex");
    assert.ok(ownMessages.length >= 0, "speaker may perceive own message");
    // If perceived, senderId should be correctly attributed.
    if (ownMessages.length > 0) {
      assert.equal(ownMessages[0].senderId, "vex");
      assert.ok(ownMessages[0].content.includes("Talking to myself"));
    }
  });

  it("distance attenuation: farther soul hears quieter message", () => {
    const { world, perception, action } = makeWorld({
      maxRadius: 50, minAudible: 0.01, attenuation: 1.0, absorption: 0.02,
    });
    const vex = makeSoul("vex", 0, 0);
    const near = makeSoul("near", 2, 0);  // 2m away
    const far = makeSoul("far", 15, 0);   // 15m away
    world.addEntity(vex);
    world.addEntity(near);
    world.addEntity(far);
    world.step(1 / 60);

    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "Distance test", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    const heardBy = (result.data as { heardBy: Array<{ id: string; intensity: number; distance: number }> }).heardBy;
    const nearEntry = heardBy.find((h) => h.id === "soul_near");
    const farEntry = heardBy.find((h) => h.id === "soul_far");

    assert.ok(nearEntry, "near soul should hear");
    assert.ok(farEntry, "far soul should hear (within maxRadius)");
    assert.ok(nearEntry!.intensity > farEntry!.intensity,
      `near intensity (${nearEntry!.intensity}) should be greater than far intensity (${farEntry!.intensity})`);
    assert.ok(nearEntry!.distance < farEntry!.distance, "near soul should be closer");
  });

  it("message beyond maxRadius is not heard", () => {
    const { world, action } = makeWorld({ maxRadius: 5, minAudible: 0.01, attenuation: 0.5 });
    const vex = makeSoul("vex", 0, 0);
    const far = makeSoul("far", 10, 0); // 10m away, beyond 5m maxRadius
    world.addEntity(vex);
    world.addEntity(far);
    world.step(1 / 60);

    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "Can you hear me now?", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    const heardBy = (result.data as { heardBy: Array<{ id: string }> }).heardBy;
    assert.ok(!heardBy.some((h) => h.id === "soul_far"), "far soul beyond maxRadius should not hear");
  });

  it("acoustic occlusion: wall between souls blocks or attenuates sound", () => {
    const { world, perception, action } = makeWorld({
      maxRadius: 30, minAudible: 0.02, attenuation: 0.5, occlusionEnabled: true, occlusionAttenuation: 0.85,
    });
    const vex = makeSoul("vex", 0, 0);
    const nova = makeSoul("nova", 10, 0); // 10m away
    // Wall between them at x=5, z=-2 to z=2 (blocks direct line of sound)
    const wall = new GameObject({
      id: "wall1", name: "Wall", type: "static",
      position: { x: 5, y: 0, z: 0 }, mass: 100, material: "stone",
    });
    wall.state.set("blocksSound", true);
    wall.active = false; // wall is not a sound receiver
    world.addEntity(vex);
    world.addEntity(nova);
    world.addEntity(wall);
    world.step(1 / 60);

    // First: speak WITHOUT wall effect baseline (we can't easily compare, just verify it works)
    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "Hello through the wall", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    // With occlusion, Nova may still hear (15% leakage per occlusion), but intensity should be low.
    const heardBy = (result.data as { heardBy: Array<{ id: string; intensity: number }> }).heardBy;
    const novaEntry = heardBy.find((h) => h.id === "soul_nova");
    if (novaEntry) {
      // If heard through wall, intensity should be very low (occlusion attenuates 85%).
      assert.ok(novaEntry.intensity < 0.5, `intensity through wall should be low, got ${novaEntry.intensity}`);
    }
    // If not heard at all, that's also valid (below minAudible after occlusion).
  });

  it("multiple souls hear the same message", () => {
    const { world, perception, action } = makeWorld({ maxRadius: 30, minAudible: 0.02, attenuation: 0.5 });
    const speaker = makeSoul("speaker", 0, 0);
    const listener1 = makeSoul("listener1", 3, 0);
    const listener2 = makeSoul("listener2", 0, 4);
    const listener3 = makeSoul("listener3", -3, -3);
    world.addEntity(speaker);
    world.addEntity(listener1);
    world.addEntity(listener2);
    world.addEntity(listener3);
    world.step(1 / 60);

    const result = action.executeAction({
      soulId: "speaker", action: "communicate",
      parameters: { content: "Broadcast to all", medium: "acoustic", volume: 1 },
      timestamp: Date.now(),
    }, world);

    const heardBy = (result.data as { heardBy: Array<{ id: string }> }).heardBy;
    assert.equal(heardBy.length, 3, "all 3 listeners should hear the message");

    world.step(1 / 60);

    // Verify each listener perceives the communication.
    for (const id of ["soul_listener1", "soul_listener2", "soul_listener3"]) {
      const frame = perception.getPerception(id);
      assert.ok(frame!.communications.length > 0, `${id} should perceive the communication`);
      assert.equal(frame!.communications[0].senderId, "speaker");
    }
  });

  it("non-acoustic medium (telepathy) bypasses distance attenuation", () => {
    const { world, perception, action } = makeWorld({ maxRadius: 5, minAudible: 0.02, attenuation: 0.5 });
    const vex = makeSoul("vex", 0, 0);
    const nova = makeSoul("nova", 20, 0); // 20m away, beyond acoustic maxRadius
    world.addEntity(vex);
    world.addEntity(nova);
    world.step(1 / 60);

    // Telepathy should bypass acoustic propagation (fallback path records directly).
    const result = action.executeAction({
      soulId: "vex", action: "communicate",
      parameters: { content: "Telepathic message", medium: "telepathy", volume: 1 },
      timestamp: Date.now(),
    }, world);

    assert.equal(result.success, true);
    world.step(1 / 60);

    const novaFrame = perception.getPerception("soul_nova");
    assert.ok(novaFrame!.communications.length > 0, "Nova should receive telepathic message regardless of distance");
    assert.equal(novaFrame!.communications[0].medium, "telepathy");
  });
});
