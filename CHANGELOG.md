# Seed SDK Changelog

All notable changes to the Seed virtual world engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-06

### Milestone M3: Resource System & Economy

Seed v1.2.0 introduces a complete abstract resource system: harvestable resource nodes,
crafting/production, consumption rules, and experience/level growth. All resource types,
recipes, consumption rules, and growth rules are registered at runtime — no hardcoded
game-specific content in the engine kernel. Application layers (e.g., SoulGame) configure
their own resource economy.

### Added

#### Resource System (M3 Core)
- **ResourceType & Registry** — Runtime-registered resource type definitions (id/name/maxStackSize/renewable). No hardcoded resource types.
- **ResourceNode** — Harvestable resource node component (resourceTypeId/currentAmount/maxAmount/regenRate/harvestTime/harvestAmount/renewable). Tracks harvest state, supports regeneration, provides state snapshots.
- **ResourceInventory** — Entity resource inventory with add/remove/has/getAmount/getTotal/getAll/clear. Configurable maxCapacity.
- **HarvestSystem** — WorldSystem for resource harvesting. Distance detection (configurable harvestRange, default 3m), harvest countdown, auto-add to inventory, regeneration processing, 4 events (start/complete/depleted/regenerated).

#### Crafting / Production
- **CraftingRecipe & Registry** — Runtime-registered crafting recipes (inputs→output, craftTime, outputAmount). No hardcoded recipes.
- **CraftingSystem** — WorldSystem for production. registerSoul inventory, canCraft() validation (resources + concurrency), startCraft() (consumes inputs immediately), tick-based countdown, output on completion. maxConcurrentPerSoul config (default 1). Partial add when inventory near capacity. 3 events (start/complete/fail).
- **SoulActionSystem craft action** — `craft` action type with recipeId from parameters or targetId. Shares inventory from HarvestSystem to CraftingSystem automatically. Returns detailed failure reasons.

#### Consumption Rules
- **ConsumptionRule & Registry** — Runtime-registered consumption rules (resourceTypeId/amount/intervalTicks). No hardcoded survival mechanics.
- **ConsumptionSystem** — WorldSystem for resource consumption over time. registerSoul/unregisterSoul, per-rule tick counters, independent consumption per rule. On success: consume + ResourceConsumedEvent. On failure: partial consume + ResourceConsumptionFailedEvent. enabled flag.

#### Growth / Experience
- **GrowthRule & Registry** — Runtime-registered growth rules (triggerEventType/soulIdField/xpPerEvent/baseXP/growthMultiplier/maxLevel). Configurable geometric level curves. No hardcoded skill types.
- **GrowthSystem** — WorldSystem for XP/level tracking. registerSoul/unregisterSoul, grantXP() with auto level-up, getXP/getLevel/getSoulGrowth. Event-driven: listens to trigger event types, grants XP automatically. soulIdField config supports different event payload structures (harvesterId vs soulId). 2 events (xp_gained/level_up).

#### Perception Integration
- **nearbyResources in PerceptionFrame** — SoulPerceptionSystem now includes nearby harvestable resource nodes in the perception frame: id/name/resourceType/currentAmount/maxAmount/position/distance/isAvailable/isBeingHarvested. Filtered by viewDistance, sorted by distance, capped by maxVisibleEntities.
- **Harvest & Craft event perception** — SoulPerceptionSystem listens for resource.harvest.complete (low), resource.node.depleted (medium), and crafting.complete (low) events.

#### Action Integration
- **harvest action** — SoulActionSystem `harvest` action type. Validates target/resource node/availability/distance. Calls HarvestSystem.startHarvest(). Returns detailed failure reasons.
- **craft action** — SoulActionSystem `craft` action type. See Crafting section above.

#### Type Extensions
- **ActionRequest** — action type union now includes 'harvest' and 'craft'.
- **PerceptionFrame** — optional `nearbyResources` field.

#### Examples & Demos
- **resource-system-demo.ts** — End-to-end demo of the complete M3 resource pipeline: harvest → craft → consume → grow → perceive. Verifies all systems work together.

