// Tests for M12 Phase 7: Task Chain Deepening.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TaskChainSystem } from "../src/task/TaskChainSystem.js";
import { DEFAULT_TASK_CHAIN_CONFIG } from "../src/task/TaskChainTypes.js";
import type { TaskChain, TaskChainStep } from "../src/task/TaskChainTypes.js";
import { World } from "../src/engine/World.js";

// Helper: create a simple 3-step chain with linear dependencies.
function createSimpleChain(): TaskChain {
  return {
    id: "chain_1",
    name: "The Quest",
    description: "A simple quest chain",
    status: "available",
    priority: 10,
    participants: ["hero_1"],
    narrative: "The hero must gather, craft, then deliver.",
    steps: [
      { id: "step_1", name: "Gather Materials", description: "Gather wood and stone", dependencies: [], status: "locked", narrative: "The hero ventures into the forest." },
      { id: "step_2", name: "Craft Item", description: "Craft a sword", dependencies: ["step_1"], status: "locked", narrative: "The hero forges the blade." },
      { id: "step_3", name: "Deliver Item", description: "Deliver to the king", dependencies: ["step_2"], status: "locked", narrative: "The hero presents the sword." },
    ],
  };
}

// Helper: create a chain with branching dependencies.
function createBranchingChain(): TaskChain {
  return {
    id: "chain_2",
    name: "Branching Quest",
    description: "A quest with parallel steps",
    status: "available",
    priority: 5,
    participants: ["hero_1"],
    steps: [
      { id: "a", name: "Talk to Elder", description: "", dependencies: [], status: "locked" },
      { id: "b", name: "Find Map", description: "", dependencies: ["a"], status: "locked" },
      { id: "c", name: "Gather Supplies", description: "", dependencies: ["a"], status: "locked" },
      { id: "d", name: "Begin Journey", description: "", dependencies: ["b", "c"], status: "locked" },
    ],
  };
}

describe("TaskChainSystem - Chain Management", () => {
  test("addChain and getChain", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    const chain = system.getChain("chain_1");
    assert.equal(chain?.name, "The Quest");
    assert.equal(chain?.steps.length, 3);
  });

  test("getAllChains returns all chains", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.addChain({ ...createSimpleChain(), id: "chain_2", name: "Second" });
    assert.equal(system.getAllChains().length, 2);
  });

  test("getChainsByStatus filters correctly", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain()); // available
    system.addChain({ ...createSimpleChain(), id: "chain_2", status: "active" });
    assert.equal(system.getChainsByStatus("available").length, 1);
    assert.equal(system.getChainsByStatus("active").length, 1);
  });

  test("startChain sets status to active and unlocks first steps", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    assert.equal(system.startChain("chain_1"), true);
    assert.equal(system.getChain("chain_1")?.status, "active");
    // step_1 has no dependencies, should be unlocked.
    assert.equal(system.getStep("chain_1", "step_1")?.status, "available");
    // step_2 and step_3 still locked.
    assert.equal(system.getStep("chain_1", "step_2")?.status, "locked");
    assert.equal(system.getStep("chain_1", "step_3")?.status, "locked");
  });

  test("startChain returns false if already active", () => {
    const system = new TaskChainSystem();
    system.addChain({ ...createSimpleChain(), status: "active" });
    assert.equal(system.startChain("chain_1"), false);
  });

  test("completeChain sets status to completed", () => {
    const system = new TaskChainSystem();
    system.addChain({ ...createSimpleChain(), status: "active" });
    assert.equal(system.completeChain("chain_1"), true);
    assert.equal(system.getChain("chain_1")?.status, "completed");
  });

  test("failChain sets status to failed", () => {
    const system = new TaskChainSystem();
    system.addChain({ ...createSimpleChain(), status: "active" });
    assert.equal(system.failChain("chain_1", "hero died"), true);
    assert.equal(system.getChain("chain_1")?.status, "failed");
  });
});

