// M10 End-to-End Demo: Multi-Modal Perception System
//
// Demonstrates the full M10 perception pipeline:
//   1. VisionConeSystem - FOV-based entity visibility filtering
//   2. SoundPerceptionSystem - auditory perception with distance attenuation
//   3. PerceptionFilter - event filtering by type/severity/distance
//   4. AttentionSystem - event prioritization by severity/distance/recency
//   5. SoulPerceptionSystem integration - all four systems in one perception frame
//
// Run: npx tsx examples/m10-demo.ts

import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { VisionConeSystem } from "../src/vision/VisionConeSystem.js";
import { SoundPerceptionSystem } from "../src/sound/SoundPerceptionSystem.js";
import { PerceptionFilter } from "../src/perception/PerceptionFilter.js";
import { AttentionSystem } from "../src/perception/AttentionSystem.js";

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
console.log("M10 Multi-Modal Perception - End-to-End Demo");
console.log("=".repeat(60));

// --- Phase 1: VisionConeSystem ---
console.log("\n📷 Phase 1: VisionConeSystem (FOV Perception)");
{
  const vision = new VisionConeSystem();
  // Observer at origin, facing +x (direction 0), 90-degree FOV, 20m range.
  vision.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 20 }, "obs_1");

  // Entity directly in front (+x).
  assert(vision.isTargetVisible("obs_1", { x: 10, z: 0 }), "Entity directly in front is visible");
  // Entity directly behind (-x).
  assert(!vision.isTargetVisible("obs_1", { x: -10, z: 0 }), "Entity directly behind is NOT visible");
  // Entity to the side (+z, outside 90-degree FOV).
  assert(!vision.isTargetVisible("obs_1", { x: 0, z: 10 }), "Entity to the side is NOT visible");
  // Entity beyond view distance.
  assert(!vision.isTargetVisible("obs_1", { x: 25, z: 0 }), "Entity beyond view distance is NOT visible");

  // 360-degree FOV (omnidirectional).
  vision.setObserverConfig("obs_1", { fovAngle: 360, viewDistance: 20, checkOcclusion: false });
  assert(vision.isTargetVisible("obs_1", { x: 0, z: 10 }), "360-degree FOV: side entity is visible");
  assert(vision.isTargetVisible("obs_1", { x: -10, z: 0 }), "360-degree FOV: behind entity is visible");

  console.log(`  VisionConeSystem: ${vision.getObservers().length} observer, FOV filtering active`);
}

// --- Phase 2: SoundPerceptionSystem ---
console.log("\n🔊 Phase 2: SoundPerceptionSystem (Auditory Perception)");
{
  const sound = new SoundPerceptionSystem();
  // Add a loud alert sound at (10, 0).
  const src = sound.addSource("alert", { x: 10, z: 0 }, 1.0);
  // Add a listener at origin with normal hearing.
  sound.addListener({ x: 0, z: 0 }, 0.05, "listener_1");

  const heard = sound.getHeardSound(src.sourceId!, "listener_1")!;
  assert(heard.audible, "Loud alert at 10m is audible");
  assert(heard.receivedIntensity > 0, `Received intensity > 0 (${heard.receivedIntensity.toFixed(3)})`);
  assert(Math.abs(heard.directionAngle) < 1, `Direction angle ~0 degrees (${heard.directionAngle.toFixed(1)})`);

  // Quiet whisper far away - should be inaudible.
  const quiet = sound.addSource("whisper", { x: 40, z: 0 }, 0.01);
  sound.addListener({ x: 0, z: 0 }, 0.5, "listener_2");
  const heardQuiet = sound.getHeardSound(quiet.sourceId!, "listener_2")!;
  assert(!heardQuiet.audible, "Quiet whisper at 40m with high threshold is NOT audible");

  // Intensity decreases with distance.
  const near = sound.computeReceivedIntensity(1.0, 1);
  const far = sound.computeReceivedIntensity(1.0, 20);
  assert(near > far, `Intensity decreases with distance (near=${near.toFixed(3)}, far=${far.toFixed(3)})`);

  console.log(`  SoundPerceptionSystem: ${sound.sourceCount} sources, ${sound.listenerCount} listeners`);
}

// --- Phase 3: PerceptionFilter ---
console.log("\n🔍 Phase 3: PerceptionFilter (Event Filtering)");
{
  const filter = new PerceptionFilter({ minSeverity: "high", maxDistance: 20 });
  filter.addExcludedType("debug.info");

  const events = [
    { id: "e1", type: "collision.enter", name: "Collision", severity: "high" as const, position: { x: 5, z: 0 }, tick: 100 },
    { id: "e2", type: "weather.rain", name: "Rain", severity: "low" as const, position: { x: 5, z: 0 }, tick: 100 },
    { id: "e3", type: "debug.info", name: "Debug", severity: "critical" as const, position: { x: 5, z: 0 }, tick: 100 },
    { id: "e4", type: "alert.danger", name: "Danger", severity: "critical" as const, position: { x: 50, z: 0 }, tick: 100 },
  ];

  const result = filter.filterEvents(events, { x: 0, z: 0 });
  assert(result.events.length === 1, `Filtered to 1 event (got ${result.events.length})`);
  assert(result.events[0].id === "e1", "Only high-severity, in-range, non-excluded event passes");
  assert(result.result.filteredCount === 3, `3 events filtered out (got ${result.result.filteredCount})`);

  console.log(`  PerceptionFilter: minSeverity=high, maxDistance=20, excludedTypes=[debug.info]`);
}

