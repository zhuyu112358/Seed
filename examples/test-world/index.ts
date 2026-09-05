// Test world demo: builds a small 2D world from the SDK, drops Vex/Nova soul
// proxies in, runs physics, demonstrates acoustic communication, then prints
// the evaluation report. Run with: npm run test-world.
import { WorldBuilder, EntityFactory, PhysicsConfig, AcousticPropagation, Message } from '../../src/sdk/index.js';
import { WorldEngine } from '../../src/engine/WorldEngine.js';
import { SoulClient } from '../../src/api/soulClient.js';
import { WorldEvaluator } from '../../src/evaluator/WorldEvaluator.js';
import { SnapshotManager } from '../../src/reliability/SnapshotManager.js';
import { ExceptionHandler } from '../../src/reliability/ExceptionHandler.js';
import { Logger } from '../../src/reliability/Logger.js';
const log = Logger.for('test-world');
async function main(): Promise<void> {
  const snapshots = new SnapshotManager();
  new ExceptionHandler(snapshots, () => snapshots.save({ worldName: 'test-world', worldTime: 0, tick: 0, entities: [] })).install();
  const souls = await new SoulClient().listSouls();
  log.info({ usedMock: souls.usedMock, souls: souls.souls.map((s) => `${s.name}(${s.element})`) }, 'soul roster');
  const vex = souls.souls.find((s) => s.name === 'Vex') ?? souls.souls[0];
  const nova = souls.souls.find((s) => s.name === 'Nova') ?? souls.souls[1];
  const world = new WorldBuilder('test-world')
    .setConfig({ tickRate: 60 })
    .usePhysics(PhysicsConfig.builder().gravity(9.8).restitution(0.6).friction(0.05).airResistance(0.02).build())
    .addEntity(EntityFactory.staticBox('ground', { x: 0, y: -0.5, z: 0 }, { x: 25, y: 0.5, z: 25 }))
    .addEntity(EntityFactory.dynamicBox({ name: 'crate', position: { x: -3, y: 4, z: 0 }, mass: 1, material: 'wood' }))
    .addEntity(EntityFactory.dynamicBox({ name: 'boulder', position: { x: 1.5, y: 6, z: 0 }, mass: 5, material: 'stone' }))
    .addEntity(EntityFactory.dynamicBox({ name: 'ball', position: { x: 0, y: 9, z: 0 }, mass: 0.5, material: 'rubber', velocity: { x: 1.2, y: 0, z: 0 } }))
    .addEntity(EntityFactory.zoneTrigger({ name: 'magic-circle', center: { x: 0, y: 0.6, z: 0 }, halfExtents: { x: 1.5, y: 1.5, z: 1.5 } }))
    .addEntity(EntityFactory.soulProxy({ soulId: vex.id, name: vex.name, element: vex.element, position: { x: -1, y: 1, z: 0 } }))
    .addEntity(EntityFactory.soulProxy({ soulId: nova.id, name: nova.name, element: nova.element, position: { x: 4, y: 1, z: 0 } }))
    .build();
  const evaluator = new WorldEvaluator();
  let collisionCount = 0; let zoneEvents = 0;
  world.events.on('physics.collision', () => { collisionCount++; });
  world.events.on('zone.enter', (e) => { zoneEvents++; log.info({ event: e.payload }, 'zone event'); });
  const engine = new WorldEngine();
  engine.load(world);
  engine.start();
  const TICKS = 180;
  const before = new Map<string, { x: number; y: number }>();
  for (const [id, e] of world.entities) before.set(id, { x: e.position.x, y: e.position.y });
  for (let i = 0; i < TICKS; i++) { const t0 = performance.now(); world.step(1 / 60); evaluator.recordTick(performance.now() - t0); }
  engine.stop();
  console.log('\n--- Final positions ---');
  for (const [id, e] of world.entities) { const b = before.get(id); const dx = e.position.x - (b?.x ?? e.position.x); const dy = e.position.y - (b?.y ?? e.position.y); console.log(`${e.name.padEnd(12)} -> (${e.position.x.toFixed(2)}, ${e.position.y.toFixed(2)}, ${e.position.z.toFixed(2)})  delta=(${dx.toFixed(2)}, ${dy.toFixed(2)})`); }
  console.log(`\ncollisions: ${collisionCount}, zone events: ${zoneEvents}`);
  const acoustic = new AcousticPropagation({ maxRadius: 30, attenuation: 0.02, absorption: 0.01 });
  const vexProxy = world.getEntity(`soul_${vex.id}`)!;
  const msg = new Message({ content: `@${nova.name}: can you hear me?`, sourceId: vexProxy.id, position: vexProxy.position.toObject(), medium: 'acoustic', intensity: 1 });
  const received = acoustic.transmit(msg, vexProxy as never, { entities: world.bodies(), byId: (id) => world.getEntity(id) as never });
  console.log('\n--- Acoustic demo ---');
  console.log(`Vex says: "${msg.content}" from ${vexProxy.position.toString()}`);
  for (const r of received) { console.log(`  -> received at distance ${r.distance.toFixed(2)}m, intensity ${r.receivedIntensity.toFixed(3)}`); }
  const snapFile = snapshots.save({ worldName: 'test-world', worldTime: world.worldTime, tick: world.tick, entities: [...world.entities.values()] });
  console.log(`\nsnapshot: ${snapFile}`);
  evaluator.bump('messages', received.length);
  evaluator.flush(world);
}
main().catch((err) => { log.error({ err: String(err?.stack ?? err) }, 'test-world failed'); process.exit(1); });
