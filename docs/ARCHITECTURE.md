# 架构文档（ARCHITECTURE）

> 严格基于 `src/` 真实源码。TypeScript ESM（`NodeNext`，`strict`），源码约 50 个文件。
> 文档中文，代码注释英文。

---

## 1. 概述

Seed System 是一个可配置的虚拟物理世界引擎：它本身不规定某个具体世界，而是提供世界容器、物理、事件、通信、可靠性、安全、评估与对外 API，并与 SoulArena 对接让灵魂进入世界。

代码当前由**两条并行的实现栈**构成，二者通过 `src/types/index.ts` 的接口类型耦合，但尚未完全收敛：

- **核心模拟层（core / layered）**：`engine/World.ts` + `entity/` + `physics/` + `event/` + `communication/`。干净、可单测，是 `WorldEvaluator` 与 `runEval` 围绕的对象。
- **运行时 / SDK 层（runtime / types-driven）**：`engine/WorldEngine.ts` + `engine/{Entity,Vector3,PhysicsSystem,Quadtree,ObjectPool}` + `sdk/` + `api/` + `bridge/`。以 `types/index.ts` 接口为契约，是对外服务的主循环。

> 这一“双栈并存”是当前最大的架构事实，也是大量已知问题的根源，详见 `DEVLOG.md`。

---

## 2. 目录与分层

```
src/
├── types/            全局类型契约（IVector3 / IEntity / WorldConfig / PhysicsConfig /
│                     ICommunicationStrategy / PerceptionFrame / ActionRequest ...）
├── engine/           主循环与运行时（WorldEngine / EntitySystem / engine/PhysicsSystem /
│                     engine/Entity / engine/Vector3 / Quadtree / ObjectPool / World.ts）
├── entity/           核心模拟层实体：Entity / GameObject / EntityFactory / Vector3
├── physics/          核心模拟层物理：PhysicsConfig / IPhysicsBackend / SimplePhysics2D / PhysicsSystem
├── event/            核心模拟层事件：Event / EventSystem / ConditionEngine / EventPropagation
├── communication/    Message / CommunicationStrategy / AcousticPropagation / NetworkPacket / WorldResonance
├── reliability/     Logger / SnapshotManager / WorldTransaction(Transaction.ts) / ExceptionHandler
├── security/         InputValidator / PermissionSystem / RateLimiter / ApiKeyAuth / sanitize
├── sdk/              WorldBuilder（链式建世界）+ 若干孤立辅助模块
├── systems/          玩法事件定义系统（EventSystem / ConditionEngine / event-types）——与 event/ 重复
├── evaluator/        WorldEvaluator + runEval 入口
├── api/              Express REST + ws WebSocket + SoulClient
└── bridge/           SoulBridge（与 SoulArena 的双向桥）
```

---

## 3. 核心模拟层（core）

### 3.1 `World` 容器（`src/engine/World.ts`）

世界是实体集合 + 系统列表 + 事件总线的聚合根：

```ts
interface WorldSystem {
  readonly name: string;
  enabled: boolean;
  start?(): void;
  stop?(): void;
  tick(dt: number, world: World, events: EventSystem): void;
}

class World {
  constructor(config: { name: string; tickRate: number });
  readonly config: { name: string; tickRate: number };
  readonly entities: Map<string, Entity>;
  readonly systems: WorldSystem[];
  readonly events: EventSystem;
  worldTime: number;
  tick: number;
  state: 'created' | 'running' | 'stopped' | 'error';

  addEntity(entity: Entity): this;
  removeEntity(id: string): boolean;
  getEntity(id: string): Entity | undefined;
  addSystem(system: WorldSystem): this;
  bodies(): GameObject[];                 // only GameObject instances
  queryByType(type: string): Entity[];
  iterate(fn: (e: Entity) => void): void;
  start(): void;                           // state='running', calls system.start?.()
  stop(): void;                            // state='stopped', calls system.stop?.()
  step(dt: number): void;                  // tick++, worldTime+=dt, emit WorldTickEvent, tick enabled systems
}
```

