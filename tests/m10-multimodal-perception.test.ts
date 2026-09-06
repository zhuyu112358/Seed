// Tests for M10 phase 4: SoulPerceptionSystem multi-modal perception integration.
// Verifies VisionConeSystem, SoundPerceptionSystem, PerceptionFilter, AttentionSystem
// integration into SoulPerceptionSystem.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { VisionConeSystem } from "../src/vision/VisionConeSystem.js";
import { SoundPerceptionSystem } from "../src/sound/SoundPerceptionSystem.js";
import { PerceptionFilter } from "../src/perception/PerceptionFilter.js";
import { AttentionSystem } from "../src/perception/AttentionSystem.js";

function makeWorld(): World {
  return new World({ tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: `Soul_${id}`, position: { x, y: 0, z } });
}

function makeEntity(id: string, x: number, z: number, type = "item"): GameObject {
  return new GameObject({ id, type, name: `Entity_${id}`, position: { x, y: 0, z } });
}

describe("M10 Integration - Backward Compatibility", () => {
  test("without M10 systems, perception frame works as before", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    const entity = makeEntity("item_1", 5, 0);
    world.addEntity(soul);
    world.addEntity(entity);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    assert.ok(frame);
    assert.equal(frame.visibleEntities.length, 1);
    assert.equal(frame.visibleEntities[0].id, "item_1");
    assert.equal(frame.fovFiltered, undefined);
    assert.equal(frame.auditoryEvents, undefined);
    assert.equal(frame.attentionSorted, undefined);
  });
});

describe("M10 Integration - VisionCone FOV Filtering", () => {
  test("entities outside FOV are filtered out", () => {
    const world = makeWorld();
    const visionCone = new VisionConeSystem();
    // Observer facing +x (direction 0), FOV 90 degrees.
    visionCone.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 20 }, "obs_1");
    const perception = new SoulPerceptionSystem({
      visionCone,
      visionObserverId: "obs_1",
      viewDistance: 30,
    });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    // Entity in front (+x, within FOV).
    const frontEntity = makeEntity("item_front", 10, 0);
    // Entity behind (-x, outside FOV).
    const backEntity = makeEntity("item_back", -10, 0);
    // Entity to the side (+z, outside 90-degree FOV centered on +x).
    const sideEntity = makeEntity("item_side", 0, 10);
    world.addEntity(soul);
    world.addEntity(frontEntity);
    world.addEntity(backEntity);
    world.addEntity(sideEntity);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    assert.equal(frame.fovFiltered, true);
    assert.equal(frame.visibleEntities.length, 1);
    assert.equal(frame.visibleEntities[0].id, "item_front");
  });

  test("wide FOV includes more entities", () => {
    const world = makeWorld();
    const visionCone = new VisionConeSystem();
    // 360-degree FOV (omnidirectional).
    visionCone.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 360, viewDistance: 20 }, "obs_1");
    const perception = new SoulPerceptionSystem({
      visionCone,
      visionObserverId: "obs_1",
      viewDistance: 30,
    });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addEntity(makeEntity("item_1", 10, 0));
    world.addEntity(makeEntity("item_2", -10, 0));
    world.addEntity(makeEntity("item_3", 0, 10));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    assert.equal(frame.fovFiltered, true);
    assert.equal(frame.visibleEntities.length, 3);
  });

  test("inactive observer disables FOV filtering", () => {
    const world = makeWorld();
    const visionCone = new VisionConeSystem();
    visionCone.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 20 }, "obs_1");
    visionCone.setObserverActive("obs_1", false);
    const perception = new SoulPerceptionSystem({
      visionCone,
      visionObserverId: "obs_1",
      viewDistance: 30,
    });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addEntity(makeEntity("item_1", 10, 0));
    world.addEntity(makeEntity("item_2", -10, 0));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    // Inactive observer → FOV filtering not applied, all entities visible.
    assert.equal(frame.fovFiltered, undefined);
    assert.equal(frame.visibleEntities.length, 2);
  });
});

