// Shared type definitions for the Seed world engine.
// Comments are intentionally in English.

/** A 3-component floating point vector used for positions, velocities and forces. */
export interface IVector3 {
  x: number;
  y: number;
  z: number;
}

/** Logical classification of an entity inside the world. */
export type EntityType =
  | 'static'      // immovable scenery / terrain
  | 'dynamic'     // movable physical body
  | 'interactive' // objects souls can interact with
  | 'soul'        // a soul entity (in-world body proxy)
  | 'soul-proxy'  // legacy alias: a proxy in-world body representing an external soul
  | 'npc'         // non-player character
  | 'trigger'     // non-physical region that fires events
  | 'area'        // logical region / zone
  | 'effect';     // visual / effect-only entity

/** High level system lifecycle phases. */
export type SystemState = 'created' | 'running' | 'paused' | 'stopped';

/** Roles used by the permission system. */
export type Role = 'admin' | 'soul' | 'observer';

/** Logger severity levels. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** A generic serialisable world snapshot envelope. */
export interface WorldSnapshot {
  schema: string;
  version: string;
  worldTime: number;
  tick: number;
  savedAt: string;
  entities: unknown[];
}

/** Result of a world-wide evaluation run. */
export interface EvalReport {
  generatedAt: string;
  world: {
    name: string;
    tick: number;
    worldTime: number;
    entityCount: number;
  };
  performance: {
    tickTimeAvgMs: number;
    tickTimeP95Ms: number;
    tickTimeP99Ms: number;
    fps: number;
    rssBytes: number;
  };
  subsystems: { name: string; enabled: boolean }[];
  activity: {
    eventsPerTick: number;
    collisionsPerTick: number;
    messagesPerTick: number;
    movedEntitiesPerTick: number;
  };
  soulInteraction: {
    actionSuccessRate: number;
    perceivedEvents: number;
    connectedSouls: number;
  };
}

/** Minimal shape of a soul as returned by SoulArena (snake_case, as confirmed). */
export interface SoulInfo {
  id: string;
  name: string;
  element: string;
  status: string;
  current_game_id: string | null;
  birth_time: number;
  total_existence_ms: number;
  last_active_at: number;
  created_at: number;
  memoryStats: {
    episodic: number;
    semantic: number;
    core: number;
    links: number;
    reflections: number;
    total: number;
  };
  personality?: {
    bravery: number;
    aggression: number;
    sociability: number;
    curiosity: number;
    loyalty: number;
  };
  emotion?: {
    valence: number;
    arousal: number;
    dominance: number;
    trust: number;
    anticipation: number;
    fatigue: number;
  };
  valueSystem?: {
    beliefs: string[];
    priorities: Record<string, number>;
    moralAlignment: number;
  };
}

// ============================================================================
// Materials, geometry and entities
// ============================================================================

/** Physically inspired material categories used for density / friction lookup. */
export type MaterialType =
  | 'wood' | 'stone' | 'metal' | 'glass' | 'water'
  | 'fire' | 'earth' | 'air' | 'organic' | 'energy' | 'custom';

/** Axis-aligned bounding box corners. */
export interface AABB {
  min: IVector3;
  max: IVector3;
}

/** Sphere collision shape. */
export interface Sphere {
  center: IVector3;
  radius: number;
}

export type CollisionShapeType = 'aabb' | 'sphere' | 'mesh';

export interface CollisionShape {
  type: CollisionShapeType;
  aabb?: AABB;
  sphere?: Sphere;
}

/** Free-form per-entity state bag. */
export interface EntityState {
  [key: string]: unknown;
}

/** A named, swappable component attached to an entity. */
export interface EntityComponent {
  type: string;
  data: Record<string, unknown>;
  enabled: boolean;
}

/** The fundamental object in the world. */
export interface IEntity {
  readonly id: string;
  readonly type: EntityType;
  name: string;
  position: IVector3;
  velocity: IVector3;
  rotation: IVector3;
  mass: number;
  material: MaterialType;
  collisionShape: CollisionShape;
  state: EntityState;
  readonly properties: Map<string, unknown>;
  components: EntityComponent[];
  active: boolean;
  readonly createdAt: number;
  updatedAt: number;
  isStatic: boolean;
  isTrigger: boolean;
  destroy(): void;
  addComponent(component: EntityComponent): void;
  removeComponent(type: string): void;
  getComponent(type: string): EntityComponent | undefined;
  setProperty(key: string, value: unknown): void;
  getProperty<T>(key: string): T | undefined;
}

