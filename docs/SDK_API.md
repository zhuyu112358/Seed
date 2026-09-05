# Seed SDK API Reference (v1.0.0)

This document provides a comprehensive reference for the Seed virtual world engine SDK.
External applications (e.g., SoulGame) can import all public APIs from the `seed-system` package.

## Quick Start

```typescript
import {
  WorldBuilder,
  SoulBridgeAdapter,
  SoulPerceptionSystem,
  SoulActionSystem,
  SoulClient,
  PhysicsSystem,
  PathfinderSystem,
  GameObject,
  Vector3,
} from 'seed-system';

// Build a world
const world = new WorldBuilder('my-world')
  .setConfig({ tickRate: 60 })
  .usePhysics()
  .build();

// Add soul interaction systems
const perception = new SoulPerceptionSystem({ viewDistance: 30 });
const action = new SoulActionSystem({ pathfindingEnabled: true, smoothPaths: true });
const soulClient = new SoulClient('http://localhost:3000');
const bridge = new SoulBridgeAdapter({ perception, action, soulClient });

world.addSystem(perception);
world.addSystem(action);
world.addSystem(bridge);

// Add a soul entity
const soul = new GameObject({
  id: 'soul_001', name: 'TestSoul', type: 'soul',
  position: { x: 0, y: 0, z: 0 }, mass: 1, material: 'wind',
});
world.addEntity(soul);

// Run the world
world.start();
setInterval(() => world.step(1 / 60), 1000 / 60);
```

---

## Core Engine

### World

The central container for all entities, systems, and the tick loop.

```typescript
import { World } from 'seed-system';

const world = new World({ name: 'my-world', tickRate: 60 });
```

**Methods:**
- `addEntity(entity: Entity): void` — Add an entity to the world
- `removeEntity(id: string): void` — Remove an entity by ID
- `getEntity(id: string): Entity | undefined` — Get an entity by ID
- `addSystem(system: WorldSystem): void` — Register a system
- `step(dt: number): void` — Advance the simulation by dt seconds
- `start(): void` — Start all systems
- `stop(): void` — Stop all systems
- `bodies(): GameObject[]` — Get all physics bodies

**Properties:**
- `config: WorldConfig` — World configuration (name, tickRate)
- `entities: Map<string, Entity>` — All entities
- `systems: WorldSystem[]` — All registered systems
- `tick: number` — Current tick count

### WorldSystem Interface

All systems implement this interface.

```typescript
interface WorldSystem {
  readonly name: string;
  enabled: boolean;
  tick(dt: number, world: World, events: EventSystem): void;
  start(): void;
  stop(): void;
}
```

---

## Entity System

### GameObject

The core entity class with physics properties and a state map.

```typescript
import { GameObject, Vector3 } from 'seed-system';

const obj = new GameObject({
  id: 'obj_001',
  name: 'MyObject',
  type: 'static',  // 'soul' | 'static' | 'dynamic' | 'trigger' | custom
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  mass: 1,
  material: 'stone',
  halfExtents: { x: 0.5, y: 0.5, z: 0.5 },  // AABB half-extents
});
```

**Properties:**
- `id: string` — Unique identifier
- `name: string` — Human-readable name
- `type: string` — Entity type (used for collision filtering, path blocking, etc.)
- `position: Vector3` — World position
- `velocity: Vector3` — Current velocity
- `rotation: Vector3` — Euler rotation
- `mass: number` — Physics mass (0 = static/immovable)
- `material: string` — Physics material
- `halfExtents: Vector3` — AABB collision half-extents
- `state: Map<string, any>` — Arbitrary state storage (used by systems for moveTarget, movePath, etc.)

**Methods:**
- `applyForce(force: Vector3): void` — Apply a force (affects velocity based on mass)
- `getAABB(): AABB` — Get axis-aligned bounding box

### Vector3

3D vector with math utilities.

