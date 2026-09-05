// Test world demo: builds a small 2D world from the engine SDK, drops Vex/Nova soul
// proxies in, runs physics, demonstrates acoustic communication, then writes and
// prints an evaluation report. Run with: npm run test-world.
//
// Robust notes: avoids src/engine/WorldEngine.ts (on-disk revision imports modules
// that do not yet exist); drives the stable src/engine/World directly; all
// evaluator calls go through `any` so it compiles/runs against either revision.

import path from 'node:path';
import { EntityFactory } from '../../src/entity/EntityFactory.js';
import type { GameObject } from '../../src/entity/Entity.js';
import { World } from '../../src/engine/World.js';
import { PhysicsSystem } from '../../src/physics/PhysicsSystem.js';
import { PhysicsConfig } from '../../src/physics/PhysicsConfig.js';
import { AcousticPropagation } from '../../src/communication/AcousticPropagation.js';
import { Message } from '../../src/communication/Message.js';
import { SoulClient } from '../../src/api/soulClient.js';
import { WorldEvaluator } from '../../src/evaluator/WorldEvaluator.js';
import { SnapshotManager } from '../../src/reliability/SnapshotManager.js';
import { ExceptionHandler } from '../../src/reliability/ExceptionHandler.js';
import { Logger } from '../../src/reliability/Logger.js';

const log = Logger.for('test-world');

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[idx] ?? 0;
}

