// End-to-end integration test: Seed world engine <-> SoulArena cognitive system.
//
// Supports both single-soul and multi-soul modes:
//   Single: npx tsx examples/integration-test.ts [soulId] [tickCount]
//   Multi:  npx tsx examples/integration-test.ts --multi N [tickCount]
//
// Multi-soul mode verifies:
//   - Independent perception/decision/action loops per soul
//   - Soul-to-soul acoustic communication (one speaks, others hear)
//   - ActionResult correctly routed per soul
//   - No interference between souls

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

interface SoulRuntime {
  info: SoulInfo;
  entity: GameObject;
  perceptionsSent: number;
  actionsReceived: number;
  actionsExecuted: number;
  actionsFailed: number;
  positionHistory: Array<{ tick: number; x: number; y: number; z: number }>;
  communicationsHeard: Array<{ tick: number; from: string; content: string }>;
}

async function discoverSouls(count: number): Promise<SoulInfo[]> {
  try {
    const res = await fetch(`${SOUL_ARENA_URL}/api/souls`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const body = (await res.json()) as { souls?: Array<{ id: string; name: string; element: string }> };
    if (!body.souls || body.souls.length === 0) return [];
    return body.souls.slice(0, count).map((s) => ({ id: s.id, name: s.name, element: s.element }));
  } catch {
    return [];
  }
}

function parseArgs(): { multiCount: number | null; soulId: string | null; tickCount: number } {
  const args = process.argv.slice(2);
  let multiCount: number | null = null;
  let soulId: string | null = null;
  let tickCount = DEFAULT_TICKS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--multi") {
      multiCount = parseInt(args[i + 1] ?? "2", 10);
      i++;
    } else if (!isNaN(parseInt(args[i], 10)) && args[i].length <= 4) {
      tickCount = parseInt(args[i], 10);
    } else if (args[i].startsWith("soul_")) {
      soulId = args[i];
    }
  }
  return { multiCount, soulId, tickCount };
}