`tick(dt)` 的顺序：自增 tick → 累加 worldTime → 发 `world.tick` 事件 → 依次调用每个 `enabled` 系统的 `tick(dt, this, this.events)`。

### 3.2 实体（`src/entity/Entity.ts`）

```ts
class Entity {
  constructor(opts: { id?: string; name: string; type: EntityType;
                      position?; velocity?; mass?; material? });
  readonly id: string; name: string; readonly type: EntityType;
  position: Vector3; velocity: Vector3; mass: number; material: string;
  readonly state: Map<string, unknown>;
  readonly properties: Map<string, unknown>;
  active: boolean; readonly createdAt: number;
  readonly children: Entity[]; parent: Entity | null;
  attach(child: Entity): void;
  detach(): void;
  walk(fn: (e: Entity) => void): void;   // BFS over subtree
  toJSON(): Record<string, unknown>;
}

class GameObject extends Entity {        // adds physical/interaction properties
  halfExtents: Vector3; interactable: boolean; hittable: boolean;
  aabbMin(): Vector3;
  aabbMax(): Vector3;
}
```

`EntityType` 见 `types/index.ts`：`static | dynamic | interactive | soul | soul-proxy | npc | trigger | area | effect`。

### 3.3 向量数学（`src/entity/Vector3.ts`）

不可变向量（所有运算返回新实例）。`static zero`、`static from(v)`；方法 `add/sub/mul/div(除零返回zero)/dot/cross/length/lengthSquared/normalize/distance/distanceSquared/lerp/clamp/distanceTo/clone/equals/toArray/toObject/toString`。另导出独立标量函数 `clamp(value, min, max)`（NaN 返回 min）。

### 3.4 实体工厂（`src/entity/EntityFactory.ts`）

全部为静态方法：

| 方法 | 产物 |
|------|------|
| `staticBox(name, center, halfExtents)` | type `static`，质量无穷，材质 stone |
| `dynamicBox(opts{name,position,mass?,material?,velocity?,halfExtents?})` | type `dynamic` |
| `zoneTrigger(opts{name,center,halfExtents,onEnter?})` | type `trigger`，记录 `isZone` / `onEnter` |
| `soulProxy(opts{soulId,name,element,position?})` | type `soul-proxy`，id=`soul_<id>` |
| `distance(a,b)` | 点到点距离（便捷方法） |

### 3.5 物理（`src/physics/`）

- `PhysicsConfig`（类）：`constructor(opts?)`，`static defaults()`，`static builder()`。字段 `gravity=9.8`（标量，Y 轴）、`friction=0.1`、`airResistance=0.05`、`fixedDt=1/60`、`enabled=true`、`restitution=0.6`。`PhysicsConfigBuilder` 提供 fluent 链式 `gravity/friction/airResistance/fixedDt/enabled/restitution/build()`。
- `IPhysicsBackend`（接口）：`{ name; step(dt, bodies, config): {collisions: CollisionPair[]}; applyImpulse(body, ix, iy, iz) }`，并导出 `aabbOverlap(...)`。
- `SimplePhysics2D`（默认后端，`name='simple-2d'`）：确定性积分 + O(n²) AABB 碰撞；重力沿 -Y，摩擦/空气阻力衰减速度，静态体（无穷质量）不动。
- `PhysicsSystem`（`name='physics'`）：生命周期系统，`tick(dt, world, events)` 从 `world.bodies()` 取体驱动后端，把碰撞封装为 `CollisionEvent`，并检测 trigger 区进出并发出 `EntityEnterZone`。字段 `config`、`backend`、`counters{collisions, moved}`；`applyImpulse(body, ix, iy, iz)`。

> 注意：`physics/PhysicsConfig`（标量 gravity 的**类**）与 `types/index.ts` 的 `PhysicsConfig`（向量 gravity 的**接口**）是两套定义，见已知问题。