async function main(): Promise<void> {
  const snapshots = new SnapshotManager();
  new ExceptionHandler(
    snapshots,
    () => snapshots.save({ worldName: 'test-world', worldTime: 0, tick: 0, entities: [] }),
  ).install();

  const souls = await new SoulClient().listSouls();
  log.info(
    { usedMock: souls.usedMock, souls: souls.souls.map((s) => `${s.name}(${s.element})`) },
    'soul roster',
  );
  const vex = souls.souls.find((s) => s.name === 'Vex') ?? souls.souls[0];
  const nova = souls.souls.find((s) => s.name === 'Nova') ?? souls.souls[1];

  const world = new World({ name: 'test-world', tickRate: 60 });
  const physics = new PhysicsSystem({
    config: PhysicsConfig.builder().gravity(9.8).restitution(0.6).friction(0.05).airResistance(0.02).build(),
  });
  world.addSystem(physics);

  world.addEntity(EntityFactory.staticBox('ground', { x: 0, y: -0.5, z: 0 }, { x: 25, y: 0.5, z: 25 }));
  world.addEntity(EntityFactory.dynamicBox({ name: 'crate', position: { x: -3, y: 4, z: 0 }, mass: 1, material: 'wood' }));
  world.addEntity(EntityFactory.dynamicBox({ name: 'boulder', position: { x: 1.5, y: 6, z: 0 }, mass: 5, material: 'stone' }));
  world.addEntity(
    EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 9, z: 0 }, mass: 0.5, material: 'rubber', velocity: { x: 1.2, y: 0, z: 0 } }),
  );
  world.addEntity(
    EntityFactory.zoneTrigger({ name: 'magic-circle', center: { x: 0, y: 0.6, z: 0 }, halfExtents: { x: 1.5, y: 1.5, z: 1.5 } }),
  );
  world.addEntity(EntityFactory.soulProxy({ soulId: vex.id, name: vex.name, element: vex.element, position: { x: -1, y: 1, z: 0 } }));
  world.addEntity(EntityFactory.soulProxy({ soulId: nova.id, name: nova.name, element: nova.element, position: { x: 4, y: 1, z: 0 } }));

  const TICKS = 180;
  const dt = 1 / 60;
  let collisionCount = 0;
  let zoneEvents = 0;
  const tickSamples: number[] = [];
  world.events.on('physics.collision', () => { collisionCount++; });
  world.events.on('zone.enter', (e) => {
    zoneEvents++;
    log.info({ event: e.payload }, 'zone event');
  });

  const before = new Map<string, { x: number; y: number }>();
  for (const [id, e] of world.entities) before.set(id, { x: e.position.x, y: e.position.y });

  world.start();
  const runStart = performance.now();
  for (let i = 0; i < TICKS; i++) {
    const t0 = performance.now();
    world.step(dt);
    tickSamples.push(performance.now() - t0);
  }
  const runMs = performance.now() - runStart;
  world.stop();

  console.log('\n--- Final positions ---');
  for (const [id, e] of world.entities) {
    const b = before.get(id);
    const dx = e.position.x - (b?.x ?? e.position.x);
    const dy = e.position.y - (b?.y ?? e.position.y);
    console.log(
      `${e.name.padEnd(12)} [${id}] -> (${e.position.x.toFixed(2)}, ${e.position.y.toFixed(2)}, ${e.position.z.toFixed(2)})  d=(${dx.toFixed(2)}, ${dy.toFixed(2)})`,
    );
  }
  console.log(`\ncollisions: ${collisionCount}, zone events: ${zoneEvents}`);

  const acoustic = new AcousticPropagation({ maxRadius: 30, attenuation: 0.02, absorption: 0.01 });
  const vexProxy = world.getEntity(`soul_${vex.id}`) as GameObject | undefined;
  if (!vexProxy) throw new Error(`soul proxy for Vex not found (id soul_${vex.id})`);
  const msg = new Message({
    content: `@${nova.name}: can you hear me?`,
    sourceId: vexProxy.id,
    position: vexProxy.position.toObject(),
    medium: 'acoustic',
    intensity: 1,
  });
  const received = acoustic.transmit(msg, vexProxy, { entities: world.bodies(), byId: (id) => world.getEntity(id) as GameObject | undefined });
  console.log('\n--- Acoustic demo ---');
  console.log(`Vex says: "${msg.content}" from ${vexProxy.position.toString()}`);
  for (const r of received) {
    console.log(`  -> heard at distance ${r.distance.toFixed(2)}m, intensity ${r.receivedIntensity.toFixed(3)}`);
  }

  const snapFile = snapshots.save({
    worldName: 'test-world',
    worldTime: world.worldTime,
    tick: world.tick,
    entities: [...world.entities.values()],
  });
  console.log(`\nsnapshot: ${snapFile}`);

  const sorted = [...tickSamples].sort((a, b) => a - b);
  const avgTick = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const p99 = percentile(sorted, 0.99);
  const seconds = Math.max(0.001, runMs / 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = WorldEvaluator as any;
  // Construct defensively: the rich revision throws on a no-arg construction,
  // which tells us we must use the {worldEngine} branch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let probe: any = null;
  try {
    probe = new Ctor();
  } catch {
    probe = null;
  }
  if (probe && typeof probe.recordTick === 'function') {
    for (const ms of tickSamples) probe.recordTick(ms);
    probe.bump('collisions', collisionCount);
    probe.bump('events', collisionCount + zoneEvents);
    probe.bump('messages', received.length);
    probe.flush(world);
  } else {
    const shimEngine = {
      getStats: () => ({
        tickCount: TICKS, uptimeMs: runMs, entityCount: world.entities.size, activeEvents: 0,
        avgTickTimeMs: Math.round(avgTick * 1000) / 1000, p99TickTimeMs: Math.round(p99 * 1000) / 1000,
        fps: avgTick > 0 ? Math.round(1000 / avgTick) : 0,
        memoryUsageMB: Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 1000) / 1000,
        collisionsPerSecond: Math.round((collisionCount / seconds) * 1000) / 1000,
        interactionsPerSecond: Math.round((received.length / seconds) * 1000) / 1000,
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rich: any = new Ctor({ worldEngine: shimEngine, reportsDir: 'logs' });
    rich.bump('eventTriggers', collisionCount + zoneEvents);
    rich.bump('communications', received.length);
    if (typeof rich.setActiveSouls === 'function') rich.setActiveSouls(2);
    rich.printReport();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.resolve('logs', `eval-${stamp}.json`);
    await rich.saveReport(reportPath);
    console.log(`\nreport: ${reportPath}`);
  }
}

main().catch((err) => {
  log.error({ err: String(err?.stack ?? err) }, 'test-world failed');
  process.exit(1);
});