/** Declarative entity creation config consumed by the factory / SDK. */
export interface EntityConfig {
  id?: string;
  type: EntityType;
  name: string;
  position?: IVector3;
  velocity?: IVector3;
  rotation?: IVector3;
  mass?: number;
  material?: MaterialType;
  collisionShape?: CollisionShape;
  state?: EntityState;
  properties?: Record<string, unknown>;
  components?: EntityComponent[];
  isStatic?: boolean;
  isTrigger?: boolean;
}

// ============================================================================
// Physics
// ============================================================================

/** Physics tuning (SI-like units). Gravity is a vector. */
export interface PhysicsConfig {
  gravity: IVector3;
  airDensity: number;
  frictionCoefficient: number;
  restitutionCoefficient: number;
  timeScale: number;
  maxVelocity: number;
  collisionEnabled: boolean;
  substeps: number;
}

export interface CollisionResult {
  entityA: string;
  entityB: string;
  point: IVector3;
  normal: IVector3;
  penetrationDepth: number;
  relativeVelocity: IVector3;
  timestamp: number;
}

export interface ForceApplication {
  entityId: string;
  force: IVector3;
  point?: IVector3;
  duration?: number;
  type: 'impulse' | 'continuous';
}

export interface RaycastHit {
  entityId: string;
  point: IVector3;
  normal: IVector3;
  distance: number;
}

// ============================================================================
// World configuration and statistics
// ============================================================================

export type WeatherState =
  | 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow' | 'windy' | 'extreme';

/** Complete declarative world configuration produced by the SDK. */
export interface WorldConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  bounds: { min: IVector3; max: IVector3 };
  physics: PhysicsConfig;
  tickRate: number;
  maxEntities: number;
  communication: { strategies: string[]; defaultStrategy: string };
  weather: { enabled: boolean; initialState?: WeatherState };
  clock: { enabled: boolean; dayLengthSeconds: number; startTime?: number };
  events: { enabled: boolean; maxActiveEvents: number };
  snapshot: { enabled: boolean; intervalMs: number; maxSnapshots: number; directory: string };
}

/** Runtime world statistics snapshot. */
export interface WorldStats {
  tickCount: number;
  uptimeMs: number;
  entityCount: number;
  activeEvents: number;
  avgTickTimeMs: number;
  p99TickTimeMs: number;
  fps: number;
  memoryUsageMB: number;
  collisionsPerSecond: number;
  interactionsPerSecond: number;
}

/** Logger interface used across the engine, bridge and evaluator. */
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  debug(bindings: Record<string, unknown>, message?: string): void;
  info(message: string, meta?: Record<string, unknown>): void;
  info(bindings: Record<string, unknown>, message?: string): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  warn(bindings: Record<string, unknown>, message?: string): void;
  error(message: string, meta?: Record<string, unknown>): void;
  error(bindings: Record<string, unknown>, message?: string): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
  fatal(bindings: Record<string, unknown>, message?: string): void;
  child(module: string): ILogger;
}

// ============================================================================
// Communication system
// ============================================================================

export type CommunicationMedium = 'acoustic' | 'network' | 'resonance' | 'telepathic' | 'custom';

export interface CommunicationMessage {
  id: string;
  senderId: string;
  senderType: 'soul' | 'entity' | 'system';
  medium: CommunicationMedium;
  content: string;
  metadata: Record<string, unknown>;
  position: IVector3;
  timestamp: number;
  priority: number;
  ttl: number;
}

export interface CommunicationResult {
  messageId: string;
  deliveredTo: string[];
  failedDeliveries: Array<{ recipientId: string; reason: string }>;
  latencyMs: number;
  signalStrength: number;
}

/** Pluggable communication medium. */
export interface ICommunicationStrategy {
  readonly medium: CommunicationMedium;
  readonly name: string;
  initialize(config: Record<string, unknown>): void;
  send(message: CommunicationMessage, worldEntities: IEntity[]): CommunicationResult;
  canReach(sender: IVector3, receiver: IVector3, obstacles: IEntity[]): { reachable: boolean; signalStrength: number };
  getPropagationDelay(sender: IVector3, receiver: IVector3): number;
  update(deltaTime: number): void;
  destroy(): void;
}

// ============================================================================
// Soul bridge contracts
// ============================================================================

