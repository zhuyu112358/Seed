# 架构文档（ARCHITECTURE）

> 基于 `src/` 下真实模块与依赖关系整理。项目为 TypeScript ESM（`"type": "module"`，`moduleResolution: NodeNext`）。

---

## 1. 设计目标与分层

Seed 是一个运行在 SoulArena **之下** 的虚拟物理世界引擎，提供：可配置的世界容器、物理模拟、
事件系统、可插拔通信媒介、灵魂交互桥接，以及可靠性与安全基础设施。整体分层自底向上：

```
┌──────────────────────────────────────────────────────────────┐
│  api/            REST + WebSocket 服务端，SoulClient 桥接      │
├──────────────────────────────────────────────────────────────┤
│  sdk/            WorldBuilder 流畅组装世界（对外公共表面）       │
├──────────────────────────────────────────────────────────────┤
│  engine/         World（容器）+ WorldEngine（主循环/统计）      │
├───────────┬───────────────┬──────────────┬───────────────────┤
│ entity/   │ physics/      │ event/       │ communication/    │
│ 实体层次  │ 可插拔物理后端│ 事件总线/传播│ 通信媒介策略       │
├───────────┴───────────────┴──────────────┴───────────────────┤
│  reliability/    Logger / Snapshot / Transaction / Exception   │
│  security/       ApiKeyAuth / InputValidator / RateLimiter /   │
│                  PermissionSystem / sanitize                  │
├──────────────────────────────────────────────────────────────┤
│  types/          跨模块共享类型契约（IVector3 / Perception…）  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 主循环流程

主循环由 `WorldEngine` 驱动（`src/engine/WorldEngine.ts`）：

```
WorldEngine.start()
  └─ setInterval(1000 / tickRate)
       └─ WorldEngine.tick(deltaTime)
            ├─ world.step(deltaTime)
            │    ├─ tick++; worldTime += dt
            │    ├─ events.emit(new WorldTickEvent(...))   // 世界总线
            │    └─ for system of world.systems:            // 按顺序
            │          if system.enabled: system.tick(dt, world, events)
            │                └─ PhysicsSystem.tick(...)     // 物理后端积分+碰撞
            │                     ├─ backend.step(dt, bodies, config)
            │                     ├─ events.emit(CollisionEvent)
            │                     └─ 区域触发检测 → events.emit(EntityEnterZone)
            ├─ 采样 tick 耗时（滑动窗口 120）
            └─ emit('tick', {...})  → 引擎级监听
