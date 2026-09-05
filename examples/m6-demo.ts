// M6 End-to-End Demo: Behavior Tree + Task System + Narrative Chain
//
// This demo shows the full M6 feature set working together:
// 1. A behavior tree controls an NPC agent's actions
// 2. A task system tracks objectives and progress
// 3. A narrative chain advances the story based on game state
// 4. SoulPerceptionSystem captures all events for soul delivery
//
// All content (behaviors, tasks, narrative) is defined by the application layer.
// Seed only provides the execution frameworks and event emission.

import { World } from "../src/engine/World.js";
import { GameObject } from "../src/entity/Entity.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";

// Behavior tree imports
import {
  BehaviorTree,
  BehaviorTreeSystem,
  Sequence,
  Selector,
  ActionNode,
  ConditionNode,
  WaitNode,
  Inverter,
  BehaviorStatus,
  Blackboard,
} from "../src/behavior/index.js";

// Task system imports
import {
  TaskSystem,
  TaskDefinition,
} from "../src/task/index.js";

// Narrative system imports
import {
  NarrativeSystem,
  NarrativeChainDefinition,
} from "../src/narrative/index.js";

// ─── Setup World ───────────────────────────────────────────────

const world = new World({ name: "m6-demo", tickRate: 60 });

// Add a soul entity for perception
const soul = new GameObject({
  id: "soul_demo",
  type: "soul",
  name: "Demo Soul",
  position: { x: 0, y: 0, z: 0 },
});
world.addEntity(soul);

// Add systems (order matters: narrative/task before perception for event timing)
const narrative = new NarrativeSystem();
const tasks = new TaskSystem();
const behaviorTrees = new BehaviorTreeSystem();
const perception = new SoulPerceptionSystem();

world.addSystem(narrative);
world.addSystem(tasks);
world.addSystem(behaviorTrees);
world.addSystem(perception);

// ─── 1. Define a Task ──────────────────────────────────────────

const gatherWoodTask: TaskDefinition = {
  id: "gather_wood",
  name: "Gather Wood",
  description: "Collect 5 pieces of wood for the village",
  objectives: [
    { id: "wood", type: "collect", target: "wood", requiredAmount: 5, description: "Collect 5 wood" },
  ],
  rewards: { xp: 100, gold: 50, reputation: 10 },
};

tasks.registerTask(gatherWoodTask);
console.log("[Task] Registered: Gather Wood (5 wood required)");

// ─── 2. Define a Narrative Chain ───────────────────────────────

const storyChain: NarrativeChainDefinition = {
  id: "village_story",
  name: "Village Story",
  description: "A tale of gathering and growth",
  nodes: [
    {
      id: "intro",
      name: "The Village Needs Wood",
      description: "The village elder asks for wood",
      onEnter: [(ctx) => { console.log(`[Narrative] Entered: ${ctx.nodeId} - The village needs wood!`); }],
      exitConditions: [(ctx) => (ctx.blackboard.taskAccepted as boolean) === true],
    },
    {
      id: "gathering",
      name: "Gathering in the Forest",
      description: "The agent heads to the forest to gather wood",
      onEnter: [(ctx) => { console.log(`[Narrative] Entered: ${ctx.nodeId} - Heading to the forest...`); }],
      exitConditions: [(ctx) => (ctx.blackboard.woodCollected as number) >= 5],
    },
    {
      id: "return",
      name: "Returning to the Village",
      description: "The agent returns with the wood",
      onEnter: [(ctx) => { console.log(`[Narrative] Entered: ${ctx.nodeId} - Returning with 5 wood!`); }],
      exitConditions: [() => true],
    },
    {
      id: "celebration",
      name: "Village Celebration",
      description: "The village celebrates the successful gathering",
      onEnter: [(ctx) => { console.log(`[Narrative] Entered: ${ctx.nodeId} - The village celebrates! 🎉`); }],
      terminal: true,
    },
  ],
};

narrative.registerChain(storyChain);
console.log("[Narrative] Registered: Village Story (4 nodes)");

// ─── 3. Define a Behavior Tree for the NPC Agent ───────────────

const agentBlackboard = new Blackboard();
agentBlackboard.set("wood", 0);
agentBlackboard.set("taskAccepted", false);

// Shared narrative blackboard reference
const narrativeInstance = narrative.startChain("village_story", world.events, world.tick)!;