### SDK Exports
- Resource system: ResourceType/Registry, ResourceNode, ResourceInventory, HarvestSystem
- Crafting: CraftingRecipe/Registry, CraftingSystem
- Consumption: ConsumptionRule/Registry, ConsumptionSystem
- Growth: GrowthRule/Registry, GrowthSystem
- Events: HarvestStart/Complete, ResourceDepleted/Regenerated, CraftStart/Complete/Fail, ResourceConsumed/ConsumptionFailed, XPGained/LevelUp

### Tests
- 86 new tests since v1.1.0 (550 → 636)
- resource-system.test.ts (24), harvest-action.test.ts (14), crafting-system.test.ts (13), craft-action.test.ts (7), consumption-system.test.ts (12), growth-system.test.ts (16)

### Architecture Principles
- **No hardcoded world content** — All resource types, recipes, consumption rules, and growth rules are registered at runtime via configuration.
- **No game logic in kernel** — Seed only executes resource mechanics and emits events. Consequences (death, debuffs, unlocks) are decided by the application layer.
- **Abstract & configurable** — Every system accepts configuration via constructor/options. No magic numbers or game-specific values in the engine.

## [1.1.0] - 2026-09-06

### Milestone M2: Physics & Perception Deepening

Seed v1.1.0 deepens the physics simulation, collision detection, pathfinding, and soul
perception systems. Major highlights include continuous collision detection (CCD), spatial
hash broadphase, collision layers/masks, trigger volumes, physics materials, friction
impulses, dynamic obstacle replanning, and comprehensive event perception integration.

### Added

#### Collision System
- **Collision Layers & Masks** — Per-entity collisionLayer and collisionMask (bitmask), with `canCollideWith()` bidirectional filtering. 9 predefined layers (DEFAULT/PLAYER/ENEMY/WORLD/INTERACTABLE/PROJECTILE/TRIGGER/HAZARD/ALL/NONE).
- **Collision Lifecycle Callbacks** — `CollisionEnterEvent` (physics.collision.enter), `CollisionStayEvent` (with contactDurationTicks), `CollisionExitEvent` (with lastContactPoint and contactDurationTicks). State tracking with previous/current collision pair maps.
- **Trigger Volumes** — `TriggerEnterEvent`/`TriggerStayEvent`/`TriggerExitEvent` (physics.trigger.*). Entities marked as triggers overlap without physics response (no position correction or velocity impulse).
- **Physics Material System** — `PhysicsMaterial` interface (restitution/friction/name), 10 predefined materials (DEFAULT/ICE/RUBBER/STONE/WOOD/METAL/FLESH/GLASS/BOUNCY/FRICTIONLESS), `combineMaterials()` averaging strategy.
- **Collision Friction Impulse** — Coulomb friction model with tangential impulse application. Friction impulse magnitude = combinedFriction × |normalImpulse|, capped to prevent reverse direction. Applied equally and oppositely to both entities.
- **CCD (Continuous Collision Detection)** — Swept AABB (union of prevPosition and position AABBs) for fast-moving entities (configurable ccdSpeedThreshold, default 5 m/s). Tunneling detection: if swept AABB overlaps but discrete AABB does not, roll back fast entity to prevPosition.
- **Spatial Hash Broadphase** — `SpatialHash` utility class (insert/remove/query/queryPoint/getCollisionPairs/clear/getStats). CollisionSystem `broadPhase` config ('brute-force' default / 'spatial-hash'), configurable `spatialHashCellSize` (default 5). Reduces pair checks from O(n²) to O(n) for sparse distributions.

#### Pathfinding
- **Dynamic Obstacle Local Replanning** — PathFollowerSystem `enableReplanning` config (default false), `replanningCheckInterval` (default 5 ticks), `maxReplanningAttempts` (default 5). DDA ray-cast segment blocking detection from current position to next waypoint. Automatic re-path via PathfinderSystem when blocked. `replanningCount` tracked in entity.state.
- **Path Replanned Event** — `PathReplannedEvent` (movement.path_replanned) with payload {entityId, oldPathLength, newPathLength, goal, attempt}. Emitted on successful replanning.
- **Path Completed Event** — `PathCompletedEvent` (movement.path_completed) with payload {entityId, waypoints}. Fixes previous plain-object emission that crashed EventSystem.emit().

