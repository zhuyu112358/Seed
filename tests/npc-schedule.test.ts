// Tests for M12 Phase 5: NPC Daily Schedule.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ScheduleSystem } from "../src/npc/ScheduleSystem.js";
import {
  DEFAULT_SCHEDULE_CONFIG,
  SCHEDULE_TEMPLATES,
} from "../src/npc/ScheduleTypes.js";
import type { ScheduleActivity } from "../src/npc/ScheduleTypes.js";
import { World } from "../src/engine/World.js";

// Helper: create a simple schedule.
function createSimpleSchedule(): ScheduleActivity[] {
  return [
    { id: "sleep", name: "Sleep", startTime: 0, endTime: 480, priority: 10, actionType: "sleep", location: { x: 0, z: 0 } },
    { id: "work", name: "Work", startTime: 480, endTime: 1020, priority: 8, actionType: "work", location: { x: 10, z: 10 } },
    { id: "leisure", name: "Leisure", startTime: 1020, endTime: 1320, priority: 4, actionType: "idle" },
    { id: "sleep_night", name: "Sleep", startTime: 1320, endTime: 1440, priority: 10, actionType: "sleep", location: { x: 0, z: 0 } },
  ];
}

describe("ScheduleSystem - Schedule Management", () => {
  test("setSchedule stores activities sorted by start time", () => {
    const system = new ScheduleSystem();
    const schedule = createSimpleSchedule();
    // Shuffle to test sorting.
    const shuffled = [...schedule].reverse();
    system.setSchedule("npc_1", shuffled);
    const stored = system.getSchedule("npc_1");
    assert.equal(stored.length, 4);
    assert.equal(stored[0].id, "sleep");
    assert.equal(stored[1].id, "work");
    assert.equal(stored[2].id, "leisure");
    assert.equal(stored[3].id, "sleep_night");
  });

  test("addActivity adds and sorts", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.addActivity("npc_1", {
      id: "lunch", name: "Lunch", startTime: 720, endTime: 780, priority: 6, actionType: "eat",
    });
    const stored = system.getSchedule("npc_1");
    assert.equal(stored.length, 5);
    // Lunch should be between work (480) and leisure (1020).
    assert.equal(stored[2].id, "lunch");
  });

  test("removeActivity removes an activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    assert.equal(system.removeActivity("npc_1", "leisure"), true);
    assert.equal(system.getSchedule("npc_1").length, 3);
  });

  test("removeActivity returns false for unknown activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    assert.equal(system.removeActivity("npc_1", "nonexistent"), false);
  });

  test("updateActivity modifies properties", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.updateActivity("npc_1", "work", { priority: 15, name: "Important Work" });
    const work = system.getSchedule("npc_1").find(a => a.id === "work");
    assert.equal(work?.priority, 15);
    assert.equal(work?.name, "Important Work");
  });

  test("getSchedule returns empty array for unknown entity", () => {
    const system = new ScheduleSystem();
    assert.deepEqual(system.getSchedule("unknown"), []);
  });
});

describe("ScheduleSystem - Activity Lookup", () => {
  test("getActivityAtTime returns correct activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    // 600 (10:00) should be work (480-1020).
    const activity = system.getActivityAtTime("npc_1", 600);
    assert.equal(activity?.id, "work");
  });

  test("getActivityAtTime returns null outside all activities", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", [
      { id: "a", name: "A", startTime: 100, endTime: 200, priority: 1, actionType: "idle" },
    ]);
    assert.equal(system.getActivityAtTime("npc_1", 50), null);
    assert.equal(system.getActivityAtTime("npc_1", 250), null);
  });

  test("getActivityAtTime handles wrap-around activities", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", [
      { id: "night", name: "Night", startTime: 1320, endTime: 360, priority: 1, actionType: "sleep" },
    ]);
    // 1400 (23:20) should be night.
    assert.equal(system.getActivityAtTime("npc_1", 1400)?.id, "night");
    // 100 (01:40) should be night (wrap-around).
    assert.equal(system.getActivityAtTime("npc_1", 100)?.id, "night");
  });

  test("getActivityAtTime returns highest priority on conflict", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", [
      { id: "low", name: "Low", startTime: 0, endTime: 100, priority: 1, actionType: "idle" },
      { id: "high", name: "High", startTime: 0, endTime: 100, priority: 10, actionType: "work" },
    ]);
    assert.equal(system.getActivityAtTime("npc_1", 50)?.id, "high");
  });

  test("getActivityAtTime skips disabled activities", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", [
      { id: "disabled", name: "Disabled", startTime: 0, endTime: 100, priority: 10, actionType: "idle", enabled: false },
      { id: "active", name: "Active", startTime: 0, endTime: 100, priority: 1, actionType: "work" },
    ]);
    assert.equal(system.getActivityAtTime("npc_1", 50)?.id, "active");
  });

  test("getNextActivity returns next activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    // At time 500 (during work), next should be leisure (1020).
    const next = system.getNextActivity("npc_1", 500);
    assert.equal(next?.id, "leisure");
  });

  test("getNextActivity wraps to next day", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    // At time 1400 (after all activities), next should be sleep (0, next day).
    const next = system.getNextActivity("npc_1", 1400);
    assert.equal(next?.id, "sleep");
  });
});

