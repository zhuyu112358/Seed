import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { WindForceSystem } from '../src/physics/WindForceSystem.js';
import { WeatherSimulator } from '../src/event/WeatherSimulator.js';
import { World } from '../src/engine/World.js';
import { GameObject } from '../src/entity/Entity.js';

function makeWorld(): { world: World; weather: WeatherSimulator; wind: WindForceSystem } {
  const world = new World({ name: "test", tickRate: 60 });
  const weather = new WeatherSimulator({ initialWindSpeed: 10, initialState: "windy" });
  const wind = new WindForceSystem({ forceCoefficient: 1.0 });
  world.addSystem(weather);
  world.addSystem(wind);
  return { world, weather, wind };
}

describe("WindForceSystem", () => {
  it("applies force to dynamic bodies in wind direction", () => {
    const { world, wind } = makeWorld();
    const body = new GameObject({ name: "box", type: "dynamic", position: { x: 0, y: 0, z: 0 }, mass: 1, material: "wood" });
    world.addEntity(body);
    const vxBefore = body.velocity.x;
    wind.tick(1 / 60, world, world.events);
    // Wind direction defaults to +x, speed 10 -> should gain +x velocity
    assert.ok(body.velocity.x > vxBefore, `expected vx increase, got ${body.velocity.x} vs ${vxBefore}`);
  });

  it("does not affect static bodies", () => {
    const { world, wind } = makeWorld();
    const body = new GameObject({ name: "wall", type: "static", position: { x: 0, y: 0, z: 0 }, mass: 1000, material: "stone" });
    world.addEntity(body);
    wind.tick(1 / 60, world, world.events);
    assert.equal(body.velocity.x, 0);
    assert.equal(body.velocity.y, 0);
  });

  it("does not affect souls by default", () => {
    const { world, wind } = makeWorld();
    const soul = new GameObject({ name: "soul:test", type: "soul", position: { x: 0, y: 0, z: 0 }, mass: 1, material: "energy" });
    world.addEntity(soul);
    wind.tick(1 / 60, world, world.events);
    assert.equal(soul.velocity.x, 0);
  });

  it("affects souls when configured", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const weather = new WeatherSimulator({ initialWindSpeed: 10 });
    const wind = new WindForceSystem({ forceCoefficient: 1.0, affectSouls: true });
    world.addSystem(weather);
    world.addSystem(wind);
    const soul = new GameObject({ name: "soul:test", type: "soul", position: { x: 0, y: 0, z: 0 }, mass: 1, material: "energy" });
    world.addEntity(soul);
    wind.tick(1 / 60, world, world.events);
    assert.ok(soul.velocity.x > 0);
  });

  it("no force below min effective speed", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const weather = new WeatherSimulator({ initialWindSpeed: 0.1 });
    const wind = new WindForceSystem({ forceCoefficient: 1.0, minEffectiveSpeed: 1.0 });
    world.addSystem(weather);
    world.addSystem(wind);
    const body = new GameObject({ name: "box", type: "dynamic", position: { x: 0, y: 0, z: 0 }, mass: 1, material: "wood" });
    world.addEntity(body);
    wind.tick(1 / 60, world, world.events);
    assert.equal(body.velocity.x, 0);
    assert.equal(wind.affectedCount, 0);
  });

  it("heavier bodies are less affected", () => {
    const { world, wind } = makeWorld();
    const light = new GameObject({ name: "light", type: "dynamic", position: { x: 0, y: 0, z: 0 }, mass: 1, material: "wood" });
    const heavy = new GameObject({ name: "heavy", type: "dynamic", position: { x: 10, y: 0, z: 0 }, mass: 100, material: "metal" });
    world.addEntity(light);
    world.addEntity(heavy);
    wind.tick(1 / 60, world, world.events);
    assert.ok(light.velocity.x > heavy.velocity.x, `light(${light.velocity.x}) should move more than heavy(${heavy.velocity.x})`);
  });

  it("reports affected count and wind speed", () => {
    const { world, wind } = makeWorld();
    const b1 = new GameObject({ name: "a", type: "dynamic", position: { x: 0, y: 0, z: 0 }, mass: 1, material: "wood" });
    const b2 = new GameObject({ name: "b", type: "dynamic", position: { x: 5, y: 0, z: 0 }, mass: 1, material: "wood" });
    world.addEntity(b1);
    world.addEntity(b2);
    wind.tick(1 / 60, world, world.events);
    assert.equal(wind.affectedCount, 2);
    assert.ok(wind.currentWindSpeed > 0);
  });
});