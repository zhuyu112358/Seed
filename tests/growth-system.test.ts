import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GrowthRule, GrowthRuleRegistry } from "../src/resource/GrowthRule.js";
import { GrowthSystem } from "../src/resource/GrowthSystem.js";
import { HarvestCompleteEvent } from "../src/event/Event.js";

describe("GrowthRule", () => {
  test("creates rule with default values", () => {
    const rule = new GrowthRule({
      id: "woodcutting",
      name: "Woodcutting",
      triggerEventType: "resource.harvest.complete",
    });
    assert.equal(rule.xpPerEvent, 10);
    assert.equal(rule.baseXP, 100);
    assert.equal(rule.growthMultiplier, 1.5);
    assert.equal(rule.maxLevel, 100);
  });

  test("xpForLevel calculates geometric curve", () => {
    const rule = new GrowthRule({
      id: "test", name: "Test",
      triggerEventType: "test",
      baseXP: 100, growthMultiplier: 2,
    });
    assert.equal(rule.xpForLevel(1), 0);
    assert.equal(rule.xpForLevel(2), 100);
    assert.equal(rule.xpForLevel(3), 300); // 100 + 200
    assert.equal(rule.xpForLevel(4), 700); // 100 + 200 + 400
  });

  test("xpForNextLevel returns incremental XP", () => {
    const rule = new GrowthRule({
      id: "test", name: "Test",
      triggerEventType: "test",
      baseXP: 100, growthMultiplier: 2,
    });
    assert.equal(rule.xpForNextLevel(1), 100);
    assert.equal(rule.xpForNextLevel(2), 200);
    assert.equal(rule.xpForNextLevel(3), 400);
  });

  test("levelFromXP calculates correct level", () => {
    const rule = new GrowthRule({
      id: "test", name: "Test",
      triggerEventType: "test",
      baseXP: 100, growthMultiplier: 2,
    });
    assert.equal(rule.levelFromXP(0), 1);
    assert.equal(rule.levelFromXP(99), 1);
    assert.equal(rule.levelFromXP(100), 2);
    assert.equal(rule.levelFromXP(299), 2);
    assert.equal(rule.levelFromXP(300), 3);
  });

  test("linear curve when multiplier is 1", () => {
    const rule = new GrowthRule({
      id: "test", name: "Test",
      triggerEventType: "test",
      baseXP: 100, growthMultiplier: 1,
    });
    assert.equal(rule.xpForLevel(3), 200); // 100 * 2
    assert.equal(rule.xpForLevel(5), 400); // 100 * 4
  });
});

describe("GrowthRuleRegistry", () => {
  test("registers and retrieves rules", () => {
    const reg = new GrowthRuleRegistry();
    const rule = reg.register({ id: "wc", name: "WC", triggerEventType: "e1" });
    assert.equal(reg.size, 1);
    assert.equal(reg.get("wc"), rule);
  });

  test("getByTriggerEventType filters rules", () => {
    const reg = new GrowthRuleRegistry();
    reg.register({ id: "r1", name: "R1", triggerEventType: "e1" });
    reg.register({ id: "r2", name: "R2", triggerEventType: "e1" });
    reg.register({ id: "r3", name: "R3", triggerEventType: "e2" });
    assert.equal(reg.getByTriggerEventType("e1").length, 2);
    assert.equal(reg.getByTriggerEventType("e2").length, 1);
    assert.equal(reg.getByTriggerEventType("e3").length, 0);
  });

  test("remove and clear work", () => {
    const reg = new GrowthRuleRegistry();
    reg.register({ id: "r1", name: "R1", triggerEventType: "e1" });
    assert.equal(reg.remove("r1"), true);
    assert.equal(reg.remove("r1"), false);
    reg.register({ id: "r2", name: "R2", triggerEventType: "e1" });
    reg.clear();
    assert.equal(reg.size, 0);
  });
});