```

关键点：

- `World` 是**世界无关的可配置容器**，`WorldEngine` 是驱动它的运行时；两者分离，方便用 SDK
  组装具体世界后再交给引擎。
- 每个 `WorldSystem` 实现 `{ readonly name; enabled; start?; stop?; tick(dt, world, events) }`。
- `PhysicsSystem` 是当前唯一默认挂载的系统；碰撞与区域事件都通过 `world.events` 总线派发。
- `WorldEngine` 自身也有一个小事件分发（`tick/entityCreated/entityRemoved/error`），监听异常被
  try/catch 隔离，不会拖垮主循环。

---

## 3. 实体模型（Entity → GameObject 层次）

`src/entity/Entity.ts`：

- **`Entity`（根类）**：`id / name / type / position: Vector3 / velocity / mass / material /
  state: Map / properties: Map / active / createdAt / children[] / parent`。
  提供 `attach(child)` / `detach()` / `walk(fn)`（子树 BFS）/ `toJSON()`。
- **`GameObject extends Entity`**：物理/交互实体，增加 `halfExtents / interactable / hittable`，
  以及 `aabbMin()` / `aabbMax()`（轴对齐包围盒角点）。

实体分类（`types/index.ts` 的 `EntityType`）：`static | dynamic | interactive | soul | soul-proxy |
npc | trigger | area | effect`。

`EntityFactory`（`src/entity/EntityFactory.ts`，**注意它在 `src/entity/`，不在 `sdk/` 下**）以静态方法
生产常用原型：

| 方法 | 产出 |
|------|------|
| `staticBox(name, center, halfExtents)` | 不可动静态体（质量无穷大，stone） |
| `dynamicBox({name, position, mass, material, velocity, halfExtents})` | 可动动态体 |
| `zoneTrigger({name, center, halfExtents, onEnter})` | 非物理触发区域（type=`trigger`） |
| `soulProxy({soulId, name, element, position})` | 灵魂在世界内的代理体，id=`soul_<soulId>` |
| `distance(a, b)` | 两点距离工具 |

`Vector3`（`src/entity/Vector3.ts`）是不可变三维向量，所有运算返回新向量；附带导出 `clamp()`。

---

## 4. 事件流（EventSystem 总线 + 传播衰减）

`src/event/`：

- **`Event<T>`（`Event.ts`）**：事件信封，携带 `type / payload / timestamp / sourceId` 与
  `propagation { origin, remainingRadius, intensity }`；`cancel()` / `isCancelled()` 支持短路。
  预置事件工厂：`CollisionEvent`(`physics.collision`)、`EntityEnterZone`(`zone.enter`)、
  `WorldTickEvent`(`world.tick`)、`WeatherEvent`(`world.weather`)。
- **`EventSystem`（`EventSystem.ts`）**：进程内类型化事件总线。
  - `on(type, handler, priority=0)` 返回退订函数；handler 按 priority 降序执行。
  - `once(...)` / `off(...)` / `listenerCount(type)` / `clear()`。
  - `emit(event)`：同步 handler 直接执行；异步 handler 以 fire-and-forget 运行，rejection 被吞掉；
    handler 抛错被捕获记日志；`event.cancel()` 会中断后续 handler。
- **`EventPropagation`（`EventPropagation.ts`）**：空间衰减辅助。
  `intensityAt(event, target) = max(0, originIntensity - attenuationPerMetre × distance)`，
  超过 `maxRadius` 返回 0；`filterByRadius(...)` 过滤可感知实体。
- **`ConditionEngine`（`ConditionEngine.ts`）**：小型谓词语言（`entityProperty / worldTime /
  and / or / not`），用于「实体 X 进入区域 Y 且 worldTime > T」这类玩法规则求值。

---

## 5. 通信策略（可插拔媒介）

项目里存在**两代**通信抽象（见 §11 已知问题）：

### 5.1 主实现：`src/communication/`

```ts
interface WorldView { entities: Iterable<GameObject>; byId(id): GameObject | undefined; }
interface CommunicationStrategy {
  readonly medium: string;
  transmit(message: Message, source: GameObject, world: WorldView): ReceivedMessage[];
}
```

- **`Message`**：`{ id, content, sourceId, position, medium, intensity, timestamp }`。
- **`ReceivedMessage`**：`{ original, receivedIntensity, distance }`。
- **`AcousticPropagation`**：逆平方 + 介质吸收衰减
  `intensity = sourceIntensity × 1/(1+atten·d²) × (1-absorb·d)`，超过 `maxRadius` 或低于
  `minAudible` 不送达。可配 `attenuation/absorption/maxRadius/minAudible`。
- **`NetworkPacket`**：分布式/网络媒介的**桩**，当前无距离衰减地广播给所有活跃实体。
- **`WorldResonance`**：「世界低语」媒介的**桩**，当前只让 `soul-proxy` 实体以满强度「听到」。

### 5.2 新一代：`src/systems/strategies/`

实现了 `types/index.ts` 的 `ICommunicationStrategy` 完整契约：

```ts
interface ICommunicationStrategy {
  readonly medium: CommunicationMedium;
  readonly name: string;
  initialize(config): void;
  send(message: CommunicationMessage, worldEntities: IEntity[]): CommunicationResult;
  canReach(sender, receiver, obstacles): { reachable; signalStrength };
  getPropagationDelay(sender, receiver): number;
  update(deltaTime): void;
  destroy(): void;
}
```

三个实现：`AcousticPropagation`（声速 343m/s、材料遮挡 AABB 射线检测、频率响应）、
`NetworkPacket`（带宽/跳数/丢包/延迟模型）、`WorldResonance`（谐振频率谐波增强、场强随时间衰减）。

---

## 6. 物理子系统

`src/physics/`：

- **`IPhysicsBackend`**：可插拔后端契约 `{ name; step(dt, bodies, config) → {collisions};
  applyImpulse(body, ix,iy,iz) }`，附带 `aabbOverlap(...)` 工具。
- **`SimplePhysics2D`**：v0.1 参考实现——重力/阻尼/空气阻力积分 + O(n²) AABB 窄相碰撞，
  沿最小穿透轴反射速度并按 `restitution` 缩放；静态体（质量无穷/0）不参与受力。
- **`PhysicsConfig`（类，`physics/PhysicsConfig.ts`）**：标量配置
  `gravity=9.8 / friction=0.1 / airResistance=0.05 / fixedDt=1/60 / enabled / restitution=0.6`，
  配 `defaults()` 与 fluent `builder()`。
- **`PhysicsSystem`**：实现 `WorldSystem` 接口，每 tick 拉取 `world.bodies()`、调用后端、派发
  `CollisionEvent`、做区域进入检测（`EntityEnterZone`）、统计 `counters {collisions, moved}`。

---

## 7. 可靠性（reliability/）

| 模块 | 职责 |
|------|------|
| `Logger` | 零依赖结构化 JSON 日志；`Logger.for(module)` 子 logger，支持 `(msg, meta)` 与 `(bindings, msg)` 两种重载；控制台 + `logs/seed.log`；级别由 `SEED_LOG_LEVEL` 控制；另有 `createLogger()` 返回严格 `ILogger` |
| `SnapshotManager` | 世界序列化为 `snapshots/*.json`（schema `seed/world-snapshot@1`）；`save/load/list/rollback`；`prune()` 只保留最新 N 份 |
| `WorldTransaction` | 最小 undo-log：`record(entity, beforePos)` → `finalize(entities)` → `commit()/rollback(entities)`，当前仅支持位置/速度回滚 |
| `ExceptionHandler` | 安装 `uncaughtException` / `unhandledRejection` 进程级处理器，记 fatal 日志并触发紧急快照；默认不退出，`setExitOnFatal(true)` 后严格模式退出 |

---

## 8. 安全（security/）

详见 `docs/SECURITY.md`。此处仅列分层：

- **`ApiKeyAuth`**：Express 中间件工厂，`X-API-Key` 校验，`SEED_AUTH=off` 时放行。
- **`InputValidator`**：基于 **Ajv** 的 schema 校验，5 个内置 schema，`validate(name, data)` /
  `validateInline(schema, data)`。
- **`RateLimiter`**：令牌桶，按 `RateLimitConfig` 配置，`consume(key)` / `check(key)` / `getStats()`。
- **`PermissionSystem`**：RBAC，5 个默认角色，`hasPermission` / `checkPermission`，带缓存。
- **`sanitize`**：`sanitizeString`（去控制字符 + HTML 转义）、`looksInjective`（注入特征检测）。

---

## 9. 评估（evaluator/）

- **`WorldEvaluator`**：`recordTick(ms)` 采样、`bump(keyof EvalCounters)` 活动计数、
  `buildReport(world)` 汇总 `EvalReport`（world / performance / subsystems / activity / soulInteraction）、
  `flush(world)` 写 `logs/eval-<stamp>.json` 并打印。
- **`runEval.ts`**：`npm run eval` 入口，用 SDK 搭一个小世界跑 N tick 并出报告。
- **`index.ts`**：评估 barrel（当前导出与实现存在不一致，见 §11）。

---

## 10. 入口与依赖关系

```
api/server.ts ──▶ engine/WorldEngine ──▶ engine/World ──▶ entity/Entity, event/EventSystem
                 ├─▶ security/{InputValidator,PermissionSystem,RateLimiter,ApiKeyAuth,sanitize}
                 └─▶ api/soulClient ──(HTTP)──▶ SoulArena (:3000)
sdk/WorldBuilder ──▶ engine/World, physics/PhysicsSystem, physics/PhysicsConfig, entity/Entity
physics/PhysicsSystem ──▶ physics/{IPhysicsBackend,SimplePhysics2D,PhysicsConfig}, event/{Event,EventSystem}
evaluator/runEval ──▶ sdk/index, communication/{Message,AcousticPropagation}, evaluator/WorldEvaluator
```

---

## 11. 已知架构问题

1. **两套物理配置不兼容**：`physics/PhysicsConfig.ts` 是**类、标量 gravity**；`types/index.ts` 的
   `PhysicsConfig` 是**接口、向量 gravity**（`{x,y,z}`）。`sdk/PhysicsConfig.ts` 的预设用后者，
   而 `PhysicsSystem`/`SimplePhysics2D` 用前者，尚未统一。
2. **两代通信策略接口并存**：`communication/CommunicationStrategy`（`medium + transmit`，操作
   `Message/GameObject`）与 `types/index.ts` 的 `ICommunicationStrategy`（`medium + name +
   initialize/send/canReach/getPropagationDelay/update/destroy`，操作 `CommunicationMessage/IEntity`）
   互不兼容。
3. **`src/systems/index.ts` barrel 断裂**：引用了 `./EventSystem.js`、`./CommunicationSystem.js`、
   `./ClockSystem.js`、`./WeatherSystem.js`、`./event-types.js` 等当前不存在的模块。
4. **两套服务端并存**：`api/server.ts`（主入口）与 `server/index.ts`（更完整但未接线）。
5. **WorldEngine 两种形态**：早期版本依赖 `engine/` 下不存在的 `EntitySystem/SpatialIndex/ObjectPool`，
   当前版本已收敛为直接持有 `World + PhysicsSystem`；旧引用应清理。
6. 编译当前不通过（24 个 TS 错误），详见 `docs/DEVLOG.md`。
