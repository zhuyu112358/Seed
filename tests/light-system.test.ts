import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LightSystem, PointLight } from "../src/event/LightSystem.js";
import { WorldClock } from "../src/event/WorldClock.js";
import { World } from "../src/engine/World.js";
import { EventSystem } from "../src/event/EventSystem.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";

describe("PointLight", () => {
  it("initializes with default values", () => {
    const light = new PointLight({ id: "l1", position: { x: 0, y: 0, z: 0 } });
    assert.equal(light.id, "l1");
    assert.equal(light.intensity, 1);
    assert.equal(light.radius, 10);
    assert.equal(light.enabled, true);
    assert.deepEqual(light.color, { r: 1, g: 1, b: 1 });
  });

  it("accepts custom configuration", () => {
    const light = new PointLight({
      id: "l2", position: { x: 5, y: 2, z: -3 },
      intensity: 0.5, radius: 20, enabled: false,
      color: { r: 1, g: 0.5, b: 0.2 },
    });
    assert.equal(light.intensity, 0.5);
    assert.equal(light.radius, 20);
    assert.equal(light.enabled, false);
    assert.deepEqual(light.color, { r: 1, g: 0.5, b: 0.2 });
  });

  it("returns full intensity at light position", () => {
    const light = new PointLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, intensity: 0.8 });
    assert.equal(light.contributionAt(new Vector3(0, 0, 0)), 0.8);
  });

  it("returns zero beyond radius", () => {
    const light = new PointLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, radius: 5 });
    assert.equal(light.contributionAt(new Vector3(6, 0, 0)), 0);
    assert.equal(light.contributionAt(new Vector3(5, 0, 0)), 0);
  });

  it("returns zero when disabled", () => {
    const light = new PointLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, enabled: false });
    assert.equal(light.contributionAt(new Vector3(0, 0, 0)), 0);
  });

  it("falls off with distance (inverse square normalized)", () => {
    const light = new PointLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, radius: 10, intensity: 1 });
    const atZero = light.contributionAt(new Vector3(0, 0, 0));
    const atFive = light.contributionAt(new Vector3(5, 0, 0));
    const atNine = light.contributionAt(new Vector3(9, 0, 0));
    assert.equal(atZero, 1);
    // At 50% radius, contribution = (1-0.5)^2 = 0.25
    assert.ok(Math.abs(atFive - 0.25) < 0.001);
    // At 90% radius, contribution = (1-0.9)^2 = 0.01
    assert.ok(Math.abs(atNine - 0.01) < 0.001);
    // Monotonically decreasing
    assert.ok(atZero > atFive);
    assert.ok(atFive > atNine);
  });

  it("calculates colored contribution scaled by intensity", () => {
    const light = new PointLight({
      id: "l1", position: { x: 0, y: 0, z: 0 },
      intensity: 0.5, color: { r: 1, g: 0, b: 0 }, radius: 10,
    });
    const c = light.colorAt(new Vector3(0, 0, 0));
    assert.equal(c.r, 0.5);
    assert.equal(c.g, 0);
    assert.equal(c.b, 0);
  });
});

