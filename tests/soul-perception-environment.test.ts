import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { LightSystem } from "../src/event/LightSystem.js";
import { ThermalSystem } from "../src/event/ThermalSystem.js";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorldWithEnv(): {
  world: World;
  weather: WeatherSimulator;
  light: LightSystem;
  thermal: ThermalSystem;
  perception: SoulPerceptionSystem;
} {
  const world = new World({ name: "test", tickRate: 60 });
  const weather = new WeatherSimulator({ initialTemperature: 20 });
  const light = new LightSystem({ ambientIntensity: 0.3 });
  const thermal = new ThermalSystem({ defaultAmbientTemperature: 20 });
  thermal.bindWeather(weather);
  const perception = new SoulPerceptionSystem({ viewDistance: 20, sensoryRange: 15 });
  world.addSystem(weather);
  world.addSystem(light);
  world.addSystem(thermal);
  world.addSystem(perception);
  return { world, weather, light, thermal, perception };
}

function makeSoul(id: string, x: number, y: number, z: number): GameObject {
  return new GameObject({ id: `soul_${id}`, name: id, type: "soul", position: { x, y, z }, mass: 1, material: "fire" });
}

describe("SoulPerceptionSystem - LightSystem integration", () => {
  it("includes localLightLevel in perception frame when LightSystem is present", () => {
    const { world, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.localLightLevel !== undefined, "localLightLevel should be defined");
    assert.ok(typeof frame.environment.localLightLevel === "number");
    assert.ok(frame.environment.localLightLevel! >= 0);
  });

  it("localLightLevel increases near a point light", () => {
    const { world, light, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);

    // Baseline illumination (ambient only).
    world.step(1 / 60);
    const baseline = perception.getPerception("soul_vex")!.environment.localLightLevel!;

    // Add a bright point light at the soul's position.
    light.addLight({ id: "lamp1", position: { x: 0, y: 0, z: 0 }, intensity: 1.0, radius: 10 });
    world.step(1 / 60);
    const withLight = perception.getPerception("soul_vex")!.environment.localLightLevel!;

    assert.ok(withLight > baseline, `Expected withLight (${withLight}) > baseline (${baseline})`);
    assert.ok(withLight > 0.5, `Expected withLight > 0.5 near bright light, got ${withLight}`);
  });

  it("localLightLevel is lower far from point light", () => {
    const { world, light, perception } = makeWorldWithEnv();
    const nearSoul = makeSoul("near", 0, 0, 0);
    const farSoul = makeSoul("far", 20, 0, 0);
    world.addEntity(nearSoul);
    world.addEntity(farSoul);
    light.addLight({ id: "lamp1", position: { x: 0, y: 0, z: 0 }, intensity: 1.0, radius: 10 });
    world.step(1 / 60);

    const nearLevel = perception.getPerception("soul_near")!.environment.localLightLevel!;
    const farLevel = perception.getPerception("soul_far")!.environment.localLightLevel!;
    assert.ok(nearLevel > farLevel, `Expected near (${nearLevel}) > far (${farLevel})`);
  });

  it("includes nearbyLights in perception frame", () => {
    const { world, light, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    light.addLight({ id: "lamp1", position: { x: 3, y: 0, z: 0 }, intensity: 0.8, radius: 10 });
    light.addLight({ id: "lamp2", position: { x: 50, y: 0, z: 0 }, intensity: 1.0, radius: 10 }); // out of range
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.nearbyLights !== undefined);
    assert.equal(frame.environment.nearbyLights!.length, 1);
    assert.equal(frame.environment.nearbyLights![0].id, "lamp1");
    assert.ok(frame.environment.nearbyLights![0].distance > 0);
    assert.equal(frame.environment.nearbyLights![0].intensity, 0.8);
  });

  it("nearbyLights is empty when no lights in range", () => {
    const { world, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.nearbyLights !== undefined);
    assert.equal(frame.environment.nearbyLights!.length, 0);
  });
});