### 3.6 事件（`src/event/`）

- `Event`：事件信封 `{ type, payload, timestamp, sourceId, propagation{origin, remainingRadius, intensity} }`，`cancel()` / `isCancelled()`。
- 具体事件：`CollisionEvent`（type `physics.collision`）、`EntityEnterZone`（`zone.enter`）、`WorldTickEvent`（`world.tick`）、`WeatherEvent`（`world.weather`）。
- `EventSystem`：进程内事件总线。`on(type, handler, priority=0)` 返回取消订阅函数；`once/off/emit/listenerCount/clear`。handler 按 priority 降序执行；`cancel()` 后中断后续 handler；同步错误被捕获、异步错误 fire-and-forget，单 listener 异常不拖垮总线。
- `ConditionEngine`：谓词可辨识联合 `entityProperty | worldTime | and | or | not`，`evaluate(pred, ctx{worldTime, entities})`。
- `EventPropagation`：`{attenuationPerMetre, maxRadius}` 空间衰减，`distanceTo/intensityAt/filterByRadius`。

### 3.7 通信（`src/communication/`）

- `Message`：`{ id, content, sourceId, position, medium, intensity, timestamp }`，`medium = 'acoustic' | 'network' | 'resonance'`；另有 `ReceivedMessage{original, receivedIntensity, distance}`。
- `CommunicationStrategy`（接口）：`{ medium; transmit(message, source, world: WorldView): ReceivedMessage[] }`；`WorldView = { entities: Iterable<GameObject>; byId(id) }`。
- `AcousticPropagation`（`medium='acoustic'`）：距离衰减 `1/(1+att·d²)` 乘以介质吸收 `(1-abs·d)`，超过 `maxRadius` 或低于 `minAudible` 不送达。`intensityAt(sourceIntensity, distance)` 公开可测。
- `NetworkPacket`（`medium='network'`，**stub**）：当前无衰减广播给所有 active 实体。
- `WorldResonance`（`medium='resonance'`，**stub**）：当前只让 `soul-proxy` 实体以满强度接收。

---

## 4. 运行时 / SDK 层（runtime）

### 4.1 `WorldEngine`（`src/engine/WorldEngine.ts`）

对外服务的主循环。**构造签名与你可能预期的不同**：

```ts
class WorldEngine {
  constructor(config: WorldConfig, logger?: ILogger);
  // WorldConfig (types/index.ts) requires: id, name, bounds{min,max},
  // physics (types/PhysicsConfig vector form), tickRate, ...
  start(): void;                 // setInterval at 1000/tickRate, unref()
  stop(): void;
  get isRunning(): boolean;
  tick(dt: number): void;        // run physics.step(dt), emit 'collision'/'tick'
  getStats(): WorldStats;
  createEntity(c: EntityConfig): IEntity;
  removeEntity(id: string): boolean;
  getEntity(id: string): IEntity | undefined;
  applyForce(a: ForceApplication): void;
  raycast(o: IVector3, d: IVector3, md: number): RaycastHit | null;
  on(ev: WorldEngineEvent, cb: WorldEngineCallback): void;
  off(ev: WorldEngineEvent, cb: WorldEngineCallback): void;
  destroy(): void;
}
type WorldEngineEvent = 'tick' | 'entityCreated' | 'entityRemoved' | 'collision' | 'error';
```

内部组合 `EntitySystem` + `engine/PhysicsSystem`（实现 `IPhysicsEngine`）+ `Quadtree`（空间索引）+ `ObjectPool<CollisionResult>`。

> **重要事实**：`WorldEngine` **没有** `currentWorld` getter、**没有** `getAllEntities()`、**没有** `load()`、**没有** `runTicks()`。示例与 `server.ts` 中对这些成员的调用均为悬空调用，见已知问题。

### 4.2 运行时子系统

