import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ThermalSystem, HeatSource } from "../src/event/ThermalSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { World } from "../src/engine/World.js";
import { EventSystem } from "../src/event/EventSystem.js";
import { GameObject } from "../src/entity/Entity.js";
import { Vector3 } from "../src/entity/Vector3.js";

describe("HeatSource", () => {
  it("initializes with default values", () => {
    const source = new HeatSource({ id: "fire1", position: { x: 0, y: 0, z: 0 } });
    assert.equal(source.id, "fire1");
    assert.equal(source.intensity, 50);
    assert.equal(source.radius, 8);
    assert.equal(source.enabled, true);
  });

  it("accepts custom configuration", () => {
    const source = new HeatSource({
      id: "fire2", position: { x: 5, y: 1, z: -2 },
      intensity: 100, radius: 15, enabled: false,
    });
    assert.equal(source.intensity, 100);
    assert.equal(source.radius, 15);
    assert.equal(source.enabled, false);
  });

  it("returns full intensity at source position", () => {
    const source = new HeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 }, intensity: 80 });
    assert.equal(source.contributionAt(new Vector3(0, 0, 0)), 80);
  });

  it("returns zero beyond radius", () => {
    const source = new HeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 }, radius: 5 });
    assert.equal(source.contributionAt(new Vector3(6, 0, 0)), 0);
    assert.equal(source.contributionAt(new Vector3(5, 0, 0)), 0);
  });

  it("returns zero when disabled", () => {
    const source = new HeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 }, enabled: false });
    assert.equal(source.contributionAt(new Vector3(0, 0, 0)), 0);
  });

  it("falls off with distance (inverse square normalized)", () => {
    const source = new HeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 }, radius: 10, intensity: 100 });
    const atZero = source.contributionAt(new Vector3(0, 0, 0));
    const atFive = source.contributionAt(new Vector3(5, 0, 0));
    const atNine = source.contributionAt(new Vector3(9, 0, 0));
    assert.equal(atZero, 100);
    assert.ok(Math.abs(atFive - 25) < 0.001); // (1-0.5)^2 * 100 = 25
    assert.ok(Math.abs(atNine - 1) < 0.001);   // (1-0.9)^2 * 100 = 1
    assert.ok(atZero > atFive);
    assert.ok(atFive > atNine);
  });
});

