import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { ConsumptionRule, ConsumptionRuleRegistry } from "../src/resource/ConsumptionRule.js";
import { ConsumptionSystem } from "../src/resource/ConsumptionSystem.js";
import { ResourceInventory } from "../src/resource/ResourceInventory.js";

describe("ConsumptionRule", () => {
  test("creates rule with default values", () => {
    const rule = new ConsumptionRule({
      id: "hunger",
      name: "Hunger",
      resourceTypeId: "food",
    });
    assert.equal(rule.id, "hunger");
    assert.equal(rule.amount, 1);
    assert.equal(rule.intervalTicks, 600);
  });

  test("creates rule with custom values", () => {
    const rule = new ConsumptionRule({
      id: "thirst",
      name: "Thirst",
      resourceTypeId: "water",
      amount: 2,
      intervalTicks: 300,
    });
    assert.equal(rule.amount, 2);
    assert.equal(rule.intervalTicks, 300);
  });
});

describe("ConsumptionRuleRegistry", () => {
  test("registers and retrieves rules", () => {
    const reg = new ConsumptionRuleRegistry();
    const rule = reg.register({ id: "hunger", name: "Hunger", resourceTypeId: "food" });
    assert.equal(reg.size, 1);
    assert.equal(reg.get("hunger"), rule);
    assert.equal(reg.has("hunger"), true);
  });

  test("getAll returns all rules", () => {
    const reg = new ConsumptionRuleRegistry();
    reg.register({ id: "r1", name: "R1", resourceTypeId: "food" });
    reg.register({ id: "r2", name: "R2", resourceTypeId: "water" });
    assert.equal(reg.getAll().length, 2);
  });

  test("remove and clear work", () => {
    const reg = new ConsumptionRuleRegistry();
    reg.register({ id: "r1", name: "R1", resourceTypeId: "food" });
    assert.equal(reg.remove("r1"), true);
    assert.equal(reg.remove("r1"), false);
    reg.register({ id: "r2", name: "R2", resourceTypeId: "water" });
    reg.clear();
    assert.equal(reg.size, 0);
  });
});

describe("ConsumptionSystem", () => {
  function makeWorld(): { world: World; consumption: ConsumptionSystem } {
    const world = new World({ name: "test", tickRate: 60 });
    const consumption = new ConsumptionSystem();
    world.addSystem(consumption);
    return { world, consumption };
  }

  test("consumes resources at interval", () => {
    const { world, consumption } = makeWorld();
    consumption.rules.register({
      id: "hunger", name: "Hunger",
      resourceTypeId: "food", amount: 1, intervalTicks: 5,
    });
    const inv = new ResourceInventory({ initial: { food: 10 } });
    consumption.registerSoul("soul_1", inv);

    // Tick 4 times — no consumption yet (interval=5)
    for (let i = 0; i < 4; i++) world.step(1 / 60);
    assert.equal(inv.getAmount("food"), 10);

    // 5th tick — consumption happens
    world.step(1 / 60);
    assert.equal(inv.getAmount("food"), 9);

    // Another 5 ticks — second consumption
    for (let i = 0; i < 5; i++) world.step(1 / 60);
    assert.equal(inv.getAmount("food"), 8);
  });

  test("emits ResourceConsumedEvent on successful consumption", () => {
    const { world, consumption } = makeWorld();
    consumption.rules.register({
      id: "hunger", name: "Hunger",
      resourceTypeId: "food", amount: 2, intervalTicks: 3,
    });
    const inv = new ResourceInventory({ initial: { food: 10 } });
    consumption.registerSoul("soul_1", inv);

    const consumedEvents: string[] = [];
    world.events.on("resource.consumed", () => consumedEvents.push("consumed"));

    for (let i = 0; i < 3; i++) world.step(1 / 60);

    assert.ok(consumedEvents.length > 0);
    assert.equal(inv.getAmount("food"), 8);
  });

  test("emits ResourceConsumptionFailedEvent when insufficient resources", () => {
    const { world, consumption } = makeWorld();
    consumption.rules.register({
      id: "hunger", name: "Hunger",
      resourceTypeId: "food", amount: 5, intervalTicks: 2,
    });
    const inv = new ResourceInventory({ initial: { food: 3 } });
    consumption.registerSoul("soul_1", inv);

    const failedEvents: string[] = [];
    world.events.on("resource.consumption_failed", () => failedEvents.push("failed"));

    for (let i = 0; i < 2; i++) world.step(1 / 60);

    assert.ok(failedEvents.length > 0);
    // Partial consumption: 3 available, 5 required -> consumes 3, inventory=0
    assert.equal(inv.getAmount("food"), 0);
  });

  test("multiple rules consume independently", () => {
    const { world, consumption } = makeWorld();
    consumption.rules.register({
      id: "hunger", name: "Hunger",
      resourceTypeId: "food", amount: 1, intervalTicks: 3,
    });
    consumption.rules.register({
      id: "thirst", name: "Thirst",
      resourceTypeId: "water", amount: 2, intervalTicks: 5,
    });
    const inv = new ResourceInventory({ initial: { food: 10, water: 10 } });
    consumption.registerSoul("soul_1", inv);

    // 5 ticks: hunger consumes at tick 3 (1 food), thirst consumes at tick 5 (2 water)
    for (let i = 0; i < 5; i++) world.step(1 / 60);

    assert.equal(inv.getAmount("food"), 9);
    assert.equal(inv.getAmount("water"), 8);
  });

  test("unregisterSoul stops consumption", () => {
    const { world, consumption } = makeWorld();
    consumption.rules.register({
      id: "hunger", name: "Hunger",
      resourceTypeId: "food", amount: 1, intervalTicks: 2,
    });
    const inv = new ResourceInventory({ initial: { food: 10 } });
    consumption.registerSoul("soul_1", inv);

    world.step(1 / 60);
    world.step(1 / 60); // consumes 1
    assert.equal(inv.getAmount("food"), 9);

    consumption.unregisterSoul("soul_1");
    for (let i = 0; i < 5; i++) world.step(1 / 60);
    assert.equal(inv.getAmount("food"), 9); // no more consumption
  });

  test("disabled system does not consume", () => {
    const { world, consumption } = makeWorld();
    consumption.rules.register({
      id: "hunger", name: "Hunger",
      resourceTypeId: "food", amount: 1, intervalTicks: 2,
    });
    const inv = new ResourceInventory({ initial: { food: 10 } });
    consumption.registerSoul("soul_1", inv);

    consumption.enabled = false;
    for (let i = 0; i < 10; i++) world.step(1 / 60);
    assert.equal(inv.getAmount("food"), 10);
  });

  test("registerSoul is idempotent", () => {
    const { consumption } = makeWorld();
    const inv = new ResourceInventory();
    consumption.registerSoul("soul_1", inv);
    consumption.registerSoul("soul_1", inv); // duplicate
    assert.equal(consumption.registeredSoulCount, 1);
  });
});
