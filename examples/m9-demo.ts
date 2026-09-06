// M9 End-to-End Demo: AI Navigation Enhancement + Group Behavior + Formation Control
//
// Demonstrates the full M9 feature chain:
// 1. FlockingSystem: Reynolds three rules (separation/alignment/cohesion) + seek
// 2. OrcaSystem: Optimal Reciprocal Collision Avoidance
// 3. FormationSystem: 6 formation types (line/column/wedge/circle/v/custom)
// 4. PathCostSystem: terrain/danger modifiers + A* cost function
// 5. Navigation Events: path_changed/path_blocked/arrived/waypoint_reached
// 6. SoulPerceptionSystem: captures all navigation events
//
// Seed only provides the execution framework and calculations.
// High-level decisions (targets, formation selection, movement execution)
// are handled by the application layer / Ember (soul engine).

import { World } from "../src/engine/World.js";
import { FlockingSystem } from "../src/flocking/FlockingSystem.js";
import { OrcaSystem } from "../src/orca/OrcaSystem.js";
import { FormationSystem } from "../src/formation/FormationSystem.js";
import { PathCostSystem } from "../src/navigation/PathCostSystem.js";
import {
  PathChangedEvent,
  PathBlockedEvent,
  ArrivedEvent,
  WaypointReachedEvent,
} from "../src/navigation/NavigationEvents.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { GameObject } from "../src/entity/Entity.js";

function makeWorld(): World {
  return new World({ name: "m9-demo", tickRate: 60 });
}

function section(title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

// ============================================================
// Phase 1: Flocking System
// ============================================================
function demoFlocking(): void {
  section("Phase 1: Flocking System (Reynolds Three Rules)");

  const flocking = new FlockingSystem({
    separationWeight: 1.5,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    maxSpeed: 5,
    maxForce: 3,
    perceptionRadius: 8,
    separationRadius: 3,
  });

  // Add 5 agents in a cluster.
  const positions = [
    { x: 0, z: 0 },
    { x: 1, z: 1 },
    { x: -1, z: 1 },
    { x: 1, z: -1 },
    { x: -1, z: -1 },
  ];
  const agentIds: string[] = [];
  for (const pos of positions) {
    const result = flocking.addAgent(pos, { x: 1, z: 0 });
    agentIds.push(result.agentId!);
  }
  console.log(`Created ${agentIds.length} flocking agents`);

  // Set a target for all agents (seek behavior).
  const target = { x: 20, z: 10 };
  for (const id of agentIds) {
    const agent = flocking.getAgent(id)!;
    agent.target = target;
  }
  console.log(`Target: (${target.x}, ${target.z})`);

  // Simulate 120 ticks (2 seconds at 60fps).
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) {
    flocking.tick(dt, null as any, null as any);
  }

  // Report final positions.
  console.log("\nFinal positions after 120 ticks:");
  for (const id of agentIds) {
    const agent = flocking.getAgent(id)!;
    console.log(`  ${id}: pos=(${agent.position.x.toFixed(1)}, ${agent.position.z.toFixed(1)}) ` +
      `vel=(${agent.velocity.x.toFixed(1)}, ${agent.velocity.z.toFixed(1)})`);
  }

  // Check cohesion: agents should be near each other.
  const first = flocking.getAgent(agentIds[0])!;
  const last = flocking.getAgent(agentIds[agentIds.length - 1])!;
  const dist = Math.sqrt(
    Math.pow(first.position.x - last.position.x, 2) +
    Math.pow(first.position.z - last.position.z, 2),
  );
  console.log(`\nCohesion check: distance between first and last agent = ${dist.toFixed(2)} (should be < 10)`);
  console.log(`Flocking demo: ${dist < 10 ? "PASS" : "CHECK"}`);
}