- `EntitySystem`：实体 CRUD + 四叉树索引 + 生命周期事件（`created/removed/destroyed`）。方法 `createEntity/removeEntity/getEntity/getAllEntities/getEntitiesByType/getEntitiesInArea/updateEntity/clear/count/on/off`。
- `engine/PhysicsSystem`（实现 `IPhysicsEngine`）：`initialize(config)/step(dt): CollisionResult[]/addEntity/removeEntity/updateEntity/applyForce/raycast/getConfig/setConfig/destroy`；支持 AABB / Sphere / AABB-Sphere 碰撞、子步进、力与冲量、射线检测。
- `Quadtree`（`engine/SpatialIndex.ts`，别名 `SpatialIndex`）：2D（XZ 平面）空间分区，`insert/remove/update/queryRange/queryNear/queryRay/clear/size`。
- `ObjectPool<T>`：`acquire/release/preallocate/shrink/getStats/clear`。
- `engine/Entity.ts`、`engine/Vector3.ts`：与 `entity/` 同名但不同实现（`Vector3` 可变、含 `addInPlace/mulInPlace`，`Entity` 实现 `IEntity` 全量字段）。

### 4.3 SDK（`src/sdk/`）

- `WorldBuilder`（实现 `IWorldBuilder`）：链式声明式构建世界。`createWorld(options)/addEntity(config)=>id/addEntities/setPhysicsConfig/addCommunicationStrategy/addEventListener/registerSoul/setTickRate/enableWeather/enableClock/enableEvents/build(): WorldConfig`，以及便捷的 `async buildAndStart(): Promise<RunningWorld>`。
- `RunningWorld`：`buildAndStart()` 返回的轻量自运行世界，`addEntity/removeEntity/getEntity/getAllEntities/addStrategy/on/start/stop/isRunning/getStats/destroy`。
- `sdk/PhysicsConfig.ts`：预设 `defaultPhysicsConfig/zeroGravityConfig/moonGravityConfig/waterPhysicsConfig`、`createPhysicsConfig(overrides)`、材质表 `materialDensity/materialFriction/materialRestitution`。
- 桶文件 `sdk/index.ts` 导出：`WorldBuilder`、`EntityFactory`（来自 `entity/`）、`PhysicsConfig`+`PhysicsConfigBuilder`（来自 `physics/`）、`PhysicsSystem`（`physics/`）、`AcousticPropagation/NetworkPacket/WorldResonance/Message` 及相关类型。

> `sdk/EntityFactory.ts`（实现 `IEntityFactory` 的声明式工厂）、`sdk/PhysicsConfig.ts`（预设/材质表）、`sdk/WorldEventListener.ts`（`createListener()`）**未被 `sdk/index.ts` 引用**，属于孤立文件。

---

## 5. 可靠性与安全

- **日志** `reliability/Logger.ts`：`Logger.for(module)` 取子 logger，`Logger.level(level)` 全局调级，`Logger.logDir`；`createLogger(module)` 返回严格 `ILogger`。`ILogger` 的 `debug/info/warn/error/fatal` 均有 `(message, meta?)` 与 `(bindings, message?)` 两个重载，并支持 `child(module)`。输出同时写控制台与 `logs/seed.log`。
- **快照** `reliability/SnapshotManager.ts`：`constructor({dir?, keep?})`，`save({worldName, worldTime, tick, entities, version?})`、`load(file)`、`list()`、`rollback()`（取最新快照），自动只保留最新 `keep`（默认 20）份。
- **事务** `reliability/Transaction.ts`：类名是 **`WorldTransaction`**（不是 `Transaction`）。`record(entity, before)`、`finalize(entities: Map)`、`commit()`、`rollback(entities): number`、`isCommitted()`、`size()`。v0.1 仅支持位置撤销日志。
- **异常** `reliability/ExceptionHandler.ts`：`constructor(snapshotter?, emergencySnapshot?)`、`setExitOnFatal(v)`、`install()`（挂 `uncaughtException` / `unhandledRejection`，可触发紧急快照）。
- **安全** `security/`：见 `SECURITY.md`。

---