#### Soul Perception
- **Collision/Trigger Lifecycle Event Perception** — SoulPerceptionSystem listens for physics.collision.enter (severity based on impact speed: <1m/s=low, 1-2m/s=medium, ≥2m/s=high), physics.collision.exit (low, with duration), physics.trigger.enter (medium, "Entered zone: X"), physics.trigger.exit (low, with duration).
- **Path Replanned Event Perception** — Listens for movement.path_replanned, records "Path replanned: N→M waypoints (attempt K)" with medium severity.
- **Weather Event Perception** — Listens for world.weather events. WeatherSimulator now emits `WeatherEvent` on state transitions (clear→rain, rain→storm, etc.) with computed strength (0-1 based on conditions), and on wind gusts (>5 m/s speed increase). Severity mapping: storm/wind_gust>20→high, rain/snow/windy/wind_gust>10→medium, else low.

#### Acoustic
- **Sound Diffraction** — AcousticPropagation `diffractionEnabled` (default false), `diffractionCoefficient` (default 0.3), `maxDiffractionAngle` (default PI). Computes shortest diffraction path around AABB corners, applies diffraction loss (coefficient × deflection angle) + extra distance attenuation, **replaces** wall attenuation (no double penalty). Deflection angle = PI - cornerAngle.

#### Tools & Testing
- **Collision Performance Benchmark** — `examples/benchmark-collision.ts` compares brute-force vs spatial-hash wall-clock time. Tests sparse (100x100) and dense (20x20) distributions. Reports speedup ratio and percentage improvement.
- **Integration Test Auto-Cleanup** — `cleanupSouls()` in examples/integration-test.ts automatically calls exit-world on all active souls with stale current_game_id before discovering souls. Handles SOUL_NOT_IN_WORLD (stale id), SOUL_NOT_FOUND (duplicates), and real errors.
- **3-Soul Integration Test** — Multi-soul mode supports up to 3 souls with independent perception/decision/action loops and position verification.

### Changed

- **Collision restitution=0 behavior** — Removed `if (combinedRestitution > 0)` guard. restitution=0 now means perfectly inelastic collision (normal impulse still applied, momentum exchanged, no bounce) rather than "no velocity response". Normal impulse formula (1+restitution)×relVelNormal/2 gives relVelNormal/2 at restitution=0.
- **Event emission requires Event instances** — EventSystem.emit() expects Event class instances (calls event.isCancelled()). Plain objects with `as never` will crash at runtime. All systems now use proper Event subclasses.
- **SDK exports expanded** — Added 13 new event class exports (CollisionEvent, CollisionEnter/Stay/Exit, TriggerEnter/Stay/Exit, PathReplannedEvent, PathCompletedEvent, WeatherEvent, EntityEnterZone, WorldTickEvent). SDK now exports 70+ symbols.

### Fixed

- **BUG-007: Acoustic Diffraction Test Failures** — All 6 diffraction test failures resolved. Fixed initial test config (minAudible too low), double-penalty (diffraction replaces wall attenuation), and deflection angle calculation (PI - cornerAngle).
- **BUG-008: Integration Test Sleeping Soul Selection** — discoverSouls() now filters `status === 'active'` before current_game_id filtering. Never selects sleeping souls (e.g., PersistTest) that cannot perceive. Falls back to in-game active souls with warning when no free active souls available.
- **BUG-009: Flaky Unit Tests** — Investigated all 42+ test files, no conditional skips (test.skip/skipIf/todo) or dynamic test count generation found. Test count stable at 550 across consecutive runs. Root cause was transient issue in earlier version, no longer reproducible.
- **String Direction NaN Bug** — SoulArena may return direction as string ("south"/"north" etc.) instead of vector object. resolveDirection() now parses string directions to vectors, preventing position NaN.
- **Event Bus Systematic Bug** — WorldClock/WorldEventSystem were emitting plain objects instead of Event instances, causing event.isCancelled() crashes. Fixed to use proper Event subclasses.
- **PathFollowerSystem High-Speed Overshoot** — At high speed (8 m/s) with large waypoint spacing (6.4m) and default arrivalThreshold (0.15m), entities could skip past targets without triggering arrival. Fixed with `enableDynamicAiming` (re-aim velocity toward target every tick) and configurable arrivalThreshold.
- **movement.path_completed Event Crash** — Was emitted as plain object `{type, payload, timestamp} as never`, crashing EventSystem.emit(). Replaced with proper PathCompletedEvent class.