describe("GrowthSystem", () => {
  function makeWorld(): { world: World; growth: GrowthSystem } {
    const world = new World({ name: "test", tickRate: 60 });
    const growth = new GrowthSystem();
    world.addSystem(growth);
    return { world, growth };
  }

  test("grantXP increases XP and level", () => {
    const { world, growth } = makeWorld();
    growth.rules.register({
      id: "wc", name: "Woodcutting",
      triggerEventType: "resource.harvest.complete",
      xpPerEvent: 50, baseXP: 100, growthMultiplier: 1.5,
    });
    growth.registerSoul("soul_1");

    assert.equal(growth.getXP("soul_1", "wc"), 0);
    assert.equal(growth.getLevel("soul_1", "wc"), 1);

    growth.grantXP("soul_1", "wc", 50, world.events);
    assert.equal(growth.getXP("soul_1", "wc"), 50);
    assert.equal(growth.getLevel("soul_1", "wc"), 1);

    growth.grantXP("soul_1", "wc", 50, world.events);
    assert.equal(growth.getXP("soul_1", "wc"), 100);
    assert.equal(growth.getLevel("soul_1", "wc"), 2); // level up!
  });

  test("emits XPGainedEvent and LevelUpEvent", () => {
    const { world, growth } = makeWorld();
    growth.rules.register({
      id: "wc", name: "Woodcutting",
      triggerEventType: "test",
      xpPerEvent: 100, baseXP: 100, growthMultiplier: 2,
    });
    growth.registerSoul("soul_1");

    const xpEvents: string[] = [];
    const levelEvents: string[] = [];
    world.events.on("growth.xp_gained", () => xpEvents.push("xp"));
    world.events.on("growth.level_up", () => levelEvents.push("level"));

    growth.grantXP("soul_1", "wc", 100, world.events);

    assert.ok(xpEvents.length > 0);
    assert.ok(levelEvents.length > 0);
    assert.equal(growth.getLevel("soul_1", "wc"), 2);
  });

  test("listens to trigger events and grants XP automatically", () => {
    const { world, growth } = makeWorld();
    growth.rules.register({
      id: "wc", name: "Woodcutting",
      triggerEventType: "resource.harvest.complete",
      soulIdField: "harvesterId",
      xpPerEvent: 25, baseXP: 100, growthMultiplier: 2,
    });
    growth.registerSoul("soul_1");

    // Step once to set up event listeners
    world.step(1 / 60);

    // Emit a harvest complete event (simulating HarvestSystem)
    world.events.emit(new HarvestCompleteEvent("soul_1", "node_1", "wood", 1, 9));

    assert.equal(growth.getXP("soul_1", "wc"), 25);
  });

  test("grantXP fails for unregistered soul", () => {
    const { world, growth } = makeWorld();
    growth.rules.register({ id: "wc", name: "WC", triggerEventType: "test" });
    const result = growth.grantXP("unknown_soul", "wc", 10, world.events);
    assert.equal(result, false);
  });

  test("grantXP fails for nonexistent rule", () => {
    const { growth } = makeWorld();
    growth.registerSoul("soul_1");
    const result = growth.grantXP("soul_1", "nonexistent", 10);
    assert.equal(result, false);
  });

  test("disabled system does not grant XP", () => {
    const { world, growth } = makeWorld();
    growth.rules.register({ id: "wc", name: "WC", triggerEventType: "test" });
    growth.registerSoul("soul_1");
    growth.enabled = false;
    const result = growth.grantXP("soul_1", "wc", 10, world.events);
    assert.equal(result, false);
    assert.equal(growth.getXP("soul_1", "wc"), 0);
  });

  test("unregisterSoul removes growth state", () => {
    const { growth } = makeWorld();
    growth.registerSoul("soul_1");
    assert.equal(growth.isRegistered("soul_1"), true);
    growth.unregisterSoul("soul_1");
    assert.equal(growth.isRegistered("soul_1"), false);
  });

  test("maxLevel prevents further leveling", () => {
    const { world, growth } = makeWorld();
    growth.rules.register({
      id: "wc", name: "WC",
      triggerEventType: "test",
      xpPerEvent: 1000, baseXP: 100, growthMultiplier: 1.1, maxLevel: 3,
    });
    growth.registerSoul("soul_1");

    // Grant enough XP to reach max level
    growth.grantXP("soul_1", "wc", 10000, world.events);
    assert.equal(growth.getLevel("soul_1", "wc"), 3);

    // Further XP should not increase level
    const xpBefore = growth.getXP("soul_1", "wc");
    const result = growth.grantXP("soul_1", "wc", 100, world.events);
    assert.equal(result, false);
    assert.equal(growth.getXP("soul_1", "wc"), xpBefore);
  });
});