```typescript
import { Vector3 } from 'seed-system';

const v = new Vector3(1, 2, 3);
v.add(new Vector3(0, 1, 0));
v.normalize();
const len = v.length();
```

**Methods:** `add`, `sub`, `mul`, `div`, `normalize`, `length`, `lengthSq`, `distanceTo`, `clone`, `set`, `dot`, `cross`

### EntityFactory

Factory for creating common entity types.

```typescript
import { EntityFactory } from 'seed-system';

const soul = EntityFactory.createSoul('soul_001', 'TestSoul', { x: 0, y: 0, z: 0 });
const wall = EntityFactory.createStatic('wall_001', 'Wall', { x: 10, y: 0, z: 5 });
```

---

## Physics

### PhysicsSystem

Physics simulation with gravity, friction, velocity integration, and Quadtree spatial partitioning.

```typescript
import { PhysicsSystem, PhysicsConfig } from 'seed-system';

const physics = new PhysicsSystem({
  gravity: 9.8,        // m/s² (use 0 for top-down / zero-g worlds)
  friction: 0.1,
  airResistance: 0.05,
  restitution: 0.6,
});
world.addSystem(physics);
```

**Config:** `gravity`, `friction`, `airResistance`, `restitution`, `fixedDt`, `enabled`

### CollisionSystem

Top-down x/z plane AABB collision detection with position separation and velocity response.

```typescript
import { CollisionSystem } from 'seed-system';

const collision = new CollisionSystem({
  collidableTypes: ['soul', 'static', 'dynamic'],
  restitution: 0.3,
  slop: 0.02,  // Position correction tolerance (prevents jitter)
});
world.addSystem(collision);
```

**Events:** Emits `physics.collision` events with `{ a, b, point, relativeSpeed }`

### MovementController

Arrival detection and velocity control for entities with a `moveTarget`.

```typescript
import { MovementController } from 'seed-system';

const controller = new MovementController({
  distanceMode: '2d',           // '2d' (ignore y) or '3d'
  arrivalThreshold: 0.15,       // Distance at which entity is "arrived"
  enableEarlyStop: true,        // Stop when speed drops below minSpeed
  minSpeed: 0.05,
  enableAcceleration: false,    // Active velocity control with accel/decel curves
  maxAcceleration: 10,
  maxDeceleration: 15,
  cruiseSpeed: 5,
});
world.addSystem(controller);
```

**State:** Reads `moveTarget` from entity.state, clears it on arrival and emits `movement.arrived` event.

---

## Pathfinding

### GridMap

Configurable grid navigation map.

```typescript
import { GridMap } from 'seed-system';

const grid = new GridMap({
  width: 100, height: 100,  // Grid dimensions in cells
  cellSize: 1,               // World units per cell
  originX: 0, originZ: 0,   // World position of grid origin
  allowDiagonal: true,       // 8-direction movement
});
```

**Methods:** `isWalkable(x, z)`, `blockRegion(minX, minZ, maxX, maxZ)`, `clear()`, `worldToCellX(x)`, `worldToCellZ(z)`, `cellToWorld(cx, cz)`

### AStarPathfinder

A* pathfinding algorithm.

```typescript
import { AStarPathfinder } from 'seed-system';

const pathfinder = new AStarPathfinder(100000); // maxIterations
const result = pathfinder.findPath(startX, startZ, goalX, goalZ, grid);
// result: { waypoints: [{x, z}], length: number, cellsExplored: number } | null
```

### PathfinderSystem

WorldSystem integration with automatic obstacle scanning.

```typescript
import { PathfinderSystem } from 'seed-system';

const pathfinder = new PathfinderSystem({
  width: 100, height: 100, cellSize: 1,
  autoUpdate: true,
  blockingTypes: ['static'],
  respectBlocksPathFlag: true,
  enableSmoothing: true,  // Auto-smooth paths with PathSmoother
});
world.addSystem(pathfinder);
```

**Methods:** `findPath(startX, startZ, goalX, goalZ, world?)`, `smoothPath(waypoints)`, `markDirty()`, `rebuildGrid(world)`

