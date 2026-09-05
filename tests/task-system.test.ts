// Tests for TaskSystem (M6 phase 2).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import {
  TaskSystem,
  TaskInstance,
  TaskDefinition,
} from "../src/task/index.js";

function makeWorld() {
  return new World({ name: "task-test", tickRate: 60 });
}

const collectWoodTask: TaskDefinition = {
  id: "collect_wood",
  name: "Collect Wood",
  description: "Gather 5 wood from the forest",
  objectives: [
    { id: "wood", type: "collect", target: "wood", requiredAmount: 5, description: "Collect 5 wood" },
  ],
  rewards: { xp: 100, gold: 50 },
};

const reachShrineTask: TaskDefinition = {
  id: "reach_shrine",
  name: "Reach the Shrine",
  objectives: [
    { id: "shrine", type: "reach", target: "shrine_01", requiredAmount: 1 },
  ],
  rewards: { xp: 50 },
};

const chainedTask: TaskDefinition = {
  id: "chained",
  name: "Chained Task",
  objectives: [{ id: "obj", type: "custom", target: "x", requiredAmount: 1 }],
  acceptConditions: [{ type: "task_completed", target: "collect_wood" }],
};

const autoAcceptTask: TaskDefinition = {
  id: "auto_accept",
  name: "Auto Accept Task",
  objectives: [{ id: "obj", type: "custom", target: "x", requiredAmount: 1 }],
  autoAccept: true,
};

describe("TaskSystem - Registration", () => {
  test("register and get task definition", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    assert.equal(system.getTaskDefinition("collect_wood")?.name, "Collect Wood");
  });

  test("duplicate registration throws", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    assert.throws(() => system.registerTask(collectWoodTask));
  });

  test("unregister removes task", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    assert.ok(system.unregisterTask("collect_wood"));
    assert.ok(!system.getTaskDefinition("collect_wood"));
  });

  test("getTaskIds returns all registered", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    system.registerTask(reachShrineTask);
    assert.deepEqual(system.getTaskIds().sort(), ["collect_wood", "reach_shrine"]);
  });
});

describe("TaskSystem - Availability", () => {
  test("getAvailableTasks returns tasks with no conditions", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const available = system.getAvailableTasks("agent1");
    assert.equal(available.length, 1);
    assert.equal(available[0].id, "collect_wood");
  });

  test("task with unmet condition not available", () => {
    const system = new TaskSystem();
    system.registerTask(chainedTask);
    const available = system.getAvailableTasks("agent1");
    assert.equal(available.length, 0);
  });

  test("task available after prerequisite completed", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    system.registerTask(chainedTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.completeTask("collect_wood", "agent1", world.events);
    const available = system.getAvailableTasks("agent1");
    assert.ok(available.some((t) => t.id === "chained"));
  });

  test("completed non-repeatable task not available", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.completeTask("collect_wood", "agent1", world.events);
    const available = system.getAvailableTasks("agent1");
    assert.equal(available.length, 0);
  });

  test("repeatable task available after completion", () => {
    const system = new TaskSystem();
    system.registerTask({ ...collectWoodTask, repeatable: true });
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.completeTask("collect_wood", "agent1", world.events);
    const available = system.getAvailableTasks("agent1");
    assert.equal(available.length, 1);
  });
});

describe("TaskSystem - Accept", () => {
  test("accept task returns instance", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    const instance = system.acceptTask("collect_wood", "agent1", world.events, 0);
    assert.ok(instance);
    assert.equal(instance?.taskId, "collect_wood");
    assert.equal(instance?.status, "active");
  });

  test("accept unavailable task returns null", () => {
    const system = new TaskSystem();
    system.registerTask(chainedTask);
    const world = makeWorld();
    const instance = system.acceptTask("chained", "agent1", world.events, 0);
    assert.equal(instance, null);
  });

  test("cannot accept already active task", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    const second = system.acceptTask("collect_wood", "agent1", world.events, 0);
    assert.equal(second, null);
  });

  test("accept emits task.accepted event", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    let accepted = false;
    world.events.on("task.accepted", () => { accepted = true; });
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    assert.ok(accepted);
  });
});

