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
export { PhysicsMaterials, combineMaterials } from '../physics/PhysicsMaterial.js';
export type { PhysicsMaterial } from '../physics/PhysicsMaterial.js';
export { MovementController } from '../physics/MovementController.js';
export { WindForceSystem } from '../physics/WindForceSystem.js';

// --- Event ---
export { EventSystem } from '../event/EventSystem.js';
export {
  Event,
  EntityArrivedEvent,
  CollisionEvent,
  CollisionEnterEvent,
  CollisionStayEvent,
  CollisionExitEvent,
  TriggerEnterEvent,
  TriggerStayEvent,
  TriggerExitEvent,
  PathReplannedEvent,
  PathCompletedEvent,
  WeatherEvent,
  EntityEnterZone,
  WorldTickEvent,
} from '../event/Event.js';
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

// --- Resource System (M3) ---
export { ResourceType, ResourceTypeRegistry } from '../resource/ResourceType.js';
export type { ResourceTypeConfig } from '../resource/ResourceType.js';
export { ResourceNode } from '../resource/ResourceNode.js';
export type { ResourceNodeConfig, HarvestState } from '../resource/ResourceNode.js';
export { ResourceInventory } from '../resource/ResourceInventory.js';
export type { ResourceInventoryConfig } from '../resource/ResourceInventory.js';
export { HarvestSystem } from '../resource/HarvestSystem.js';
export type { HarvestSystemConfig } from '../resource/HarvestSystem.js';
export { CraftingRecipe, CraftingRecipeRegistry } from '../resource/CraftingRecipe.js';
export type { CraftingRecipeConfig, RecipeInput } from '../resource/CraftingRecipe.js';
export { ConsumptionRule, ConsumptionRuleRegistry } from '../resource/ConsumptionRule.js';
export type { ConsumptionRuleConfig } from '../resource/ConsumptionRule.js';
export { GrowthRule, GrowthRuleRegistry } from '../resource/GrowthRule.js';
export type { GrowthRuleConfig } from '../resource/GrowthRule.js';
export { GrowthSystem } from '../resource/GrowthSystem.js';
export type { GrowthSystemConfig } from '../resource/GrowthSystem.js';

// --- Persistence (M4) ---
export { WorldSerializer } from '../persistence/WorldSerializer.js';
export type {
  SerializedEntity,
  SerializedSystems,
  SerializedWorld,
  ISerializable,
} from '../persistence/WorldSerializer.js';
export { isSerializable } from '../persistence/WorldSerializer.js';
export { WorldSaveManager } from '../persistence/WorldSaveManager.js';
export type { SaveMetadata, SaveManagerConfig } from '../persistence/WorldSaveManager.js';

// --- Generation (M4) ---
export { SeededRandom } from '../generation/SeededRandom.js';
export { WorldGenerator } from '../generation/WorldGenerator.js';
export type {
  GenerationContext,
  GenerationPlugin,
  WorldGeneratorConfig,
} from '../generation/WorldGenerator.js';

// --- Rules (M5) ---
export { WorldRuleEngine } from '../rules/WorldRuleEngine.js';
export type {
  RuleConfig,
  RuleContext,
  RuleCondition,
  RuleAction,
} from '../rules/WorldRuleEngine.js';

// --- Ecosystem (M5) ---
export { EcosystemSystem } from '../ecosystem/EcosystemSystem.js';
export type { EcosystemZoneConfig } from '../ecosystem/EcosystemSystem.js';
export {
  EcosystemSpawnEvent,
  EcosystemDepletedEvent,
  EcosystemRemovedEvent,
  EcosystemZoneChangedEvent,
} from '../ecosystem/EcosystemSystem.js';

export { ConsumptionSystem } from '../resource/ConsumptionSystem.js';
export type { ConsumptionSystemConfig } from '../resource/ConsumptionSystem.js';
export { CraftingSystem } from '../resource/CraftingSystem.js';
export type { CraftingSystemConfig } from '../resource/CraftingSystem.js';

