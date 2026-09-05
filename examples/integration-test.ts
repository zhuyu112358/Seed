// End-to-end integration test: Seed world engine <-> SoulArena cognitive system.
//
// This script verifies the complete perceive -> decide -> act loop:
//   1. Create a Seed world with perception, action, and bridge systems
//   2. Start the webhook action receiver
//   3. Register a soul with SoulArena (enter-world)
//   4. Add the soul as an entity in the world
//   5. Run the world for N ticks, observing perceptions and actions
//   6. Exit the world cleanly
//   7. Print a summary report
//
// Usage: npx tsx examples/integration-test.ts [soulId] [tickCount]
//   soulId   - SoulArena soul ID (default: first soul found via API)
//   tickCount - Number of world ticks to run (default: 60)

import { World } from "../src/engine/World.js";
import { SoulPerceptionSystem } from "../src/entity/SoulPerceptionSystem.js";
import { SoulActionSystem } from "../src/entity/SoulActionSystem.js";
import { SoulBridgeAdapter } from "../src/bridge/SoulBridgeAdapter.js";
import { WeatherSimulator } from "../src/event/WeatherSimulator.js";
import { GameObject } from "../src/entity/Entity.js";

const SOUL_ARENA_URL = process.env.SOUL_URL ?? "http://localhost:3000";
const DEFAULT_TICKS = 60;
const WEBHOOK_PORT = 3001;

interface SoulInfo {
  id: string;
  name: string;
  element: string;
}

