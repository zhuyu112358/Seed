/**
 * Seed SDK Example: Pathfinding
 *
 * Demonstrates how to use the A* pathfinding system, path smoothing,
 * and path following to navigate entities around obstacles.
 *
 * Run: npx tsx examples/sdk-usage/pathfinding.ts
 */

import {
  WorldBuilder,
  PhysicsSystem,
  PhysicsConfig,
  PathfinderSystem,
  PathSmoother,
  PathFollowerSystem,
  MovementController,
  GameObject,
  Vector3,
  Logger,
} from '../../src/sdk/index.js';

const log = Logger.for('sdk-example-pathfinding');

// 1. Build a world with physics, pathfinding, and movement control
const world = new WorldBuilder('pathfinding-demo')
  .setConfig({ tickRate: 60 })
  .usePhysics(new PhysicsConfig({ gravity: 0, friction: 0.05 }))
  .build();

// Pathfinder with smoothing enabled
const pathfinder = new PathfinderSystem({
  width: 50,
  height: 50,
  cellSize: 1,
  blockingTypes: ['static'],
  enableSmoothing: true, // Auto-smooth paths with string-pulling
});

// Movement controller for arrival detection
const controller = new MovementController({
  distanceMode: '2d',
  arrivalThreshold: 0.2,
  enableEarlyStop: true,
});

// Path follower with dynamic aiming (prevents overshoot)
const follower = new PathFollowerSystem({
  moveSpeed: 4,
  enableDynamicAiming: true, // Re-aim velocity each tick
});

world.addSystem(pathfinder);
world.addSystem(controller);
world.addSystem(follower);

// 2. Create a maze-like obstacle course (walls)
const walls: GameObject[] = [];

// Vertical wall with a gap
for (let z = 0; z < 20; z++) {
  if (z >= 8 && z <= 11) continue; // Gap at z=8-11
  walls.push(new GameObject({
    id: `wall_v_${z}`,
    name: 'Vertical Wall',
    type: 'static',
    position: { x: 15, y: 0, z },
    halfExtents: { x: 0.5, y: 1, z: 0.5 },
    mass: 0,
    material: 'stone',
  }));
}

// Horizontal wall
for (let x = 5; x < 25; x++) {
  if (x >= 12 && x <= 15) continue; // Gap
  walls.push(new GameObject({
    id: `wall_h_${x}`,
    name: 'Horizontal Wall',
    type: 'static',
    position: { x, y: 0, z: 25 },
    halfExtents: { x: 0.5, y: 1, z: 0.5 },
    mass: 0,
    material: 'stone',
  }));
}

walls.forEach(w => world.addEntity(w));
log.info('Obstacles created', { wallCount: walls.length });

// 3. Add a navigating entity (the "player")
const player = new GameObject({
  id: 'player_001',
  name: 'Navigator',
  type: 'dynamic',
  position: { x: 5, y: 0, z: 5 },
  halfExtents: { x: 0.4, y: 0.5, z: 0.4 },
  mass: 1,
  material: 'flesh',
});
world.addEntity(player);

// 4. Build the navigation grid (scan obstacles)
pathfinder.rebuildGrid(world);
log.info('Navigation grid built', { blockedCells: pathfinder.blockedCellCount });

// 5. Find a path from start to goal (around obstacles)
const start = { x: 5, z: 5 };
const goal = { x: 30, z: 30 };

const path = pathfinder.findPath(start.x, start.z, goal.x, goal.z, world);

if (!path) {
  log.error('No path found!');
  process.exit(1);
}

log.info('Path found', {
  waypoints: path.waypoints.length,
  length: path.length.toFixed(2),
  cellsExplored: path.cellsExplored,
});

// 6. Manually smooth the path (demonstrates PathSmoother API)
const smoother = new PathSmoother(pathfinder.grid);
const smoothed = smoother.smooth(path.waypoints);
log.info('Path smoothed', {
  originalWaypoints: path.waypoints.length,
  smoothedWaypoints: smoothed.waypoints.length,
  removed: smoothed.removed,
  smoothedLength: smoothed.length.toFixed(2),
});

// 7. Set the path on the player for PathFollowerSystem to follow
player.state.set('movePath', smoothed.waypoints);
player.state.set('movePathIndex', 0);
player.state.set('moveTarget', {
  x: smoothed.waypoints[0].x,
  y: player.position.y,
  z: smoothed.waypoints[0].z,
});
player.state.set('movementMode', 'physics');

// Set initial velocity toward first waypoint
const firstWp = smoothed.waypoints[0];
const dx = firstWp.x - player.position.x;
const dz = firstWp.z - player.position.z;
const len = Math.sqrt(dx * dx + dz * dz) || 1;
player.velocity = new Vector3((dx / len) * 4, 0, (dz / len) * 4);

// 8. Run the simulation until path is completed
world.start();
const dt = 1 / 60;
let completed = false;

for (let i = 0; i < 600; i++) { // Max 10 seconds
  world.step(dt);

  if (i % 60 === 0) { // Log every second
    log.info('Navigation tick', {
      tick: i,
      position: { x: player.position.x.toFixed(1), z: player.position.z.toFixed(1) },
      pathIndex: player.state.get('movePathIndex'),
      speed: Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2).toFixed(2),
    });
  }

  if (!player.state.get('movePath')) {
    completed = true;
    log.info('Path completed!', { tick: i });
    break;
  }
}

world.stop();

// 9. Final state
log.info('Final state', {
  completed,
  finalPosition: { x: player.position.x.toFixed(2), z: player.position.z.toFixed(2) },
  goal,
  distanceToGoal: Math.sqrt(
    (player.position.x - goal.x) ** 2 + (player.position.z - goal.z) ** 2
  ).toFixed(2),
});
