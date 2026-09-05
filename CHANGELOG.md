# Seed SDK Changelog

All notable changes to the Seed virtual world engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-09-06

### Milestone M7: Multiplayer Interaction & Social Relationships & Trading & Party

#### Added
- **Social Graph System** (`src/social/`): Social relationship management between entities
  - SocialRelationType: friend/neutral/enemy/rival/ally/family (6 types)
  - SocialRelation with trust (0-100), familiarity (0-100), interactionCount, lastInteractionTick
  - Undirected graph storage with sorted keys (entityA|entityB)
  - SocialGraph (WorldSystem): setRelation/getRelation/removeRelation, getFriends/getEnemies/getAllies
  - modifyTrust/modifyFamiliarity (auto-clamp 0-100, auto-create neutral relation)
  - recordInteraction (updates trust/familiarity/count, emits events)
  - 3 event classes (RelationChanged/TrustChanged/Interaction)
  - 29 unit tests
- **Trading System** (`src/trade/`): Trade offers between entities with item transfer
  - TradeStatus: pending/accepted/rejected/cancelled/completed/expired
  - TradeItem: itemId/name/quantity/metadata (application-defined items)
  - TradeOffer with offerItems/requestItems/expiresTick
  - TradingSystem (WorldSystem): createOffer/acceptOffer/rejectOffer/cancelOffer
  - transferValidator/transferHandler callbacks (application layer manages inventory)
  - Auto-expiration on tick, duplicate pending offer prevention
  - 6 event classes (Offered/Accepted/Rejected/Cancelled/Completed/Expired)
  - 27 unit tests
- **Party System** (`src/party/`): Party management with membership and leadership
  - Party with id/name/leaderId/memberIds/maxSize (default 4)
  - PartySystem (WorldSystem): createParty/disbandParty/joinParty/leaveParty
  - kickMember (leader-only), transferLeadership (leader-only)
  - Auto leadership transfer when leader leaves, auto-disband when last member leaves
  - Dual lookup: parties (forward) + memberToParty (reverse) for O(1) queries
  - experienceShareHandler/lootShareHandler callbacks for resource distribution
  - 5 event classes (Created/Disbanded/MemberJoined/MemberLeft/LeaderChanged)
  - 30 unit tests
- **Social + Trade event perception** in SoulPerceptionSystem
  - 9 new event listeners (lazy-loaded on first tick):
    - `social.relation_changed`: low
    - `social.trust_changed`: low
    - `social.interaction`: low
    - `trade.offered`: low
    - `trade.accepted`: medium
    - `trade.rejected`: low
    - `trade.cancelled`: low
    - `trade.completed`: medium
    - `trade.expired`: low
  - stop() cleanup for all 9 listeners
  - 12 unit tests
- **Party event perception** in SoulPerceptionSystem
  - 5 new event listeners (lazy-loaded on first tick):
    - `party.created`: low
    - `party.disbanded`: medium
    - `party.member_joined`: low
    - `party.member_left`: low
    - `party.leader_changed`: low
  - stop() cleanup for all 5 listeners
  - 6 unit tests
- **M7 End-to-End Demo** (`examples/m7-demo.ts`): Full multiplayer interaction pipeline
  - Phase 1: Social interactions (greetings, conversations, friendship formation)
  - Phase 2: Trading (wood-for-gold trade with inventory simulation, rejected offer)
  - Phase 3: Party formation (create, join, XP sharing, leadership transfer, leave)
  - Phase 4: Perception summary (10 events: 1 social + 4 trade + 5 party)
  - Validates all M7 systems working together

#### Architecture
- All multiplayer systems follow the Seed architecture pattern:
  - Seed provides execution framework + state management + event emission
  - All decisions (who to befriend, what to trade, party formation) by application layer/SoulArena
  - No hardcoded relationships, items, or party configurations - fully configurable
  - Inventory management via callbacks (transferValidator/transferHandler)
  - Resource sharing via callbacks (experienceShareHandler/lootShareHandler)
- SoulPerceptionSystem now listens to 43+ events across all subsystems