describe("TaskChainSystem - Step Management", () => {
  test("getStep returns specific step", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    const step = system.getStep("chain_1", "step_2");
    assert.equal(step?.name, "Craft Item");
  });

  test("getAvailableSteps returns only available steps", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    assert.equal(system.getAvailableSteps("chain_1").length, 1);
    assert.equal(system.getAvailableSteps("chain_1")[0].id, "step_1");
  });

  test("getActiveSteps returns only active steps", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    assert.equal(system.getActiveSteps("chain_1").length, 1);
    assert.equal(system.getActiveSteps("chain_1")[0].id, "step_1");
  });

  test("getCompletedSteps returns only completed steps", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    system.completeStep("chain_1", "step_1");
    assert.equal(system.getCompletedSteps("chain_1").length, 1);
  });

  test("checkDependencies returns satisfied for step with no deps", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    const result = system.checkDependencies("chain_1", "step_1");
    assert.equal(result.satisfied, true);
    assert.equal(result.missingDependencies.length, 0);
  });

  test("checkDependencies returns not satisfied for unmet deps", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    const result = system.checkDependencies("chain_1", "step_2");
    assert.equal(result.satisfied, false);
    assert.ok(result.missingDependencies.includes("step_1"));
  });

  test("startStep transitions available → active", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    const result = system.startStep("chain_1", "step_1");
    assert.equal(result.progressed, true);
    assert.equal(result.newStatus, "active");
    assert.equal(system.getStep("chain_1", "step_1")?.status, "active");
  });

  test("startStep fails if dependencies not met", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    // Manually set step_2 to available to test dependency check (normally it's locked).
    const step2 = system.getStep("chain_1", "step_2");
    if (step2) step2.status = "available";
    // step_2 depends on step_1, should fail with dependencies_not_met.
    const result = system.startStep("chain_1", "step_2");
    assert.equal(result.progressed, false);
    assert.equal(result.reason, "dependencies_not_met");
  });

  test("completeStep transitions active → completed and unlocks dependents", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    const result = system.completeStep("chain_1", "step_1");
    assert.equal(result.progressed, true);
    assert.equal(result.newStatus, "completed");
    // step_2 should now be available (dependency met).
    assert.equal(system.getStep("chain_1", "step_2")?.status, "available");
  });

  test("failStep transitions active → failed", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    const result = system.failStep("chain_1", "step_1", "interrupted");
    assert.equal(result.progressed, true);
    assert.equal(result.newStatus, "failed");
  });

  test("skipStep transitions available → skipped and unlocks dependents", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    const result = system.skipStep("chain_1", "step_1");
    assert.equal(result.progressed, true);
    assert.equal(result.newStatus, "skipped");
    // step_2 should be available (skipped counts as done).
    assert.equal(system.getStep("chain_1", "step_2")?.status, "available");
  });
});

describe("TaskChainSystem - Branching Dependencies", () => {
  test("parallel steps unlock after shared dependency", () => {
    const system = new TaskChainSystem();
    system.addChain(createBranchingChain());
    system.startChain("chain_2");
    // a is available (no deps).
    assert.equal(system.getStep("chain_2", "a")?.status, "available");
    system.startStep("chain_2", "a");
    system.completeStep("chain_2", "a");
    // Both b and c should now be available.
    assert.equal(system.getStep("chain_2", "b")?.status, "available");
    assert.equal(system.getStep("chain_2", "c")?.status, "available");
  });

  test("step with multiple deps unlocks only when all are met", () => {
    const system = new TaskChainSystem();
    system.addChain(createBranchingChain());
    system.startChain("chain_2");
    system.startStep("chain_2", "a");
    system.completeStep("chain_2", "a");
    system.startStep("chain_2", "b");
    system.completeStep("chain_2", "b");
    // d depends on b AND c, c not done yet.
    assert.equal(system.getStep("chain_2", "d")?.status, "locked");
    system.startStep("chain_2", "c");
    system.completeStep("chain_2", "c");
    // Now d should be available.
    assert.equal(system.getStep("chain_2", "d")?.status, "available");
  });
});