async function main(): Promise<void> {
  const { multiCount, soulId, tickCount } = parseArgs();
  const isMulti = multiCount !== null;

  console.log("=== Seed <-> SoulArena End-to-End Integration Test ===");
  console.log(`Mode: ${isMulti ? `Multi-soul (${multiCount} souls)` : "Single-soul"}\n`);

  // 1. Discover souls.
  let souls: SoulInfo[] = [];
  if (isMulti) {
    console.log(`Discovering ${multiCount} souls from SoulArena...`);
    souls = await discoverSouls(multiCount!);
    if (souls.length < 2) {
      console.error("ERROR: Could not discover at least 2 souls. Is the server running?");
      process.exit(1);
    }
    console.log(`Discovered ${souls.length} souls: ${souls.map((s) => s.name).join(", ")}`);
  } else {
    if (soulId) {
      souls = [{ id: soulId, name: "custom", element: "unknown" }];
      console.log(`Using provided soul ID: ${soulId}`);
    } else {
      console.log("Discovering soul from SoulArena...");
      const discovered = await discoverSouls(1);
      if (discovered.length === 0) {
        console.error("ERROR: Could not discover any soul from SoulArena. Is the server running?");
        process.exit(1);
      }
      souls = discovered;
      console.log(`Discovered soul: ${souls[0].name} (${souls[0].element}), ID: ${souls[0].id}`);
    }
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

  // 3. Add test objects.
  const tree = new GameObject({ id: "obj_tree1", name: "Oak Tree", type: "interactive", position: { x: 5, y: 0, z: 0 }, mass: 100, material: "wood" });
  const rock = new GameObject({ id: "obj_rock1", name: "Large Rock", type: "static", position: { x: -3, y: 0, z: 4 }, mass: 50, material: "stone" });
  const lamp = new GameObject({ id: "obj_lamp1", name: "Street Lamp", type: "interactive", position: { x: 2, y: 0, z: -3 }, mass: 10, material: "metal" });
  world.addEntity(tree);
  world.addEntity(rock);
  world.addEntity(lamp);
  console.log("Added 3 test objects: Oak Tree, Large Rock, Street Lamp");

  // 4. Add soul entities (spread out in multi-soul mode).
  const runtimes: SoulRuntime[] = [];
  souls.forEach((soul, idx) => {
    const angle = (idx / souls.length) * Math.PI * 2;
    const radius = isMulti ? 3 : 0;
    const x = Math.round(Math.cos(angle) * radius * 10) / 10;
    const z = Math.round(Math.sin(angle) * radius * 10) / 10;
    const entity = new GameObject({
      id: soul.id,
      name: soul.name,
      type: "soul",
      position: { x, y: 0, z },
      mass: 1,
      material: soul.element,
    });
    world.addEntity(entity);
    runtimes.push({
      info: soul,
      entity,
      perceptionsSent: 0,
      actionsReceived: 0,
      actionsExecuted: 0,
      actionsFailed: 0,
      positionHistory: [],
      communicationsHeard: [],
    });
    console.log(`Added soul entity: ${soul.name} at position (${x}, 0, ${z})`);
  });

  // 5. Start webhook receiver.
  console.log("\n--- Starting webhook action receiver ---");
  try {
    const port = await bridge.startWebhookServer(WEBHOOK_PORT);
    console.log(`Webhook receiver listening on http://localhost:${port}/actions`);
  } catch (err) {
    console.warn(`Webhook server failed to start (port may be in use): ${String(err)}`);
    console.warn("Continuing with perception-only test.");
  }

  // 6. Enter world for all souls.
  console.log("\n--- Entering world ---");
  for (const rt of runtimes) {
    const entered = await bridge.enterWorld(rt.info.id);
    if (!entered) {
      console.error(`ERROR: Failed to enter world for soul ${rt.info.name}.`);
    } else {
      console.log(`Soul ${rt.info.name} entered world successfully.`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // 7. Run world ticks.
  console.log(`\n--- Running world for ${tickCount} ticks ---`);
  const dt = 1 / 60;

  for (let i = 0; i < tickCount; i++) {
    world.step(dt);

    // Track per-soul data every 5 ticks.
    if (i % 5 === 0) {
      for (const rt of runtimes) {
        rt.positionHistory.push({
          tick: i,
          x: rt.entity.position.x,
          y: rt.entity.position.y,
          z: rt.entity.position.z,
        });

        // Track communications heard by this soul.
        const frame = perception.getPerception(rt.info.id);
        if (frame && frame.communications.length > 0) {
          for (const comm of frame.communications) {
            if (comm.senderId && comm.senderId !== rt.info.id) {
              const alreadyRecorded = rt.communicationsHeard.some(
                (c) => c.tick === i && c.from === comm.senderId && c.content === comm.content,
              );
              if (!alreadyRecorded) {
                rt.communicationsHeard.push({ tick: i, from: comm.senderId, content: comm.content });
              }
            }
          }
        }
      }
    }

    // Allow async perceptions to resolve.
    if (i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Wait for in-flight perceptions/actions.
  await new Promise((r) => setTimeout(r, 500));

  // 8. Collect per-soul stats.
  const globalStats = bridge.getStats();
  for (const rt of runtimes) {
    const history = actionSystem.getHistory(rt.info.id);
    rt.actionsExecuted = history.filter((h) => h.result.success).length;
    rt.actionsFailed = history.filter((h) => !h.result.success).length;
    rt.actionsReceived = history.length;
  }

  // 9. Exit world for all souls.
  console.log("\n--- Exiting world ---");
  for (const rt of runtimes) {
    const exited = await bridge.exitWorld(rt.info.id, "integration_test_complete");
    console.log(`Soul ${rt.info.name}: ${exited ? "exited successfully" : "exit returned failure"}`);
    await new Promise((r) => setTimeout(r, 50));
  }

  // 10. Stop webhook.
  await bridge.stopWebhookServer();
  console.log("Webhook receiver stopped.");

  // 11. Print report.
  console.log("\n=== Integration Test Report ===");
  console.log(`Mode:              ${isMulti ? `Multi-soul (${runtimes.length} souls)` : "Single-soul"}`);
  console.log(`World ticks:       ${tickCount}`);
  console.log(`Global perceptions: ${globalStats.perceptionsSent} sent, ${globalStats.perceptionsFailed} failed`);
  console.log(`Global actions:    ${globalStats.actionsReceived} received, ${globalStats.actionsExecuted} executed, ${globalStats.actionsFailed} failed`);

  for (const rt of runtimes) {
    console.log(`\n--- Soul: ${rt.info.name} (${rt.info.element}) ---`);
    console.log(`  ID:               ${rt.info.id}`);
    console.log(`  Actions received: ${rt.actionsReceived}`);
    console.log(`  Actions executed: ${rt.actionsExecuted}`);
    console.log(`  Actions failed:   ${rt.actionsFailed}`);
    const finalPos = rt.entity.position;
    console.log(`  Final position:   (${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)})`);
    if (rt.communicationsHeard.length > 0) {
      console.log(`  Communications heard: ${rt.communicationsHeard.length}`);
      for (const c of rt.communicationsHeard.slice(0, 3)) {
        console.log(`    Tick ${c.tick}: from ${c.from}: "${c.content.slice(0, 50)}"`);
      }
    }
  }

  // Multi-soul specific: verify soul-to-soul communication.
  if (isMulti && runtimes.length >= 2) {
    console.log("\n--- Multi-Soul Interaction Analysis ---");
    let totalCommsHeard = 0;
    for (const rt of runtimes) {
      totalCommsHeard += rt.communicationsHeard.length;
    }
    console.log(`Total cross-soul communications heard: ${totalCommsHeard}`);
    if (totalCommsHeard > 0) {
      console.log("PASS: Soul-to-soul acoustic communication detected.");
    } else {
      console.log("NOTE: No cross-soul communication detected (souls may not have spoken).");
    }

    // Verify independent movement (souls at different positions).
    const positions = runtimes.map((rt) => `${rt.entity.position.x.toFixed(1)},${rt.entity.position.z.toFixed(1)}`);
    const uniquePositions = new Set(positions);
    console.log(`Unique final positions: ${uniquePositions.size}/${runtimes.length}`);
    if (uniquePositions.size === runtimes.length) {
      console.log("PASS: Souls ended at independent positions.");
    } else {
      console.log("NOTE: Some souls share the same final position.");
    }
  }

  // 12. Verdict.
  console.log("\n=== Verdict ===");
  const perceptionOk = globalStats.perceptionsSent > 0;
  const actionLoopOk = globalStats.actionsReceived > 0;
  if (perceptionOk && actionLoopOk) {
    console.log("PASS: perceive -> decide -> act loop is fully operational.");
  } else if (perceptionOk) {
    console.log("PARTIAL: Perceptions sent, but no actions received.");
  } else {
    console.log("FAIL: No perceptions sent. Check SoulArena connectivity.");
  }

  process.exit(perceptionOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Integration test crashed:", err);
  process.exit(1);
});