describe("LightSystem", () => {
  it("initializes with default config", () => {
    const ls = new LightSystem();
    const stats = ls.getStats();
    assert.equal(stats.ambientIntensity, 0.08);
    assert.equal(stats.maxLights, 128);
    assert.equal(stats.totalLights, 0);
    assert.equal(stats.directionalIntensity, 0);
  });

  it("accepts custom config", () => {
    const ls = new LightSystem({ ambientIntensity: 0.2, maxLights: 10, visibilityThreshold: 0.1 });
    const stats = ls.getStats();
    assert.equal(stats.ambientIntensity, 0.2);
    assert.equal(stats.maxLights, 10);
    assert.equal(stats.visibilityThreshold, 0.1);
  });

  it("adds and retrieves point lights", () => {
    const ls = new LightSystem();
    const light = ls.addLight({ id: "torch1", position: { x: 0, y: 0, z: 0 }, intensity: 0.8 });
    assert.ok(light);
    assert.equal(light!.id, "torch1");
    assert.equal(ls.getLight("torch1")!.intensity, 0.8);
    assert.equal(ls.getAllLights().length, 1);
    assert.equal(ls.getStats().totalLights, 1);
  });

  it("rejects duplicate light IDs", () => {
    const ls = new LightSystem();
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 } });
    const second = ls.addLight({ id: "l1", position: { x: 1, y: 0, z: 0 } });
    assert.equal(second, null);
    assert.equal(ls.getAllLights().length, 1);
  });

  it("enforces maxLights capacity", () => {
    const ls = new LightSystem({ maxLights: 2 });
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 } });
    ls.addLight({ id: "l2", position: { x: 1, y: 0, z: 0 } });
    const third = ls.addLight({ id: "l3", position: { x: 2, y: 0, z: 0 } });
    assert.equal(third, null);
    assert.equal(ls.getAllLights().length, 2);
  });

  it("removes lights", () => {
    const ls = new LightSystem();
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 } });
    assert.equal(ls.removeLight("l1"), true);
    assert.equal(ls.getLight("l1"), undefined);
    assert.equal(ls.getAllLights().length, 0);
    assert.equal(ls.removeLight("nonexistent"), false);
  });

  it("filters enabled lights", () => {
    const ls = new LightSystem();
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, enabled: true });
    ls.addLight({ id: "l2", position: { x: 1, y: 0, z: 0 }, enabled: false });
    assert.equal(ls.getEnabledLights().length, 1);
    assert.equal(ls.getEnabledLights()[0].id, "l1");
  });

  it("calculates ambient-only illumination when no lights or clock", () => {
    const ls = new LightSystem({ ambientIntensity: 0.1, useClockDirectionalLight: false });
    const illum = ls.getIlluminationAt(new Vector3(0, 0, 0));
    assert.equal(illum, 0.1);
  });

  it("adds point light contribution to illumination", () => {
    const ls = new LightSystem({ ambientIntensity: 0.1, useClockDirectionalLight: false });
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, intensity: 0.5, radius: 10 });
    const atLight = ls.getIlluminationAt(new Vector3(0, 0, 0));
    const farAway = ls.getIlluminationAt(new Vector3(100, 0, 0));
    // At light position: ambient 0.1 + point 0.5 = 0.6
    assert.ok(Math.abs(atLight - 0.6) < 0.001);
    // Far away: only ambient
    assert.equal(farAway, 0.1);
  });

  it("sums multiple point light contributions", () => {
    const ls = new LightSystem({ ambientIntensity: 0, useClockDirectionalLight: false });
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, intensity: 0.3, radius: 10 });
    ls.addLight({ id: "l2", position: { x: 0, y: 0, z: 0 }, intensity: 0.4, radius: 10 });
    const illum = ls.getIlluminationAt(new Vector3(0, 0, 0));
    assert.ok(Math.abs(illum - 0.7) < 0.001);
  });

  it("clamps illumination to [0, 1]", () => {
    const ls = new LightSystem({ ambientIntensity: 0.5, useClockDirectionalLight: false });
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, intensity: 1, radius: 10 });
    ls.addLight({ id: "l2", position: { x: 0, y: 0, z: 0 }, intensity: 1, radius: 10 });
    const illum = ls.getIlluminationAt(new Vector3(0, 0, 0));
    assert.equal(illum, 1);
  });

  it("binds WorldClock and uses directional light", () => {
    const ls = new LightSystem({ ambientIntensity: 0 });
    const clock = new WorldClock({ startTime: 0.25 }); // noon, light level ~1
    ls.bindClock(clock);
    const illum = ls.getIlluminationAt(new Vector3(0, 0, 0));
    // At noon, getLightLevel() should be close to 1
    assert.ok(illum > 0.8);
    assert.equal(ls.getDirectionalIntensity(), clock.getLightLevel());
  });

  it("directional intensity is 0 when clock not bound or disabled", () => {
    const ls1 = new LightSystem({ useClockDirectionalLight: false });
    assert.equal(ls1.getDirectionalIntensity(), 0);
    const ls2 = new LightSystem(); // no clock bound
    assert.equal(ls2.getDirectionalIntensity(), 0);
  });

  it("calculates entity visibility based on illumination", () => {
    const ls = new LightSystem({ ambientIntensity: 0, useClockDirectionalLight: false, visibilityThreshold: 0.1 });
    const entity = new GameObject({ id: "e1", name: "test", type: "dynamic", position: { x: 0, y: 0, z: 0 } });
    // No lights -> illumination 0 -> visibility 0
    assert.equal(ls.getEntityVisibility(entity), 0);
    // Add bright light -> visibility 1
    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 }, intensity: 1, radius: 10 });
    assert.equal(ls.getEntityVisibility(entity), 1);
  });

  it("emits light.changed event on add and remove", () => {
    const ls = new LightSystem();
    const events = new EventSystem();
    const emitted: unknown[] = [];
    events.on("light.changed", (e) => { emitted.push(e); });

    ls.addLight({ id: "l1", position: { x: 0, y: 0, z: 0 } }, events);
    assert.equal(emitted.length, 1);
    const addEvt = emitted[0] as { payload: { action: string; lightId: string } };
    assert.equal(addEvt.payload.action, "add");
    assert.equal(addEvt.payload.lightId, "l1");

    ls.removeLight("l1", events);
    assert.equal(emitted.length, 2);
    const removeEvt = emitted[1] as { payload: { action: string; lightId: string } };
    assert.equal(removeEvt.payload.action, "remove");
    assert.equal(removeEvt.payload.lightId, "l1");
  });

  it("calculates colored illumination with white ambient and colored lights", () => {
    const ls = new LightSystem({ ambientIntensity: 0.1, useClockDirectionalLight: false });
    ls.addLight({
      id: "red", position: { x: 0, y: 0, z: 0 },
      intensity: 0.5, color: { r: 1, g: 0, b: 0 }, radius: 10,
    });
    const c = ls.getColoredIlluminationAt(new Vector3(0, 0, 0));
    // R: ambient 0.1 + red light 0.5 = 0.6
    // G: ambient 0.1 only
    // B: ambient 0.1 only
    assert.ok(Math.abs(c.r - 0.6) < 0.001);
    assert.ok(Math.abs(c.g - 0.1) < 0.001);
    assert.ok(Math.abs(c.b - 0.1) < 0.001);
  });

  it("works as WorldSystem in a World tick loop", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const clock = new WorldClock({ startTime: 0.25 });
    const ls = new LightSystem();
    ls.bindClock(clock);
    world.addSystem(clock);
    world.addSystem(ls);
    ls.addLight({ id: "torch", position: { x: 0, y: 0, z: 0 }, intensity: 0.5 });

    // Tick the world
    world.step(1 / 60);

    const stats = ls.getStats();
    assert.equal(stats.totalLights, 1);
    assert.ok(stats.directionalIntensity > 0);
    const illum = ls.getIlluminationAt(new Vector3(0, 0, 0));
    assert.ok(illum > 0.5); // ambient + directional + point
  });
});
