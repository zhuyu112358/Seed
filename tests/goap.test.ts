// Tests for M12 Phase 3: GOAP Goal-Oriented Action Planning.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GoapPlanner } from "../src/npc/GoapPlanner.js";
import { GoapSystem } from "../src/npc/GoapSystem.js";
import { DEFAULT_GOAP_CONFIG } from "../src/npc/GoapTypes.js";
import type { GoapGoal, GoapAction, WorldState } from "../src/npc/GoapTypes.js";
import { World } from "../src/engine/World.js";

// Helper: create a simple "get food" scenario.
function createFoodScenario() {
  const goal: GoapGoal = {
    id: "eat",
    name: "Eat food",
    priority: 10,
    targetState: { hasFood: "true", eaten: "true" },
    relevant: true,
  };
  const actions: GoapAction[] = [
    {
      id: "hunt",
      name: "Hunt",
      preconditions: { hasWeapon: "true" },
      effects: { hasFood: "true" },
      cost: 5,
    },
    {
      id: "forage",
      name: "Forage",
      preconditions: {},
      effects: { hasFood: "true" },
      cost: 3,
    },
    {
      id: "eat",
      name: "Eat",
      preconditions: { hasFood: "true" },
      effects: { eaten: "true" },
      cost: 1,
    },
    {
      id: "craft_weapon",
      name: "Craft Weapon",
      preconditions: { hasMaterials: "true" },
      effects: { hasWeapon: "true" },
      cost: 4,
    },
  ];
  return { goal, actions };
}

describe("GoapPlanner - Basic Planning", () => {
  test("finds a simple 2-step plan", () => {
    const planner = new GoapPlanner();
    const { goal, actions } = createFoodScenario();
    const startState: WorldState = {};
    const result = planner.plan(startState, goal, actions);
    assert.equal(result.success, true);
    assert.ok(result.actions.length >= 2, "Should need at least 2 actions");
    // First action should produce hasFood, last should be eat.
    assert.equal(result.actions[result.actions.length - 1].id, "eat");
  });

  test("chooses lower-cost path (forage over hunt+craft)", () => {
    const planner = new GoapPlanner();
    const { goal, actions } = createFoodScenario();
    const startState: WorldState = { hasMaterials: "true" };
    const result = planner.plan(startState, goal, actions);
    assert.equal(result.success, true);
    // forage(3) + eat(1) = 4, hunt(5)+craft(4)+eat(1)=10, should choose forage
    assert.ok(result.actions.some(a => a.id === "forage"), "Should choose forage (lower cost)");
    assert.equal(result.totalCost, 4);
  });

  test("returns empty plan if goal already satisfied", () => {
    const planner = new GoapPlanner();
    const { goal, actions } = createFoodScenario();
    const startState: WorldState = { hasFood: "true", eaten: "true" };
    const result = planner.plan(startState, goal, actions);
    assert.equal(result.success, true);
    assert.equal(result.actions.length, 0);
    assert.equal(result.totalCost, 0);
  });

  test("fails if no actions can achieve goal", () => {
    const planner = new GoapPlanner();
    const goal: GoapGoal = {
      id: "impossible",
      name: "Impossible",
      priority: 1,
      targetState: { magic: "true" },
      relevant: true,
    };
    const actions: GoapAction[] = [
      { id: "a", name: "A", preconditions: {}, effects: { other: "true" }, cost: 1 },
    ];
    const result = planner.plan({}, goal, actions);
    assert.equal(result.success, false);
    assert.ok(result.failureReason);
  });

  test("fails if goal is not relevant", () => {
    const planner = new GoapPlanner();
    const { goal, actions } = createFoodScenario();
    goal.relevant = false;
    const result = planner.plan({}, goal, actions);
    assert.equal(result.success, false);
    assert.equal(result.failureReason, "Goal is not relevant");
  });

  test("fails if no available actions", () => {
    const planner = new GoapPlanner();
    const { goal } = createFoodScenario();
    const result = planner.plan({}, goal, []);
    assert.equal(result.success, false);
  });

  test("skips unavailable actions", () => {
    const planner = new GoapPlanner();
    const { goal, actions } = createFoodScenario();
    // Mark forage as unavailable, should use hunt path if weapon available.
    actions.find(a => a.id === "forage")!.available = false;
    const startState: WorldState = { hasWeapon: "true" };
    const result = planner.plan(startState, goal, actions);
    assert.equal(result.success, true);
    assert.ok(result.actions.some(a => a.id === "hunt"));
    assert.ok(!result.actions.some(a => a.id === "forage"));
  });
});