## 6. 评估与对外服务

- `evaluator/WorldEvaluator.ts`：**构造函数无参数**。`recordTick(ms)`、`bump(field: keyof EvalCounters, by=1)`、`buildReport(world: World)`、`flush(world): string`（写 `logs/eval-<ts>.json` 并打印摘要）。`EvalCounters = { events, collisions, messages, moved, soulActions, soulActionsSucceeded, perceivedEvents }`。注意它的 `buildReport/flush` 接收的是**核心模拟层 `engine/World.ts`** 的 `World`。
- `api/server.ts`：`createApp(deps)` / `startServer(deps)`，REST + WebSocket，详见 `API.md`。
- `api/soulClient.ts`：与 SoulArena 通信，见 `SOUL_INTERFACE.md`。
- `bridge/SoulBridge.ts`：双向灵魂桥，见 `SOUL_INTERFACE.md`。

---

## 7. Tick 数据流

### 7.1 核心模拟层

```
World.step(dt)
  └─ emit WorldTickEvent
       └─ for each enabled system: system.tick(dt, world, events)
            └─ PhysicsSystem.tick
                 ├─ backend.step(dt, world.bodies(), config)  → 积分 + AABB 碰撞
                 ├─ events.emit(CollisionEvent ...)           → 监听者（如 evaluator.bump）
                 └─ zone 检测 → events.emit(EntityEnterZone ...)
```

### 7.2 运行时层

```
WorldEngine.start() → setInterval(1000/tickRate)
  └─ tick(dt)
       ├─ phys.step(dt)            // engine/PhysicsSystem, 含 Quadtree 广义相位
       ├─ emit('collision', c)     // per collision
       └─ emit('tick', { tick, deltaTime, collisions })
```

---

## 8. 扩展点

| 扩展点 | 接口 / 基类 | 位置 |
|--------|-------------|------|
| 替换物理后端 | `IPhysicsBackend` | `physics/IPhysicsBackend.ts` |
| 新增通信介质 | `CommunicationStrategy`（core）/ `ICommunicationStrategy`（types） | `communication/`、`types/` |
| 新增世界系统 | `WorldSystem`（core `World.step`） | `engine/World.ts` |
| 自定义事件条件 | `Predicate` 可辨识联合 | `event/ConditionEngine.ts` |
| 接入灵魂系统 | `SoulWorldAdapter` | `bridge/SoulBridge.ts` |

---

## 9. 已知问题 / 限制（摘要，详见 DEVLOG）

1. **双栈未收敛**：核心模拟层与运行时层类型不一致（`PhysicsConfig`、`CommunicationStrategy`、`Vector3`、`Entity` 各有两套）。
2. **重复模块**：`engine/{Entity,Vector3,ObjectPool,SpatialIndex}.ts` 与 `entity/` 重复；`systems/{EventSystem,ConditionEngine}.ts` 与 `event/` 重复。
3. **集成缺口**：`server.ts` 依赖 `WorldEngine.currentWorld` 等不存在的成员；`runEval.ts` / 示例使用了不存在的 `WorldBuilder` 方法与 `WorldEngine.load()/runTicks()`。
4. **`npm run build` 当前失败**（约 14 个错误），错误清单见 `build_errors.txt` 与 `DEVLOG.md`。
5. `evaluator/index.ts` 导出了 `WorldEvaluator` 中并不存在的 `EvaluatorConfig` / `EvalActivityCounters` 类型。


### 风力系统（WindForceSystem）

物理层新增 WindForceSystem，将天气模拟（WeatherSimulator）的风速风向与物理模拟桥接。每 tick 读取当前风速和方向，对动态物体施加与风速平方、迎风面积（AABB x-z 投影）成正比、与质量成反比的力。静态/触发器/区域物体不受影响，灵魂默认不受影响（可配置 affectSouls）。支持最小有效风速阈值，低于阈值不产生力。未来可扩展：湍流、阵风、障碍物风影、升力气动外形。
