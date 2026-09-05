/**
 * Seed SDK Example: Basic World
 *
 * Demonstrates how to create a virtual world using the Seed SDK,
 * add entities and systems, and run the simulation loop.
 *
 * Run: npx tsx examples/sdk-usage/basic-world.ts
 */

import {
  WorldBuilder,
  PhysicsSystem,
  PhysicsConfig,
  GameObject,
  Vector3,
  EventSystem,
  Logger,
} from '../../src/sdk/index.js';

const log = Logger.for('sdk-example-basic-world');

// 1. Build a world with physics enabled
const world = new WorldBuilder('basic-world-demo')
  .setConfig({ tickRate: 60 })
  .usePhysics(PhysicsConfig.defaults())
  .build();

log.info('World created', { name: world.config.name, tickRate: world.config.tickRate });

// 2. Add a static obstacle (wall)
const wall = new GameObject({
  id: 'wall_001',
  name: 'North Wall',
  type: 'static',
  position: { x: 0, y: 0, z: 10 },
  halfExtents: { x: 5, y: 2, z: 0.5 },
  mass: 0, // 0 = immovable
  material: 'stone',
});
world.addEntity(wall);

// 3. Add a dynamic entity (a ball)
const ball = new GameObject({
  id: 'ball_001',
  name: 'Rolling Ball',
  type: 'dynamic',
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 5 }, // Moving toward the wall at 5 m/s
  halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  mass: 1,
  material: 'rubber',
});
world.addEntity(ball);

log.info('Entities added', { entities: world.entities.size });

// 4. Listen for collision events
const events = world.systems.find(s => s.name === 'event-system') as EventSystem | undefined;
if (events) {
  events.on('physics.collision', (event: any) => {
    log.info('Collision detected', {
      a: event.payload?.a,
      b: event.payload?.b,
      relativeSpeed: event.payload?.relativeSpeed,
    });
  });
}

// 5. Run the simulation for 3 seconds (180 ticks at 60 Hz)
world.start();
const dt = 1 / 60;
const totalTicks = 180;

for (let i = 0; i < totalTicks; i++) {
  world.step(dt);

  // Log position every 30 ticks (0.5 seconds)
  if (i % 30 === 0) {
    const b = world.getEntity('ball_001')!;
    log.info('Simulation tick', {
      tick: i,
      ballPosition: { x: b.position.x.toFixed(2), z: b.position.z.toFixed(2) },
      ballVelocity: { x: b.velocity.x.toFixed(2), z: b.velocity.z.toFixed(2) },
    });
  }
}

world.stop();
log.info('Simulation complete');

// 6. Final state
const finalBall = world.getEntity('ball_001')!;
log.info('Final state', {
  ballPosition: { x: finalBall.position.x.toFixed(2), z: finalBall.position.z.toFixed(2) },
  ballVelocity: { x: finalBall.velocity.x.toFixed(2), z: finalBall.velocity.z.toFixed(2) },
});
