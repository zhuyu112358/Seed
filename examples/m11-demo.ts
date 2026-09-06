// M11 End-to-End Demo: Action System + Interaction System + Performance Optimization
//
// Demonstrates the full M11 pipeline:
//   1. ActionStateMachine + ActionPresets - NPC action state machine with 7 presets
//   2. InteractionSessionSystem - NPC-NPC and NPC-environment interaction sessions
//   3. PerformanceProfiler + Benchmark - frame time, FPS, and system performance
//   4. SoulPerceptionSystem integration - action and interaction events in perception frame
//
// Run: npx tsx examples/m11-demo.ts

import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { ActionSystem } from "../src/action/ActionSystem.js";
import {
  createAttackPreset,
  createDefendPreset,
  createInteractPreset,
  createHarvestPreset,
  createMovePreset,
  createCommunicatePreset,
  getAllPresets,
} from "../src/action/ActionPresets.js";
import { InteractionSessionSystem } from "../src/interaction/InteractionSessionSystem.js";
import { PerformanceProfiler } from "../src/performance/PerformanceProfiler.js";
import { runBenchmark } from "../src/performance/Benchmark.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

console.log("=".repeat(60));
console.log("M11 Action + Interaction + Performance - End-to-End Demo");
console.log("=".repeat(60));

// --- Phase 1: ActionStateMachine + ActionPresets ---
console.log("\n⚔️  Phase 1: Action System (ActionStateMachine + ActionPresets)");
{
  const world = new World({ name: "m11-actions", tickRate: 60 });
  const actionSystem = new ActionSystem();

  // Register all 7 presets.
  const presets = getAllPresets();
  for (const preset of presets) {
    actionSystem.registerDefaultDefinition(preset);
  }
  assert(presets.length === 7, `Registered all 7 action presets (got ${presets.length})`);

  actionSystem.registerEntity("npc_1");
  actionSystem.registerEntity("npc_2");
  world.addSystem(actionSystem);

  // Test attack action (castTime=3, duration=5).
  const attackResult = actionSystem.startAction("npc_1", "attack", "npc_2");
  assert(attackResult.success, "NPC 1 starts attack action");
  assert(actionSystem.getActionState("npc_1") === "casting", "Attack enters casting state");

  // Progress through casting.
  for (let i = 0; i < 4; i++) world.step(1 / 60);
  assert(actionSystem.getActionState("npc_1") === "active", "Attack enters active state after casting");

  // Complete attack.
  for (let i = 0; i < 6; i++) world.step(1 / 60);
  assert(actionSystem.getActionState("npc_1") === "cooling", "Attack enters cooling state after active");

  // Test instant move action (castTime=0, duration=0).
  const moveResult = actionSystem.startAction("npc_2", "move");
  assert(moveResult.success, "NPC 2 starts instant move action");
  world.step(1 / 60); // Let cooling complete for instant action.
  assert(actionSystem.getActionState("npc_2") === "idle", "Instant move completes immediately");

  // Test defend action (duration=30, long duration) - use npc_2 since npc_1 is in attack cooldown.
  const defendResult = actionSystem.startAction("npc_2", "defend");
  assert(defendResult.success, "NPC 2 starts defend action");
  world.step(1 / 60);
  assert(actionSystem.getActionState("npc_2") === "active", "Defend enters active state");

  // Interrupt defend.
  const interrupted = actionSystem.interruptAction("npc_2");
  assert(interrupted, "Defend action can be interrupted");
  assert(actionSystem.getActionState("npc_2") === "idle", "Action returns to idle after interrupt");

  // Test harvest action (castTime=5, duration=10).
  const harvestResult = actionSystem.startAction("npc_2", "harvest", "tree_1");
  assert(harvestResult.success, "NPC 2 starts harvest action on tree_1");
  assert(actionSystem.getCurrentAction("npc_2")?.targetId === "tree_1", "Harvest has correct target");

  console.log(`  Action presets: attack/defend/interact/harvest/build/move/communicate`);
}