describe("GoapPlanner - Goal Selection", () => {
  test("selects highest priority relevant goal", () => {
    const planner = new GoapPlanner();
    const goals: GoapGoal[] = [
      { id: "low", name: "Low", priority: 1, targetState: {}, relevant: true },
      { id: "high", name: "High", priority: 10, targetState: {}, relevant: true },
      { id: "mid", name: "Mid", priority: 5, targetState: {}, relevant: true },
    ];
    const selected = planner.selectGoal(goals);
    assert.equal(selected?.id, "high");
  });

  test("ignores irrelevant goals in selection", () => {
    const planner = new GoapPlanner();
    const goals: GoapGoal[] = [
      { id: "irrelevant_high", name: "Irrelevant", priority: 100, targetState: {}, relevant: false },
      { id: "relevant_low", name: "Relevant", priority: 1, targetState: {}, relevant: true },
    ];
    const selected = planner.selectGoal(goals);
    assert.equal(selected?.id, "relevant_low");
  });

  test("returns null if no relevant goals", () => {
    const planner = new GoapPlanner();
    const goals: GoapGoal[] = [
      { id: "a", name: "A", priority: 1, targetState: {}, relevant: false },
    ];
    assert.equal(planner.selectGoal(goals), null);
  });
});

describe("GoapPlanner - State Matching", () => {
  test("stateMatches returns true when all target keys match", () => {
    const planner = new GoapPlanner();
    assert.equal(planner.stateMatches({ a: "1", b: "2" }, { a: "1" }), true);
  });

  test("stateMatches returns false when a target key differs", () => {
    const planner = new GoapPlanner();
    assert.equal(planner.stateMatches({ a: "1" }, { a: "2" }), false);
  });

  test("stateMatches returns true for empty target", () => {
    const planner = new GoapPlanner();
    assert.equal(planner.stateMatches({}, {}), true);
    assert.equal(planner.stateMatches({ a: "1" }, {}), true);
  });
});

describe("GoapPlanner - Configuration", () => {
  test("DEFAULT_GOAP_CONFIG has expected values", () => {
    assert.equal(DEFAULT_GOAP_CONFIG.maxSearchDepth, 20);
    assert.equal(DEFAULT_GOAP_CONFIG.maxNodesExplored, 1000);
    assert.equal(DEFAULT_GOAP_CONFIG.useHeuristic, true);
    assert.equal(DEFAULT_GOAP_CONFIG.heuristicWeight, 1.0);
  });

  test("maxSearchDepth limits plan length", () => {
    const planner = new GoapPlanner({ maxSearchDepth: 1 });
    const { goal, actions } = createFoodScenario();
    const result = planner.plan({}, goal, actions);
    // With depth 1, can only do 1 action - can't achieve 2-state goal
    assert.equal(result.success, false);
  });
});

