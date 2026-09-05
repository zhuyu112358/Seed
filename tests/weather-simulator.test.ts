import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { World } from "../src/engine/World.js";
import { EventSystem } from "../src/event/EventSystem.js";

describe("WeatherSimulator", () => {
  it("initializes with default weather state", () => {
    const w = new WeatherSimulator();
    const data = w.getWeather();
    assert.equal(data.state, "clear");
    assert.equal(data.temperature, 20);
    assert.equal(data.humidity, 50);
    assert.equal(data.windSpeed, 2);
  });

  it("accepts custom initial configuration", () => {
    const w = new WeatherSimulator({ initialTemperature: 30, initialHumidity: 80, initialWindSpeed: 10, initialState: "rain" });
    assert.equal(w.temperature, 30);
    assert.equal(w.humidity, 80);
    assert.equal(w.windSpeed, 10);
    assert.equal(w.state, "rain");
  });

  it("updates weather data on tick", () => {
    const w = new WeatherSimulator();
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    const initialTemp = w.temperature;
    w.setTargetTemperature(35);
    for (let i = 0; i < 10; i++) w.tick(1, world, events);
    assert.notEqual(w.temperature, initialTemp);
  });

  it("clamps humidity between 0 and 100", () => {
    const w = new WeatherSimulator({ initialHumidity: 150 });
    assert.ok(w.humidity >= 0 && w.humidity <= 100);
  });

  it("clamps wind speed between 0 and 60", () => {
    const w = new WeatherSimulator({ initialWindSpeed: 100 });
    assert.ok(w.windSpeed >= 0 && w.windSpeed <= 60);
  });

  it("setTargetTemperature changes drift target", () => {
    const w = new WeatherSimulator();
    w.setTargetTemperature(35);
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    for (let i = 0; i < 100; i++) w.tick(1, world, events);
    assert.ok(w.temperature > 20);
  });

  it("setWeatherState directly changes state", () => {
    const w = new WeatherSimulator();
    w.setWeatherState("storm");
    assert.equal(w.state, "storm");
  });

  it("getWeather returns readonly snapshot", () => {
    const w = new WeatherSimulator();
    const data = w.getWeather();
    assert.ok("temperature" in data);
    assert.ok("humidity" in data);
    assert.ok("windSpeed" in data);
    assert.ok("windDirection" in data);
    assert.ok("pressure" in data);
    assert.ok("state" in data);
    assert.ok("lightLevel" in data);
  });
});