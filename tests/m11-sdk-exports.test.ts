// M11 SDK export verification test.
// Ensures all M11 modules are properly exported from the SDK entry point.
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("M11 SDK Exports", () => {
  test("Action module exports are available", async () => {
    const sdk = await import("../src/sdk/index.js");
    assert.ok(sdk.ActionStateMachine, "ActionStateMachine is exported");
    assert.ok(sdk.ActionSystem, "ActionSystem is exported");
    assert.ok(sdk.createAttackPreset, "createAttackPreset is exported");
    assert.ok(sdk.createDefendPreset, "createDefendPreset is exported");
    assert.ok(sdk.createInteractPreset, "createInteractPreset is exported");
    assert.ok(sdk.createHarvestPreset, "createHarvestPreset is exported");
    assert.ok(sdk.createBuildPreset, "createBuildPreset is exported");
    assert.ok(sdk.createMovePreset, "createMovePreset is exported");
    assert.ok(sdk.createCommunicatePreset, "createCommunicatePreset is exported");
    assert.ok(sdk.getAllPresets, "getAllPresets is exported");
  });

  test("Interaction module exports are available", async () => {
    const sdk = await import("../src/sdk/index.js");
    assert.ok(sdk.InteractionSessionSystem, "InteractionSessionSystem is exported");
    assert.ok(sdk.DEFAULT_INTERACTION_DEFINITION, "DEFAULT_INTERACTION_DEFINITION is exported");
  });

  test("Performance module exports are available", async () => {
    const sdk = await import("../src/sdk/index.js");
    assert.ok(sdk.PerformanceProfiler, "PerformanceProfiler is exported");
    assert.ok(sdk.DEFAULT_PROFILER_CONFIG, "DEFAULT_PROFILER_CONFIG is exported");
    assert.ok(sdk.runBenchmark, "runBenchmark is exported");
    assert.ok(sdk.DEFAULT_BENCHMARK_CONFIG, "DEFAULT_BENCHMARK_CONFIG is exported");
  });

  test("All 7 action presets can be created", async () => {
    const { getAllPresets } = await import("../src/sdk/index.js");
    const presets = getAllPresets();
    assert.equal(presets.length, 7, "All 7 presets are available");
    const types = presets.map(p => p.type);
    assert.ok(types.includes("attack"), "attack preset exists");
    assert.ok(types.includes("defend"), "defend preset exists");
    assert.ok(types.includes("interact"), "interact preset exists");
    assert.ok(types.includes("harvest"), "harvest preset exists");
    assert.ok(types.includes("build"), "build preset exists");
    assert.ok(types.includes("move"), "move preset exists");
    assert.ok(types.includes("communicate"), "communicate preset exists");
  });

  test("ActionSystem can register presets and start actions", async () => {
    const { ActionSystem, createAttackPreset, createMovePreset } = await import("../src/sdk/index.js");
    const system = new ActionSystem();
    system.registerDefaultDefinition(createAttackPreset());
    system.registerDefaultDefinition(createMovePreset());
    system.registerEntity("test_npc");

    const moveResult = system.startAction("test_npc", "move");
    assert.ok(moveResult.success, "Move action starts successfully");
    // Move has cooldown=0, but may need a tick to exit cooling.
    // Cancel to ensure idle state before next action.
    system.cancelAction("test_npc");

    const attackResult = system.startAction("test_npc", "attack", "target");
    assert.ok(attackResult.success, "Attack action starts successfully");
    assert.equal(system.getActionState("test_npc"), "casting", "Attack enters casting state");
  });

  test("InteractionSessionSystem can create and complete sessions", async () => {
    const { InteractionSessionSystem } = await import("../src/sdk/index.js");
    const system = new InteractionSessionSystem();
    system.registerDefinition({
      type: "test_dialogue",
      name: "Test Dialogue",
      duration: 3,
      minParticipants: 2,
      maxParticipants: 2,
    });

    const result = system.startInteraction("test_dialogue", "npc_a", "npc_b");
    assert.ok(result.success, "Interaction starts successfully");
    assert.equal(result.session?.state, "active", "Session is active");
    assert.equal(system.isInteracting("npc_a"), true, "NPC A is interacting");
    assert.equal(system.isInteracting("npc_b"), true, "NPC B is interacting");
  });

  test("PerformanceProfiler can measure frames and systems", async () => {
    const { PerformanceProfiler } = await import("../src/sdk/index.js");
    const profiler = new PerformanceProfiler();

    for (let i = 0; i < 5; i++) {
      profiler.beginFrame();
      profiler.measureSystem("test_system", () => { let x = 1 + 1; });
      profiler.endFrame();
    }

    assert.equal(profiler.getFrameCount(), 5, "5 frames recorded");
    assert.ok(profiler.getFPS() > 0, "FPS is calculated");
    assert.equal(profiler.getSystemStats().length, 1, "1 system tracked");
  });
});