### PathSmoother

String-pulling path smoothing with DDA line-of-sight.

```typescript
import { PathSmoother } from 'seed-system';

const smoother = new PathSmoother(grid);
const result = smoother.smooth(waypoints);
// result: { waypoints: [{x, z}], removed: number, length: number }
```

**Methods:** `smooth(waypoints)`, `hasLineOfSight(x1, z1, x2, z2)`

### PathFollowerSystem

Path following with per-waypoint advancement.

```typescript
import { PathFollowerSystem } from 'seed-system';

const follower = new PathFollowerSystem({
  moveSpeed: 5,
  emitCompletionEvent: true,
  enableDynamicAiming: true,  // Re-aim velocity each tick (prevents overshoot)
});
world.addSystem(follower);
```

**State:** Reads `movePath` and `movePathIndex` from entity.state, sets `moveTarget` for each waypoint.

---

## Soul Interaction (Core Bridge)

### SoulPerceptionSystem

Generates PerceptionFrame for every soul each tick.

```typescript
import { SoulPerceptionSystem } from 'seed-system';

const perception = new SoulPerceptionSystem({
  viewDistance: 30,           // Max distance for entity visibility
  hearingRange: 20,           // Max distance for acoustic communication
  maxVisibleEntities: 50,     // Cap on visible entities per frame
  includeWeather: true,
  includeLight: true,
  includeTemperature: true,
  includeWind: true,
});
world.addSystem(perception);
```

**Methods:** `getPerception(soulId): PerceptionFrame | undefined`, `getAllPerceptions(): ReadonlyMap<string, PerceptionFrame>`

**PerceptionFrame structure:**
```typescript
interface PerceptionFrame {
  soulId: string;
  timestamp: number;
  position: { x: number; y: number; z: number };
  visibleEntities: Array<{ id, name, type, position, distance }>;
  nearbySouls: Array<{ id, name, position, distance }>;
  communications: Array<{ senderId, content, medium, distance, volume }>;
  environment: {
    weather: WeatherState;
    temperature: number;
    lightLevel: number;
    wind: { speed: number; direction: number };
    timeOfDay: number;
  };
  events: Array<{ id, name, type, severity, position, timestamp }>;
  lastActionResults?: Array<{ action, success, message }>;
}
```

### SoulActionSystem

Executes ActionRequest from souls.

```typescript
import { SoulActionSystem } from 'seed-system';

const action = new SoulActionSystem({
  maxMoveDistance: 5,
  maxInteractDistance: 3,
  movementMode: 'instant',   // 'instant' or 'physics'
  physicsMoveSpeed: 5,
  pathfindingEnabled: false,  // Enable A* pathfinding for move actions
  smoothPaths: false,         // Auto-smooth paths (requires pathfindingEnabled)
  acoustic: { ... },          // Acoustic propagation config for communicate
});
world.addSystem(action);
```

**Methods:** `executeAction(request: ActionRequest, world: World): ActionResult`

**ActionRequest structure:**
```typescript
interface ActionRequest {
  soulId: string;
  action: 'move' | 'communicate' | 'interact' | 'stop';
  parameters: Record<string, any>;
  timestamp: number;
}
```

**Move action formats (6 types):**
1. Absolute: `{ x, y, z }`
2. Relative: `{ dx, dy, dz }`
3. Direction string: `{ direction: 'north'|'south'|'east'|'west'|'northeast'|... }`
4. Direction vector: `{ direction: { x, z } }`
5. Angle: `{ angle: 45 }` (degrees, 0=north)
6. Stop: `{}` (clears movement)

### SoulBridgeAdapter

Orchestrates the perceive→decide→act loop with SoulArena.