describe("SoulPerceptionSystem - ThermalSystem integration", () => {
  it("includes localTemperature in perception frame when ThermalSystem is present", () => {
    const { world, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.localTemperature !== undefined, "localTemperature should be defined");
    assert.ok(typeof frame.environment.localTemperature === "number");
  });

  it("localTemperature increases near a heat source", () => {
    const { world, thermal, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);

    // Baseline (ambient only).
    world.step(1 / 60);
    const baseline = perception.getPerception("soul_vex")!.environment.localTemperature!;

    // Add a heat source at the soul's position.
    thermal.addHeatSource({ id: "fire1", position: { x: 0, y: 0, z: 0 }, intensity: 50, radius: 10 });
    world.step(1 / 60);
    const withHeat = perception.getPerception("soul_vex")!.environment.localTemperature!;

    assert.ok(withHeat > baseline, `Expected withHeat (${withHeat}) > baseline (${baseline})`);
    assert.ok(withHeat > 50, `Expected withHeat > 50 near heat source, got ${withHeat}`);
  });

  it("localTemperature is lower far from heat source", () => {
    const { world, thermal, perception } = makeWorldWithEnv();
    const nearSoul = makeSoul("near", 0, 0, 0);
    const farSoul = makeSoul("far", 20, 0, 0);
    world.addEntity(nearSoul);
    world.addEntity(farSoul);
    thermal.addHeatSource({ id: "fire1", position: { x: 0, y: 0, z: 0 }, intensity: 50, radius: 10 });
    world.step(1 / 60);

    const nearTemp = perception.getPerception("soul_near")!.environment.localTemperature!;
    const farTemp = perception.getPerception("soul_far")!.environment.localTemperature!;
    assert.ok(nearTemp > farTemp, `Expected near (${nearTemp}) > far (${farTemp})`);
  });

  it("includes nearbyHeatSources in perception frame", () => {
    const { world, thermal, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    thermal.addHeatSource({ id: "fire1", position: { x: 4, y: 0, z: 0 }, intensity: 60, radius: 10 });
    thermal.addHeatSource({ id: "fire2", position: { x: 50, y: 0, z: 0 }, intensity: 100, radius: 10 }); // out of range
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.nearbyHeatSources !== undefined);
    assert.equal(frame.environment.nearbyHeatSources!.length, 1);
    assert.equal(frame.environment.nearbyHeatSources![0].id, "fire1");
    assert.ok(frame.environment.nearbyHeatSources![0].distance > 0);
    assert.equal(frame.environment.nearbyHeatSources![0].intensity, 60);
  });

  it("nearbyHeatSources is empty when no heat sources in range", () => {
    const { world, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.ok(frame.environment.nearbyHeatSources !== undefined);
    assert.equal(frame.environment.nearbyHeatSources!.length, 0);
  });

  it("disabled heat sources are not included in nearbyHeatSources", () => {
    const { world, thermal, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    const source = thermal.addHeatSource({ id: "fire1", position: { x: 2, y: 0, z: 0 }, intensity: 60 });
    source!.enabled = false;
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.equal(frame.environment.nearbyHeatSources!.length, 0);
  });
});

describe("SoulPerceptionSystem - combined environmental perception", () => {
  it("soul perceives both light and heat from a campfire", () => {
    const { world, light, thermal, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);

    // A campfire emits both light and heat.
    light.addLight({ id: "campfire-light", position: { x: 1, y: 0, z: 0 }, intensity: 0.9, radius: 8 });
    thermal.addHeatSource({ id: "campfire-heat", position: { x: 1, y: 0, z: 0 }, intensity: 40, radius: 8 });
    world.step(1 / 60);

    const frame = perception.getPerception("soul_vex")!;
    // Both local values should be elevated above ambient.
    assert.ok(frame.environment.localLightLevel! > 0.3, `Expected localLight > 0.3, got ${frame.environment.localLightLevel}`);
    assert.ok(frame.environment.localTemperature! > 30, `Expected localTemp > 30, got ${frame.environment.localTemperature}`);
    // Both nearby lists should contain the campfire.
    assert.equal(frame.environment.nearbyLights!.length, 1);
    assert.equal(frame.environment.nearbyLights![0].id, "campfire-light");
    assert.equal(frame.environment.nearbyHeatSources!.length, 1);
    assert.equal(frame.environment.nearbyHeatSources![0].id, "campfire-heat");
  });

  it("global environment fields remain populated alongside local fields", () => {
    const { world, perception } = makeWorldWithEnv();
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    // Global fields from WeatherSimulator still present.
    assert.ok(typeof frame.environment.temperature === "number");
    assert.ok(typeof frame.environment.pressure === "number");
    assert.ok(typeof frame.environment.humidity === "number");
    assert.ok(typeof frame.environment.windSpeed === "number");
    assert.ok(typeof frame.environment.lightLevel === "number");
    assert.ok(frame.environment.weather);
    // Local fields also present.
    assert.ok(frame.environment.localTemperature !== undefined);
    assert.ok(frame.environment.localLightLevel !== undefined);
  });
});

describe("SoulPerceptionSystem - backward compatibility", () => {
  it("local fields are undefined when LightSystem and ThermalSystem are not present", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const weather = new WeatherSimulator({ initialTemperature: 20 });
    const perception = new SoulPerceptionSystem({ viewDistance: 20 });
    world.addSystem(weather);
    world.addSystem(perception);
    const soul = makeSoul("vex", 0, 0, 0);
    world.addEntity(soul);
    world.step(1 / 60);
    const frame = perception.getPerception("soul_vex")!;
    assert.equal(frame.environment.localLightLevel, undefined);
    assert.equal(frame.environment.localTemperature, undefined);
    assert.equal(frame.environment.nearbyLights, undefined);
    assert.equal(frame.environment.nearbyHeatSources, undefined);
    // Global fields still work.
    assert.ok(typeof frame.environment.temperature === "number");
  });
});
