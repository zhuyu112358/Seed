// Seed SDK v1.0.0 - Public API exports
//
// This is the single entry point for external applications (e.g. SoulGame)
// that want to build virtual worlds on top of the Seed engine.
//
// Usage:
//   import { WorldBuilder, SoulBridgeAdapter, SoulPerceptionSystem, ... } from 'seed-system';
//
// Architecture:
//   - Engine: World container, tick loop, system management
//   - Entity: GameObjects, Vector3, EntityFactory
//   - Physics: PhysicsSystem, CollisionSystem, MovementController, WindForceSystem
//   - Event: EventSystem, Event, ConditionEngine
//   - Pathfinding: GridMap, AStarPathfinder, PathfinderSystem, PathSmoother, PathFollowerSystem
//   - Soul Interaction: SoulBridgeAdapter, SoulPerceptionSystem, SoulActionSystem, SoulClient
//   - Communication: AcousticPropagation, NetworkPacket, WorldResonance, Message
//   - Environment: WeatherSimulator, WorldClock, WorldEventSystem, LightSystem, ThermalSystem
//   - Interaction: InteractionSystem
//   - Reliability: Logger, SnapshotManager, Transaction, ExceptionHandler
//   - Security: PermissionSystem, RateLimiter, InputValidator
//   - Utils: ObjectPool
//   - SDK Helpers: WorldBuilder, WorldEventListener

// --- Engine ---
export { World } from '../engine/World.js';
export { WorldEngine } from '../engine/WorldEngine.js';
export type { WorldSystem, WorldConfig } from '../engine/World.js';

// --- Entity ---
export { GameObject } from '../entity/Entity.js';
export { CollisionLayer } from '../entity/Entity.js';
export type { Entity } from '../entity/Entity.js';
export { EntityFactory } from '../entity/EntityFactory.js';
export { Vector3 } from '../entity/Vector3.js';

// --- Physics ---
export { PhysicsSystem } from '../physics/PhysicsSystem.js';
export { PhysicsConfig, PhysicsConfigBuilder } from '../physics/PhysicsConfig.js';
export { CollisionSystem } from '../physics/CollisionSystem.js';
export { SpatialHash } from '../physics/SpatialHash.js';
export { MovementController } from '../physics/MovementController.js';
export { WindForceSystem } from '../physics/WindForceSystem.js';

// --- Event ---
export { EventSystem } from '../event/EventSystem.js';
export { Event, EntityArrivedEvent } from '../event/Event.js';
export { ConditionEngine } from '../event/ConditionEngine.js';

// --- Pathfinding ---
export { GridMap } from '../pathfinding/GridMap.js';
export { AStarPathfinder } from '../pathfinding/AStarPathfinder.js';
export { PathfinderSystem } from '../pathfinding/PathfinderSystem.js';
export { PathSmoother } from '../pathfinding/PathSmoother.js';
export { PathFollowerSystem } from '../pathfinding/PathFollowerSystem.js';
export type { PathResult } from '../pathfinding/AStarPathfinder.js';

// --- Soul Interaction (core bridge to SoulArena) ---
export { SoulBridgeAdapter } from '../bridge/SoulBridgeAdapter.js';
export { SoulPerceptionSystem } from '../entity/SoulPerceptionSystem.js';
export { SoulActionSystem } from '../entity/SoulActionSystem.js';
export { SoulClient } from '../api/soulClient.js';
export type { SoulActionConfig } from '../entity/SoulActionSystem.js';
export type { SoulPerceptionConfig } from '../entity/SoulPerceptionSystem.js';

// --- Communication ---
export { AcousticPropagation } from '../communication/AcousticPropagation.js';
export { NetworkPacket } from '../communication/NetworkPacket.js';
export { WorldResonance } from '../communication/WorldResonance.js';
export { Message } from '../communication/Message.js';
export type { ReceivedMessage } from '../communication/Message.js';
export type { CommunicationStrategy, WorldView } from '../communication/CommunicationStrategy.js';

// --- Environment ---
export { WeatherSimulator } from '../event/WeatherSimulator.js';
export { WorldClock } from '../event/WorldClock.js';
export { WorldEventSystem } from '../event/WorldEventSystem.js';
export { LightSystem } from '../event/LightSystem.js';
export { ThermalSystem } from '../event/ThermalSystem.js';

// --- Interaction ---
export { InteractionSystem } from '../entity/InteractionSystem.js';

// --- Reliability ---
export { Logger } from '../reliability/Logger.js';
export { SnapshotManager } from '../reliability/SnapshotManager.js';
export { WorldTransaction } from '../reliability/Transaction.js';
export { ExceptionHandler } from '../reliability/ExceptionHandler.js';

// --- Security ---
export { PermissionSystem } from '../security/PermissionSystem.js';
export { RateLimiter } from '../security/RateLimiter.js';
export { InputValidator } from '../security/InputValidator.js';

// --- Utils ---
export { ObjectPool } from '../utils/ObjectPool.js';

// --- SDK Helpers ---
export { WorldBuilder } from './WorldBuilder.js';
export { createListener } from './WorldEventListener.js';
export type { WorldEventHub } from './WorldEventListener.js';

// --- Core Types (PerceptionFrame, ActionRequest, ActionResult, etc.) ---
export type {
  PerceptionFrame,
  ActionRequest,
  ActionResult,
  CommunicationMessage,
  EntityType,
  WeatherState,
  EntityConfig,
  AABB,
  CollisionResult,
  WorldSnapshot,
  Transaction,
  LogLevel,
  WorldEvent,
} from '../types/index.js';