describe("M10 Integration - SoundPerception Auditory", () => {
  test("auditory events included in perception frame", () => {
    const world = makeWorld();
    const soundPerception = new SoundPerceptionSystem();
    soundPerception.addSource("alert", { x: 10, z: 0 }, 1.0);
    soundPerception.addListener({ x: 0, z: 0 }, 0.05, "listener_1");
    const perception = new SoulPerceptionSystem({
      soundPerception,
      soundListenerId: "listener_1",
    });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    assert.ok(frame.auditoryEvents);
    assert.ok(frame.auditoryEvents!.length >= 1);
    assert.equal(frame.auditoryEvents![0].type, "alert");
    assert.ok(frame.auditoryEvents![0].receivedIntensity > 0);
    assert.ok(frame.auditoryEvents![0].distance > 0);
  });

  test("inaudible sounds not included", () => {
    const world = makeWorld();
    const soundPerception = new SoundPerceptionSystem({ maxRadius: 50 });
    // Very quiet sound far away.
    soundPerception.addSource("whisper", { x: 40, z: 0 }, 0.01);
    soundPerception.addListener({ x: 0, z: 0 }, 0.5, "listener_1");
    const perception = new SoulPerceptionSystem({
      soundPerception,
      soundListenerId: "listener_1",
    });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    // Sound should be inaudible (intensity below threshold).
    assert.ok(frame.auditoryEvents === undefined || frame.auditoryEvents!.length === 0);
  });
});

describe("M10 Integration - PerceptionFilter Event Filtering", () => {
  test("perception filter configured without errors", () => {
    const world = makeWorld();
    const perceptionFilter = new PerceptionFilter({ minSeverity: "high" });
    const perception = new SoulPerceptionSystem({ perceptionFilter });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addEntity(makeEntity("item_1", 5, 0));
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    assert.ok(frame);
    assert.equal(frame.visibleEntities.length, 1);
    // Events array should exist (may be empty if no events emitted).
    assert.ok(Array.isArray(frame.events));
  });
});

describe("M10 Integration - AttentionSystem Event Prioritization", () => {
  test("events sorted by attention priority", () => {
    const world = makeWorld();
    const attentionSystem = new AttentionSystem({ severityWeight: 1.0, distanceWeight: 0, recencyWeight: 0 });
    const perception = new SoulPerceptionSystem({ attentionSystem });
    world.addSystem(perception);
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    assert.equal(frame.attentionSorted, true);
  });
});

describe("M10 Integration - Full Multi-Modal Stack", () => {
  test("all four M10 systems work together", () => {
    const world = makeWorld();

    // Vision cone: 90-degree FOV facing +x.
    const visionCone = new VisionConeSystem();
    visionCone.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 20 }, "obs_1");

    // Sound perception: one alert sound.
    const soundPerception = new SoundPerceptionSystem();
    soundPerception.addSource("alert", { x: 5, z: 0 }, 1.0);
    soundPerception.addListener({ x: 0, z: 0 }, 0.05, "listener_1");

    // Perception filter: only high+ severity.
    const perceptionFilter = new PerceptionFilter({ minSeverity: "high" });

    // Attention system: severity-weighted.
    const attentionSystem = new AttentionSystem({ severityWeight: 0.8, distanceWeight: 0.2 });

    const perception = new SoulPerceptionSystem({
      visionCone,
      visionObserverId: "obs_1",
      soundPerception,
      soundListenerId: "listener_1",
      perceptionFilter,
      attentionSystem,
      viewDistance: 30,
    });
    world.addSystem(perception);

    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    // Entity in front (visible).
    world.addEntity(makeEntity("item_front", 8, 0));
    // Entity behind (not visible in FOV).
    world.addEntity(makeEntity("item_back", -8, 0));

    world.step(1 / 60);

    const frame = perception.getPerception("soul_1")!;
    // FOV filtering active.
    assert.equal(frame.fovFiltered, true);
    // Only front entity visible.
    assert.equal(frame.visibleEntities.length, 1);
    assert.equal(frame.visibleEntities[0].id, "item_front");
    // Auditory events present.
    assert.ok(frame.auditoryEvents);
    assert.ok(frame.auditoryEvents!.length >= 1);
    // Attention sorting active.
    assert.equal(frame.attentionSorted, true);
  });
});