// --- Resource Events ---
export {
  HarvestStartEvent,
  HarvestCompleteEvent,
  ResourceDepletedEvent,
  ResourceRegeneratedEvent,
  CraftStartEvent,
  CraftCompleteEvent,
  CraftFailEvent,
  ResourceConsumedEvent,
  ResourceConsumptionFailedEvent,
  XPGainedEvent,
  LevelUpEvent,
} from '../event/Event.js';

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

// --- Behavior Tree (M6) ---
export { BehaviorStatus } from '../behavior/BehaviorStatus.js';
export { Blackboard } from '../behavior/Blackboard.js';
export {
  BehaviorNode,
  Sequence,
  Selector,
  Parallel,
  ParallelPolicy,
  Inverter,
  Repeater,
  UntilFail,
  ActionNode,
  ConditionNode,
  WaitNode,
} from '../behavior/BehaviorNode.js';
export type { BehaviorAgent } from '../behavior/BehaviorNode.js';
export { BehaviorTree } from '../behavior/BehaviorTree.js';
export { BehaviorTreeSystem } from '../behavior/BehaviorTreeSystem.js';
export { BehaviorTreeBuilder } from '../behavior/BehaviorTreeBuilder.js';
export {
  RandomSequence,
  RandomSelector,
  StatefulSelector,
  Cooldown,
  TimeLimit,
  ForceSuccess,
  ForceFailure,
  RepeatUntil,
  Counter,
  SubTree,
  LogNode,
} from '../behavior/BehaviorEnhanced.js';

// --- Task System (M6) ---
export { TaskInstance } from '../task/TaskTypes.js';
export type {
  ObjectiveType,
  TaskObjective,
  TaskObjectiveContext,
  ObjectiveProgress,
  TaskStatus,
  TaskDefinition,
  TaskCondition,
  TaskConditionContext,
} from '../task/TaskTypes.js';
export {
  TaskAvailableEvent,
  TaskAcceptedEvent,
  TaskProgressEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskStatusChangedEvent,
} from '../task/TaskEvents.js';
export { TaskSystem } from '../task/TaskSystem.js';

// --- Task Chain (M12 Phase 7) ---
export type {
  TaskChain,
  TaskChainStatus,
  TaskChainStep,
  ChainStepStatus,
  TaskChainConfig,
  StepProgressionResult,
  DependencyCheckResult,
} from '../task/TaskChainTypes.js';
export { DEFAULT_TASK_CHAIN_CONFIG } from '../task/TaskChainTypes.js';
export { TaskChainSystem } from '../task/TaskChainSystem.js';

// --- Narrative System (M6) ---
export { NarrativeChainInstance } from '../narrative/NarrativeTypes.js';
export type {
  NarrativeStatus,
  NarrativeContext,
  NarrativeNode,
  NarrativeChainDefinition,
} from '../narrative/NarrativeTypes.js';
export {
  NarrativeStartedEvent,
  NarrativeNodeEnteredEvent,
  NarrativeNodeExitedEvent,
  NarrativeBranchEvent,
  NarrativeCompletedEvent,
} from '../narrative/NarrativeEvents.js';
export { NarrativeSystem } from '../narrative/NarrativeSystem.js';

// --- Social System (M7) ---
export type {
  SocialRelationType,
  SocialRelation,
  SocialRelationChange,
  SocialInteractionContext,
} from '../social/SocialTypes.js';
export {
  SocialRelationChangedEvent,
  SocialTrustChangedEvent,
  SocialInteractionEvent,
} from '../social/SocialEvents.js';
export { SocialGraph } from '../social/SocialGraph.js';

// --- Enhanced Social Relation Graph (M13) ---
export type {
  RelationCategory,
  RelationSubtype,
  RelationStrength,
  RichSocialRelation,
  RelationEventType,
  RelationEventPayload,
  RelationModificationResult,
  SocialPathResult,
  SocialGroup,
  SocialRelationGraphConfig,
} from '../social/SocialRelationTypes.js';
export {
  DEFAULT_RELATION_STRENGTH,
  DEFAULT_SOCIAL_RELATION_CONFIG,
} from '../social/SocialRelationTypes.js';
export { SocialRelationGraph } from '../social/SocialRelationGraph.js';

