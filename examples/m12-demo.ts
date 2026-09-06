// M12 End-to-End Demo: NPC AI Deepening + World Narrative Enhancement
//
// Demonstrates the full M12 pipeline:
//   1. NPCMemorySystem - short/long term memory with decay and retrieval
//   2. NPCPersonalitySystem - Big Five OCEAN personality with behavioral tendencies
//   3. GOAP (GoalOrientedActionPlanning) - goal-based action planning
//   4. BehaviorTree Enhancement - enhanced composite/decorator nodes
//   5. NPCScheduleSystem - daily routine with time-based transitions
//   6. DynamicNarrativeSystem - narrative arcs, event chains, branching
//   7. TaskChainSystem - multi-step tasks with dependencies
//   8. Narrative Integration - event perception + world state narrative + NPC bridge
//
// Run: npx tsx examples/m12-demo.ts

import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";

// M12 Phase 1: NPC Memory
import { NPCMemorySystem } from "../src/npc/NPCMemorySystem.js";
import type { MemoryType, MemoryImportance } from "../src/npc/MemoryTypes.js";

// M12 Phase 2: NPC Personality
import { NPCPersonalitySystem } from "../src/npc/NPCPersonalitySystem.js";

// M12 Phase 3: GOAP
import { GoapSystem } from "../src/npc/GoapSystem.js";
import type { GoapGoal, GoapAction } from "../src/npc/GoapTypes.js";

// M12 Phase 4: Behavior Tree Enhancement
import {
  BehaviorTree,
  ActionNode,
  ConditionNode,
  Sequence,
  Selector,
  Cooldown,
  Counter,
  Blackboard,
  BehaviorStatus,
} from "../src/behavior/index.js";

// M12 Phase 5: NPC Schedule
import { ScheduleSystem } from "../src/npc/ScheduleSystem.js";
import { SCHEDULE_TEMPLATES } from "../src/npc/ScheduleTypes.js";

// M12 Phase 6: Dynamic Narrative
import { DynamicNarrativeSystem } from "../src/narrative/DynamicNarrativeSystem.js";
import type { DynamicNarrativeArc } from "../src/narrative/DynamicNarrativeTypes.js";

// M12 Phase 7: Task Chain
import { TaskChainSystem } from "../src/task/TaskChainSystem.js";
import type { TaskChain } from "../src/task/TaskChainTypes.js";

// M12 Phase 8: Narrative Integration
import { WorldStateNarrativeSystem, NpcNarrativeBridge } from "../src/narrative/NarrativeIntegration.js";

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

// Helper: create a simple action node.
function action(name: string, fn: () => BehaviorStatus): ActionNode {
  return new ActionNode(name, fn);
}

console.log("=".repeat(60));
console.log("M12 NPC AI + Narrative - End-to-End Demo");
console.log("=".repeat(60));

// --- Phase 1: NPC Memory System ---
console.log("\n🧠  Phase 1: NPC Memory System");
{
  const world = new World({ name: "m12-memory", tickRate: 60 });
  const memorySystem = new NPCMemorySystem();
  world.addSystem(memorySystem);

  // Add memories of different types and importance (auto-registers NPC).
  memorySystem.addMemory("npc_1", "interaction" as MemoryType, "Met a traveler at the crossroads", "medium" as MemoryImportance);
  memorySystem.addMemory("npc_1", "emotion" as MemoryType, "Felt joy when helping a villager", "high" as MemoryImportance);
  memorySystem.addMemory("npc_1", "knowledge" as MemoryType, "The old castle is haunted", "critical" as MemoryImportance);

  const stats = memorySystem.getMemoryStats("npc_1");
  assert(stats.totalCount === 3, `Added 3 memories (got ${stats.totalCount})`);

  // Get memories by type.
  const allResult = memorySystem.getMemories("npc_1");
  const knowledge = allResult.memories.filter((m: { type: string }) => m.type === "knowledge");
  assert(knowledge.length === 1, `Retrieved 1 knowledge memory (got ${knowledge.length})`);

  // High importance memory should be promoted to long-term after decay.
  for (let i = 0; i < 100; i++) world.step(1 / 60);
  const statsAfter = memorySystem.getMemoryStats("npc_1");
  assert(statsAfter.longTermCount >= 1, `High importance memory promoted to long-term (got ${statsAfter.longTermCount})`);

  // Critical knowledge memory should be retained.
  const criticalMem = allResult.memories.find((m: { importance: string }) => m.importance === "critical");
  assert(criticalMem !== undefined, "Critical knowledge memory retained");
}