describe("ScheduleSystem - Manual Control", () => {
  test("startActivity sets current activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    assert.equal(system.startActivity("npc_1", "work"), true);
    const current = system.getCurrentActivity("npc_1");
    assert.equal(current?.activity?.id, "work");
    assert.equal(current?.status, "active");
  });

  test("startActivity returns false for unknown activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    assert.equal(system.startActivity("npc_1", "nonexistent"), false);
  });

  test("completeActivity marks activity completed", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.startActivity("npc_1", "work");
    assert.equal(system.completeActivity("npc_1"), true);
    const current = system.getCurrentActivity("npc_1");
    assert.equal(current?.activity, null);
    assert.equal(current?.status, "pending");
  });

  test("completeActivity returns false if no active activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    assert.equal(system.completeActivity("npc_1"), false);
  });

  test("skipActivity skips current activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.startActivity("npc_1", "work");
    assert.equal(system.skipActivity("npc_1"), true);
    assert.equal(system.getCurrentActivity("npc_1")?.activity, null);
  });

  test("attemptCount increments on startActivity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.startActivity("npc_1", "work");
    system.completeActivity("npc_1");
    system.startActivity("npc_1", "leisure");
    assert.equal(system.getCurrentActivity("npc_1")?.attemptCount, 2);
  });
});

describe("ScheduleSystem - Location Preferences", () => {
  test("getCurrentLocation returns activity location", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.startActivity("npc_1", "work");
    const loc = system.getCurrentLocation("npc_1");
    assert.equal(loc?.x, 10);
    assert.equal(loc?.z, 10);
  });

  test("getCurrentLocation returns undefined for activity without location", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.startActivity("npc_1", "leisure");
    assert.equal(system.getCurrentLocation("npc_1"), undefined);
  });

  test("getActivityLocation returns specific activity location", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    const loc = system.getActivityLocation("npc_1", "sleep");
    assert.equal(loc?.x, 0);
    assert.equal(loc?.z, 0);
  });
});

describe("ScheduleSystem - Auto Transition (tick)", () => {
  test("tick transitions activity based on time", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new ScheduleSystem({ dayLength: 1440 });
    world.addSystem(system);
    system.setSchedule("npc_1", createSimpleSchedule());

    // Manually set time to work hours by stepping.
    // The system increments time by 1 each tick (no WorldClock).
    for (let i = 0; i < 500; i++) world.step(1 / 60);

    const current = system.getCurrentActivity("npc_1");
    // At time ~500, should be in work activity (480-1020).
    assert.equal(current?.activity?.id, "work");
  });

  test("tick emits activity_started event", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new ScheduleSystem({ dayLength: 1440 });
    world.addSystem(system);
    system.setSchedule("npc_1", createSimpleSchedule());
    world.step(1 / 60); // Initialize events reference and trigger first transition.

    let eventReceived = false;
    world.events.on("schedule.activity_started", () => { eventReceived = true; });

    // Manually clear current activity, then step to re-trigger transition.
    const current = system.getCurrentActivity("npc_1");
    if (current) {
      current.activity = null;
      current.status = "pending";
    }
    world.step(1 / 60);
    assert.equal(eventReceived, true);
  });

  test("autoTransition disabled prevents transitions", () => {
    const world = new World({ name: "test", tickRate: 60 });
    const system = new ScheduleSystem({ autoTransition: false, dayLength: 1440 });
    world.addSystem(system);
    system.setSchedule("npc_1", createSimpleSchedule());

    for (let i = 0; i < 500; i++) world.step(1 / 60);

    // No auto transition, current should be null.
    assert.equal(system.getCurrentActivity("npc_1")?.activity, null);
  });
});

describe("ScheduleSystem - Templates", () => {
  test("SCHEDULE_TEMPLATES has diurnal template", () => {
    assert.ok(SCHEDULE_TEMPLATES.diurnal);
    assert.ok(SCHEDULE_TEMPLATES.diurnal.length >= 3);
  });

  test("SCHEDULE_TEMPLATES has nocturnal template", () => {
    assert.ok(SCHEDULE_TEMPLATES.nocturnal);
  });

  test("SCHEDULE_TEMPLATES has shift_worker template", () => {
    assert.ok(SCHEDULE_TEMPLATES.shift_worker);
  });

  test("template activities have valid time ranges", () => {
    for (const [name, activities] of Object.entries(SCHEDULE_TEMPLATES)) {
      for (const activity of activities) {
        assert.ok(activity.startTime >= 0 && activity.startTime <= 1440,
          `${name}/${activity.id}: startTime out of range`);
        assert.ok(activity.endTime >= 0 && activity.endTime <= 1440,
          `${name}/${activity.id}: endTime out of range`);
      }
    }
  });

  test("can set schedule from template", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", SCHEDULE_TEMPLATES.diurnal);
    assert.equal(system.getSchedule("npc_1").length, SCHEDULE_TEMPLATES.diurnal.length);
  });
});

describe("ScheduleSystem - Configuration", () => {
  test("DEFAULT_SCHEDULE_CONFIG has expected values", () => {
    assert.equal(DEFAULT_SCHEDULE_CONFIG.autoTransition, true);
    assert.equal(DEFAULT_SCHEDULE_CONFIG.emitEvents, true);
    assert.equal(DEFAULT_SCHEDULE_CONFIG.dayLength, 1440);
    assert.equal(DEFAULT_SCHEDULE_CONFIG.startTolerance, 0);
  });
});

describe("ScheduleSystem - Serialization", () => {
  test("serialize and deserialize preserves schedule and current activity", () => {
    const system = new ScheduleSystem();
    system.setSchedule("npc_1", createSimpleSchedule());
    system.startActivity("npc_1", "work");

    const data = system.serialize();
    const system2 = new ScheduleSystem();
    system2.deserialize(data as Record<string, unknown>);

    assert.equal(system2.getSchedule("npc_1").length, 4);
    assert.equal(system2.getCurrentActivity("npc_1")?.activity?.id, "work");
  });
});