describe("ThermalSystem", () => {
  it("initializes with default config", () => {
    const ts = new ThermalSystem();
    const stats = ts.getStats();
    assert.equal(stats.ambientTemperature, 20);
    assert.equal(stats.maxHeatSources, 64);
    assert.equal(stats.totalHeatSources, 0);
    assert.equal(stats.coolingCoefficient, 0.02);
    assert.equal(stats.conductionEnabled, true);
  });

  it("accepts custom config", () => {
    const ts = new ThermalSystem({
      defaultAmbientTemperature: 25,
      maxHeatSources: 10,
      coolingCoefficient: 0.05,
      hotThreshold: 50,
      coldThreshold: 5,
    });
    const stats = ts.getStats();
    assert.equal(stats.ambientTemperature, 25);
    assert.equal(stats.maxHeatSources, 10);
    assert.equal(stats.coolingCoefficient, 0.05);
  });

  it("adds and retrieves heat sources", () => {
    const ts = new ThermalSystem();
    const source = ts.addHeatSource({ id: "fire1", position: { x: 0, y: 0, z: 0 }, intensity: 60 });
    assert.ok(source);
    assert.equal(source!.id, "fire1");
    assert.equal(ts.getHeatSource("fire1")!.intensity, 60);
    assert.equal(ts.getAllHeatSources().length, 1);
    assert.equal(ts.getStats().totalHeatSources, 1);
  });

  it("rejects duplicate heat source IDs", () => {
    const ts = new ThermalSystem();
    ts.addHeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 } });
    const second = ts.addHeatSource({ id: "f1", position: { x: 1, y: 0, z: 0 } });
    assert.equal(second, null);
    assert.equal(ts.getAllHeatSources().length, 1);
  });

  it("enforces maxHeatSources capacity", () => {
    const ts = new ThermalSystem({ maxHeatSources: 2 });
    ts.addHeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 } });
    ts.addHeatSource({ id: "f2", position: { x: 1, y: 0, z: 0 } });
    const third = ts.addHeatSource({ id: "f3", position: { x: 2, y: 0, z: 0 } });
    assert.equal(third, null);
    assert.equal(ts.getAllHeatSources().length, 2);
  });

  it("removes heat sources", () => {
    const ts = new ThermalSystem();
    ts.addHeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 } });
    assert.equal(ts.removeHeatSource("f1"), true);
    assert.equal(ts.getHeatSource("f1"), undefined);
    assert.equal(ts.getAllHeatSources().length, 0);
    assert.equal(ts.removeHeatSource("nonexistent"), false);
  });

  it("calculates ambient-only temperature when no heat sources", () => {
    const ts = new ThermalSystem({ defaultAmbientTemperature: 22 });
    const temp = ts.getTemperatureAt(new Vector3(0, 0, 0));
    assert.equal(temp, 22);
  });

  it("adds heat source contribution to temperature at point", () => {
    const ts = new ThermalSystem({ defaultAmbientTemperature: 20 });
    ts.addHeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 }, intensity: 30, radius: 10 });
    const atSource = ts.getTemperatureAt(new Vector3(0, 0, 0));
    const farAway = ts.getTemperatureAt(new Vector3(100, 0, 0));
    assert.ok(Math.abs(atSource - 50) < 0.001); // 20 ambient + 30 heat
    assert.equal(farAway, 20); // only ambient
  });

  it("binds WeatherSimulator for ambient temperature", () => {
    const ts = new ThermalSystem();
    const weather = new WeatherSimulator({ initialTemperature: 30 });
    ts.bindWeather(weather);
    assert.equal(ts.getAmbientTemperature(), 30);
    assert.equal(ts.getStats().ambientTemperature, 30);
  });

  it("uses default ambient when WeatherSimulator not bound", () => {
    const ts = new ThermalSystem({ defaultAmbientTemperature: 18 });
    assert.equal(ts.getAmbientTemperature(), 18);
  });

  it("sets and gets entity temperature directly", () => {
    const ts = new ThermalSystem();
    const entity = new GameObject({ id: "e1", name: "rock", type: "static", position: { x: 0, y: 0, z: 0 } });
    assert.equal(ts.getEntityTemperature(entity), undefined);
    ts.setEntityTemperature(entity, 25);
    assert.equal(ts.getEntityTemperature(entity), 25);
  });

  it("simulates entity heating near heat source over ticks", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const ts = new ThermalSystem({ defaultAmbientTemperature: 20, coolingCoefficient: 0.5 });
    ts.addHeatSource({ id: "fire", position: { x: 0, y: 0, z: 0 }, intensity: 80, radius: 10 });
    world.addSystem(ts);
    const entity = new GameObject({ id: "e1", name: "rock", type: "static", position: { x: 0, y: 0, z: 0 } });
    ts.setEntityTemperature(entity, 20);
    world.addEntity(entity);

    // Tick many times to heat up.
    for (let i = 0; i < 500; i++) {
      world.step(1 / 60);
    }
    const temp = ts.getEntityTemperature(entity)!;
    // Should be significantly hotter than initial 20, approaching 100 (20 ambient + 80 heat).
    assert.ok(temp > 50, `Expected temp > 50, got ${temp}`);
    assert.ok(temp < 105, `Expected temp < 105, got ${temp}`);
  });

  it("simulates entity cooling away from heat source", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const ts = new ThermalSystem({ defaultAmbientTemperature: 20, coolingCoefficient: 0.5 });
    // No heat sources.
    world.addSystem(ts);
    const entity = new GameObject({ id: "e1", name: "hot rock", type: "static", position: { x: 0, y: 0, z: 0 } });
    ts.setEntityTemperature(entity, 80);
    world.addEntity(entity);

    for (let i = 0; i < 500; i++) {
      world.step(1 / 60);
    }
    const temp = ts.getEntityTemperature(entity)!;
    // Should cool toward ambient 20.
    assert.ok(temp < 40, `Expected temp < 40 after cooling, got ${temp}`);
    assert.ok(temp > 15, `Expected temp > 15 (not below ambient), got ${temp}`);
  });

  it("simulates inter-entity heat conduction", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const ts = new ThermalSystem({
      defaultAmbientTemperature: 20,
      coolingCoefficient: 0, // Disable ambient cooling to isolate conduction.
      enableConduction: true,
      conductionRange: 3,
      conductionFactor: 0.5,
    });
    world.addSystem(ts);
    const hot = new GameObject({ id: "hot", name: "hot", type: "static", position: { x: 0, y: 0, z: 0 } });
    const cold = new GameObject({ id: "cold", name: "cold", type: "static", position: { x: 1, y: 0, z: 0 } });
    ts.setEntityTemperature(hot, 80);
    ts.setEntityTemperature(cold, 20);
    world.addEntity(hot);
    world.addEntity(cold);

    for (let i = 0; i < 100; i++) {
      world.step(1 / 60);
    }
    const hotTemp = ts.getEntityTemperature(hot)!;
    const coldTemp = ts.getEntityTemperature(cold)!;
    // Hot should cool, cold should heat (conduction transfers heat).
    assert.ok(hotTemp < 80, `Expected hot to cool, got ${hotTemp}`);
    assert.ok(coldTemp > 20, `Expected cold to heat, got ${coldTemp}`);
  });

  it("emits thermal.hot event when entity crosses hot threshold", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const ts = new ThermalSystem({ defaultAmbientTemperature: 20, coolingCoefficient: 0.5, hotThreshold: 50 });
    ts.addHeatSource({ id: "fire", position: { x: 0, y: 0, z: 0 }, intensity: 100, radius: 10 });
    world.addSystem(ts);
    const events = new EventSystem();
    const hotEvents: unknown[] = [];
    events.on("thermal.hot", (e) => { hotEvents.push(e); });

    const entity = new GameObject({ id: "e1", name: "rock", type: "static", position: { x: 0, y: 0, z: 0 } });
    ts.setEntityTemperature(entity, 20);
    world.addEntity(entity);

    // Manually tick with events to capture.
    for (let i = 0; i < 50; i++) {
      ts.tick(1 / 60, world, events);
    }
    assert.ok(hotEvents.length >= 1, `Expected at least 1 thermal.hot event, got ${hotEvents.length}`);
    const evt = hotEvents[0] as { payload: { entityId: string; temperature: number } };
    assert.equal(evt.payload.entityId, "e1");
    assert.ok(evt.payload.temperature >= 50);
  });

  it("emits thermal.cold event when entity crosses cold threshold", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const ts = new ThermalSystem({ defaultAmbientTemperature: -10, coolingCoefficient: 0.5, coldThreshold: 0 });
    world.addSystem(ts);
    const events = new EventSystem();
    const coldEvents: unknown[] = [];
    events.on("thermal.cold", (e) => { coldEvents.push(e); });

    const entity = new GameObject({ id: "e1", name: "rock", type: "static", position: { x: 0, y: 0, z: 0 } });
    ts.setEntityTemperature(entity, 20);
    world.addEntity(entity);

    for (let i = 0; i < 200; i++) {
      ts.tick(1 / 60, world, events);
    }
    assert.ok(coldEvents.length >= 1, `Expected at least 1 thermal.cold event, got ${coldEvents.length}`);
  });

  it("emits thermal.source-changed event on add and remove", () => {
    const ts = new ThermalSystem();
    const events = new EventSystem();
    const emitted: unknown[] = [];
    events.on("thermal.source-changed", (e) => { emitted.push(e); });

    ts.addHeatSource({ id: "f1", position: { x: 0, y: 0, z: 0 } }, events);
    assert.equal(emitted.length, 1);
    const addEvt = emitted[0] as { payload: { action: string; sourceId: string } };
    assert.equal(addEvt.payload.action, "add");
    assert.equal(addEvt.payload.sourceId, "f1");

    ts.removeHeatSource("f1", events);
    assert.equal(emitted.length, 2);
    const removeEvt = emitted[1] as { payload: { action: string; sourceId: string } };
    assert.equal(removeEvt.payload.action, "remove");
    assert.equal(removeEvt.payload.sourceId, "f1");
  });

  it("works as WorldSystem in a World tick loop with WeatherSimulator", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const weather = new WeatherSimulator({ initialTemperature: 25 });
    const ts = new ThermalSystem();
    ts.bindWeather(weather);
    ts.addHeatSource({ id: "campfire", position: { x: 0, y: 0, z: 0 }, intensity: 40 });
    world.addSystem(weather);
    world.addSystem(ts);

    const entity = new GameObject({ id: "e1", name: "log", type: "static", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(entity);

    world.step(1 / 60);
    world.step(1 / 60);

    const stats = ts.getStats();
    assert.equal(stats.totalHeatSources, 1);
    assert.ok(Math.abs(stats.ambientTemperature - 25) < 1, `Expected ambient ~25, got ${stats.ambientTemperature}`);
    assert.ok(stats.entitiesHeated > 0);
    // Entity should have a temperature after simulation.
    const temp = ts.getEntityTemperature(entity);
    assert.ok(typeof temp === "number");
    assert.ok(temp! > 20); // Should be warmer than default due to campfire + 25 ambient.
  });

  it("respects material thermal conductivity and heat capacity properties", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const ts = new ThermalSystem({ defaultAmbientTemperature: 20, coolingCoefficient: 0.1 });
    ts.addHeatSource({ id: "fire", position: { x: 0, y: 0, z: 0 }, intensity: 80, radius: 10 });
    world.addSystem(ts);

    // Metal: high conductivity, low heat capacity -> heats fast.
    const metal = new GameObject({ id: "metal", name: "metal", type: "static", position: { x: 0, y: 0, z: 0 } });
    metal.properties.set("thermalConductivity", 0.9);
    metal.properties.set("heatCapacity", 0.3);
    ts.setEntityTemperature(metal, 20);
    world.addEntity(metal);

    // Wood: low conductivity, high heat capacity -> heats slow.
    const wood = new GameObject({ id: "wood", name: "wood", type: "static", position: { x: 0, y: 0, z: 0 } });
    wood.properties.set("thermalConductivity", 0.05);
    wood.properties.set("heatCapacity", 2.0);
    ts.setEntityTemperature(wood, 20);
    world.addEntity(wood);

    for (let i = 0; i < 30; i++) {
      world.step(1 / 60);
    }
    const metalTemp = ts.getEntityTemperature(metal)!;
    const woodTemp = ts.getEntityTemperature(wood)!;
    // Metal should heat faster than wood.
    assert.ok(metalTemp > woodTemp, `Expected metal (${metalTemp}) > wood (${woodTemp})`);
  });
});
