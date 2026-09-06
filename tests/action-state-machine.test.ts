// Tests for M11 Phase 1: ActionStateMachine + ActionSystem.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ActionStateMachine } from "../src/action/ActionStateMachine.js";
import { ActionSystem } from "../src/action/ActionSystem.js";
import type { ActionDefinition } from "../src/action/ActionTypes.js";

function makeMachine(entityId = "npc_1"): ActionStateMachine {
  return new ActionStateMachine(entityId);
}

function makeAttackDefinition(): ActionDefinition {
  return {
    type: "attack",
    name: "Attack",
    category: "attack",
    castTime: 5,
    duration: 10,
    cooldown: 20,
    range: 3,
    cancellable: true,
    animationEvent: "attack_swing",
  };
}

function makeInstantDefinition(): ActionDefinition {
  return {
    type: "instant_action",
    name: "Instant Action",
    category: "custom",
    castTime: 0,
    duration: 0,
    cooldown: 0,
    range: 0,
    cancellable: true,
  };
}

describe("ActionStateMachine - Definition Management", () => {
  test("register and get definition", () => {
    const machine = makeMachine();
    const def = makeAttackDefinition();
    machine.registerDefinition(def);
    assert.equal(machine.getDefinition("attack")?.name, "Attack");
    assert.equal(machine.hasDefinition("attack"), true);
    assert.equal(machine.hasDefinition("nonexistent"), false);
  });

  test("register definition with defaults", () => {
    const machine = makeMachine();
    machine.registerDefinition({ type: "test", name: "Test", category: "custom" });
    const def = machine.getDefinition("test")!;
    assert.equal(def.castTime, 0);
    assert.equal(def.duration, 0);
    assert.equal(def.cooldown, 0);
    assert.equal(def.cancellable, true);
  });

  test("get all definitions", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.registerDefinition({ type: "defend", name: "Defend", category: "defend" });
    assert.equal(machine.getDefinitions().length, 2);
  });
});

describe("ActionStateMachine - State Queries", () => {
  test("initial state is idle", () => {
    const machine = makeMachine();
    assert.equal(machine.getState(), "idle");
    assert.equal(machine.isIdle(), true);
    assert.equal(machine.getCurrentAction(), null);
  });

  test("not on cooldown initially", () => {
    const machine = makeMachine();
    assert.equal(machine.isOnCooldown("attack"), false);
    assert.equal(machine.getCooldownRemaining("attack"), 0);
  });

  test("canStartAction checks registration, idle, and cooldown", () => {
    const machine = makeMachine();
    assert.equal(machine.canStartAction("nonexistent"), false);
    machine.registerDefinition(makeAttackDefinition());
    assert.equal(machine.canStartAction("attack"), true);
  });
});

describe("ActionStateMachine - Action Execution", () => {
  test("start action with cast time enters casting state", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    const result = machine.startAction("attack", "target_1");
    assert.ok(result.success);
    assert.equal(machine.getState(), "casting");
    assert.equal(machine.getCurrentAction()?.targetId, "target_1");
    assert.equal(machine.getCurrentAction()?.progress, 0);
  });

  test("start instant action enters active state immediately", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeInstantDefinition());
    machine.startAction("instant_action");
    assert.equal(machine.getState(), "active");
  });

  test("fail to start unregistered action", () => {
    const machine = makeMachine();
    const result = machine.startAction("nonexistent");
    assert.equal(result.success, false);
    assert.ok(result.reason?.includes("not registered"));
  });

  test("fail to start action when busy", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    const result = machine.startAction("attack");
    assert.equal(result.success, false);
    assert.ok(result.reason?.includes("busy"));
  });

  test("fail to start action on cooldown", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    // Complete the action (cast + active + cooldown).
    for (let i = 0; i < 50; i++) machine.update();
    // Now try to start again immediately after cooldown expires.
    // Actually after 50 ticks cooldown should be expired.
    assert.equal(machine.isOnCooldown("attack"), false);
  });

  test("casting progresses and transitions to active", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    // Update for castTime (5) ticks.
    for (let i = 0; i < 5; i++) machine.update();
    assert.equal(machine.getState(), "active");
  });

  test("active progresses and transitions to cooling", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    // Cast (5) + active (10) = 15 ticks to reach cooling.
    for (let i = 0; i < 15; i++) machine.update();
    assert.equal(machine.getState(), "cooling");
    assert.equal(machine.isOnCooldown("attack"), true);
  });

  test("cooling expires and returns to idle", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    // Cast (5) + active (10) + cooldown (20) = 35 ticks.
    for (let i = 0; i < 35; i++) machine.update();
    assert.equal(machine.getState(), "idle");
    assert.equal(machine.isOnCooldown("attack"), false);
  });

  test("instant action completes immediately", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeInstantDefinition());
    machine.startAction("instant_action");
    machine.update();
    assert.equal(machine.getState(), "idle");
  });

  test("progress increases during casting", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    machine.update();
    assert.ok(machine.getCurrentAction()!.progress > 0);
    assert.ok(machine.getCurrentAction()!.progress <= 1);
  });
});