async function discoverSoul(): Promise<SoulInfo | null> {
  try {
    const res = await fetch(`${SOUL_ARENA_URL}/api/souls`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { souls?: Array<{ id: string; name: string; element: string }> };
    if (!body.souls || body.souls.length === 0) return null;
    // Pick the most recently active soul (first in list is usually most recent).
    return { id: body.souls[0].id, name: body.souls[0].name, element: body.souls[0].element };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const argSoulId = process.argv[2];
  const argTicks = parseInt(process.argv[3] ?? String(DEFAULT_TICKS), 10);

  console.log("=== Seed <-> SoulArena End-to-End Integration Test ===\n");

  // 1. Discover or use provided soul.
  let soul: SoulInfo;
  if (argSoulId) {
    soul = { id: argSoulId, name: "custom", element: "unknown" };
    console.log(`Using provided soul ID: ${soul.id}`);
  } else {
    console.log("Discovering soul from SoulArena...");
    const discovered = await discoverSoul();
    if (!discovered) {
      console.error("ERROR: Could not discover any soul from SoulArena. Is the server running?");
      process.exit(1);
    }
    soul = discovered;
    console.log(`Discovered soul: ${soul.name} (${soul.element}), ID: ${soul.id}`);
  }

  // 2. Create the Seed world.
  console.log("\n--- Creating Seed world ---");
  const world = new World({ name: "integration-test", tickRate: 60 });
  const weather = new WeatherSimulator({ initialTemperature: 22, initialWindSpeed: 3 });
  const perception = new SoulPerceptionSystem({ viewDistance: 25, sensoryRange: 15 });
  const actionSystem = new SoulActionSystem({
    maxMoveDistance: 10,
    acoustic: { maxRadius: 30, minAudible: 0.02 },
  });
  const bridge = new SoulBridgeAdapter({
    soulArenaUrl: SOUL_ARENA_URL,
    perceiveIntervalTicks: 5,
    webhookPort: WEBHOOK_PORT,
    worldId: "integration-test-world",
    worldName: "Integration Test World",
  });

  world.addSystem(weather);
  world.addSystem(perception);
  world.addSystem(actionSystem);
  world.addSystem(bridge);
  console.log("World created with systems: weather, perception, action, bridge");

  // 3. Add test objects to the world (so the soul has something to perceive).
  const tree = new GameObject({ id: "obj_tree1", name: "Oak Tree", type: "interactive", position: { x: 5, y: 0, z: 0 }, mass: 100, material: "wood" });
  const rock = new GameObject({ id: "obj_rock1", name: "Large Rock", type: "static", position: { x: -3, y: 0, z: 4 }, mass: 50, material: "stone" });
  const lamp = new GameObject({ id: "obj_lamp1", name: "Street Lamp", type: "interactive", position: { x: 2, y: 0, z: -3 }, mass: 10, material: "metal" });
  world.addEntity(tree);
  world.addEntity(rock);
  world.addEntity(lamp);
  console.log("Added 3 test objects: Oak Tree, Large Rock, Street Lamp");

  // 4. Add the soul as an entity in the world.
  const soulEntity = new GameObject({
    id: soul.id,
    name: soul.name,
    type: "soul",
    position: { x: 0, y: 0, z: 0 },
    mass: 1,
    material: soul.element,
  });
  world.addEntity(soulEntity);
  console.log(`Added soul entity: ${soul.name} at position (0, 0, 0)`);

  // 5. Start webhook receiver.
  console.log("\n--- Starting webhook action receiver ---");
  try {
    const port = await bridge.startWebhookServer(WEBHOOK_PORT);
    console.log(`Webhook receiver listening on http://localhost:${port}/actions`);
  } catch (err) {
    console.warn(`Webhook server failed to start (port may be in use): ${String(err)}`);
    console.warn("Actions will not be received via webhook. Continuing with perception-only test.");
  }

  // 6. Enter world.
  console.log("\n--- Entering world ---");
  const entered = await bridge.enterWorld(soul.id);
  if (!entered) {
    console.error("ERROR: Failed to enter world. SoulArena may have rejected the request.");
    await bridge.stopWebhookServer();
    process.exit(1);
  }
  console.log(`Soul ${soul.name} entered world successfully.`);

  // 7. Run world ticks.
  console.log(`\n--- Running world for ${argTicks} ticks ---`);
  const dt = 1 / 60;
  let perceptionsSent = 0;
  let actionsReceived = 0;
  let actionsExecuted = 0;
  let actionsFailed = 0;
  const actionTypeCounts = new Map<string, number>();
  const positionHistory: Array<{ tick: number; x: number; y: number; z: number }> = [];
  const sampleFrames: Array<{ tick: number; visibleCount: number; temp: number; light: number }> = [];

  for (let i = 0; i < argTicks; i++) {
    world.step(dt);

    // Track position every 5 ticks.
    if (i % 5 === 0) {
      positionHistory.push({ tick: i, x: soulEntity.position.x, y: soulEntity.position.y, z: soulEntity.position.z });
    }

    // Sample perception every 10 ticks.
    if (i % 10 === 0) {
      const frame = perception.getPerception(soul.id);
      if (frame) {
        sampleFrames.push({
          tick: i,
          visibleCount: frame.visibleEntities.length,
          temp: frame.environment.temperature,
          light: frame.environment.lightLevel,
        });
      }
    }

    // Allow async perceptions to resolve (world.step is sync, bridge sends are fire-and-forget).
    if (i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Collect action type distribution from history.
  for (const entry of actionSystem.getHistory(soul.id)) {
    const type = entry.request.action;
    actionTypeCounts.set(type, (actionTypeCounts.get(type) ?? 0) + 1);
  }

  // Wait a bit for any in-flight perceptions/actions.
  await new Promise((r) => setTimeout(r, 500));

  // 8. Collect stats.
  const stats = bridge.getStats();
  perceptionsSent = stats.perceptionsSent;
  actionsReceived = stats.actionsReceived;
  actionsExecuted = stats.actionsExecuted;
  actionsFailed = stats.actionsFailed;

  const finalPosition = soulEntity.position;
  const finalFrame = perception.getPerception(soul.id);

  // 9. Exit world.
  console.log("\n--- Exiting world ---");
  const exited = await bridge.exitWorld(soul.id, "integration_test_complete");
  console.log(exited ? "Soul exited world successfully." : "Exit-world returned failure (may already be exited).");

  // 10. Stop webhook.
  await bridge.stopWebhookServer();
  console.log("Webhook receiver stopped.");

  // 11. Print report.
  console.log("\n=== Integration Test Report ===");
  console.log(`Soul:              ${soul.name} (${soul.element})`);
  console.log(`Soul ID:           ${soul.id}`);
  console.log(`World ticks:       ${argTicks}`);
  console.log(`Perceptions sent:  ${perceptionsSent}`);
  console.log(`Perceptions failed: ${stats.perceptionsFailed}`);
  console.log(`Actions received:  ${actionsReceived}`);
  console.log(`Actions executed:  ${actionsExecuted}`);
  console.log(`Actions failed:    ${actionsFailed}`);
  console.log(`Actions dropped:   ${stats.actionsDropped}`);
  console.log(`Final position:    (${finalPosition.x.toFixed(2)}, ${finalPosition.y.toFixed(2)}, ${finalPosition.z.toFixed(2)})`);
  if (finalFrame) {
    console.log(`Final env:         ${finalFrame.environment.weather}, ${finalFrame.environment.temperature.toFixed(1)}C, light ${(finalFrame.environment.lightLevel * 100).toFixed(0)}%`);
    console.log(`Visible entities:  ${finalFrame.visibleEntities.length}`);
  }

  console.log("\n--- Sampled Perception Frames ---");
  for (const s of sampleFrames) {
    console.log(`  Tick ${s.tick.toString().padStart(3)}: visible=${s.visibleCount}, temp=${s.temp.toFixed(1)}C, light=${(s.light * 100).toFixed(0)}%`);
  }

  console.log("\n--- Position History ---");
  for (const p of positionHistory) {
    console.log(`  Tick ${p.tick.toString().padStart(3)}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
  }

  console.log("\n--- Action Type Distribution ---");
  if (actionTypeCounts.size === 0) {
    console.log("  (no actions recorded)");
  } else {
    for (const [type, count] of actionTypeCounts) {
      console.log(`  ${type.padEnd(15)}: ${count}`);
    }
  }

  // 12. Verdict.
  console.log("\n=== Verdict ===");
  const perceptionOk = perceptionsSent > 0;
  const actionLoopOk = actionsReceived > 0;
  if (perceptionOk && actionLoopOk) {
    console.log("PASS: perceive -> decide -> act loop is fully operational.");
  } else if (perceptionOk) {
    console.log("PARTIAL: Perceptions are being sent, but no actions were received.");
    console.log("  - Check if SoulArena generated actions (may need speech input or threat).");
    console.log("  - Check webhook receiver is running and callbackUrl is set correctly.");
  } else {
    console.log("FAIL: No perceptions were sent. Check SoulArena connectivity and enter-world.");
  }

  process.exit(perceptionOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Integration test crashed:", err);
  process.exit(1);
});