#### Tests
- Total: 946 unit tests (up from 842 in v2.2.0, +104)
- M7 new tests: 29 (social) + 27 (trade) + 30 (party) + 12 (social-trade perception) + 6 (party perception) = 104

## [2.2.0] - 2026-09-06

### Milestone M6: NPC Behavior System & Dynamic Tasks & World Narrative

#### Added
- **Behavior Tree System** (`src/behavior/`): Reusable behavior execution framework for NPC agents
  - BehaviorStatus enum (Success/Failure/Running)
  - Blackboard: per-agent shared data store with change notification (onChange/onKeyChange)
  - 9 node types: Sequence, Selector, Parallel (RequireAll/RequireAny/RequireCount),
    Inverter, Repeater, UntilFail, ActionNode, ConditionNode, WaitNode
  - BehaviorTree container with tick/reset/serialize
  - BehaviorTreeSystem (WorldSystem) managing multi-agent behavior trees
  - All decision logic in callbacks defined by application layer; Seed only executes
  - 43 unit tests
- **Dynamic Task System** (`src/task/`): Task definitions, instances, lifecycle, and event emission
  - ObjectiveType: collect/reach/interact/kill/custom (extensible via callback)
  - TaskDefinition with objectives/rewards/acceptConditions/autoAccept/repeatable
  - TaskInstance with status (locked/available/active/completed/failed), objective progress
  - TaskSystem (WorldSystem): register/accept/updateProgress/complete/fail/abandon
  - Condition checking (prerequisite tasks), auto-accept on tick
  - 6 event classes (Available/Accepted/Progress/Completed/Failed/StatusChanged)
  - 26 unit tests
- **Task event perception** in SoulPerceptionSystem
  - 6 new event listeners (lazy-loaded on first tick):
    - `task.available`: low severity
    - `task.accepted`: medium severity
    - `task.progress`: low severity, includes current/required amounts
    - `task.completed`: high severity
    - `task.failed`: high severity, includes reason
    - `task.status_changed`: low severity, includes old→new status
  - stop() cleanup for all 6 listeners
  - 10 unit tests
- **World Narrative System** (`src/narrative/`): Narrative chains with node state machine
  - NarrativeNode with entryConditions/onEnter/exitConditions/onExit/branches/terminal
  - NarrativeChainDefinition with nodes/repeatable/autoStartConditions
  - NarrativeChainInstance with status (idle/active/paused/completed), currentNodeIndex, blackboard
  - NarrativeSystem (WorldSystem): register/start/pause/resume/reset chains
  - tick() advances active chains: exitConditions → onExit → branches (priority) → sequential → entryConditions → onEnter → terminal auto-complete
  - Branch system: condition → targetNodeId for non-linear narratives
  - 5 event classes (Started/NodeEntered/NodeExited/Branch/Completed)
  - 20 unit tests
- **Narrative event perception** in SoulPerceptionSystem
  - 5 new event listeners (lazy-loaded on first tick):
    - `narrative.started`: medium severity, includes chain name
    - `narrative.node_entered`: low severity, includes node name
    - `narrative.node_exited`: low severity
    - `narrative.branch`: medium severity, includes from→to
    - `narrative.completed`: high severity, includes nodes entered count
  - stop() cleanup for all 5 listeners
  - 5 unit tests
- **M6 end-to-end demo** (`examples/m6-demo.ts`): Full pipeline demonstration
  - Behavior tree controls NPC agent (accept task → gather wood loop)
  - Task system tracks objectives (collect 5 wood)
  - Narrative chain advances story (intro → gathering → return → celebration)
  - SoulPerceptionSystem captures all events for soul delivery
  - Verified: task 100%, narrative 100%, 10 perceived events (2 high severity)

#### Changed
- SDK exports: added behavior, task, and narrative modules to `src/sdk/index.ts`
- SoulPerceptionSystem: added 11 new event listeners (6 task + 5 narrative)

#### Architecture
- All NPC behavior/task/narrative content defined by application layer
- Seed only provides execution frameworks and event emission
- No cognitive/decision logic in Seed — all conditions/actions are callbacks
- No hardcoded behaviors/tasks/narratives — fully configurable and extensible