describe("GoapSystem - Goal and Action Management", () => {
  test("addGoal and getGoals", () => {
    const system = new GoapSystem();
    const goal: GoapGoal = { id: "g1", name: "G1", priority: 5, targetState: {}, relevant: true };
    system.addGoal("npc_1", goal);
    const goals = system.getGoals("npc_1");
    assert.equal(goals.length, 1);
    assert.equal(goals[0].id, "g1");
  });

  test("getCurrentGoal returns highest priority relevant", () => {
    const system = new GoapSystem();
    system.addGoal("npc_1", { id: "low", name: "Low", priority: 1, targetState: {}, relevant: true });
    system.addGoal("npc_1", { id: "high", name: "High", priority: 10, targetState: {}, relevant: true });
    const goal = system.getCurrentGoal("npc_1");
    assert.equal(goal?.id, "high");
  });

  test("updateGoal modifies goal properties", () => {
    const system = new GoapSystem();
    system.addGoal("npc_1", { id: "g1", name: "G1", priority: 1, targetState: {}, relevant: true });
    const updated = system.updateGoal("npc_1", "g1", { priority: 10, relevant: false });
    assert.equal(updated, true);
    assert.equal(system.getGoals("npc_1")[0].priority, 10);
    assert.equal(system.getGoals("npc_1")[0].relevant, false);
  });

  test("removeGoal deletes a goal", () => {
    const system = new GoapSystem();
    system.addGoal("npc_1", { id: "g1", name: "G1", priority: 1, targetState: {}, relevant: true });
    assert.equal(system.removeGoal("npc_1", "g1"), true);
    assert.equal(system.getGoals("npc_1").length, 0);
  });

  test("addAction and getActions", () => {
    const system = new GoapSystem();
    const action: GoapAction = { id: "a1", name: "A1", preconditions: {}, effects: {}, cost: 1 };
    system.addAction("npc_1", action);
    assert.equal(system.getActions("npc_1").length, 1);
  });

  test("updateAction modifies action properties", () => {
    const system = new GoapSystem();
    system.addAction("npc_1", { id: "a1", name: "A1", preconditions: {}, effects: {}, cost: 1 });
    system.updateAction("npc_1", "a1", { cost: 5, available: false });
    assert.equal(system.getActions("npc_1")[0].cost, 5);
    assert.equal(system.getActions("npc_1")[0].available, false);
  });
});

describe("GoapSystem - World State", () => {
  test("setWorldState and getWorldState", () => {
    const system = new GoapSystem();
    system.setWorldState("npc_1", { hunger: "high", location: "forest" });
    const state = system.getWorldState("npc_1");
    assert.equal(state.hunger, "high");
    assert.equal(state.location, "forest");
  });

  test("updateWorldState changes a single key", () => {
    const system = new GoapSystem();
    system.setWorldState("npc_1", { a: "1", b: "2" });
    system.updateWorldState("npc_1", "a", "99");
    const state = system.getWorldState("npc_1");
    assert.equal(state.a, "99");
    assert.equal(state.b, "2");
  });

  test("getWorldState returns empty object for unknown entity", () => {
    const system = new GoapSystem();
    assert.deepEqual(system.getWorldState("unknown"), {});
  });
});

describe("GoapSystem - Planning", () => {
  test("plan finds a valid plan", () => {
    const system = new GoapSystem();
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    system.setWorldState("npc_1", {});
    const result = system.plan("npc_1");
    assert.equal(result.success, true);
    assert.ok(result.actions.length >= 2);
  });

  test("plan returns failure for no relevant goals", () => {
    const system = new GoapSystem();
    const result = system.plan("npc_1");
    assert.equal(result.success, false);
    assert.equal(result.failureReason, "No relevant goals");
  });

  test("planForGoal plans for a specific goal", () => {
    const system = new GoapSystem();
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    const result = system.planForGoal("npc_1", "eat");
    assert.equal(result.success, true);
  });

  test("planForGoal returns failure for unknown goal", () => {
    const system = new GoapSystem();
    const result = system.planForGoal("npc_1", "nonexistent");
    assert.equal(result.success, false);
  });
});