### Performance

- Spatial hash broadphase: 1.08-1.38x speedup over brute-force for 100-500 entities (sparse distribution faster than dense). Main benefit at 1000+ entity scale where O(n²) becomes prohibitive.
- Object pool utility available for reducing GC pressure in high-frequency allocations.

### Known Limitations

- Physics is 2.5D (x/z plane collision, y for height/gravity)
- Pathfinding uses grid-based A* — continuous space pathfinding not yet supported
- CCD rolls back to prevPosition on tunneling detection (no exact time-of-impact calculation or velocity reflection)
- Spatial hash is rebuilt every tick (no incremental update for static/dynamic separation)
- Single-threaded world simulation
- Weather events use {0,0,0} position (global events, no spatial localization)

### Upgrade Notes

- **Breaking change**: restitution=0 behavior changed from "no velocity response" to "inelastic collision with momentum exchange". If your code relied on restitution=0 to freeze entities on collision, use `collides: false` state flag or collision layer filtering instead.
- **Breaking change**: EventSystem.emit() now strictly requires Event instances. If you were emitting plain objects with `as never`, migrate to proper Event subclasses.
- New config options are all opt-in with backward-compatible defaults: `broadPhase`, `enableCCD`, `enableReplanning`, `diffractionEnabled`, `enableTriggers`, `enableDynamicAiming`.
- All new event classes are backward-compatible additions — existing event listeners continue to work.

## [1.0.0] - 2026-09-05

### First stable SDK release

Seed v1.0.0 is the first stable release of the virtual world engine SDK, providing
a complete foundation for building virtual worlds that host soul entities (SoulArena).

### Added

#### Core Engine
- **World** — Configurable world container with tick loop, entity management, and system lifecycle
- **WorldEngine** — High-level engine wrapper with start/stop/pause controls
- **WorldSystem** interface — Base interface for all pluggable systems

#### Entity System
- **GameObject** — Core entity with position, velocity, rotation, AABB, state map, and physics properties
- **EntityFactory** — Factory for creating common entity types (souls, static objects, triggers)
- **Vector3** — 3D vector math utilities

#### Physics
- **PhysicsSystem** — Physics simulation with gravity, friction, air resistance, velocity integration, and Quadtree spatial partitioning
- **PhysicsConfig / PhysicsConfigBuilder** — Fluent configuration for physics parameters
- **CollisionSystem** — Top-down x/z plane AABB collision detection with position separation, velocity response (impulse-based), collision filtering, and CollisionEvent emission
- **MovementController** — Arrival detection and velocity control with optional acceleration/deceleration curves, early stop, and 2D/3D distance modes
- **WindForceSystem** — Wind force application to entities based on wind field

#### Event System
- **EventSystem** — Event bus with priority ordering, async handlers, and error isolation
- **Event** — Base event class with type, payload, timestamp
- **EntityArrivedEvent** — Emitted when an entity reaches its moveTarget
- **ConditionEngine** — Conditional event triggering based on world state predicates

#### Pathfinding
- **GridMap** — Configurable grid navigation map with world↔grid coordinate conversion, AABB region blocking, 8-direction neighbor query, and diagonal corner-cutting prevention
- **AStarPathfinder** — A* pathfinding with binary min-heap open set, Octile distance heuristic, and BFS fallback for blocked start/goal cells
- **PathfinderSystem** — WorldSystem integration with automatic obstacle scanning from world entities and dirty-marked lazy grid rebuild
- **PathSmoother** — String-pulling (visibility shortcut) path smoothing with DDA (Amanatides & Woo) grid line-of-sight checking
- **PathFollowerSystem** — Path following with per-waypoint advancement, dynamic aiming (optional), and completion event emission