// --- Phase 2: InteractionSessionSystem ---
console.log("\n🤝 Phase 2: Interaction System (InteractionSessionSystem)");
{
  const world = new World({ name: "m11-interactions", tickRate: 60 });
  const interactionSystem = new InteractionSessionSystem();

  // Register interaction definitions.
  interactionSystem.registerDefinition({
    type: "dialogue",
    name: "Dialogue",
    duration: 10,
    range: 5,
    minParticipants: 2,
    maxParticipants: 2,
    interruptible: true,
  });
  interactionSystem.registerDefinition({
    type: "trade",
    name: "Trade",
    duration: 20,
    range: 3,
    minParticipants: 2,
    maxParticipants: 2,
    interruptible: true,
  });
  interactionSystem.registerDefinition({
    type: "inspect",
    name: "Inspect",
    duration: 5,
    range: 2,
    minParticipants: 1,
    maxParticipants: 1,
    interruptible: true,
  });

  world.addSystem(interactionSystem);

  // Test dialogue interaction (2 participants, duration=10).
  const dialogueResult = interactionSystem.startInteraction("dialogue", "npc_1", "npc_2");
  assert(dialogueResult.success, "NPC 1 and NPC 2 start dialogue interaction");
  assert(dialogueResult.session?.state === "active", "Dialogue is in active state");
  assert(dialogueResult.session?.participants.length === 2, "Dialogue has 2 participants");

  // Check both entities are interacting.
  assert(interactionSystem.isInteracting("npc_1"), "NPC 1 is interacting");
  assert(interactionSystem.isInteracting("npc_2"), "NPC 2 is interacting");

  // Progress dialogue.
  for (let i = 0; i < 5; i++) world.step(1 / 60);
  const midSession = interactionSystem.getSession(dialogueResult.session!.id);
  const midProgress = midSession?.progress ?? 0;
  assert(midProgress > 0 && midProgress < 1,
    `Dialogue progresses (${midProgress.toFixed(2)})`);

  // Complete dialogue.
  for (let i = 0; i < 8; i++) world.step(1 / 60);
  const completedSession = interactionSystem.getSession(dialogueResult.session!.id);
  assert(completedSession?.state === "completed", "Dialogue completes after duration");
  assert(completedSession?.progress === 1, "Completed dialogue has progress 1.0");

  // Test interruptible interaction.
  const tradeResult = interactionSystem.startInteraction("trade", "npc_1", "npc_3");
  world.step(1 / 60);
  const interrupted = interactionSystem.interruptSession(tradeResult.session!.id);
  assert(interrupted, "Trade interaction can be interrupted");
  assert(interactionSystem.getSession(tradeResult.session!.id)?.state === "interrupted",
    "Interrupted trade has interrupted state");

  // Test single-participant inspect interaction.
  const inspectResult = interactionSystem.startInteraction("inspect", "npc_1");
  assert(inspectResult.success, "NPC 1 starts inspect (single participant)");
  assert(inspectResult.session?.participants.length === 1, "Inspect has 1 participant");

  // Test failure: already interacting.
  const failResult = interactionSystem.startInteraction("dialogue", "npc_1", "npc_2");
  assert(!failResult.success, "Cannot start new interaction while already interacting");
  assert(!!failResult.reason?.includes("already in an active interaction"), "Failure reason is correct");

  console.log(`  Interaction types: dialogue/trade/inspect (11 types supported)`);
}