describe("TaskChainSystem - Chain Progress", () => {
  test("getChainProgress returns 0 for new chain", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    assert.equal(system.getChainProgress("chain_1"), 0);
  });

  test("getChainProgress returns correct fraction", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    system.completeStep("chain_1", "step_1");
    // 1 of 3 steps done.
    assert.equal(system.getChainProgress("chain_1"), 1 / 3);
  });

  test("getNextStep returns first available step", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    const next = system.getNextStep("chain_1");
    assert.equal(next?.id, "step_1");
  });

  test("autoCompleteChain completes chain when all steps done", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    // Complete all 3 steps.
    system.startStep("chain_1", "step_1");
    system.completeStep("chain_1", "step_1");
    system.startStep("chain_1", "step_2");
    system.completeStep("chain_1", "step_2");
    system.startStep("chain_1", "step_3");
    system.completeStep("chain_1", "step_3");
    // Chain should be auto-completed.
    assert.equal(system.getChain("chain_1")?.status, "completed");
  });
});

describe("TaskChainSystem - Events", () => {
  test("chain_started event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new TaskChainSystem();
    world.addSystem(system);
    system.addChain(createSimpleChain());
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("taskchain.chain_started", () => { eventReceived = true; });
    system.startChain("chain_1");
    assert.equal(eventReceived, true);
  });

  test("step_completed event is emitted", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new TaskChainSystem();
    world.addSystem(system);
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("taskchain.step_completed", () => { eventReceived = true; });
    system.startStep("chain_1", "step_1");
    system.completeStep("chain_1", "step_1");
    assert.equal(eventReceived, true);
  });

  test("step_unlocked event is emitted when dependency met", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new TaskChainSystem();
    world.addSystem(system);
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    world.step(1 / 60);

    let eventReceived = false;
    world.events.on("taskchain.step_unlocked", () => { eventReceived = true; });
    system.startStep("chain_1", "step_1");
    system.completeStep("chain_1", "step_1");
    assert.equal(eventReceived, true);
  });
});

describe("TaskChainSystem - Configuration", () => {
  test("DEFAULT_TASK_CHAIN_CONFIG has expected values", () => {
    assert.equal(DEFAULT_TASK_CHAIN_CONFIG.autoUnlockSteps, true);
    assert.equal(DEFAULT_TASK_CHAIN_CONFIG.autoCompleteChain, true);
    assert.equal(DEFAULT_TASK_CHAIN_CONFIG.emitEvents, true);
    assert.equal(DEFAULT_TASK_CHAIN_CONFIG.failChainOnStepFailure, false);
  });

  test("failChainOnStepFailure=true fails chain on step failure", () => {
    const system = new TaskChainSystem({ failChainOnStepFailure: true });
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    system.failStep("chain_1", "step_1", "test failure");
    assert.equal(system.getChain("chain_1")?.status, "failed");
  });
});

describe("TaskChainSystem - Serialization", () => {
  test("serialize and deserialize preserves chains and step statuses", () => {
    const system = new TaskChainSystem();
    system.addChain(createSimpleChain());
    system.startChain("chain_1");
    system.startStep("chain_1", "step_1");
    system.completeStep("chain_1", "step_1");

    const data = system.serialize();
    const system2 = new TaskChainSystem();
    system2.deserialize(data as Record<string, unknown>);

    const chain = system2.getChain("chain_1");
    assert.equal(chain?.name, "The Quest");
    assert.equal(chain?.status, "active");
    assert.equal(system2.getStep("chain_1", "step_1")?.status, "completed");
    assert.equal(system2.getStep("chain_1", "step_2")?.status, "available");
  });
});