#### Soul Interaction (Core Bridge to SoulArena)
- **SoulBridgeAdapter** — Orchestrates the perceive→decide→act loop: gathers PerceptionFrame from SoulPerceptionSystem, converts to SoulArena format, calls SoulArena perceive API, receives actions, converts to ActionRequest, calls SoulActionSystem.executeAction(), and feeds ActionResult back to SoulArena. Includes webhook action receiver on port 3001.
- **SoulPerceptionSystem** — Generates PerceptionFrame for every soul each tick: visible entities, nearby souls, environmental conditions (weather/light/temperature/wind), recent world events (movement.arrived, physics.collision), and audible communications. Lazy event subscription.
- **SoulActionSystem** — Executes ActionRequest from souls: move (6 formats: absolute/relative/direction/vector/angle/stop), communicate (speak with acoustic propagation), interact, and stop. Supports instant and physics movement modes, pathfinding integration, path smoothing, and action history.
- **SoulClient** — HTTP client for SoulArena API (perceive, action, enter-world, exit-world, get-soul)

#### Communication
- **AcousticPropagation** — Sound wave propagation with distance attenuation, AABB obstacle occlusion (slab method), and multi-listener delivery
- **NetworkPacket** — Network communication packet abstraction
- **WorldResonance** — World-wide resonance communication medium
- **Message** — Communication message with sender, content, medium, and timestamp

#### Environment
- **WeatherSimulator** — Weather state simulation (clear/cloudy/rain/storm) with dynamic transitions
- **WorldClock** — In-world time tracking with configurable day length
- **WorldEventSystem** — Scheduled and conditional world event triggering
- **LightSystem** — Ambient and directional light simulation
- **ThermalSystem** — Temperature field simulation with heat sources and diffusion

#### Interaction
- **InteractionSystem** — Entity interaction detection and execution (proximity-based)

#### Reliability
- **Logger** — Structured logging with levels (debug/info/warn/error/fatal), console and file output, JSON format, and log rotation
- **SnapshotManager** — World state snapshot creation and restoration for rollback
- **WorldTransaction** — Transactional world state modifications with commit/rollback and undo log
- **ExceptionHandler** — Centralized exception handling with severity classification and recovery actions

#### Security
- **PermissionSystem** — Role-based access control (admin/soul/observer) with permission checks
- **RateLimiter** — Per-entity action rate limiting with configurable thresholds
- **InputValidator** — Action request validation with schema checking and sanitization

#### Utils
- **ObjectPool** — Generic object pool for performance optimization (reduces GC pressure)

#### SDK Helpers
- **WorldBuilder** — Fluent API for building worlds (name, tickRate, entities, systems, physics)
- **createListener()** — Create a typed event listener hub with priority ordering, async handlers, one-time handlers, and error isolation

### Architecture Constraints

- Seed is a **generic virtual world engine** — no hardcoded world properties, scenarios, or soul behavior
- Soul cognition/decision logic resides entirely in SoulArena — Seed only handles perception generation and action execution
- SoulBridgeAdapter is the **only** module allowed to do format conversion and SoulArena API orchestration
- World parameters are passed via constructor/config — specific world configurations belong in examples/

### Known Limitations

- Physics is currently 2.5D (x/z plane collision, y for height/gravity)
- Pathfinding uses grid-based A* — continuous space pathfinding not yet supported
- Acoustic propagation uses simple AABB occlusion — diffraction (bending around edges) not yet implemented
- Single-threaded world simulation — distributed server support planned for future releases
- Collision detection is O(n²) — spatial hash broadphase planned for performance optimization

### Upgrade Notes

This is the first stable release. All APIs marked as public in the SDK index are considered
stable and will follow semantic versioning. Internal modules (not exported in SDK index) may
change without notice.