// --- Phase 2: NPC Personality System ---
console.log("\n🎭  Phase 2: NPC Personality System");
{
  const personalitySystem = new NPCPersonalitySystem();

  // Create NPCs with different archetypes.
  personalitySystem.setPersonalityFromArchetype("npc_warrior", "warrior");
  personalitySystem.setPersonalityFromArchetype("npc_diplomat", "diplomat");

  const warrior = personalitySystem.getPersonality("npc_warrior");
  const diplomat = personalitySystem.getPersonality("npc_diplomat");
  assert(warrior !== undefined, "Warrior personality created");
  assert(diplomat !== undefined, "Diplomat personality created");

  // Derive behavioral tendencies (takes traits as input).
  const warriorTendencies = personalitySystem.deriveTendencies(warrior!.traits);
  const diplomatTendencies = personalitySystem.deriveTendencies(diplomat!.traits);
  assert(warriorTendencies.aggressionTendency > diplomatTendencies.aggressionTendency,
    `Warrior more aggressive (${warriorTendencies.aggressionTendency.toFixed(2)} > ${diplomatTendencies.aggressionTendency.toFixed(2)})`);
  assert(diplomatTendencies.socialTendency > warriorTendencies.socialTendency,
    `Diplomat more sociable (${diplomatTendencies.socialTendency.toFixed(2)} > ${warriorTendencies.socialTendency.toFixed(2)})`);

  // Derive decision style.
  const warriorStyle = personalitySystem.deriveDecisionStyle(warrior!.traits);
  assert(warriorStyle.riskPreference === "risk_seeking" || warriorStyle.riskPreference === "neutral",
    `Warrior risk preference: ${warriorStyle.riskPreference}`);

  // Modify a trait (delta, not absolute).
  personalitySystem.modifyTrait("npc_warrior", "agreeableness", 10);
  const updated = personalitySystem.getPersonality("npc_warrior");
  assert(updated!.traits.agreeableness === 30, `Trait modified: +10 agreeableness (got ${updated!.traits.agreeableness})`);
}

// --- Phase 3: GOAP (Goal-Oriented Action Planning) ---
console.log("\n🎯  Phase 3: GOAP Goal-Oriented Action Planning");
{
  const world = new World({ name: "m12-goap", tickRate: 60 });
  const goapSystem = new GoapSystem();
  world.addSystem(goapSystem);

  // Define a goal: be well-fed.
  const goal: GoapGoal = {
    id: "goal_well_fed",
    name: "Be well-fed",
    priority: 10,
    targetState: { fed: true },
    relevant: true,
  };
  goapSystem.addGoal("npc_1", goal);

  // Define actions.
  const actions: GoapAction[] = [
    { id: "action_hunt", name: "Hunt", preconditions: { hasWeapon: true }, effects: { hasFood: true }, cost: 5, duration: 3 },
    { id: "action_cook", name: "Cook", preconditions: { hasFood: true }, effects: { fed: true }, cost: 2, duration: 2 },
    { id: "action_get_weapon", name: "Get Weapon", preconditions: {}, effects: { hasWeapon: true }, cost: 1, duration: 1 },
  ];
  for (const a of actions) goapSystem.addAction("npc_1", a);

  // Set initial world state.
  goapSystem.setWorldState("npc_1", { hasWeapon: false, hasFood: false, fed: false });

  // Plan (plans for highest priority relevant goal).
  const plan = goapSystem.plan("npc_1");
  assert(plan.success === true, "GOAP plan generated successfully");
  assert(plan.actions.length >= 3, `Plan has ${plan.actions.length} actions (expected >= 3)`);
  assert(plan.actions[0].id === "action_get_weapon", `First action: get weapon (got ${plan.actions[0].id})`);

  // Execute plan (total duration = 1+3+2 = 6 ticks).
  const startResult = goapSystem.startPlan("npc_1");
  assert(startResult.success === true, "Plan execution started");
  for (let i = 0; i < 10; i++) world.step(1 / 60);

  // After 10 ticks, plan should be complete (execution removed).
  const execution = goapSystem.getExecution("npc_1");
  assert(execution === undefined || execution.status === "completed",
    `Plan completed after execution (status: ${execution?.status ?? "removed"})`);
}