#### Test Summary
- Total: 842 unit tests (738 at M5 end + 104 new in M6)
- Behavior tree: 43, Task system: 26, Task perception: 10, Narrative: 20, Narrative perception: 5
- All tests passing, 0 failures
- Build: 0 TypeScript errors

## [2.1.0] - 2026-09-06

### Milestone M5: Dynamic World Events & Ecosystem & World Rules

#### Added
- **WorldRuleEngine** (`src/rules/`): Generic condition→action rule system for world-level triggers
  - RuleConfig with id/name/enabled/priority/cooldownTicks/maxFires/condition/action
  - RuleContext with world/entity/event/data shared Map
  - register/unregister/enable/disable/evaluate (priority descending)
  - Cooldown mechanism, max fire count, rule error isolation
  - Event-driven evaluation via `bindEventBus(events, eventTypes[])`
  - ISerializable support
  - 14 unit tests
- **EcosystemSystem** (`src/ecosystem/`): Dynamic resource node lifecycle (spawn/depletion/regrowth/removal)
  - EcosystemZoneConfig with id/position/radius/resourceTypeIds/spawnRate/maxNodes/minNodes/spawnIntervalTicks/fertility/allowRegrowth/depletionRemovalTicks
  - Periodic spawn checks (fertility modifies spawnRate)
  - minNodes forced spawning, maxNodes limit
  - Depletion detection + events, regrowth or timeout removal
  - setFertility + zone_changed event
  - Optional SeededRandom for deterministic generation
  - 4 event classes (Spawned/Depleted/Removed/ZoneChanged)
  - ISerializable support
  - 13 unit tests
- **Ecosystem event perception** in SoulPerceptionSystem
  - 4 new event listeners (lazy-loaded on first tick):
    - `ecosystem.resource_spawned`: low severity, includes position
    - `ecosystem.resource_depleted`: medium severity, includes zone ID
    - `ecosystem.resource_removed`: medium severity, includes zone ID
    - `ecosystem.zone_changed`: severity by fertility (<0.2=high, <0.5=medium, else=low)
  - stop() cleanup for all 4 listeners
  - 6 unit tests
- **Ecosystem end-to-end demo** (`examples/ecosystem-demo.ts`): Full pipeline demonstration
  - Zone config → node spawn → harvest → depletion → regrowth → soul perception → rule engine reaction
- **SDK exports**: rules module (WorldRuleEngine + 4 types) + ecosystem module (EcosystemSystem + EcosystemZoneConfig + 4 events)

#### Fixed
- Ecosystem event classes now extend `Event<SpecificPayloadType>` (matching WeatherEvent pattern) for typed EventSystem handlers
- Removed public readonly properties from ecosystem event classes (data already in payload)
- EcosystemSystem `lastSpawnCheck` initialized to -1 (ensures first tick triggers spawn check)
- Flaky test "spawned node position is within zone radius" — now steps 10 times to ensure spawn check fires

#### Architecture
- Perception chain: EcosystemSystem → EventBus → SoulPerceptionSystem → SoulArena
- Event class design pattern: all events extend Event<SpecificPayloadType>, no additional public properties
- WorldRuleEngine supports both tick-based and event-driven rule evaluation

### Test Statistics
- Total: 738 tests (732 + 6 new ecosystem perception tests)
- Test files: 60
- All tests passing

---

## [2.0.0] - 2026-09-06

### Milestone M4: Persistence & Procedural Generation

Seed v2.0.0 introduces world persistence (save/load), deterministic procedural
generation, and full system state serialization. Major highlights include
WorldSerializer, WorldSaveManager, SeededRandom (deterministic PRNG),
WorldGenerator (plugin-based procedural generation), and ISerializable
implementation across all core resource systems.

### Added

#### Persistence System
- **WorldSerializer** — Generic world state serialization/deserialization.
  SerializedWorld format: version/name/tickRate/worldTime/tick/entities/systems/metadata.
  SerializedEntity: id/name/type/position/velocity/mass/material/active/state/properties/children.
  Entity state/properties Maps serialized as plain objects. Children hierarchy preserved recursively.
  toJSON()/fromJSON() for string serialization. Version validation on load.