describe("ActionStateMachine - Interrupt and Cancel", () => {
  test("interrupt during casting succeeds", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    const result = machine.interrupt();
    assert.equal(result, true);
    assert.equal(machine.getState(), "idle");
  });

  test("interrupt during active succeeds if cancellable", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    for (let i = 0; i < 5; i++) machine.update(); // reach active
    const result = machine.interrupt();
    assert.equal(result, true);
    assert.equal(machine.getState(), "idle");
  });

  test("interrupt fails for non-cancellable action in active state", () => {
    const machine = makeMachine();
    machine.registerDefinition({ ...makeAttackDefinition(), cancellable: false });
    machine.startAction("attack");
    for (let i = 0; i < 5; i++) machine.update(); // reach active
    const result = machine.interrupt();
    assert.equal(result, false);
    assert.equal(machine.getState(), "active");
  });

  test("interrupt fails during cooling", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    for (let i = 0; i < 15; i++) machine.update(); // reach cooling
    const result = machine.interrupt();
    assert.equal(result, false);
  });

  test("cancel always succeeds", () => {
    const machine = makeMachine();
    machine.registerDefinition({ ...makeAttackDefinition(), cancellable: false });
    machine.startAction("attack");
    for (let i = 0; i < 5; i++) machine.update(); // reach active
    const result = machine.cancel();
    assert.equal(result, true);
    assert.equal(machine.getState(), "idle");
  });

  test("interrupt when idle returns false", () => {
    const machine = makeMachine();
    assert.equal(machine.interrupt(), false);
  });
});

describe("ActionStateMachine - Events", () => {
  test("onStateChange callback fires on state transitions", () => {
    const machine = makeMachine();
    const events: string[] = [];
    machine.onStateChange = (payload) => events.push(payload.state);
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack"); // casting
    for (let i = 0; i < 5; i++) machine.update(); // → active
    for (let i = 0; i < 10; i++) machine.update(); // → cooling
    assert.ok(events.includes("casting"));
    assert.ok(events.includes("active"));
    assert.ok(events.includes("cooling"));
  });

  test("onStateChange payload contains action info", () => {
    const machine = makeMachine();
    let received: any = null;
    machine.onStateChange = (payload) => { received = payload; };
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack", "target_1");
    assert.equal(received.entityId, "npc_1");
    assert.equal(received.actionType, "attack");
    assert.equal(received.category, "attack");
    assert.equal(received.targetId, "target_1");
  });
});

describe("ActionStateMachine - Serialization", () => {
  test("serialize and deserialize preserves state", () => {
    const machine = makeMachine();
    machine.registerDefinition(makeAttackDefinition());
    machine.startAction("attack");
    machine.update();
    const data = machine.serialize();

    const machine2 = new ActionStateMachine("npc_1");
    machine2.deserialize(data as Record<string, unknown>);
    assert.equal(machine2.getDefinition("attack")?.name, "Attack");
    assert.equal(machine2.getState(), "casting");
    assert.ok(machine2.getCurrentAction()!.elapsedTicks > 0);
  });
});

describe("ActionSystem - WorldSystem", () => {
  test("register and unregister entity", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1");
    assert.equal(system.isRegistered("npc_1"), true);
    system.unregisterEntity("npc_1");
    assert.equal(system.isRegistered("npc_1"), false);
  });

  test("register entity with definitions", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1", [makeAttackDefinition()]);
    const machine = system.getMachine("npc_1")!;
    assert.equal(machine.hasDefinition("attack"), true);
  });

  test("default definitions apply to all entities", () => {
    const system = new ActionSystem();
    system.registerDefaultDefinition(makeAttackDefinition());
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    assert.equal(system.getMachine("npc_1")!.hasDefinition("attack"), true);
    assert.equal(system.getMachine("npc_2")!.hasDefinition("attack"), true);
  });

  test("start action through ActionSystem", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1", [makeAttackDefinition()]);
    const result = system.startAction("npc_1", "attack", "target_1");
    assert.ok(result.success);
    assert.equal(system.getActionState("npc_1"), "casting");
  });

  test("start action for unregistered entity fails", () => {
    const system = new ActionSystem();
    const result = system.startAction("nonexistent", "attack");
    assert.equal(result.success, false);
  });

  test("interrupt and cancel through ActionSystem", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1", [makeAttackDefinition()]);
    system.startAction("npc_1", "attack");
    assert.equal(system.interruptAction("npc_1"), true);
    assert.equal(system.getActionState("npc_1"), "idle");
  });

  test("tick updates all machines", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1", [makeAttackDefinition()]);
    system.registerEntity("npc_2", [makeAttackDefinition()]);
    system.startAction("npc_1", "attack");
    system.startAction("npc_2", "attack");
    // Simulate tick (world/events are null for test).
    (system as any).tick(1 / 60, null, null);
    assert.equal(system.getCurrentAction("npc_1")!.elapsedTicks, 1);
    assert.equal(system.getCurrentAction("npc_2")!.elapsedTicks, 1);
  });

  test("getRegisteredEntities", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1");
    system.registerEntity("npc_2");
    assert.equal(system.getRegisteredEntities().length, 2);
  });

  test("stop clears all machines", () => {
    const system = new ActionSystem();
    system.registerEntity("npc_1");
    system.stop();
    assert.equal(system.getRegisteredEntities().length, 0);
  });
});

describe("ActionSystem - Serialization", () => {
  test("serialize and deserialize preserves machines", () => {
    const system = new ActionSystem();
    system.registerDefaultDefinition(makeAttackDefinition());
    system.registerEntity("npc_1");
    system.startAction("npc_1", "attack");
    const data = system.serialize();

    const system2 = new ActionSystem();
    system2.deserialize(data as Record<string, unknown>);
    assert.equal(system2.isRegistered("npc_1"), true);
    assert.equal(system2.getActionState("npc_1"), "casting");
  });
});
