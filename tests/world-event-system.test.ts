import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorldEventSystem, WIND_GUST_EVENT, RAIN_STORM_EVENT, TYPHOON_EVENT, COLD_SNAP_EVENT } from "../src/event/WorldEventSystem.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { WorldClock } from "../src/event/WorldClock.js";
import { World } from "../src/engine/World.js";
import { EventSystem } from "../src/event/EventSystem.js";
import { GameObject } from "../src/entity/Entity.js";

describe("WorldEventSystem", () => {
  it("initializes with no active events", () => {
    const s = new WorldEventSystem();
    assert.equal(s.getActiveEvents().length, 0);
    assert.equal(s.getDefinitions().length, 0);
    assert.equal(s.getEventsTriggered(), 0);
  });

  it("registers and removes event definitions", () => {
    const s = new WorldEventSystem();
    s.registerDefinition(WIND_GUST_EVENT);
    assert.equal(s.getDefinitions().length, 1);
    assert.equal(s.getDefinitions()[0].id, "wind-gust");
    s.removeDefinition("wind-gust");
    assert.equal(s.getDefinitions().length, 0);
  });

  it("triggers wind gust when wind speed exceeds threshold", () => {
    const s = new WorldEventSystem();
    const weather = new WeatherSimulator({ initialWindSpeed: 15 });
    const clock = new WorldClock();
    s.bindSystems(weather, clock);
    s.registerDefinition(WIND_GUST_EVENT);
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    s.tick(1, world, events);
    assert.equal(s.getActiveEvents().length, 1);
    assert.equal(s.getActiveEvents()[0].name, "Wind Gust");
    assert.equal(s.getEventsTriggered(), 1);
  });

  it("does not trigger event when conditions not met", () => {
    const s = new WorldEventSystem();
    const weather = new WeatherSimulator({ initialWindSpeed: 2 });
    const clock = new WorldClock();
    s.bindSystems(weather, clock);
    s.registerDefinition(WIND_GUST_EVENT);
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    s.tick(1, world, events);
    assert.equal(s.getActiveEvents().length, 0);
  });

  it("respects cooldown after event ends", () => {
    const s = new WorldEventSystem();
    const weather = new WeatherSimulator({ initialWindSpeed: 15 });
    const clock = new WorldClock();
    s.bindSystems(weather, clock);
    const shortEvent = { ...WIND_GUST_EVENT, minDuration: 1, maxDuration: 1, cooldown: 100 };
    s.registerDefinition(shortEvent);
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    s.tick(1, world, events);
    assert.equal(s.getActiveEvents().length, 1);
    world.worldTime = 5;
    s.tick(1, world, events);
    assert.equal(s.getActiveEvents().length, 0);
    world.worldTime = 10;
    s.tick(1, world, events);
    assert.equal(s.getActiveEvents().length, 0);
  });

  it("has built-in typhoon event definition", () => {
    assert.equal(TYPHOON_EVENT.id, "typhoon");
    assert.equal(TYPHOON_EVENT.severity, "extreme");
    assert.equal(TYPHOON_EVENT.type, "disaster");
    assert.ok(TYPHOON_EVENT.conditions.length >= 2);
  });

  it("has built-in rain storm event definition", () => {
    assert.equal(RAIN_STORM_EVENT.id, "rain-storm");
    assert.equal(RAIN_STORM_EVENT.severity, "medium");
  });

  it("has built-in cold snap event definition", () => {
    assert.equal(COLD_SNAP_EVENT.id, "cold-snap");
    assert.equal(COLD_SNAP_EVENT.type, "seasonal");
  });

  it("applies force effects to dynamic entities during active event", () => {
    const s = new WorldEventSystem();
    const weather = new WeatherSimulator({ initialWindSpeed: 15 });
    const clock = new WorldClock();
    s.bindSystems(weather, clock);
    s.registerDefinition(WIND_GUST_EVENT);
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    const box = new GameObject({ name: "box", type: "dynamic", position: { x: 0, y: 0, z: 0 } });
    world.addEntity(box);
    const initialX = box.position.x;
    s.tick(1, world, events);
    s.tick(1, world, events);
    assert.notEqual(box.position.x, initialX);
  });

  it("clears active events on stop", () => {
    const s = new WorldEventSystem();
    const weather = new WeatherSimulator({ initialWindSpeed: 15 });
    const clock = new WorldClock();
    s.bindSystems(weather, clock);
    s.registerDefinition(WIND_GUST_EVENT);
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    s.tick(1, world, events);
    assert.equal(s.getActiveEvents().length, 1);
    s.stop();
    assert.equal(s.getActiveEvents().length, 0);
  });
});