describe("GoapSystem - Plan Execution", () => {
  test("startPlan begins execution", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    system.setWorldState("npc_1", {});

    const result = system.startPlan("npc_1");
    assert.equal(result.success, true);
    const execution = system.getExecution("npc_1");
    assert.ok(execution);
    assert.equal(execution?.status, "executing");
    assert.equal(execution?.currentIndex, 0);
  });

  test("completeCurrentAction advances execution", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    system.setWorldState("npc_1", {});

    system.startPlan("npc_1");
    const before = system.getExecution("npc_1")?.currentIndex ?? 0;
    system.completeCurrentAction("npc_1");
    const after = system.getExecution("npc_1")?.currentIndex ?? 0;
    assert.ok(after > before, "Should advance to next action");
    // World state should have first action's effects applied.
    const state = system.getWorldState("npc_1");
    assert.equal(state.hasFood, "true");
  });

  test("plan completes after all actions", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    system.setWorldState("npc_1", {});

    system.startPlan("npc_1");
    const actionCount = system.getExecution("npc_1")?.actions.length ?? 0;
    for (let i = 0; i < actionCount; i++) {
      system.completeCurrentAction("npc_1");
    }
    assert.equal(system.getExecution("npc_1"), undefined, "Execution should be removed after completion");
    const state = system.getWorldState("npc_1");
    assert.equal(state.hasFood, "true");
    assert.equal(state.eaten, "true");
  });

  test("interruptPlan stops execution", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    system.setWorldState("npc_1", {});

    system.startPlan("npc_1");
    assert.equal(system.interruptPlan("npc_1"), true);
    assert.equal(system.getExecution("npc_1"), undefined);
  });

  test("tick-based action duration", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const goal: GoapGoal = { id: "g", name: "G", priority: 1, targetState: { done: "true" }, relevant: true };
    const actions: GoapAction[] = [
      { id: "a", name: "A", preconditions: {}, effects: { done: "true" }, cost: 1, duration: 3 },
    ];
    system.addGoal("npc_1", goal);
    system.addAction("npc_1", actions[0]);
    system.setWorldState("npc_1", {});

    system.startPlan("npc_1");
    assert.equal(system.getExecution("npc_1")?.currentActionTicksRemaining, 3);
    world.step(1 / 60);
    assert.equal(system.getExecution("npc_1")?.currentActionTicksRemaining, 2);
    world.step(1 / 60);
    world.step(1 / 60);
    // After 3 ticks, action should complete and execution removed.
    assert.equal(system.getExecution("npc_1"), undefined);
  });
});

describe("GoapSystem - Events", () => {
  test("goap.plan_started event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const { goal, actions } = createFoodScenario();
    system.addGoal("npc_1", goal);
    for (const a of actions) system.addAction("npc_1", a);
    system.setWorldState("npc_1", {});
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("goap.plan_started", () => { eventReceived = true; });
    system.startPlan("npc_1");
    assert.equal(eventReceived, true);
  });

  test("goap.action_completed and goap.plan_completed events", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new GoapSystem();
    world.addSystem(system);
    const goal: GoapGoal = { id: "g", name: "G", priority: 1, targetState: { done: "true" }, relevant: true };
    const actions: GoapAction[] = [
      { id: "a", name: "A", preconditions: {}, effects: { done: "true" }, cost: 1 },
    ];
    system.addGoal("npc_1", goal);
    system.addAction("npc_1", actions[0]);
    system.setWorldState("npc_1", {});
    world.step(1 / 60);

    let actionCompleted = false;
    let planCompleted = false;
    world.events.on("goap.action_completed", () => { actionCompleted = true; });
    world.events.on("goap.plan_completed", () => { planCompleted = true; });
    system.startPlan("npc_1");
    system.completeCurrentAction("npc_1");
    assert.equal(actionCompleted, true);
    assert.equal(planCompleted, true);
  });
});

describe("GoapSystem - Serialization", () => {
  test("serialize and deserialize preserves goals, actions, and state", () => {
    const system = new GoapSystem();
    system.addGoal("npc_1", { id: "g1", name: "G1", priority: 5, targetState: { x: "1" }, relevant: true });
    system.addAction("npc_1", { id: "a1", name: "A1", preconditions: {}, effects: { x: "1" }, cost: 2 });
    system.setWorldState("npc_1", { y: "2" });

    const data = system.serialize();
    const system2 = new GoapSystem();
    system2.deserialize(data as Record<string, unknown>);

    assert.equal(system2.getGoals("npc_1").length, 1);
    assert.equal(system2.getActions("npc_1").length, 1);
    assert.equal(system2.getWorldState("npc_1").y, "2");
  });
});