// --- Social Norm System (M13) ---
export type {
  SocialNorm,
  SocialNormType,
  NormViolation,
  NormViolationSeverity,
  SocialFeedback,
  SocialFeedbackType,
  SocialNormSystemConfig,
  NormModificationResult,
  NormSystemEvent,
  NormSystemEventType,
  ComplianceCheckResult,
  SocialNormStats,
  NormScope,
  NormMutation,
} from '../social/SocialNormTypes.js';
export { DEFAULT_SOCIAL_NORM_CONFIG } from '../social/SocialNormTypes.js';
export { SocialNormSystem } from '../social/SocialNormSystem.js';

// --- Social Event System (M13) ---
export type {
  SocialEvent,
  SocialEventType,
  SocialEventStatus,
  EventParticipant,
  EventParticipantRole,
  ParticipationStatus,
  EventSocialImpact,
  SocialEventSystemConfig,
  EventCreationResult,
  SocialEventSystemEvent,
  SocialEventSystemEventType,
  SocialEventStats,
} from '../social/SocialEventTypes.js';
export { DEFAULT_SOCIAL_EVENT_CONFIG } from '../social/SocialEventTypes.js';
export { SocialEventSystem } from '../social/SocialEventSystem.js';

// --- Group Behavior Engine (M13) ---
export type {
  BehaviorGroup,
  GroupMember,
  GroupEmotionType,
  GroupEmotionState,
  MobPsychologyState,
  CollectiveAction,
  CollectiveActionType,
  CollectiveActionStatus,
  GroupDecision,
  DecisionOption,
  DecisionMethod,
  GroupDecisionStatus,
  GroupBehaviorEngineConfig,
  GroupBehaviorEvent,
  GroupBehaviorEventType,
  GroupBehaviorStats,
} from '../social/GroupBehaviorTypes.js';
export { DEFAULT_GROUP_BEHAVIOR_CONFIG } from '../social/GroupBehaviorTypes.js';
export { GroupBehaviorEngine } from '../social/GroupBehaviorEngine.js';

// --- Information Spread Model (M13) ---
export type {
  InformationItem,
  InformationType,
  InformationState,
  InformationNode,
  InformationMutation,
  CredibilityAssessment,
  InformationSpreadConfig,
  InformationSpreadEvent,
  InformationSpreadEventType,
  InformationSpreadStats,
} from '../social/InformationSpreadTypes.js';
export { DEFAULT_INFORMATION_SPREAD_CONFIG } from '../social/InformationSpreadTypes.js';
export { InformationSpreadModel } from '../social/InformationSpreadModel.js';

// --- Social Mobility System (M13) ---
export type {
  SocialClass,
  MobilityType,
  MobilityEvent,
  SocialStatus,
  MobilityResult,
  SocialMobilityConfig,
  SocialMobilityEvent,
  SocialMobilityEventType,
  SocialMobilityStats,
} from '../social/SocialMobilityTypes.js';
export { DEFAULT_SOCIAL_MOBILITY_CONFIG, SOCIAL_CLASS_RANK } from '../social/SocialMobilityTypes.js';
export { SocialMobilitySystem } from '../social/SocialMobilitySystem.js';

// --- Trading System (M7) ---
export type {
  TradeStatus,
  TradeItem,
  TradeOffer,
  TradeResult,
  ItemTransferValidator,
  ItemTransferHandler,
} from '../trade/TradeTypes.js';
export {
  TradeOfferedEvent,
  TradeAcceptedEvent,
  TradeRejectedEvent,
  TradeCancelledEvent,
  TradeCompletedEvent,
  TradeExpiredEvent,
} from '../trade/TradeEvents.js';
export { TradingSystem } from '../trade/TradingSystem.js';

