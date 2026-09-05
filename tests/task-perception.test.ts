// Tests for task event perception in SoulPerceptionSystem (M6 phase 3).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { TaskSystem } from "../src/task/TaskSystem.js";
import type { TaskDefinition } from "../src/task/TaskTypes.js";

function makeWorld(): World {
  return new World({ name: "task-perception-test", tickRate: 60 });
}

function makeSoul(id: string, x: number, z: number): GameObject {
  return new GameObject({ id, type: "soul", name: id, position: { x, y: 0, z } });
}

const collectWoodTask: TaskDefinition = {
  id: "collect_wood",
  name: "Collect Wood",
  objectives: [
    { id: "wood", type: "collect", target: "wood", requiredAmount: 5 },
  ],
  rewards: { xp: 100 },
};

function findEvent(perception: SoulPerceptionSystem, soulId: string, eventType: string) {
  const frame = perception.getPerception(soulId);
  if (!frame || !frame.events) return null;
  return frame.events.find((e: any) => e.type === eventType) ?? null;
}

describe("Task event perception", () => {
  test("perceives task accepted event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    // Step once to set up perception listeners.
    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.accepted");
    assert.ok(evt, "task.accepted event should be in perception frame");
    assert.equal(evt.severity, "medium");
  });

  test("perceives task progress event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    tasks.updateObjectiveProgress("collect_wood", "soul_1", "wood", 2, world.events);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.progress");
    assert.ok(evt, "task.progress event should be in perception frame");
    assert.equal(evt.severity, "low");
  });

  test("perceives task completed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    tasks.updateObjectiveProgress("collect_wood", "soul_1", "wood", 5, world.events);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.completed");
    assert.ok(evt, "task.completed event should be in perception frame");
    assert.equal(evt.severity, "high");
  });

  test("perceives task failed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    tasks.failTask("collect_wood", "soul_1", "timeout", world.events);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.failed");
    assert.ok(evt, "task.failed event should be in perception frame");
    assert.equal(evt.severity, "high");
  });

  test("perceives task status changed event", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.status_changed");
    assert.ok(evt, "task.status_changed event should be in perception frame");
    assert.equal(evt.severity, "low");
  });

  test("task events contain correct task id in name", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.accepted");
    assert.ok(evt);
    assert.ok(evt.name.includes("collect_wood"), `event name should include task id, got: ${evt.name}`);
  });

  test("multiple task events coexist in perception frame", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    tasks.updateObjectiveProgress("collect_wood", "soul_1", "wood", 3, world.events);
    tasks.updateObjectiveProgress("collect_wood", "soul_1", "wood", 2, world.events);
    world.step(1 / 60);

    const frame = perception.getPerception("soul_1");
    assert.ok(frame);
    const taskEvents = frame.events!.filter((e: any) => e.type.startsWith("task."));
    assert.ok(taskEvents.length >= 3, `should have at least 3 task events, got ${taskEvents.length}`);
  });

  test("stop() cleans up task event listeners", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    perception.stop();

    // After stop, emitting task events should not throw (listeners removed).
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    assert.ok(true, "no throw after stop");
  });

  test("task completed event has high severity", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    tasks.completeTask("collect_wood", "soul_1", world.events);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.completed");
    assert.ok(evt);
    assert.equal(evt.severity, "high");
  });

  test("task failed event includes reason in name", () => {
    const world = makeWorld();
    const perception = new SoulPerceptionSystem();
    const tasks = new TaskSystem();
    const soul = makeSoul("soul_1", 0, 0);
    world.addEntity(soul);
    world.addSystem(perception);
    world.addSystem(tasks);
    tasks.registerTask(collectWoodTask);

    world.step(1 / 60);
    tasks.acceptTask("collect_wood", "soul_1", world.events, world.tick);
    tasks.failTask("collect_wood", "soul_1", "npc_died", world.events);
    world.step(1 / 60);

    const evt = findEvent(perception, "soul_1", "task.failed");
    assert.ok(evt);
    assert.ok(evt.name.includes("npc_died"), `event name should include reason, got: ${evt.name}`);
  });
});