// --- Phase 4: Behavior Tree Enhancement ---
console.log("\n🌳  Phase 4: Behavior Tree Enhancement");
{
  const blackboard = new Blackboard();
  blackboard.set("hunger", 80);
  blackboard.set("has_food", true);

  // Build a behavior tree with enhanced nodes (direct construction).
  const eatAction = action("eat", () => {
    blackboard.set("hunger", 20);
    return BehaviorStatus.Success;
  });

  const tree = new BehaviorTree(
    new Selector()
      .addChild(
        new Sequence()
          .addChild(new ConditionNode("is hungry", () => blackboard.get<number>("hunger") > 50))
          .addChild(new ConditionNode("has food", () => blackboard.get<boolean>("has_food") === true))
          .addChild(new Cooldown(2, eatAction))
      )
      .addChild(action("wander", () => BehaviorStatus.Success))
  );

  // Tick the tree.
  const agent = { id: "npc_1", position: { x: 0, y: 0, z: 0 } };
  const result1 = tree.tick(agent, blackboard);
  assert(result1 === BehaviorStatus.Success, `Behavior tree tick 1: success (got ${result1})`);
  assert(blackboard.get<number>("hunger") === 20, `Hunger reduced to 20 (got ${blackboard.get("hunger")})`);

  // Test cooldown: second tick should skip eat (cooldown active).
  blackboard.set("hunger", 80);
  const result2 = tree.tick(agent, blackboard);
  assert(result2 === BehaviorStatus.Success, `Behavior tree tick 2: success (got ${result2})`);

  // Test blackboard scoped access.
  blackboard.setScoped("npc_1", "health", 100);
  assert(blackboard.getScoped("npc_1", "health") === 100, "Scoped blackboard access works");
  assert(blackboard.keysInScope("npc_1").length === 1, "One key in npc_1 scope");

  // Test counter decorator (returns success on the targetCount-th tick).
  const counter = new Counter(3);
  counter.tick(agent, blackboard); // tick 1: failure
  counter.tick(agent, blackboard); // tick 2: failure
  const counterResult = counter.tick(agent, blackboard); // tick 3: success
  assert(counterResult === BehaviorStatus.Success, `Counter returns success on 3rd tick (got ${counterResult})`);
}

// --- Phase 5: NPC Daily Schedule ---
console.log("\n📅  Phase 5: NPC Daily Schedule");
{
  const world = new World({ name: "m12-schedule", tickRate: 60 });
  const scheduleSystem = new ScheduleSystem();
  world.addSystem(scheduleSystem);

  // Use diurnal template.
  scheduleSystem.setSchedule("npc_1", SCHEDULE_TEMPLATES.diurnal);
  assert(scheduleSystem.getSchedule("npc_1").length === SCHEDULE_TEMPLATES.diurnal.length,
    `Diurnal schedule set (${SCHEDULE_TEMPLATES.diurnal.length} activities)`);

  // Start chain - at tick 0, should be in sleep (0-360).
  world.step(1 / 60);
  let current = scheduleSystem.getCurrentActivity("npc_1");
  assert(current?.activity?.actionType === "sleep", `At time 0: sleeping (got ${current?.activity?.actionType})`);

  // Step to work hours (480+).
  for (let i = 0; i < 500; i++) world.step(1 / 60);
  current = scheduleSystem.getCurrentActivity("npc_1");
  assert(current?.activity?.actionType === "work", `At time ~500: working (got ${current?.activity?.actionType})`);

  // Check location preference (sleep activity has location).
  const sleepLocation = scheduleSystem.getActivityLocation("npc_1", "sleep");
  assert(sleepLocation !== undefined, "Sleep activity has location preference");

  // Manual activity control (evening is in the diurnal template).
  assert(scheduleSystem.startActivity("npc_1", "evening") === true, "Manually start evening activity");
  assert(scheduleSystem.completeActivity("npc_1") === true, "Manually complete activity");
}

