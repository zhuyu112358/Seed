# Seed SDK Changelog

All notable changes to the Seed virtual world engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