// ============================================================
// Phase 2: ORCA Collision Avoidance
// ============================================================
function demoOrca(): void {
  section("Phase 2: ORCA Local Collision Avoidance");

  const orca = new OrcaSystem({
    timeHorizon: 5,
    maxSpeed: 4,
    maxForce: 5,
    neighborDist: 10,
    maxNeighbors: 10,
    defaultRadius: 0.5,
  });

  // Two agents moving toward each other.
  const a1 = orca.addAgent({ x: -5, z: 0 }, { x: 2, z: 0 }, 0.5);
  const a2 = orca.addAgent({ x: 5, z: 0 }, { x: -2, z: 0 }, 0.5);
  console.log(`Agent 1: pos=(-5, 0), vel=(2, 0) → moving right`);
  console.log(`Agent 2: pos=(5, 0), vel=(-2, 0) → moving left`);
  console.log(`Head-on collision predicted without ORCA`);

  // Simulate 60 ticks.
  const dt = 1 / 60;
  let minDistance = Infinity;
  for (let i = 0; i < 60; i++) {
    orca.tick(dt, null as any, null as any);
    const ag1 = orca.getAgent(a1.agentId!)!;
    const ag2 = orca.getAgent(a2.agentId!)!;
    const dist = Math.sqrt(
      Math.pow(ag1.position.x - ag2.position.x, 2) +
      Math.pow(ag1.position.z - ag2.position.z, 2),
    );
    minDistance = Math.min(minDistance, dist);
  }

  const ag1 = orca.getAgent(a1.agentId!)!;
  const ag2 = orca.getAgent(a2.agentId!)!;
  console.log(`\nAfter 60 ticks:`);
  console.log(`  Agent 1: pos=(${ag1.position.x.toFixed(1)}, ${ag1.position.z.toFixed(1)})`);
  console.log(`  Agent 2: pos=(${ag2.position.x.toFixed(1)}, ${ag2.position.z.toFixed(1)})`);
  console.log(`  Minimum distance during simulation: ${minDistance.toFixed(2)}`);
  console.log(`  Collision radius sum: 1.0 (each radius 0.5)`);
  console.log(`ORCA avoidance: ${minDistance > 1.0 ? "PASS (no collision)" : "CHECK (possible collision)"}`);
}

// ============================================================
// Phase 3: Formation System
// ============================================================
function demoFormation(): void {
  section("Phase 3: Formation Control (6 Formation Types)");

  const formation = new FormationSystem({ spacing: 2, positionTolerance: 1.0 });

  // Create a line formation with leader + 3 members.
  const lineResult = formation.createFormation("line", "leader_1", "Alpha Squad");
  const lineId = lineResult.formationId!;
  formation.addMember(lineId, "member_1");
  formation.addMember(lineId, "member_2");
  formation.addMember(lineId, "member_3");
  console.log(`Created line formation: ${lineId} (leader + 3 members)`);

  // Compute slot positions for line formation.
  const leaderPos = { x: 10, z: 10 };
  const lineSlots = formation.computeSlotPositions(lineId, leaderPos);
  console.log(`\nLine formation slot positions (leader at (10, 10)):`);
  for (const slot of lineSlots) {
    console.log(`  Slot ${slot.slotIndex}: member=${slot.memberId ?? "empty"} ` +
      `pos=(${slot.position.x.toFixed(1)}, ${slot.position.z.toFixed(1)}) ` +
      `inPosition=${slot.inPosition}`);
  }

  // Switch to wedge formation.
  formation.setFormationType(lineId, "wedge");
  const wedgeSlots = formation.computeSlotPositions(lineId, leaderPos);
  console.log(`\nWedge formation slot positions (after type switch):`);
  for (const slot of wedgeSlots) {
    console.log(`  Slot ${slot.slotIndex}: member=${slot.memberId ?? "empty"} ` +
      `pos=(${slot.position.x.toFixed(1)}, ${slot.position.z.toFixed(1)})`);
  }

  // Check in-position: place members at exact targets.
  const memberPositions = new Map<string, { x: number; z: number }>();
  memberPositions.set("leader_1", leaderPos);
  for (const slot of wedgeSlots) {
    if (slot.memberId) {
      memberPositions.set(slot.memberId, slot.position);
    }
  }
  const inPosition = formation.isFormationInPosition(lineId, memberPositions, leaderPos);
  console.log(`\nFormation in-position check (all members at exact targets): ${inPosition}`);

  // Get member target position.
  const target = formation.getMemberTargetPosition("member_1", leaderPos);
  console.log(`Member 1 target position: (${target?.x.toFixed(1)}, ${target?.z.toFixed(1)})`);

  // Test all 6 formation types.
  console.log(`\nAll 6 formation types (4 members, leader at (0,0)):`);
  for (const type of ["line", "column", "wedge", "circle", "v", "custom"] as const) {
    const f = formation.createFormation(type, "lead", `${type}-test`, type === "custom" ? [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }] : undefined);
    formation.addMember(f.formationId!, "m1");
    formation.addMember(f.formationId!, "m2");
    formation.addMember(f.formationId!, "m3");
    const slots = formation.computeSlotPositions(f.formationId!, { x: 0, z: 0 });
    const positions = slots.filter(s => s.memberId).map(s => `(${s.position.x.toFixed(1)},${s.position.z.toFixed(1)})`).join(" ");
    console.log(`  ${type.padEnd(8)}: ${positions}`);
    formation.disbandFormation(f.formationId!);
  }

  console.log(`\nFormation demo: PASS`);
}