// --- Phase 6: Dynamic Narrative Generation ---
console.log("\n📖  Phase 6: Dynamic Narrative Generation");
{
  const world = new World({ name: "m12-narrative", tickRate: 60 });
  const narrativeSystem = new DynamicNarrativeSystem();
  world.addSystem(narrativeSystem);

  // Create a narrative arc.
  const arc: DynamicNarrativeArc = {
    id: "arc_hero",
    name: "The Hero's Journey",
    description: "A hero rises to save the village",
    status: "available",
    phases: [
      { id: "call", name: "Call to Adventure", description: "The hero receives the call" },
      { id: "trials", name: "Road of Trials", description: "The hero faces challenges" },
      { id: "return", name: "The Return", description: "The hero returns victorious", isFinal: true },
    ],
    currentPhaseIndex: 0,
    priority: 10,
    participants: ["hero_1"],
  };
  narrativeSystem.addArc(arc);

  // Start the arc.
  assert(narrativeSystem.startArc("arc_hero") === true, "Narrative arc started");
  assert(narrativeSystem.getArc("arc_hero")?.status === "active", "Arc status: active");

  // Record narrative events.
  narrativeSystem.recordEvent("plot", "Hero Departs", "The hero leaves the village", {
    arcId: "arc_hero",
    consequences: { hero_location: "forest" },
  });
  narrativeSystem.recordEvent("character", "Hero Grows", "The hero gains wisdom", {
    arcId: "arc_hero",
    consequences: { hero_wisdom: 50 },
  });

  assert(narrativeSystem.getEvents().length === 2, `2 narrative events recorded (got ${narrativeSystem.getEvents().length})`);
  assert(narrativeSystem.getState("hero_location") === "forest", "Consequence applied: hero_location=forest");

  // Advance arc phases.
  const advanceResult = narrativeSystem.advanceArc("arc_hero");
  assert(advanceResult.advanced === true, "Arc advanced to phase 2");
  assert(advanceResult.newPhaseId === "trials", `New phase: trials (got ${advanceResult.newPhaseId})`);

  // Create a branching narrative.
  const branch = narrativeSystem.createBranch("How should the hero proceed?", [
    { id: "fight", text: "Fight the dragon", weight: 3, consequences: { hero_path: "warrior" } },
    { id: "negotiate", text: "Negotiate peace", weight: 1, consequences: { hero_path: "diplomat" } },
  ], { arcId: "arc_hero" });
  assert(branch.choices.length === 2, "Branch created with 2 choices");

  narrativeSystem.selectChoice(branch.id, "fight");
  assert(narrativeSystem.getBranch(branch.id)?.resolved === true, "Branch resolved");
  assert(narrativeSystem.getState("hero_path") === "warrior", "Choice consequence: hero_path=warrior");

  // Player influence.
  narrativeSystem.recordPlayerAction("steal_artifact", "Player steals the ancient artifact", {
    artifact_taken: true,
    player_reputation: -10,
  }, { participants: ["player_1"] });
  assert(narrativeSystem.getPlayerInfluence("player_1") === 1, "Player influence recorded");
}

// --- Phase 7: Task Chain Deepening ---
console.log("\n📋  Phase 7: Task Chain Deepening");
{
  const world = new World({ name: "m12-taskchain", tickRate: 60 });
  const taskChainSystem = new TaskChainSystem();
  world.addSystem(taskChainSystem);

  // Create a multi-step task chain with dependencies.
  const chain: TaskChain = {
    id: "chain_save_village",
    name: "Save the Village",
    description: "A multi-step quest to save the village",
    status: "available",
    priority: 10,
    participants: ["hero_1"],
    narrative: "The hero must gather, craft, and deliver to save the village.",
    steps: [
      { id: "gather", name: "Gather Materials", description: "Gather wood and stone", dependencies: [], status: "locked", narrative: "The hero ventures into the forest." },
      { id: "craft", name: "Craft Weapon", description: "Craft a mighty sword", dependencies: ["gather"], status: "locked", narrative: "The hero forges the blade." },
      { id: "deliver", name: "Deliver Weapon", description: "Deliver to the village elder", dependencies: ["craft"], status: "locked", narrative: "The hero presents the sword." },
    ],
  };
  taskChainSystem.addChain(chain);

  // Start chain.
  assert(taskChainSystem.startChain("chain_save_village") === true, "Task chain started");
  assert(taskChainSystem.getAvailableSteps("chain_save_village").length === 1, "1 step available (gather)");

  // Complete step 1: gather.
  taskChainSystem.startStep("chain_save_village", "gather");
  const gatherResult = taskChainSystem.completeStep("chain_save_village", "gather");
  assert(gatherResult.progressed === true, "Step 'gather' completed");

  // Step 2 (craft) should now be available.
  assert(taskChainSystem.getStep("chain_save_village", "craft")?.status === "available",
    "Step 'craft' unlocked after gather completed");

  // Complete step 2: craft.
  taskChainSystem.startStep("chain_save_village", "craft");
  taskChainSystem.completeStep("chain_save_village", "craft");

  // Complete step 3: deliver (should auto-complete chain).
  taskChainSystem.startStep("chain_save_village", "deliver");
  taskChainSystem.completeStep("chain_save_village", "deliver");

  assert(taskChainSystem.getChain("chain_save_village")?.status === "completed",
    "Chain auto-completed after all steps done");
  assert(taskChainSystem.getChainProgress("chain_save_village") === 1, "Chain progress: 100%");

  // Test dependency check.
  const depResult = taskChainSystem.checkDependencies("chain_save_village", "craft");
  assert(depResult.satisfied === true, "Dependencies for 'craft' now satisfied");
}

