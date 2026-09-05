/**
 * Seed SDK Example: Soul Interaction
 *
 * Demonstrates the complete perceive→decide→act loop for soul entities:
 * 1. SoulPerceptionSystem generates PerceptionFrame each tick
 * 2. SoulBridgeAdapter sends perception to SoulArena and receives actions
 * 3. SoulActionSystem executes actions and feeds results back
 *
 * Note: This example requires a running SoulArena server at localhost:3000.
 * For testing without SoulArena, see the mock adapter pattern below.
 *
 * Run: npx tsx examples/sdk-usage/soul-interaction.ts
 */

import {
  WorldBuilder,
  PhysicsSystem,
  PhysicsConfig,
  SoulPerceptionSystem,
  SoulActionSystem,
  SoulBridgeAdapter,
  SoulClient,
  GameObject,
  Vector3,
  WeatherSimulator,
  LightSystem,
  ThermalSystem,
  Logger,
} from '../../src/sdk/index.js';

const log = Logger.for('sdk-example-soul-interaction');

// ============================================================================
// Configuration
// ============================================================================

const SOUL_ARENA_URL = process.env.SOUL_ARENA_URL || 'http://localhost:3000';
const TEST_SOUL_ID = process.env.TEST_SOUL_ID || 'soul_test_001';
const SIMULATION_TICKS = 300; // 5 seconds at 60 Hz

// ============================================================================
// World Setup
// ============================================================================

const world = new WorldBuilder('soul-interaction-demo')
  .setConfig({ tickRate: 60 })
  .usePhysics(new PhysicsConfig({ gravity: 0, friction: 0.1 }))
  .build();

// Environment systems
const weather = new WeatherSimulator({ initialState: 'clear' });
const light = new LightSystem();
const thermal = new ThermalSystem();
world.addSystem(weather);
world.addSystem(light);
world.addSystem(thermal);

// Soul interaction systems
// Note: SoulPerceptionSystem and SoulActionSystem must be added BEFORE
// SoulBridgeAdapter, as the bridge lazy-locates them by system name.
const perception = new SoulPerceptionSystem({
  viewDistance: 30,
  maxVisibleEntities: 20,
  commRetentionTicks: 300,
  eventRetentionTicks: 600,
  sensoryRange: 15,
  maxNearbySensory: 8,
});

const action = new SoulActionSystem({
  maxMoveDistance: 5,
  movementMode: 'physics',
  physicsMoveSpeed: 3,
  pathfindingEnabled: false, // Set to true if PathfinderSystem is registered
});

world.addSystem(perception);
world.addSystem(action);

// ============================================================================
// Soul Arena Bridge
// ============================================================================

// SoulBridgeAdapter takes only config in constructor.
// It lazy-locates SoulPerceptionSystem and SoulActionSystem from the world
// by their system names ('soul-perception' and 'soul-action').
// Alternatively, use bridge.bindSystems(perception, action) for explicit binding.
const bridge = new SoulBridgeAdapter({
  soulArenaUrl: SOUL_ARENA_URL,
  perceiveIntervalTicks: 10, // Send perception every 10 ticks
  enableSituationMode: true, // Use simplified situation text (recommended)
  perceiveTimeoutMs: 2000,
  maxQueuedActionsPerSoul: 20,
  webhookPort: 3001,
  worldId: 'sdk-demo-world',
  worldName: 'SDK Demo World',
});

world.addSystem(bridge);

log.info('World systems initialized', {
  systems: world.systems.map(s => s.name),
  soulArenaUrl: SOUL_ARENA_URL,
});

// ============================================================================
// Entity Setup
// ============================================================================

// Create a soul entity
const soul = new GameObject({
  id: TEST_SOUL_ID,
  name: 'Test Soul',
  type: 'soul',
  position: { x: 0, y: 0, z: 0 },
  halfExtents: { x: 0.4, y: 0.9, z: 0.4 },
  mass: 1,
  material: 'flesh',
});
world.addEntity(soul);

// Add some environmental objects for the soul to perceive
const tree = new GameObject({
  id: 'tree_001',
  name: 'Oak Tree',
  type: 'static',
  position: { x: 5, y: 0, z: 3 },
  halfExtents: { x: 1, y: 3, z: 1 },
  mass: 0,
  material: 'wood',
});
world.addEntity(tree);

const rock = new GameObject({
  id: 'rock_001',
  name: 'Large Rock',
  type: 'static',
  position: { x: -4, y: 0, z: 6 },
  halfExtents: { x: 1.5, y: 1, z: 1.2 },
  mass: 0,
  material: 'stone',
});
world.addEntity(rock);

log.info('Entities created', {
  souls: 1,
  staticObjects: 2,
  total: world.entities.size,
});

// ============================================================================
// Simulation Loop
// ============================================================================

log.info('Starting simulation', { ticks: SIMULATION_TICKS, soulId: TEST_SOUL_ID });

world.start();
const dt = 1 / 60;

let actionsExecuted = 0;
let perceptionsGenerated = 0;

for (let i = 0; i < SIMULATION_TICKS; i++) {
  world.step(dt);

  // Check perception every 30 ticks (0.5 seconds)
  if (i % 30 === 0) {
    const frame = perception.getPerception(TEST_SOUL_ID);
    if (frame) {
      perceptionsGenerated++;
      log.info('Perception frame', {
        tick: i,
        visibleEntities: frame.visibleEntities?.length || 0,
        nearbySouls: frame.nearbySouls?.length || 0,
        communications: frame.communications?.length || 0,
        weather: frame.environment?.weather,
        temperature: frame.environment?.temperature,
        position: { x: frame.position?.x.toFixed(1), z: frame.position?.z.toFixed(1) },
      });
    }
  }

  // Check action history
  const history = (action as any).history;
  if (history && history.length > actionsExecuted) {
    const latest = history[history.length - 1];
    actionsExecuted = history.length;
    log.info('Action executed', {
      tick: i,
      action: latest.request?.action,
      success: latest.result?.success,
      message: latest.result?.message,
    });
  }
}

world.stop();

// ============================================================================
// Final Report
// ============================================================================

log.info('Simulation complete', {
  totalTicks: SIMULATION_TICKS,
  perceptionsGenerated,
  actionsExecuted,
  finalPosition: { x: soul.position.x.toFixed(2), z: soul.position.z.toFixed(2) },
  finalVelocity: { x: soul.velocity.x.toFixed(2), z: soul.velocity.z.toFixed(2) },
});

// ============================================================================
// Mock Adapter Pattern (for testing without SoulArena)
// ============================================================================
//
// To test without a running SoulArena server, you can create a mock bridge
// that generates actions locally:
//
// class MockSoulBridge {
//   constructor(private perception: SoulPerceptionSystem, private action: SoulActionSystem) {}
//
//   tick(dt: number, world: World) {
//     const frame = this.perception.getPerception(TEST_SOUL_ID);
//     if (!frame) return;
//
//     // Simple mock decision: move toward the nearest visible entity
//     if (frame.visibleEntities && frame.visibleEntities.length > 0) {
//       const target = frame.visibleEntities[0];
//       this.action.executeAction({
//         soulId: TEST_SOUL_ID,
//         action: 'move',
//         parameters: { x: target.position.x, y: 0, z: target.position.z },
//         timestamp: Date.now(),
//       }, world);
//     }
//   }
//
//   start() {}
//   stop() {}
//   readonly name = 'mock-soul-bridge';
//   enabled = true;
// }
//
// Then use world.addSystem(new MockSoulBridge(perception, action)) instead
// of SoulBridgeAdapter.
// ============================================================================