// --- Party System (M7) ---
export type {
  Party,
  PartyResult,
  ExperienceShareHandler,
  LootShareHandler,
} from '../party/PartyTypes.js';
export {
  PartyCreatedEvent,
  PartyDisbandedEvent,
  PartyMemberJoinedEvent,
  PartyMemberLeftEvent,
  PartyLeaderChangedEvent,
} from '../party/PartyEvents.js';
export { PartySystem } from '../party/PartySystem.js';

// --- Building System (M8) ---
export type {
  BuildingType,
  BuildingPosition,
  BuildingSize,
  Building,
  BuildingResult,
  BuildingProductionHandler,
  BuildingDefenseHandler,
} from '../building/BuildingTypes.js';
export {
  BuildingPlacedEvent,
  BuildingUpgradedEvent,
  BuildingDestroyedEvent,
  BuildingDamagedEvent,
  BuildingRepairedEvent,
} from '../building/BuildingEvents.js';
export { BuildingSystem } from '../building/BuildingSystem.js';

// --- Territory System (M8) ---
export type {
  TerritoryBoundary,
  Territory,
  TerritoryResult,
  TerritoryPosition,
} from '../territory/TerritoryTypes.js';
export {
  TerritoryClaimedEvent,
  TerritoryAbandonedEvent,
  TerritoryExpandedEvent,
  TerritoryEnteredEvent,
  TerritoryLeftEvent,
} from '../territory/TerritoryEvents.js';
export { TerritorySystem } from '../territory/TerritorySystem.js';

// --- Flocking System (M9) ---
export type {
  FlockConfig,
  FlockVector2,
  FlockAgent,
  FlockResult,
} from '../flocking/FlockingTypes.js';
export { DEFAULT_FLOCK_CONFIG } from '../flocking/FlockingTypes.js';
export { FlockingSystem } from '../flocking/FlockingSystem.js';

// --- ORCA Avoidance System (M9) ---
export type {
  OrcaConfig,
  OrcaVector2,
  OrcaAgent,
  OrcaHalfPlane,
  OrcaResult,
} from '../orca/OrcaTypes.js';
export { DEFAULT_ORCA_CONFIG } from '../orca/OrcaTypes.js';
export { OrcaSystem } from '../orca/OrcaSystem.js';

// --- Formation System (M9) ---
export type {
  FormationType,
  FormationSlot,
  FormationConfig,
  Formation,
  FormationResult,
  FormationSlotPosition,
} from '../formation/FormationTypes.js';
export { DEFAULT_FORMATION_CONFIG } from '../formation/FormationTypes.js';
export { FormationSystem } from '../formation/FormationSystem.js';

// --- Navigation System (M9) ---
export type {
  CostModifierType,
  PathCostModifier,
  PathCostConfig,
  NavigationEventType,
  NavigationEventPayload,
  NavigationResult,
} from '../navigation/NavigationTypes.js';
export { DEFAULT_PATH_COST_CONFIG } from '../navigation/NavigationTypes.js';
export { PathCostSystem } from '../navigation/PathCostSystem.js';
export { PathChangedEvent, PathBlockedEvent, ArrivedEvent, WaypointReachedEvent } from '../navigation/NavigationEvents.js';

// --- Vision System (M10) ---
export type {
  VisionConeConfig,
  VisionObserver,
  VisibleEntity,
  VisionResult,
} from '../vision/VisionConeTypes.js';
export { DEFAULT_VISION_CONE_CONFIG } from '../vision/VisionConeTypes.js';
export { VisionConeSystem } from '../vision/VisionConeSystem.js';

// --- Sound Perception System (M10) ---
export type {
  SoundType,
  SoundSource,
  SoundListener,
  HeardSound,
  SoundConfig,
  SoundResult,
} from '../sound/SoundTypes.js';
export { DEFAULT_SOUND_CONFIG } from '../sound/SoundTypes.js';
export { SoundPerceptionSystem } from '../sound/SoundPerceptionSystem.js';