const agentTree = new BehaviorTree(
  new Sequence()
    .addChild(
      // Step 1: Accept the task if not accepted
      new ConditionNode("task not accepted", (_a, bb) => bb.get("taskAccepted") !== true),
    )
    .addChild(
      new ActionNode("accept task", (_a, bb) => {
        const instance = tasks.acceptTask("gather_wood", "agent_1", world.events, world.tick);
        if (instance) {
          bb.set("taskAccepted", true);
          narrativeInstance.blackboard.taskAccepted = true;
          console.log("[Behavior] Accepted task: Gather Wood");
          return BehaviorStatus.Success;
        }
        return BehaviorStatus.Failure;
      }),
    ),
  agentBlackboard,
);

// Second behavior tree: gathering loop (runs after task accepted)
const gatheringTree = new BehaviorTree(
  new Sequence()
    .addChild(new ConditionNode("task accepted", (_a, bb) => bb.get("taskAccepted") === true))
    .addChild(new ConditionNode("not enough wood", (_a, bb) => (bb.get("wood") as number) < 5))
    .addChild(
      new ActionNode("gather wood", (_a, bb) => {
        const current = bb.get("wood") as number;
        const next = current + 1;
        bb.set("wood", next);
        narrativeInstance.blackboard.woodCollected = next;
        tasks.updateObjectiveProgress("gather_wood", "agent_1", "wood", 1, world.events);
        console.log(`[Behavior] Gathered wood: ${next}/5`);
        return BehaviorStatus.Success;
      }),
    )
    .addChild(new WaitNode(2)),
  agentBlackboard,
);

behaviorTrees.registerAgent("agent_1", agentTree);
behaviorTrees.registerAgent("agent_1_gathering", gatheringTree);
console.log("[Behavior] Registered 2 behavior trees for agent_1");

// ─── 4. Run Simulation ─────────────────────────────────────────

console.log("\n=== Starting Simulation ===");
console.log("World tick rate: 60fps, running 120 ticks (2 seconds)\n");

for (let i = 0; i < 120; i++) {
  world.step(1 / 60);

  // Print perception events every 20 ticks
  if ((i + 1) % 20 === 0) {
    const frame = perception.getPerception("soul_demo");
    if (frame && frame.events) {
      const taskEvents = frame.events.filter((e: any) => e.type.startsWith("task."));
      const narrativeEvents = frame.events.filter((e: any) => e.type.startsWith("narrative."));
      console.log(`\n--- Tick ${i + 1} Perception Summary ---`);
      console.log(`  Task events: ${taskEvents.length}`);
      console.log(`  Narrative events: ${narrativeEvents.length}`);
      if (narrativeEvents.length > 0) {
        const latest = narrativeEvents[narrativeEvents.length - 1];
        console.log(`  Latest narrative: ${latest.name} [${latest.severity}]`);
      }
    }
  }
}

// ─── 5. Final State Report ─────────────────────────────────────

console.log("\n=== Final State ===");

// Task state
const taskInstance = tasks.getActiveTask("gather_wood", "agent_1");
console.log(`Task: ${taskInstance ? taskInstance.status : "not found"}`);
if (taskInstance) {
  const prog = taskInstance.objectiveProgress.get("wood");
  console.log(`  Wood collected: ${prog?.currentAmount}/5`);
  console.log(`  Task progress: ${(taskInstance.getProgress() * 100).toFixed(0)}%`);
}

// Narrative state
const narrativeState = narrative.getInstance("village_story");
console.log(`Narrative: ${narrativeState?.status}`);
if (narrativeState) {
  const currentNode = storyChain.nodes[narrativeState.currentNodeIndex];
  console.log(`  Current node: ${currentNode?.name ?? "none"}`);
  console.log(`  Nodes entered: ${narrativeState.nodesEntered}`);
  console.log(`  Narrative progress: ${(narrativeState.getProgress(storyChain.nodes) * 100).toFixed(0)}%`);
}

// Behavior tree state
console.log(`Behavior trees: ${behaviorTrees.size} registered`);

// Perception summary
const finalFrame = perception.getPerception("soul_demo");
if (finalFrame && finalFrame.events) {
  const allEvents = finalFrame.events;
  console.log(`Total perceived events: ${allEvents.length}`);
  const highSeverity = allEvents.filter((e: any) => e.severity === "high");
  console.log(`High severity events: ${highSeverity.length}`);
}

console.log("\n=== M6 Demo Complete ===");
console.log("Behavior Tree + Task System + Narrative Chain + Perception all working together!");