/** What a soul perceives from the world in a single frame. */
export interface PerceptionFrame {
  soulId: string;
  timestamp: number;
  worldTime: number;
  position: IVector3;
  visibleEntities: Array<{
    id: string;
    name: string;
    type: EntityType;
    position: IVector3;
    distance: number;
    visible: boolean;
  }>;
  nearbySouls: Array<{ id: string; name: string; element: string; position: IVector3; distance: number }>;
  /** Nearby harvestable resource nodes within view distance. */
  nearbyResources?: Array<{
    id: string;
    name: string;
    resourceType: string;
    currentAmount: number;
    maxAmount: number;
    position: IVector3;
    distance: number;
    isAvailable: boolean;
    isBeingHarvested: boolean;
  }>;
  environment: {
    /** Global ambient temperature from WeatherSimulator (Celsius). */
    temperature: number;
    pressure: number;
    humidity: number;
    windSpeed: number;
    windDirection: IVector3;
    /** Global light level from WeatherSimulator (0-1, based on time of day). */
    lightLevel: number;
    weather: WeatherState;
    timeOfDay: number;
    /** Local temperature at the soul's exact position, including heat source radiation (Celsius). Undefined if ThermalSystem not available. */
    localTemperature?: number;
    /** Local illumination at the soul's exact position, including point/directional lights (0-1+). Undefined if LightSystem not available. */
    localLightLevel?: number;
    /** Nearby heat sources within perception range. */
    nearbyHeatSources?: Array<{ id: string; distance: number; intensity: number }>;
    /** Nearby light sources within perception range. */
    nearbyLights?: Array<{ id: string; distance: number; intensity: number }>;
  };
  events: Array<{
    id: string;
    type: string;
    name: string;
    severity: string;
    distance: number;
    affectsSoul: boolean;
  }>;
  communications: CommunicationMessage[];
  /** M10: Auditory events perceived by the soul (from SoundPerceptionSystem). */
  auditoryEvents?: Array<{
    sourceId: string;
    type: string;
    receivedIntensity: number;
    distance: number;
    directionAngle: number;
  }>;
  /** M10: Whether FOV-based visibility filtering was applied. */
  fovFiltered?: boolean;
  /** M10: Whether events were sorted by attention priority. */
  attentionSorted?: boolean;
}

/** A soul's requested action. */
export interface ActionRequest {
  soulId: string;
  action: 'move' | 'interact' | 'communicate' | 'use' | 'attack' | 'harvest' | 'craft' | 'wait' | 'stop' | 'custom';
  targetId?: string;
  parameters: Record<string, unknown>;
  timestamp: number;
}

export interface ActionResult {
  soulId: string;
  action: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/** How the world influences a soul's emotion / state. */
export interface WorldEffect {
  soulId: string;
  source: string;
  effectType: 'emotion' | 'physical' | 'mental' | 'social' | 'custom';
  magnitude: number;
  emotionDelta?: {
    valence?: number;
    arousal?: number;
    dominance?: number;
    trust?: number;
    anticipation?: number;
  };
  physicalDelta?: { health?: number; energy?: number; fatigue?: number };
  description: string;
  timestamp: number;
}

/** A soul's response to a recent world effect. */
export interface SoulFeedback {
  soulId: string;
  worldEffectId: string;
  emotionalResponse: string;
  actionTaken: string;
  intensity: number;
  timestamp: number;
}

// ============================================================================
// Security
// ============================================================================

export type ServerRole = 'admin' | 'moderator' | 'soul' | 'observer' | 'anonymous';

export interface ValidationSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  required?: string[];
  properties?: Record<string, ValidationSchema>;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  items?: ValidationSchema;
}

/** Result returned by InputValidator validation calls. */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

/** A single permission entry in the RBAC table. */
export interface Permission {
  resource: string;
  action: string;
  condition?: string;
}

/** Configuration for the token-bucket rate limiter. */
export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  perSoul: boolean;
  perIP: boolean;
  burstMultiplier: number;
}

// ============================================================================
// Evaluation
// ============================================================================

export interface PerformanceMetrics {
  avgTickTimeMs: number;
  p99TickTimeMs: number;
  p999TickTimeMs: number;
  fps: number;
  minFps: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  entityCount: number;
  activeEvents: number;
  collisionsPerSecond: number;
  interactionsPerSecond: number;
}

export interface FeatureCoverage {
  totalPlanned: number;
  implemented: number;
  coveragePercent: number;
  modules: Array<{
    name: string;
    status: 'implemented' | 'partial' | 'planned' | 'interface-only';
    progress: number;
  }>;
}

export interface WorldActivityMetrics {
  entityInteractionsPerSecond: number;
  eventTriggerFrequency: number;
  soulActionsPerSecond: number;
  communicationsPerSecond: number;
  activeSouls: number;
}