```typescript
import { SoulBridgeAdapter, SoulClient, SoulPerceptionSystem, SoulActionSystem } from 'seed-system';

const bridge = new SoulBridgeAdapter({
  perception,           // SoulPerceptionSystem instance
  action,               // SoulActionSystem instance
  soulClient,           // SoulClient instance (pointing to SoulArena)
  webhookPort: 3001,   // Port for action receiver webhook
  perceiveInterval: 100, // ms between perceive calls
});
world.addSystem(bridge);
```

**Flow:**
1. Gather PerceptionFrame from SoulPerceptionSystem
2. Convert to SoulArena perception format
3. Call SoulArena perceive API
4. Receive action decisions from SoulArena
5. Convert to ActionRequest
6. Call SoulActionSystem.executeAction()
7. Feed ActionResult back to SoulArena in next perception frame

### SoulClient

HTTP client for SoulArena API.

```typescript
import { SoulClient } from 'seed-system';

const client = new SoulClient('http://localhost:3000');
const souls = await client.listSouls();
const perception = await client.perceive(soulId, frame);
const result = await client.action(soulId, action);
await client.enterWorld(soulId, worldId);
await client.exitWorld(soulId);
```

---

## Communication

### AcousticPropagation

Sound wave propagation with distance attenuation and obstacle occlusion.

```typescript
import { AcousticPropagation } from 'seed-system';

const acoustic = new AcousticPropagation({
  speedOfSound: 343,     // m/s
  baseRange: 20,          // Base hearing range
  attenuation: 0.1,       // Distance attenuation factor
  obstacleLoss: 0.5,      // Volume loss per obstacle
});
```

**Methods:** `propagate(source, content, world, config): ReceivedMessage[]`

---

## Environment

### WeatherSimulator

Weather state simulation with dynamic transitions.

```typescript
import { WeatherSimulator } from 'seed-system';

const weather = new WeatherSimulator({
  initialState: 'clear',
  transitionInterval: 600,  // ticks between weather changes
  stormProbability: 0.1,
});
```

**States:** `clear`, `cloudy`, `rain`, `storm`

### WorldClock

In-world time tracking.

```typescript
import { WorldClock } from 'seed-system';

const clock = new WorldClock({
  dayLength: 24 * 60 * 60,  // Real seconds per in-world day
  startTime: 8 * 60 * 60,    // Start at 8:00 AM
});
```

### LightSystem / ThermalSystem / WindForceSystem

Environmental simulation systems for light, temperature, and wind.

---

## Reliability

### Logger

Structured logging with console and file output.

```typescript
import { Logger } from 'seed-system';

const log = Logger.for('my-module');
log.info('World started', { tickRate: 60 });
log.warn('Low FPS', { fps: 30 });
log.error('Simulation error', { error: err.message, stack: err.stack });
```

### SnapshotManager

World state snapshot creation and restoration.

```typescript
import { SnapshotManager } from 'seed-system';

const snapshots = new SnapshotManager(world);
const id = snapshots.create('before-event');
// ... modify world ...
snapshots.restore(id);  // Rollback
```

### WorldTransaction

Transactional world state modifications.

```typescript
import { WorldTransaction } from 'seed-system';

const tx = new WorldTransaction(world);
tx.addOperation({ type: 'move', entityId: 'soul_001', data: { x: 10 } });
tx.commit();  // Apply all operations
// or tx.rollback(); // Undo
```

---

## Security

### PermissionSystem

Role-based access control.

```typescript
import { PermissionSystem } from 'seed-system';

const perms = new PermissionSystem();
perms.assignRole('soul_001', 'soul');
perms.grantPermission('soul', 'move');
perms.grantPermission('soul', 'communicate');
const allowed = perms.check('soul_001', 'move');  // true
```

### RateLimiter

Per-entity action rate limiting.

```typescript
import { RateLimiter } from 'seed-system';

const limiter = new RateLimiter({
  maxActionsPerSecond: 10,
  windowSize: 1000,  // ms
});
const allowed = limiter.check('soul_001', 'move');
```

### InputValidator

Action request validation.

