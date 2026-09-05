import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorldClock } from "../src/event/WorldClock.js";
import { World } from "../src/engine/World.js";
import { EventSystem } from "../src/event/EventSystem.js";

describe("WorldClock", () => {
  it("initializes with default day length and start time", () => {
    const c = new WorldClock();
    assert.equal(c.getDayLength(), 120);
    assert.ok(c.getTimeOfDay() >= 0 && c.getTimeOfDay() < 1);
  });

  it("accepts custom configuration", () => {
    const c = new WorldClock({ dayLengthSeconds: 60, startTime: 0.5 });
    assert.equal(c.getDayLength(), 60);
    assert.equal(c.getTimeOfDay(), 0.5);
  });

  it("advances time of day on tick", () => {
    const c = new WorldClock({ dayLengthSeconds: 100, startTime: 0 });
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    c.tick(10, world, events);
    assert.ok(c.getTimeOfDay() > 0);
    assert.ok(Math.abs(c.getTimeOfDay() - 0.1) < 0.001);
  });

  it("wraps time of day at 1.0", () => {
    const c = new WorldClock({ dayLengthSeconds: 10, startTime: 0.9 });
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    c.tick(5, world, events); // 5/10 = 0.5, 0.9+0.5 = 1.4 -> 0.4
    assert.ok(c.getTimeOfDay() < 0.5);
    assert.ok(c.getTimeOfDay() > 0.3);
  });

  it("calculates light level peak at noon (0.25)", () => {
    const c = new WorldClock({ startTime: 0.25 });
    const light = c.getLightLevel();
    assert.ok(light > 0.9);
  });

  it("calculates low light level at midnight (0.75)", () => {
    const c = new WorldClock({ startTime: 0.75 });
    const light = c.getLightLevel();
    assert.ok(light < 0.2);
  });

  it("returns correct phase at different times", () => {
    const dawn = new WorldClock({ startTime: 0.25 });
    assert.equal(dawn.getPhase(), "dawn");
    const day = new WorldClock({ startTime: 0.5 });
    assert.equal(day.getPhase(), "day");
    const dusk = new WorldClock({ startTime: 0.75 });
    assert.equal(dusk.getPhase(), "dusk");
    const night = new WorldClock({ startTime: 0.0 });
    assert.equal(night.getPhase(), "night");
  });

  it("can be disabled", () => {
    const c = new WorldClock({ enabled: false, startTime: 0 });
    const world = new World({ name: "test", tickRate: 60 });
    const events = new EventSystem();
    c.tick(10, world, events);
    assert.equal(c.getTimeOfDay(), 0);
  });
});