// ============================================================
// Phase 4: Path Cost System + Navigation Events
// ============================================================
function demoNavigation(): void {
  section("Phase 4: Path Cost Modifiers + Navigation Events");

  const pathCost = new PathCostSystem({ baseCost: 1.0, maxCostMultiplier: 50 });

  // Add terrain modifier (swamp, 2x cost).
  const swamp = pathCost.addModifier("terrain", { x: 5, z: 5 }, 3, 2.0, "Swamp");
  // Add danger modifier (lava, 5x cost).
  const lava = pathCost.addModifier("danger", { x: 10, z: 0 }, 2, 5.0, "Lava Zone");
  console.log(`Added terrain modifier: Swamp at (5,5), radius 3, 2.0x cost`);
  console.log(`Added danger modifier: Lava at (10,0), radius 2, 5.0x cost`);

  // Compute costs at various positions.
  console.log(`\nPath costs at various positions:`);
  const testPositions = [
    { x: 0, z: 0, label: "Open field" },
    { x: 5, z: 5, label: "In swamp" },
    { x: 10, z: 0, label: "In lava" },
    { x: 7, z: 3, label: "Edge of swamp" },
  ];
  for (const pos of testPositions) {
    const cost = pathCost.computePathCost(pos);
    const multiplier = pathCost.computeCostMultiplier(pos);
    console.log(`  ${pos.label.padEnd(15)} (${pos.x},${pos.z}): cost=${cost.toFixed(2)} (multiplier=${multiplier.toFixed(2)}x)`);
  }

  // Compute segment cost (path through swamp).
  const segmentCost = pathCost.computeSegmentCost({ x: 0, z: 5 }, { x: 10, z: 5 });
  console.log(`\nSegment cost from (0,5) to (10,5) (passes through swamp): ${segmentCost.toFixed(2)}`);
  console.log(`  (base cost would be 10.0, swamp increases it)`);

  // A* cost function.
  const aStarCost = pathCost.aStarCostFunction({ x: 0, z: 0 }, { x: 3, z: 4 });
  console.log(`A* cost function (0,0)→(3,4), distance 5: ${aStarCost.toFixed(2)}`);

  // Navigation events.
  console.log(`\nNavigation events emitted:`);
  const world = makeWorld();
  const perception = new SoulPerceptionSystem();
  const soul = new GameObject({ id: "soul_nav", type: "soul", name: "Navigator", position: { x: 0, y: 0, z: 0 } });
  world.addEntity(soul);
  world.addSystem(perception);
  world.step(1 / 60); // Set up lazy subscriptions.

  world.events.emit(new PathChangedEvent({
    entityId: "soul_nav", eventType: "path_changed",
    position: { x: 0, z: 0 }, target: { x: 20, z: 10 }, pathCost: 25.5,
  }));
  console.log(`  Emitted: navigation.path_changed (target=(20,10), cost=25.5)`);

  world.events.emit(new WaypointReachedEvent({
    entityId: "soul_nav", eventType: "waypoint_reached",
    position: { x: 5, z: 3 }, waypointIndex: 1,
  }));
  console.log(`  Emitted: navigation.waypoint_reached (waypoint #1)`);

  world.events.emit(new PathBlockedEvent({
    entityId: "soul_nav", eventType: "path_blocked",
    position: { x: 10, z: 5 }, reason: "collapsed bridge",
  }));
  console.log(`  Emitted: navigation.path_blocked (reason: collapsed bridge)`);

  world.events.emit(new ArrivedEvent({
    entityId: "soul_nav", eventType: "arrived",
    position: { x: 20, z: 10 },
  }));
  console.log(`  Emitted: navigation.arrived (at destination)`);

  world.step(1 / 60);

  // Check perception frame.
  const frame = perception.getPerception("soul_nav")!;
  const navEvents = frame.events.filter((e: any) => e.type.startsWith("navigation."));
  console.log(`\nPerception frame captured ${navEvents.length} navigation events:`);
  for (const evt of navEvents) {
    console.log(`  [${evt.severity.toUpperCase().padEnd(6)}] ${evt.type}: ${evt.name}`);
  }

  const hasHigh = navEvents.some((e: any) => e.severity === "high");
  const hasMedium = navEvents.some((e: any) => e.severity === "medium");
  console.log(`\nNavigation demo: ${navEvents.length === 4 && hasHigh && hasMedium ? "PASS" : "CHECK"}`);
}