describe("TaskSystem - Progress", () => {
  test("update objective progress", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    const completed = system.updateObjectiveProgress("collect_wood", "agent1", "wood", 3, world.events);
    assert.ok(!completed);
    const instance = system.getActiveTask("collect_wood", "agent1")!;
    assert.equal(instance.objectiveProgress.get("wood")?.currentAmount, 3);
  });

  test("progress capped at required amount", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.updateObjectiveProgress("collect_wood", "agent1", "wood", 10, world.events);
    const instance = system.getActiveTask("collect_wood", "agent1")!;
    assert.equal(instance.objectiveProgress.get("wood")?.currentAmount, 5);
  });

  test("task completes when all objectives done", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    const completed = system.updateObjectiveProgress("collect_wood", "agent1", "wood", 5, world.events);
    assert.ok(completed);
    const instance = system.getActiveTask("collect_wood", "agent1")!;
    assert.equal(instance.status, "completed");
  });

  test("completion emits task.completed event", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    let completedEvent = false;
    world.events.on("task.completed", () => { completedEvent = true; });
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.updateObjectiveProgress("collect_wood", "agent1", "wood", 5, world.events);
    assert.ok(completedEvent);
  });

  test("progress emits task.progress event", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    let progressEvent = false;
    world.events.on("task.progress", () => { progressEvent = true; });
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.updateObjectiveProgress("collect_wood", "agent1", "wood", 2, world.events);
    assert.ok(progressEvent);
  });

  test("getProgress returns correct percentage", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    const instance = system.getActiveTask("collect_wood", "agent1")!;
    assert.equal(instance.getProgress(), 0);
    system.updateObjectiveProgress("collect_wood", "agent1", "wood", 5, world.events);
    assert.equal(instance.getProgress(), 1);
  });
});

describe("TaskSystem - Fail and Abandon", () => {
  test("fail task changes status", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    const failed = system.failTask("collect_wood", "agent1", "timeout", world.events);
    assert.ok(failed);
    const instance = system.getActiveTask("collect_wood", "agent1")!;
    assert.equal(instance.status, "failed");
  });

  test("fail emits task.failed event", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    let failedEvent = false;
    world.events.on("task.failed", () => { failedEvent = true; });
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.failTask("collect_wood", "agent1", "timeout", world.events);
    assert.ok(failedEvent);
  });

  test("abandon task removes it", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    assert.ok(system.abandonTask("collect_wood", "agent1"));
    assert.ok(!system.getActiveTask("collect_wood", "agent1"));
  });

  test("abandoned task can be re-accepted", () => {
    const system = new TaskSystem();
    system.registerTask(collectWoodTask);
    const world = makeWorld();
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    system.abandonTask("collect_wood", "agent1");
    const instance = system.acceptTask("collect_wood", "agent1", world.events, 0);
    assert.ok(instance);
  });
});

describe("TaskSystem - Multi-objective", () => {
  test("task with multiple objectives completes only when all done", () => {
    const multiTask: TaskDefinition = {
      id: "multi",
      name: "Multi Objective",
      objectives: [
        { id: "wood", type: "collect", target: "wood", requiredAmount: 3 },
        { id: "stone", type: "collect", target: "stone", requiredAmount: 2 },
      ],
    };
    const system = new TaskSystem();
    system.registerTask(multiTask);
    const world = makeWorld();
    system.acceptTask("multi", "agent1", world.events, 0);
    system.updateObjectiveProgress("multi", "agent1", "wood", 3, world.events);
    let instance = system.getActiveTask("multi", "agent1")!;
    assert.equal(instance.status, "active");
    system.updateObjectiveProgress("multi", "agent1", "stone", 2, world.events);
    instance = system.getActiveTask("multi", "agent1")!;
    assert.equal(instance.status, "completed");
  });
});

describe("TaskSystem - Auto Accept", () => {
  test("autoAccept task accepted on tick", () => {
    const system = new TaskSystem();
    system.registerTask(autoAcceptTask);
    const world = makeWorld();
    world.addSystem(system);
    // Need at least one active instance for the agent to be tracked
    system.registerTask(collectWoodTask);
    system.acceptTask("collect_wood", "agent1", world.events, 0);
    world.step(1 / 60);
    assert.ok(system.getActiveTask("auto_accept", "agent1"));
  });
});

describe("TaskInstance", () => {
  test("serialize preserves state", () => {
    const instance = new TaskInstance("task1", "agent1", collectWoodTask.objectives, 0);
    const data = instance.serialize();
    assert.equal(data.taskId, "task1");
    assert.equal(data.agentId, "agent1");
    assert.equal(data.status, "active");
  });
});