// --- Phase 4: AttentionSystem ---
console.log("\n⚡ Phase 4: AttentionSystem (Event Prioritization)");
{
  const attention = new AttentionSystem({ severityWeight: 0.8, distanceWeight: 0.2, recencyWeight: 0 });

  const events = [
    { id: "e1", type: "collision.enter", name: "Near collision", severity: "medium" as const, position: { x: 2, z: 0 }, tick: 100 },
    { id: "e2", type: "alert.danger", name: "Far danger", severity: "critical" as const, position: { x: 40, z: 0 }, tick: 100 },
    { id: "e3", type: "weather.rain", name: "Rain", severity: "low" as const, position: { x: 5, z: 0 }, tick: 100 },
  ];

  const prioritized = attention.prioritizeEvents(events, { x: 0, z: 0 }, 100);
  assert(prioritized.length === 3, "All 3 events prioritized");
  assert(prioritized[0].event.id === "e2", `Critical event has highest priority (got ${prioritized[0].event.id})`);
  assert(prioritized[2].event.id === "e3", "Low severity event has lowest priority");
  assert(prioritized[0].priority > prioritized[2].priority, "Priority ordering is correct");

  // Attention decay.
  const decayed = attention.applyAttentionDecay(prioritized, 10);
  assert(decayed[0].priority < prioritized[0].priority, "Attention decay reduces priority over time");

  // Top-N selection.
  const top = attention.getTopEvents(events, { x: 0, z: 0 }, 100, 2);
  assert(top.events.length === 2, `Top-2 selection returns 2 events (got ${top.events.length})`);
  assert(top.result.processedCount === 3, "Processed count = 3");

  console.log(`  AttentionSystem: severityWeight=0.8, top-N selection + decay`);
}

// --- Phase 5: Full Multi-Modal Integration ---
console.log("\n🌐 Phase 5: SoulPerceptionSystem Multi-Modal Integration");
{
  const world = new World({ tickRate: 60 });

  // Initialize all four M10 systems.
  const visionCone = new VisionConeSystem();
  visionCone.addObserver({ x: 0, z: 0 }, 0, { fovAngle: 90, viewDistance: 20 }, "obs_1");

  const soundPerception = new SoundPerceptionSystem();
  soundPerception.addSource("alert", { x: 8, z: 0 }, 1.0);
  soundPerception.addSource("whisper", { x: -5, z: 5 }, 0.2);
  soundPerception.addListener({ x: 0, z: 0 }, 0.05, "listener_1");

  const perceptionFilter = new PerceptionFilter({ minSeverity: "medium" });
  const attentionSystem = new AttentionSystem({ severityWeight: 0.7, distanceWeight: 0.3 });

  // SoulPerceptionSystem with all M10 systems integrated.
  const perception = new SoulPerceptionSystem({
    visionCone,
    visionObserverId: "obs_1",
    soundPerception,
    soundListenerId: "listener_1",
    perceptionFilter,
    attentionSystem,
    viewDistance: 30,
  });
  world.addSystem(perception);

  // Add soul and entities.
  const soul = new GameObject({ id: "soul_1", type: "soul", name: "TestSoul", position: { x: 0, y: 0, z: 0 } });
  const frontEntity = new GameObject({ id: "item_front", type: "item", name: "Front Item", position: { x: 10, y: 0, z: 0 } });
  const backEntity = new GameObject({ id: "item_back", type: "item", name: "Back Item", position: { x: -10, y: 0, z: 0 } });
  const sideEntity = new GameObject({ id: "item_side", type: "item", name: "Side Item", position: { x: 0, y: 0, z: 10 } });

  world.addEntity(soul);
  world.addEntity(frontEntity);
  world.addEntity(backEntity);
  world.addEntity(sideEntity);

  // Step the world.
  world.step(1 / 60);

  // Get perception frame.
  const frame = perception.getPerception("soul_1")!;
  assert(frame !== undefined, "Perception frame generated");

  // FOV filtering: only front entity visible.
  assert(frame.fovFiltered === true, "FOV filtering is active");
  assert(frame.visibleEntities.length === 1, `Only 1 entity visible in FOV (got ${frame.visibleEntities.length})`);
  if (frame.visibleEntities.length > 0) {
    assert(frame.visibleEntities[0].id === "item_front", "Visible entity is the front item");
  }

  // Auditory perception: alert sound heard, whisper may or may not be audible.
  assert(frame.auditoryEvents !== undefined, "Auditory events present");
  if (frame.auditoryEvents) {
    const alert = frame.auditoryEvents.find(e => e.type === "alert");
    assert(alert !== undefined, "Alert sound is in auditory events");
    if (alert) {
      assert(alert.receivedIntensity > 0, `Alert received intensity > 0 (${alert.receivedIntensity})`);
      assert(Math.abs(alert.directionAngle) < 5, `Alert direction ~0 degrees (${alert.directionAngle.toFixed(1)})`);
    }
  }

  // Attention sorting active.
  assert(frame.attentionSorted === true, "Attention sorting is active");

  // Frame structure complete.
  assert(frame.soulId === "1", `Frame soulId correct (got "${frame.soulId}")`);
  assert(Array.isArray(frame.visibleEntities), "visibleEntities is array");
  assert(Array.isArray(frame.events), "events is array");
  assert(Array.isArray(frame.communications), "communications is array");
  assert(frame.environment !== undefined, "environment present");

  console.log(`  PerceptionFrame: ${frame.visibleEntities.length} visible entities, ${frame.auditoryEvents?.length ?? 0} auditory events, FOV filtered, attention sorted`);
}

// --- Summary ---
console.log("\n" + "=".repeat(60));
console.log(`M10 Demo Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