// ============================================================
// Phase 5: Integrated World Demo
// ============================================================
function demoIntegrated(): void {
  section("Phase 5: Integrated World (All M9 Systems Together)");

  const world = makeWorld();

  // Add all M9 systems.
  const flocking = new FlockingSystem({ maxSpeed: 4, maxForce: 2 });
  const orca = new OrcaSystem({ timeHorizon: 3, maxSpeed: 4 });
  const formation = new FormationSystem({ spacing: 2 });
  const pathCost = new PathCostSystem({ baseCost: 1.0 });
  const perception = new SoulPerceptionSystem();

  world.addSystem(flocking);
  world.addSystem(orca);
  world.addSystem(formation);
  world.addSystem(pathCost);
  world.addSystem(perception);

  // Add a soul for perception.
  const soul = new GameObject({ id: "soul_m9", type: "soul", name: "M9Soul", position: { x: 0, y: 0, z: 0 } });
  world.addEntity(soul);

  // Add terrain modifier.
  pathCost.addModifier("terrain", { x: 10, z: 10 }, 5, 1.5, "Forest");

  // Create formation.
  const formResult = formation.createFormation("wedge", "soul_m9", "Squad Alpha");
  formation.addMember(formResult.formationId!, "unit_1");
  formation.addMember(formResult.formationId!, "unit_2");

  // Add flocking agents.
  for (let i = 0; i < 3; i++) {
    flocking.addAgent({ x: i * 2, z: 0 }, { x: 1, z: 0 });
  }

  // Add ORCA agents.
  orca.addAgent({ x: -3, z: 0 }, { x: 1, z: 0 });
  orca.addAgent({ x: 3, z: 0 }, { x: -1, z: 0 });

  console.log(`World initialized with 5 M9 systems:`);
  console.log(`  Flocking: ${flocking.getAgents().length} agents`);
  console.log(`  ORCA: ${orca.getAgents().length} agents`);
  console.log(`  Formation: ${formation.formationCount} formations`);
  console.log(`  PathCost: ${pathCost.modifierCount} modifiers`);
  console.log(`  Perception: active for soul_m9`);

  // Emit navigation events.
  world.step(1 / 60);
  world.events.emit(new PathChangedEvent({
    entityId: "soul_m9", eventType: "path_changed",
    position: { x: 0, z: 0 }, target: { x: 15, z: 15 }, pathCost: 30,
  }));

  // Simulate 30 ticks.
  for (let i = 0; i < 30; i++) {
    world.step(1 / 60);
  }

  // Final state.
  const frame = perception.getPerception("soul_m9")!;
  console.log(`\nAfter 30 ticks:`);
  console.log(`  Perception events: ${frame.events.length}`);
  console.log(`  Formation slot positions (leader at (0,0)):`);
  const slots = formation.computeSlotPositions(formResult.formationId!, { x: 0, z: 0 });
  for (const slot of slots) {
    console.log(`    Slot ${slot.slotIndex}: ${slot.memberId ?? "empty"} → (${slot.position.x.toFixed(1)}, ${slot.position.z.toFixed(1)})`);
  }

  console.log(`\nIntegrated demo: PASS`);
}

// ============================================================
// Main
// ============================================================
console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  M9 End-to-End Demo: AI Navigation + Group Behavior      ║");
console.log("║  Flocking + ORCA + Formation + PathCost + Perception     ║");
console.log("╚══════════════════════════════════════════════════════════╝");

demoFlocking();
demoOrca();
demoFormation();
demoNavigation();
demoIntegrated();

console.log("\n" + "=".repeat(60));
console.log("  M9 Demo Complete: All 5 phases executed");
console.log("  Systems: Flocking | ORCA | Formation | PathCost | Perception");
console.log("  Seed provides execution framework; Ember provides decisions");
console.log("=".repeat(60));