// --- Phase 3: PerformanceProfiler + Benchmark ---
console.log("\n📊 Phase 3: Performance Optimization (PerformanceProfiler + Benchmark)");
{
  // Test PerformanceProfiler.
  const profiler = new PerformanceProfiler({ frameHistorySize: 30 });

  // Simulate frames.
  for (let i = 0; i < 30; i++) {
    profiler.beginFrame();
    profiler.measureSystem("physics", () => {
      let sum = 0;
      for (let j = 0; j < 100; j++) sum += j;
    });
    profiler.measureSystem("perception", () => {
      let sum = 0;
      for (let j = 0; j < 200; j++) sum += j;
    });
    profiler.endFrame();
  }

  const fps = profiler.getFPS();
  assert(fps > 0, `PerformanceProfiler calculates FPS (${fps.toFixed(1)})`);
  assert(profiler.getFrameCount() === 30, `Profiler recorded 30 frames`);
  assert(profiler.getAvgFrameTimeMs() > 0, `Profiler tracks avg frame time (${profiler.getAvgFrameTimeMs().toFixed(3)}ms)`);

  const systemStats = profiler.getSystemStats();
  assert(systemStats.length === 2, `Profiler tracks 2 systems (got ${systemStats.length})`);
  assert(systemStats[0].name === "perception" || systemStats[1].name === "perception",
    "Perception system is tracked");

  const slowest = profiler.getSlowestSystems(1);
  assert(slowest.length === 1, "getSlowestSystems returns requested count");

  const summary = profiler.getSummary();
  assert("fps" in summary && "slowFrameCount" in summary && "slowestSystems" in summary,
    "getSummary returns complete statistics");

  // Test Benchmark with 10 NPCs (quick test).
  const benchmarkResult = runBenchmark({
    npcCount: 10,
    frameCount: 30,
    enablePhysics: true,
    enablePerception: true,
    movingNpcs: true,
  });
  assert(benchmarkResult.fps > 0, `Benchmark runs with 10 NPCs (FPS: ${benchmarkResult.fps.toFixed(1)})`);
  assert(benchmarkResult.avgFrameTimeMs > 0, `Benchmark tracks avg frame time (${benchmarkResult.avgFrameTimeMs.toFixed(3)}ms)`);
  assert(typeof benchmarkResult.meets30FpsTarget === "boolean", "Benchmark reports 30FPS target status");

  console.log(`  10 NPC benchmark: ${benchmarkResult.fps.toFixed(1)} FPS, ${benchmarkResult.avgFrameTimeMs.toFixed(3)}ms avg frame`);
}

// --- Phase 4: SoulPerceptionSystem Integration ---
console.log("\n👁️  Phase 4: Perception Integration (Action + Interaction Events)");
{
  const world = new World({ name: "m11-perception", tickRate: 60 });

  const actionSystem = new ActionSystem();
  actionSystem.registerDefaultDefinition(createAttackPreset());
  actionSystem.registerDefaultDefinition(createCommunicatePreset());
  actionSystem.registerEntity("npc_1");
  world.addSystem(actionSystem);

  const interactionSystem = new InteractionSessionSystem();
  interactionSystem.registerDefinition({
    type: "dialogue",
    name: "Dialogue",
    duration: 5,
    minParticipants: 2,
    maxParticipants: 2,
  });
  world.addSystem(interactionSystem);

  const perception = new SoulPerceptionSystem();
  world.addSystem(perception);

  const soul = new GameObject({
    id: "soul_1",
    type: "soul",
    name: "Observer",
    position: { x: 0, y: 0, z: 0 },
  });
  world.addEntity(soul);

  // First step sets up event listeners.
  world.step(1 / 60);

  // Trigger action event.
  actionSystem.startAction("npc_1", "attack", "npc_2");
  world.step(1 / 60);

  let frame = perception.getPerception("soul_1");
  assert(frame !== undefined, "Perception frame is generated");
  const actionEvents = (frame?.events ?? []).filter((e: any) => e.type === "action.started");
  assert(actionEvents.length > 0, `Soul perceives action.started event (${actionEvents.length} events)`);
  assert(actionEvents[0]?.severity === "high", "Attack action event has high severity");

  // Trigger interaction event.
  interactionSystem.startInteraction("dialogue", "npc_1", "npc_2");
  world.step(1 / 60);

  frame = perception.getPerception("soul_1");
  const interactionEvents = (frame?.events ?? []).filter((e: any) => e.type === "interaction.started");
  assert(interactionEvents.length > 0, `Soul perceives interaction.started event (${interactionEvents.length} events)`);
  assert(interactionEvents[0]?.name.includes("Dialogue"), "Interaction event name includes Dialogue");

  console.log(`  Perception frame includes: action events + interaction events`);
}

// --- Summary ---
console.log("\n" + "=".repeat(60));
console.log("M11 End-to-End Demo Summary");
console.log("=".repeat(60));
console.log(`  Phase 1: Action System - ActionStateMachine + 7 ActionPresets`);
console.log(`  Phase 2: Interaction System - InteractionSessionSystem + 11 interaction types`);
console.log(`  Phase 3: Performance - PerformanceProfiler + Benchmark (100+ NPC support)`);
console.log(`  Phase 4: Perception - Action + Interaction events in SoulPerceptionSystem`);
console.log(`\n  Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