```typescript
import { InputValidator } from 'seed-system';

const validator = new InputValidator();
const result = validator.validateAction(request);
// result: { valid: boolean, errors: string[] }
```

---

## SDK Helpers

### WorldBuilder

Fluent API for building worlds.

```typescript
import { WorldBuilder, PhysicsConfig } from 'seed-system';

const world = new WorldBuilder('my-world')
  .setConfig({ name: 'my-world', tickRate: 60 })
  .usePhysics(PhysicsConfig.defaults())
  .addEntity(soul)
  .addSystem(pathfinder)
  .build();
```

### createListener()

Create a typed event listener hub.

```typescript
import { createListener } from 'seed-system';

const hub = createListener();
hub.on('movement.arrived', (event) => {
  console.log(`${event.payload.entityId} arrived`);
});
hub.once('physics.collision', (event) => {
  console.log('First collision!');
});
```

---

## Event Types

| Event Type | Payload | Emitted By |
|---|---|---|
| `movement.arrived` | `{ entityId, target, position, reason, distance }` | MovementController |
| `physics.collision` | `{ a, b, point, relativeSpeed }` | CollisionSystem |
| `movement.path_completed` | `{ entityId, waypoints }` | PathFollowerSystem |
| `weather.changed` | `{ from, to }` | WeatherSimulator |
| `world.event.triggered` | `{ eventId, name, payload }` | WorldEventSystem |

---

## Configuration Reference

### WorldConfig
```typescript
{ name: string; tickRate: number; }
```

### SoulPerceptionConfig
```typescript
{
  viewDistance?: number;      // default 30
  hearingRange?: number;      // default 20
  maxVisibleEntities?: number; // default 50
  includeWeather?: boolean;   // default true
  includeLight?: boolean;     // default true
  includeTemperature?: boolean; // default true
  includeWind?: boolean;      // default true
}
```

### SoulActionConfig
```typescript
{
  maxMoveDistance?: number;      // default 5
  maxInteractDistance?: number;  // default 3
  maxQueuePerSoul?: number;      // default 10
  defaultMoveDistance?: number;  // default 1
  movementMode?: 'instant' | 'physics'; // default 'instant'
  physicsMoveSpeed?: number;     // default 5
  pathfindingEnabled?: boolean;  // default false
  smoothPaths?: boolean;         // default false
  acoustic?: AcousticConfig;
}
```

### PathfinderSystemConfig
```typescript
{
  width?: number;           // default 100
  height?: number;          // default 100
  cellSize?: number;        // default 1
  originX?: number;         // default 0
  originZ?: number;         // default 0
  allowDiagonal?: boolean;  // default true
  autoUpdate?: boolean;     // default true
  blockingTypes?: string[]; // default ['static']
  respectBlocksPathFlag?: boolean; // default true
  enableSmoothing?: boolean; // default false
}
```

### PathFollowerConfig
```typescript
{
  moveSpeed?: number;           // default 5
  emitCompletionEvent?: boolean; // default true
  enableDynamicAiming?: boolean; // default false
}
```

### MovementControllerConfig
```typescript
{
  arrivalThreshold?: number;   // default 0.15
  enableEarlyStop?: boolean;   // default true
  minSpeed?: number;            // default 0.05
  distanceMode?: '2d' | '3d';  // default '3d'
  enableAcceleration?: boolean; // default false
  maxAcceleration?: number;     // default 10
  maxDeceleration?: number;     // default 15
  cruiseSpeed?: number;         // default 5
}
```

---

## Architecture Notes

- **System Order**: Systems run in the order they are added. Recommended order: Physics → Pathfinder → SoulAction → MovementController → PathFollower → SoulPerception → SoulBridge
- **State Communication**: Systems communicate via `entity.state` Map (for moveTarget, movePath, etc.) and the EventSystem (for events)
- **SoulArena Integration**: SoulBridgeAdapter is the only module that should call SoulArena APIs. All perception/action format conversion happens there.
- **Backward Compatibility**: All new config options default to false/off to preserve existing behavior.