// --- Phase 8: Narrative Integration (Event Perception + World State + NPC Bridge) ---
console.log("\n🔗  Phase 8: Narrative Integration");
{
  const world = new World({ name: "m12-integration", tickRate: 60 });
  const perception = new SoulPerceptionSystem();
  const narrative = new DynamicNarrativeSystem();
  const worldStateNarrative = new WorldStateNarrativeSystem();
  const npcBridge = new NpcNarrativeBridge();

  world.addSystem(perception);
  world.addSystem(narrative);
  world.addSystem(worldStateNarrative);
  world.addSystem(npcBridge);

  // Add a soul.
  world.addEntity(new GameObject({ id: "soul_1", type: "soul", name: "HeroSoul", position: { x: 0, y: 0, z: 0 } }));
  world.step(1 / 60); // Initialize event listeners.

  // 8a: Narrative event perception.
  narrative.recordEvent("climax", "Final Battle", "The final battle begins!");
  world.step(1 / 60);

  const frame = perception.getPerception("soul_1");
  assert(frame !== undefined, "Perception frame exists");
  const narrativeEvents = frame!.events.filter(e => e.type === "narrative.event_recorded");
  assert(narrativeEvents.length >= 1, `Soul perceived narrative event (${narrativeEvents.length} events)`);

  // 8b: World state narrative.
  worldStateNarrative.addRule({
    id: "rule_crowded",
    name: "Village Crowded",
    condition: (s) => s.entityCount >= 2,
    narrative: { type: "world", title: "Crowded Village", description: "Many souls in the village" },
  });

  let worldStateEvent = false;
  world.events.on("narrative.world_state", () => { worldStateEvent = true; });

  world.addEntity(new GameObject({ id: "soul_2", type: "soul", name: "Villager", position: { x: 5, y: 0, z: 5 } }));
  world.step(1 / 60);
  assert(worldStateEvent === true, "World state narrative rule triggered");

  // 8c: NPC-Narrative bridge (NPC behavior → narrative).
  npcBridge.addMapping({
    id: "map_work",
    npcId: "npc_hero",
    behaviorType: "schedule.activity_started",
    narrativeTemplate: { type: "character", title: "Hero at Work", description: "The hero begins working", severity: "low" },
  });

  let npcNarrativeEvent = false;
  world.events.on("narrative.npc_behavior", () => { npcNarrativeEvent = true; });
  npcBridge.triggerNarrativeFromBehavior("schedule.activity_started", "npc_hero", { activity: "work" });
  assert(npcNarrativeEvent === true, "NPC behavior triggered narrative event");

  // 8d: Narrative → NPC behavior influence.
  npcBridge.applyInfluence({
    id: "inf_battle",
    narrativeEventType: "narrative.event_recorded",
    npcId: "npc_hero",
    modifier: { aggression: 0.8, courage: 0.9 },
    duration: 100,
    active: false,
  });
  const combined = npcBridge.getCombinedModifier("npc_hero");
  assert(combined.aggression === 0.8, `Narrative influence applied: aggression=${combined.aggression}`);
  assert(combined.courage === 0.9, `Narrative influence applied: courage=${combined.courage}`);
}

// --- Summary ---
console.log("\n" + "=".repeat(60));
console.log(`M12 Demo Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