// --- Perception Filter + Attention System (M10) ---
export type {
  PerceptionSeverity,
  PerceptionEvent,
  PerceptibleEntity,
  FilterConfig,
  FilterResult,
  AttentionConfig,
  PrioritizedEvent,
  AttentionResult,
  TypeImportanceMap,
} from '../perception/index.js';
export {
  DEFAULT_FILTER_CONFIG,
  SEVERITY_PRIORITY,
  PerceptionFilter,
  DEFAULT_ATTENTION_CONFIG,
  AttentionSystem,
} from '../perception/index.js';

// --- Action System (M11) ---
export type {
  ActionCategory,
  ActionState,
  ActionDefinition,
  ActionInstance,
  ActionStartResult,
  ActionEventPayload,
} from '../action/index.js';
export { DEFAULT_ACTION_DEFINITION, ActionStateMachine, ActionSystem, createAttackPreset, createDefendPreset, createInteractPreset, createHarvestPreset, createBuildPreset, createMovePreset, createCommunicatePreset, getAllPresets } from '../action/index.js';


// --- Interaction System (M11 phase 3) ---
export type {
  InteractionType,
  InteractionState,
  InteractionDefinition,
  InteractionParticipant,
  InteractionSession,
  InteractionStartResult,
  InteractionEventPayload,
} from '../interaction/index.js';
export { DEFAULT_INTERACTION_DEFINITION, InteractionSessionSystem } from '../interaction/index.js';


// --- Performance System (M11 phase 4) ---
export type {
  SystemPerformance,
  FrameStats,
  PerformanceProfilerConfig,
  BenchmarkConfig,
  BenchmarkResult,
} from '../performance/index.js';
export { DEFAULT_PROFILER_CONFIG, PerformanceProfiler, DEFAULT_BENCHMARK_CONFIG, runBenchmark } from '../performance/index.js';


// --- NPC System (M12) ---
export type {
  MemoryType,
  MemoryImportance,
  MemoryEntry,
  NPCMemoryConfig,
  MemoryQueryResult,
  BigFiveTraits,
  BehavioralTendencies,
  DecisionStyle,
  PersonalityProfile,
  PersonalityConfig,
  WorldState,
  GoapGoal,
  GoapAction,
  GoapNode,
  GoapPlanResult,
  GoapConfig,
  PlanExecution,
  PlanExecutionStatus,
  ScheduleActivity,
  CurrentActivity,
  ScheduleConfig,
  TransitionResult,
  ScheduleLocation,
  ActivityStatus,
} from '../npc/index.js';
export {
  DEFAULT_NPC_MEMORY_CONFIG,
  IMPORTANCE_WEIGHT,
  NPCMemorySystem,
  NEUTRAL_PERSONALITY,
  PERSONALITY_ARCHETYPES,
  DEFAULT_PERSONALITY_CONFIG,
  NPCPersonalitySystem,
  DEFAULT_GOAP_CONFIG,
  GoapPlanner,
  GoapSystem,
  DEFAULT_SCHEDULE_CONFIG,
  SCHEDULE_TEMPLATES,
  ScheduleSystem,
} from '../npc/index.js';


// --- Narrative System (M12 Phase 6) ---
export type {
  DynamicNarrativeArc,
  DynamicNarrativeArcStatus,
  NarrativePhase,
  DynamicNarrativeEvent,
  DynamicNarrativeEventType,
  DynamicNarrativeBranch,
  DynamicNarrativeChoice,
  DynamicNarrativeConfig,
  DynamicArcAdvancementResult,
} from '../narrative/index.js';
export { DEFAULT_DYNAMIC_NARRATIVE_CONFIG, DynamicNarrativeSystem } from '../narrative/index.js';

// --- Narrative Integration (M12 Phase 8) ---
export type {
  WorldStateNarrativeRule,
  WorldStateSnapshot,
  WorldStateNarrativeConfig,
  NpcNarrativeMapping,
  NarrativeInfluence,
  NpcNarrativeBridgeConfig,
} from '../narrative/index.js';
export {
  DEFAULT_WORLD_STATE_NARRATIVE_CONFIG,
  DEFAULT_NPC_NARRATIVE_BRIDGE_CONFIG,
  WorldStateNarrativeSystem,
  NpcNarrativeBridge,
} from '../narrative/index.js';