export interface SoulInteractionQuality {
  perceptionSuccessRate: number;
  actionExecutionSuccessRate: number;
  worldFeedbackLatencyMs: number;
  soulSatisfaction: number;
  feedbackLoopCount: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface EvaluationReport {
  version: string;
  timestamp: number;
  worldId: string;
  durationMs: number;
  performance: PerformanceMetrics;
  featureCoverage: FeatureCoverage;
  worldActivity: WorldActivityMetrics;
  soulInteraction: SoulInteractionQuality;
  overallScore: number;
  grade: Grade;
  recommendations: string[];
  issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
}

// ============================================================================
// SDK builder contracts
// ============================================================================

export interface WorldBuildOptions {
  id?: string;
  name: string;
  description?: string;
  bounds?: { min: IVector3; max: IVector3 };
  physics?: Partial<PhysicsConfig>;
  tickRate?: number;
  weather?: boolean;
  clock?: boolean;
  events?: boolean;
}

/** Fluent world builder contract. */
export interface IWorldBuilder {
  createWorld(options: WorldBuildOptions): this;
  addEntity(config: EntityConfig): string;
  addEntities(configs: EntityConfig[]): string[];
  setPhysicsConfig(config: Partial<PhysicsConfig>): this;
  addCommunicationStrategy(strategy: ICommunicationStrategy): this;
  addEventListener(type: string, handler: (event: WorldEvent) => void): this;
  registerSoul(soulId: string, spawnPosition: IVector3): this;
  build(): WorldConfig;
}

/** Pre-built entity archetypes contract. */
export interface IEntityFactory {
  createGround(position: IVector3, size: IVector3, material?: MaterialType): EntityConfig;
  createWall(position: IVector3, size: IVector3, material?: MaterialType): EntityConfig;
  createBox(position: IVector3, size?: number, material?: MaterialType): EntityConfig;
  createLight(position: IVector3, radius?: number, intensity?: number): EntityConfig;
  createDoor(position: IVector3, width?: number, height?: number): EntityConfig;
  createTriggerZone(position: IVector3, radius: number, onEnter?: string): EntityConfig;
  createSoulAnchor(soulId: string, position: IVector3): EntityConfig;
  custom(config: Partial<EntityConfig>): EntityConfig;
}

/** Minimal world event shape used by the SDK event listener helper. */
export interface WorldEvent {
  id: string;
  type: string;
  name: string;
  severity: string;
  position: IVector3;
  radius: number;
  status: string;
  createdAt: number;
  data: Record<string, unknown>;
}

// ============================================================================
// Core engine contracts (implemented by src/engine/*)
// ============================================================================

/** Pluggable spatial partitioning index over entity 2D footprints. */
export interface ISpatialIndex {
  insert(entity: IEntity): void;
  remove(entityId: string): void;
  update(entity: IEntity): void;
  queryRange(min: IVector3, max: IVector3): IEntity[];
  queryNear(point: IVector3, radius: number): IEntity[];
  queryRay(origin: IVector3, direction: IVector3, maxDistance: number): IEntity[];
  clear(): void;
  size(): number;
}

/** Generic recyclable instance pool. */
export interface IObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  preallocate(count: number): void;
  shrink(): void;
  getStats(): { active: number; pooled: number; total: number };
  clear(): void;
}

/** Pluggable physics engine contract. */
export interface IPhysicsEngine {
  initialize(config: PhysicsConfig): void;
  step(deltaTime: number): CollisionResult[];
  addEntity(entity: IEntity): void;
  removeEntity(entityId: string): void;
  updateEntity(entity: IEntity): void;
  applyForce(application: ForceApplication): void;
  raycast(origin: IVector3, direction: IVector3, maxDistance: number): RaycastHit | null;
  getConfig(): PhysicsConfig;
  setConfig(config: Partial<PhysicsConfig>): void;
  destroy(): void;
}
export interface RolePermissions { role: Role; permissions: Permission[]; }
export interface TransactionOperation { type: string; entityId?: string; data: Record<string, unknown>; }
export interface UndoEntry { operation: TransactionOperation; previousState: Record<string, unknown>; }
export interface Transaction { id: string; timestamp: number; operations: TransactionOperation[]; status: 'pending' | 'committed' | 'rolled_back'; undoLog: UndoEntry[]; }
export interface LogEntry { timestamp: string; level: LogLevel; module: string; message: string; meta?: Record<string, unknown>; stack?: string; }
export interface LoggerConfig { level: LogLevel; consoleEnabled: boolean; fileEnabled: boolean; logDirectory: string; maxFileSize: string; maxFiles: number; jsonFormat: boolean; }
export type ExceptionSeverity = 'recoverable' | 'degraded' | 'fatal';
export interface ExceptionInfo { error: Error; module: string; entityId?: string; timestamp: number; severity: ExceptionSeverity; context: Record<string, unknown>; }
export interface RecoveryAction { type: 'restart_entity' | 'isolate_entity' | 'rollback' | 'degrade' | 'restart_world' | 'alert'; target?: string; reason: string; }