- **ISerializable interface** — Systems implement serialize()/deserialize() for state persistence.
  isSerializable() type guard. WorldSerializer auto-detects and serializes ISerializable systems.
- **WorldSaveManager** — Save file management: save/load/exists/delete/list/getMetadata.
  Configurable saveDirectory (default "./saves") and fileExtension (default ".seed.json").
  SaveMetadata: name/path/size/modifiedAt/worldName/tick/version.
  List sorted by modification time (newest first). Corrupted files skipped.
  Auto-creates save directory. savedAt timestamp in metadata. Custom metadata support.
- **HarvestSystem ISerializable** — Serializes inventories (soulId → items + maxCapacity)
  and nodeStates (entityId → currentAmount). Deserialize restores inventories and node amounts
  (nodes must be re-registered by app before deserialize).
- **CraftingSystem ISerializable** — Serializes inventories and activeCrafts
  (soulId → [{recipeId, ticksRemaining}]). Deserialize rebuilds ActiveCraft from recipeId
  (recipes must be re-registered).
- **ConsumptionSystem ISerializable** — Serializes souls (soulId → {inventory, tickCounters}).
  Deserialize restores SoulConsumptionState with inventory + tickCounters Map.
- **GrowthSystem ISerializable** — Serializes soulGrowth (soulId → ruleId → {totalXP, level}).
  Deserialize restores growth state. Event listeners are transient (re-registered in tick).

#### Procedural Generation
- **SeededRandom** — Deterministic PRNG (mulberry32 algorithm). Same seed = same sequence.
  Supports number and string seeds (FNV-1a hash). next() [0,1), nextInt(min,max) inclusive,
  nextFloat(min,max), chance(p), pick(arr), sample(arr,n) without replacement, shuffle(arr)
  (Fisher-Yates). getState()/setState() for serialization/resume. fork() creates independent
  sub-generator.
- **WorldGenerator** — Plugin-based procedural world generation framework.
  GenerationContext: world/rng/seed/data (shared Map between plugins).
  GenerationPlugin: name + generate(ctx), runs in registration order.
  addPlugin (chainable, duplicate name throws), removePlugin, getPluginNames.
  generate(world?) creates or populates a world. generateWithData returns world + data.
  Plugins share data via ctx.data (e.g., terrain map → resource placement).
  Deterministic: same seed + same plugins = same world.

#### Examples
- **persistence-demo.ts** — End-to-end persistence demo: create world → run (harvest/craft/consume/grow)
  → save → load into fresh world → verify 7 state fields match → continue running.
  Demonstrates config vs state separation: recipes/rules re-registered, state restored via ISerializable.
  All 7 state fields verified: wood/plank/food/treeAmount/XP/level/tick.

### Architecture Principles
- **Config vs State separation** — Configuration (ResourceType/Recipe/Rule) is registered via
  Registry at runtime, NOT serialized, re-registered by app after world load. State (inventories/
  activeCrafts/counters/growth) is serialized via ISerializable. Save files contain only mutable state.
- **No hardcoded world content** — WorldGenerator has no built-in generation logic; all generation
  via plugins provided by application layer. SeededRandom is a generic utility.
- **Plugin-based composability** — WorldGenerator plugins run in order, share data via context,
  can be freely combined for different generation strategies.
- **Entity factory pattern** — WorldSerializer.deserialize uses an entityFactory callback to create
  entities, allowing application layer to re-attach components (ResourceNode, etc.) before
  system state deserialization.

### Tests
- 69 new tests since v1.2.0 (636 → 705)
- world-serializer.test.ts (12), world-save-manager.test.ts (15),
  seeded-random.test.ts (15), world-generator.test.ts (15), system-serialization.test.ts (12)

### Breaking Changes
- None at the API level. v2.0.0 reflects the major milestone (persistence + generation),
  not breaking API changes. Existing v1.x code continues to work.

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
