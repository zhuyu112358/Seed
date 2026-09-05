// Tests for WorldRuleEngine — generic world-level rule system.
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { WorldRuleEngine } from "../src/rules/WorldRuleEngine.js";

function makeWorld(): World {
  return new World({ name: "test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

describe("WorldRuleEngine", () => {
  test("register and unregister rules", () => {
    const engine = new WorldRuleEngine();
    engine.registerRule({
      id: "rule1",
      condition: () => true,
      action: () => {},
    });
    assert.equal(engine.size, 1);
    assert.ok(engine.getRule("rule1"));

    engine.unregisterRule("rule1");
    assert.equal(engine.size, 0);
    assert.equal(engine.getRule("rule1"), undefined);
  });

  test("duplicate rule ID throws", () => {
    const engine = new WorldRuleEngine();
    engine.registerRule({ id: "r1", condition: () => true, action: () => {} });
    assert.throws(() => {
      engine.registerRule({ id: "r1", condition: () => true, action: () => {} });
    }, /already exists/);
  });

  test("enable/disable rules", () => {
    const engine = new WorldRuleEngine();
    engine.registerRule({ id: "r1", condition: () => true, action: () => {} });
    assert.equal(engine.isRuleEnabled("r1"), true);

    engine.disableRule("r1");
    assert.equal(engine.isRuleEnabled("r1"), false);

    engine.enableRule("r1");
    assert.equal(engine.isRuleEnabled("r1"), true);
  });

  test("rule fires when condition is true", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let fired = 0;
    engine.registerRule({
      id: "fire-test",
      condition: () => true,
      action: () => { fired++; },
    });
    world.addSystem(engine);

    world.step(1 / 60);
    assert.equal(fired, 1);
    world.step(1 / 60);
    assert.equal(fired, 2);
  });

  test("rule does not fire when condition is false", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let fired = 0;
    engine.registerRule({
      id: "no-fire",
      condition: () => false,
      action: () => { fired++; },
    });
    world.addSystem(engine);

    world.step(1 / 60);
    assert.equal(fired, 0);
  });

  test("rule cooldown prevents rapid firing", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let fired = 0;
    engine.registerRule({
      id: "cooldown",
      cooldownTicks: 3,
      condition: () => true,
      action: () => { fired++; },
    });
    world.addSystem(engine);

    world.step(1 / 60); // tick 1: fire
    assert.equal(fired, 1);
    world.step(1 / 60); // tick 2: cooldown
    world.step(1 / 60); // tick 3: cooldown
    assert.equal(fired, 1);
    world.step(1 / 60); // tick 4: fire (3 ticks since last)
    assert.equal(fired, 2);
  });

  test("rule maxFires limits total firings", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let fired = 0;
    engine.registerRule({
      id: "max-fires",
      maxFires: 2,
      condition: () => true,
      action: () => { fired++; },
    });
    world.addSystem(engine);

    for (let i = 0; i < 5; i++) world.step(1 / 60);
    assert.equal(fired, 2);
    assert.equal(engine.getFireCount("max-fires"), 2);
  });

  test("higher priority rules fire first", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    const order: string[] = [];
    engine.registerRule({
      id: "low",
      priority: 1,
      condition: () => true,
      action: () => { order.push("low"); },
    });
    engine.registerRule({
      id: "high",
      priority: 10,
      condition: () => true,
      action: () => { order.push("high"); },
    });
    world.addSystem(engine);

    world.step(1 / 60);
    assert.deepEqual(order, ["high", "low"]);
  });

  test("rule context provides world and shared data", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let ctxWorld: World | null = null;
    engine.registerRule({
      id: "ctx-test",
      condition: (ctx) => {
        ctxWorld = ctx.world;
        ctx.data.set("test", 42);
        return true;
      },
      action: (ctx) => {
        assert.equal(ctx.data.get("test"), 42);
      },
    });
    world.addSystem(engine);

    world.step(1 / 60);
    assert.equal(ctxWorld, world);
  });

  test("disabled rules do not fire", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let fired = 0;
    engine.registerRule({
      id: "disabled",
      condition: () => true,
      action: () => { fired++; },
    });
    engine.disableRule("disabled");
    world.addSystem(engine);

    world.step(1 / 60);
    assert.equal(fired, 0);
  });

  test("rule error does not crash engine", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    let otherFired = 0;
    engine.registerRule({
      id: "error-rule",
      condition: () => { throw new Error("boom"); },
      action: () => {},
    });
    engine.registerRule({
      id: "ok-rule",
      condition: () => true,
      action: () => { otherFired++; },
    });
    world.addSystem(engine);

    // Should not throw.
    world.step(1 / 60);
    assert.equal(otherFired, 1);
  });

  test("getRuleIds returns all registered IDs", () => {
    const engine = new WorldRuleEngine();
    engine.registerRule({ id: "a", condition: () => true, action: () => {} });
    engine.registerRule({ id: "b", condition: () => true, action: () => {} });
    const ids = engine.getRuleIds();
    assert.equal(ids.length, 2);
    assert.ok(ids.includes("a"));
    assert.ok(ids.includes("b"));
  });

  test("serialize/deserialize preserves rule state", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    engine.registerRule({
      id: "persist-rule",
      maxFires: 10,
      condition: () => true,
      action: () => {},
    });
    world.addSystem(engine);
    world.step(1 / 60);
    world.step(1 / 60);
    engine.disableRule("persist-rule");

    const data = engine.serialize() as any;
    assert.equal(data.rules["persist-rule"].fireCount, 2);
    assert.equal(data.rules["persist-rule"].enabled, false);

    // New engine, re-register rule, deserialize state.
    const engine2 = new WorldRuleEngine();
    engine2.registerRule({
      id: "persist-rule",
      maxFires: 10,
      condition: () => true,
      action: () => {},
    });
    engine2.deserialize(data);
    assert.equal(engine2.getFireCount("persist-rule"), 2);
    assert.equal(engine2.isRuleEnabled("persist-rule"), false);
  });

  test("rule with entity context (event-driven)", () => {
    const world = makeWorld();
    const engine = new WorldRuleEngine();
    const soul = makeSoul("s1", 0, 0);
    world.addEntity(soul);
    let capturedEntity: GameObject | undefined;

    engine.registerRule({
      id: "entity-rule",
      condition: (ctx) => ctx.entity?.id === "s1",
      action: (ctx) => { capturedEntity = ctx.entity; },
    });
    world.addSystem(engine);

    // Step once to bind the world to the engine (tick sets this.world).
    world.step(1 / 60);

    // Evaluate with entity context (simulating event-driven rule).
    engine.evaluate(soul);
    assert.equal(capturedEntity, soul);
  });
});
