# 开发日志（DEVLOG）

> 版本 v0.1.0。本日志记录本次文档重写时对 `src/` 的**真实代码核对**结果、已落地能力，以及**必须跟踪的已知问题清单**。
> 文档中文，代码注释英文。

---

## 1. 本次核对结论

本次重写全部文档前，逐文件阅读了 `src/` 源码。核心事实：

- 项目存在**两条并行实现栈**（核心模拟层 / 运行时-SDK 层），通过 `types/index.ts` 的接口耦合，但**尚未完全收敛**。
- 此前部分文档/示例描述的 API（`WorldBuilder.setConfig/usePhysics/build()→World`、`WorldEngine.load()/runTicks()`、`InputValidator.registerSchema/validateInline`、`PermissionSystem.defineRole/checkPermission` 等）**在当前源码中并不存在**。本次文档一律以源码真实签名为准，并在下面“已知问题”中记录落差。
- `build_errors.txt` 记录的是**某次历史快照**的 14 个 `tsc` 错误；其中若干处已被部分修复（见下文对照），但整体 `npm run build` 仍未通过。

---

## 2. 已落地、可正常工作的部分

- `entity/`：`Entity` / `GameObject` / `Vector3`（不可变）/ `EntityFactory`（静态方法）。
- `physics/`：`PhysicsConfig`（类 + Builder）、`IPhysicsBackend`、`SimplePhysics2D`、`PhysicsSystem`（生命周期系统）、`aabbOverlap`。
- `event/`：`Event` 信封与子类、`EventSystem`（优先级/取消/错误隔离）、`ConditionEngine`（谓词联合）、`EventPropagation`（空间衰减）。
- `communication/`：`Message`、`CommunicationStrategy`、`AcousticPropagation`（真实衰减）、`NetworkPacket` / `WorldResonance`（stub）。
- `reliability/`：`Logger`、`SnapshotManager`、`WorldTransaction`、`ExceptionHandler`。
- `evaluator/WorldEvaluator.ts`：无参构造，`recordTick/bump/buildReport/flush`。
- `api/soulClient.ts`、`bridge/SoulBridge.ts`：与 SoulArena 的对接契约。

---

## 3. 已知问题清单（必须修复）

### P0 — 构建失败 / 运行时崩溃

**K1. `npm run build` 失败（约 14 个错误）**
- `examples/test-world/index.ts`：
  - 用 `new WorldEngine({ name, tickRate })` 构造，但真实构造函数要求完整 `WorldConfig`（含 `bounds`、`physics`）。
  - 调用 `engine.getAllEntities()`，该方法在 `WorldEngine` 上**不存在**（存在于 `EntitySystem`）。
  - `build_errors.txt` 还记录了与 `GameObject` 类型、`WorldEvaluator` 不存在的字段（`eventTriggers/communications/setActiveSouls/printReport/saveReport`）相关的错误。
- `src/evaluator/runEvaluation.ts`：`package.json` 的 `npm run evaluate` 指向它，但**文件不存在**。
- `src/evaluator/runEval.ts`：使用了设想中的 API（`new WorldBuilder('eval-world').setConfig().usePhysics().addEntity(...).build()` 后接 `world.events.on/world.step/world.bodies/world.getEntity`），与真实 `WorldBuilder`（`createWorld/addEntity(config)=>id/build():WorldConfig`）不符。
- `src/evaluator/index.ts`：`export type { EvaluatorConfig, EvalActivityCounters }`，但 `WorldEvaluator.ts` **没有导出这两个类型** → TS 报错（`build_errors.txt` 第 19–20 行）。

**K2. `server.ts` 与 `WorldEngine` 未接通**
- 所有处理器读取 `deps.engine.currentWorld`（getter），但 `WorldEngine` **没有 `currentWorld`**，也没有 `entities/tick/worldTime` 字段 → 运行时退化为“无世界”分支，类型检查失败。
- `POST /api/entities` 只校验不落库；`/ws` 仅回显。

> 说明：`build_errors.txt` 中提到的 `permissions.ensure() 不存在`、`limiter.check() 无 retryAfterMs`、`InputValidator.validate() 签名错误`，在**当前** `server.ts` 中已部分修正（当前代码确为 `permissions.ensure(...)`、`limiter.check(clientId).retryAfterMs`、`actionValidator.validate(schema, req.body)`）。这些旧报错以 `build_errors.txt` 记录为准，当前残留的真正阻断点是 `currentWorld` 缺失。

### P1 — 重复 / 双份实现

**K3. 重复模块（与 `entity/` 重复）**
- `engine/Entity.ts`（实现 `IEntity`，可变 `Vector3` 全套）与 `entity/Entity.ts`（`GameObject` 体系）是**两个不同的 `Entity`**。
- `engine/Vector3.ts`（可变，`addInPlace/mulInPlace`）与 `entity/Vector3.ts`（不可变）是**两个不同的 `Vector3`**。
- `engine/ObjectPool.ts`、`engine/SpatialIndex.ts`（`Quadtree`）无对应 `entity/` 同名文件，但与核心层无共享。

**K4. 重复事件模块（与 `event/` 重复）**
- `systems/EventSystem.ts`（带 `EventDefinition`/条件的玩法事件系统）与 `event/EventSystem.ts`（通用总线）类名相同、API 不同。
- `systems/ConditionEngine.ts`（`evaluate(conditions[], logic, ctx)`）与 `event/ConditionEngine.ts`（`evaluate(pred, ctx)`）类名相同、API 不同。

**K5. 两套 `PhysicsConfig`**
- `physics/PhysicsConfig.ts`：**类**，`gravity` 为标量（9.8），字段 `friction/airResistance/restitution/fixedDt/enabled`。
- `types/index.ts`：**接口** `PhysicsConfig`，`gravity` 为向量，字段 `airDensity/frictionCoefficient/restitutionCoefficient/timeScale/maxVelocity/collisionEnabled/substeps`。
- `sdk/PhysicsConfig.ts` 又提供了基于后者的预设。三者字段名互不通用。

**K6. 两套通信策略接口**
- `communication/CommunicationStrategy.ts`：`{ medium; transmit(message, source, world: WorldView): ReceivedMessage[] }`（core，`Message` 形状）。
- `types/index.ts` 的 `ICommunicationStrategy`：`{ medium; name; initialize; send(...): CommunicationResult; canReach; getPropagationDelay; update; destroy }`（runtime，`CommunicationMessage` 形状）。
- `AcousticPropagation` 实现的是前者；`WorldBuilder.addCommunicationStrategy` 期望的是后者。

### P2 — 孤立 / 未接线文件

**K7. 孤立 SDK 文件（未被 `sdk/index.ts` 引用）**
- `sdk/EntityFactory.ts`（`IEntityFactory` 实现，`createGround/createBox/...`）。
- `sdk/PhysicsConfig.ts`（预设与材质密度/摩擦/弹性表）。
- `sdk/WorldEventListener.ts`（`createListener()`）。
- `RunningWorld` 类未从桶导出。

**K8. `evaluator/index.ts` 内容未对齐**：见 K1，导出了不存在的类型。

### P3 — 已知落差（文档已据实标注）

**K9. `WorldEngine` 无 `load()` / `runTicks()`**：示例/旧文档使用了这两个方法，源码不存在。当前 `WorldEngine` 提供 `start()/stop()/tick(dt)/getStats()`。

**K10. 安全模块 API 与早期设想不同**（以源码为准）：
- `InputValidator`：构造无参，仅 `validate(schema, input)`；**无** `registerSchema/validate(name,data)/validateInline/sanitize/getRegisteredSchemas`，也**无内置 schema**。
- `PermissionSystem`：`grant/isAllowed/ensure`；**无** `defineRole/assignRole/hasPermission/checkPermission/addPermissionToRole`。默认仅授权 admin `*`、observer `read`、soul 对 entity `read/interact` + soul `self-action`。
- `RateLimiter`：`constructor(qps, windowMs=1000)`、`check(clientId, now?)`、`reset()`；**无** `consume/resetAll/getStats`。

**K11. 动作枚举不一致**：`server.ts` 允许 `move/speak/interact/attack/use`；`types/ActionRequest` 允许 `move/interact/communicate/use/attack/wait/custom`。

---

## 4. 修复优先级建议

1. 先解决 **K1/K2**：统一 `WorldEngine` 与 `World` 的关系（让 `server.ts` 能拿到当前世界），并修掉 `evaluator/index.ts` 的错误导出，使 `npm run build` 转绿。
2. 收敛 **K5/K6**：选定一套 `PhysicsConfig` 与 `CommunicationStrategy`，删除/别名另一套。
3. 去重 **K3/K4**：合并 `engine/` 与 `entity/`、`systems/` 与 `event/`。
4. 处理 **K7**：决定孤立 SDK 文件是接入桶导出还是删除。
5. 对齐 **K10/K11**：安全模块与动作枚举。

---

## 5. 变更记录

- 本次：重写全部 9 份 `docs/`（新增 `SECURITY.md`），全部以 `src/` 真实签名为准；把上述落差显式记录在本日志与各文档“已知问题”节。

## 2026-09-05 — World Event System v0.1

**新增模块：**
- src/event/WeatherSimulator.ts — 气象模拟器（温度/湿度/风速/风向/气压/天气状态动态变化）
- src/event/WorldClock.ts — 世界时钟（昼夜循环/光照计算/时段变化事件）
- src/event/WorldEventSystem.ts — 世界事件系统（条件评估/事件触发/效果应用/冷却机制）

**内置事件：**
- wind-gust（阵风）— 风速 > 10 m/s 触发，对动态实体施力
- rain-storm（暴雨）— 高湿度+低气压触发
- typhoon（台风）— 极高风速+高湿度触发，extreme 严重度
- cold-snap（寒潮）— 温度 < 0°C 触发

**测试：** 新增 26 个单元测试，全部通过。完整测试套件 113/113 通过。

**文档：** 新增 docs/WORLD_EVENTS.md，详细描述架构、API、集成方式和扩展指南。

**需求覆盖：** 需求12（模拟世界事件）核心架构落地。
---

## 2026-09-05 世界事件系统增强（第5轮迭代）

**增强内容：**

- egisterBuiltinEvents() 方法：一键注册全部 4 个内置事件（阵风/暴雨/台风/寒潮），无需手动逐个 registerDefinition
- modifyProperty 效果类型：事件持续期间修改目标实体的 state 属性（如 wet/frozen），支持 all/souls/dynamicEntities/staticEntities 目标筛选
- 灵魂感知集成：事件触发时自动按 name 查找 SoulPerceptionSystem，调用 recordEvent() 将事件写入灵魂感知缓冲区，灵魂在 PerceptionFrame.events 中可感知
- triggerEvent 签名增加 world 参数，用于访问 world.systems 查找感知系统

**测试：** 新增 3 个单元测试（registerBuiltinEvents、modifyProperty 效果、灵魂感知集成），完整测试套件 149/149 通过。

**文档：** SOUL_INTERFACE.md 新增第 9 节「世界事件系统」，包含内置事件表、条件评估、事件效果、灵魂感知集成、API 说明。

**需求覆盖：** 需求12（模拟世界事件）增强——事件现在能影响灵魂感知，形成完整的"天气条件→事件触发→物体影响→灵魂感知"链路。

---

## 2026-09-05 对象池 ObjectPool（第6轮迭代）

**新增内容：**

- src/utils/ObjectPool.ts：通用泛型对象池，复用频繁创建/销毁的对象以减少 GC 压力
- 配置项：factory（创建函数）、reset（重置函数）、validate（验证函数）、initialSize（预分配）、maxSize（最大容量）
- API：acquire() 获取对象（池空则新建）、release(obj) 归还对象（自动重置）、preallocate(count) 预分配、clear() 清空空闲对象、getStats() 统计
- 防双释放：通过 activeSet 追踪活跃对象，重复 release 被忽略
- 超容量丢弃：release 时池已满则对象被丢弃（等待 GC）
- 验证机制：acquire 时可通过 validate 函数检查对象有效性，无效则丢弃并新建

**测试：** 新增 12 个单元测试（预分配、获取/归还、复用、双释放、maxSize、preallocate、clear、统计、validate、无reset），完整测试套件 161/161 通过。

**文档：** ARCHITECTURE.md 新增 3.8 节「性能工具」，描述 ObjectPool 设计与适用场景。

**需求覆盖：** 需求10（性能问题，参考大型游戏方案）——对象池是游戏引擎标准性能优化组件，可用于 Vector3 临时计算、粒子、投射物、临时实体等短生命周期对象。


---

## 2026-09-05 SoulBridgeAdapter 桥接适配器（第7轮迭代）

**P0 核心瓶颈突破：** 创建 SoulBridgeAdapter，打通 perceive→decide→act 完整循环。

**新增文件：**
- `src/bridge/SoulBridgeAdapter.ts`：Seed 与 SoulArena 之间的唯一桥接组件

**核心功能：**
- 感知格式转换：支持简化模式（situation 文本，推荐）和结构化模式（SoulArena 原生格式）
- 动作格式转换：speak→communicate、expression→custom、move/attack/interact/use/wait 映射，未知类型→custom（保留 originalType）
- API 编排：定期（默认每10 tick）从 SoulPerceptionSystem 获取 PerceptionFrame，POST 到 SoulArena `/api/soul/:id/perceive`
- 动作接收：支持 API 返回体中的 actions[] 自动解析，以及 `ingestAction()` 方法供 webhook 回调推送
- 动作队列：每 tick 处理，每灵魂上限 20 个（超出丢弃最旧）
- 懒加载绑定：作为 WorldSystem 添加到 world 后，自动按 name 查找 soul-perception 和 soul-action 系统
- 完整统计：perceptionsSent/perceptionsFailed/actionsReceived/actionsExecuted/actionsFailed/actionsDropped/connectedSouls

**架构约束遵守：**
- SoulBridgeAdapter 是唯一允许做格式转换和 SoulArena API 调用的模块
- SoulPerceptionSystem/SoulActionSystem 只处理标准化格式，不直接调用 SoulArena
- 未在 Seed 内核中实现任何灵魂认知/决策逻辑

**测试：** 新增 16 个单元测试（初始化、7种动作转换、统计追踪、队列溢出丢弃、situation文本生成、两种payload构建、clearQueue、懒加载绑定、无绑定安全），完整测试套件 177/177 通过。

**文档：** SOUL_INTERFACE.md 新增第 10 节「SoulBridgeAdapter 桥接适配器」，包含架构约束、工作流程图、格式转换表、API 说明、使用示例。

**需求覆盖：** 需求1（灵魂-世界接口约定）核心闭环打通——感知生成→SoulArena决策→动作执行完整链路。



---

## 2026-09-05 InteractionSystem 物体交互系统（第8轮迭代）

**需求5核心缺口补全：** 创建 InteractionSystem，实现可交互物体的状态机，物体交互不再只是记录计数，而是有实际的状态变化。

**新增文件：**
- `src/entity/InteractionSystem.ts`：通用可交互物体状态机系统

**核心功能：**
- 可交互物体定义（InteractableDef）：entityId, type, name, initialState, states[], transitions[], usable, maxUses
- 6种交互类型：toggle（开关）、door（门）、button（按钮）、lever（拉杆）、container（容器）、custom（自定义）
- 状态转换引擎：按当前状态查找匹配的 transition，执行 from→to 转换
- interact(entityId, actorId?, events?)：触发状态转换，返回 InteractionResult
- use(entityId, actorId?, events?)：使用物体，递增 useCount，支持 maxUses 消耗限制
- 状态转换时发出 interaction.state-change 事件；use 时发出 interaction.use 事件
- 运行时追踪：interactCount, useCount, lastInteractedBy/At, lastUsedBy/At
- reset(entityId)：重置到初始状态，清除计数
- getStats()：聚合统计（totalRegistered, totalInteractions, totalUses, byType）
- 内置工厂函数：createDoorDef/createToggleDef/createButtonDef/createLeverDef/createContainerDef
- 支持自定义多状态机（如锁：locked→unlocking→unlocked→locked）
- maxInteractables 容量限制

**架构约束遵守：**
- 通用状态机，不硬编码具体世界属性
- 不实现灵魂决策逻辑，只处理交互状态转换
- 可交互物体定义通过 register() 传入，不写死在内核

**测试：** 新增 23 个单元测试（注册/拒绝、5种内置类型状态转换、无转换失败、交互计数追踪、use计数/不可用/耗尽、reset、unregister、getStats、事件发射、容量限制、自定义3状态机、WorldSystem tick），完整测试套件 200/200 通过。

**文档：** ARCHITECTURE.md 新增 3.5 节「交互系统」，后续章节重新编号（3.5物理→3.6，3.6事件→3.7，3.7通信→3.8，3.8性能工具→3.9）。

**需求覆盖：** 需求5（虚拟物理世界搭建，物体的定义与互相之间的交互）——物体交互从"只记录计数"升级为"实际状态机转换"，门可以开关、灯可以亮灭、按钮可以按下、容器可以打开。



---

## 2026-09-05 SoulActionSystem × InteractionSystem 集成（第9轮迭代）

**需求5闭环完成：** 灵魂的 interact/use 动作现在会实际触发 InteractionSystem 状态机转换，形成"灵魂动作→物体状态变化→事件发射→灵魂感知"完整闭环。

**核心修改：**

1. **SoulActionSystem 集成 InteractionSystem**（src/entity/SoulActionSystem.ts）
   - 新增 `interaction` 字段和 `ensureInteraction(world)` 懒加载方法（按 name='interaction' 查找）
   - `executeAction()` 和 `tick()` 中调用 `ensureInteraction()`
   - `doInteract()`：如果 InteractionSystem 可用且目标已注册，调用 `interaction.interact(targetId, soulId, world.events)` 触发状态转换，返回 previousState/newState/transitioned；否则回退到原有的计数-only 行为
   - `doUse()`：如果 InteractionSystem 可用且目标已注册，调用 `interaction.use(targetId, soulId, world.events)`，支持耗尽失败；否则回退到计数-only 行为
   - 向后兼容：InteractionSystem 不可用时保持原有行为，不破坏现有测试

2. **InteractionSystem 事件发射 bug 修复**（src/entity/InteractionSystem.ts）
   - **重要 bug**：之前 `events.emit({...} as never)` 传入的是普通对象，不是 Event 类实例，导致 EventSystem.emit() 运行时抛出 `event.isCancelled is not a function`
   - 修复：import Event 类，使用 `new Event({ type, payload, sourceId })` 格式发射事件
   - `interaction.state-change` 事件：payload 包含 entityId/entityName/interactableType/previousState/newState/actorId/interactCount
   - `interaction.use` 事件：payload 包含 entityId/entityName/useCount/maxUses/depleted/actorId

**测试：**
- soul-action.test.ts 新增 5 个集成测试：门打开、门开关切换、use 计数、无 InteractionSystem 回退、事件发射验证
- interaction-system.test.ts 修复 2 个测试：event.data → event.payload（适配 Event 类格式）
- 完整测试套件 205/205 通过

**架构约束遵守：**
- SoulActionSystem 只处理标准化 ActionRequest 格式，不绑定具体灵魂
- InteractionSystem 是通用状态机，不硬编码具体世界属性
- 两个系统通过 name 懒加载解耦，不直接 import 彼此

**需求覆盖：** 需求5（虚拟物理世界，物体定义与互相交互，对灵魂的影响和反馈）——灵魂交互从"只记录计数"升级为"实际状态机转换+事件发射"，物体状态变化可被灵魂感知系统捕获。



---

## 2026-09-05 事件总线系统性 Bug 修复（第10轮迭代）

**可靠性修复（需求7）：** 修复了事件总线上的系统性 bug——多个模块在 `events.emit()` 时传入普通对象而非 `Event` 类实例，导致 EventSystem 在有监听器时抛出 `event.isCancelled is not a function` 运行时错误。此 bug 之前不可见，因为没有测试为这些事件注册监听器。

**修复的模块：**

1. **WorldClock.ts**（src/event/WorldClock.ts）
   - `clock.phaseChange` 事件：普通对象 `{ id, type, timestamp, data }` → `new Event({ type, payload, sourceId })`
   - payload: `{ phase, timeOfDay, lightLevel }`

2. **WorldEventSystem.ts**（src/event/WorldEventSystem.ts）——3 处
   - `world.event.start`：payload `{ eventId, name, severity, duration }`
   - `world.event.end`：payload `{ eventId, name, tickCount, effectsApplied }`
   - `emitEvent` 效果：payload `{ sourceEvent, ...effect.parameters }`

**已修复的同类问题（上一轮）：**
- InteractionSystem.ts：`interaction.state-change` 和 `interaction.use` 事件

**测试：**
- world-clock.test.ts 新增 1 个测试：验证 phaseChange 事件为 Event 实例，含正确 payload 和 isCancelled 方法
- world-event-system.test.ts 新增 1 个测试：验证 world.event.start/end 为 Event 实例，含正确 payload
- 完整测试套件 207/207 通过（上一轮 205，新增 2）

**影响评估：**
- 修复前：任何为 `clock.phaseChange`、`world.event.start`、`world.event.end`、`world.effect` 注册监听器的代码都会在事件触发时崩溃
- 修复后：事件总线完全正常工作，监听器可安全接收 Event 实例
- 这是 SoulPerceptionSystem 集成世界事件的前置条件（感知系统需要监听世界事件）

**需求覆盖：** 需求7（可靠性，log/异常恢复）——修复运行时崩溃 bug，提升系统稳定性。



---

## 2026-09-05 光照系统 LightSystem（第11轮迭代）

**现实逼近（需求11）：** 新增动态光照系统，支持点光源（位置/强度/颜色/衰减半径）、方向光（与 WorldClock 昼夜循环集成）、环境光、点光照度计算、实体可见度计算、彩色光照计算。

**核心模块：** `src/event/LightSystem.ts`

**PointLight（点光源）：**
- 位置（Vector3）、强度（0-1）、颜色（RGB 0-1）、衰减半径（米）、启用状态
- `contributionAt(point)`：逆平方归一化衰减，距离 0 处 = intensity，距离 = radius 处 = 0，公式 `(1 - dist/radius)² × intensity`
- `colorAt(point)`：按贡献度缩放的 RGB 颜色

**LightSystem（光照系统）：**
- 点光源管理：addLight/removeLight/getLight/getAllLights/getEnabledLights，maxLights 容量限制（默认 128），ID 去重
- `getIlluminationAt(point)`：总照度 = 环境光 + 方向光（太阳/月亮） + 所有点光源贡献，钳制到 [0,1]
- `getColoredIlluminationAt(point)`：彩色 RGB 照度计算，环境光和方向光为白色，点光源带颜色
- `getEntityVisibility(entity)`：基于实体位置照度计算可见度（0-1），低于 visibilityThreshold 为 0
- `bindClock(clock)`：绑定 WorldClock，方向光强度跟随 `getLightLevel()`（昼夜循环）
- `getDirectionalIntensity()`：获取当前方向光强度
- 事件：`light.changed`（add/remove/modify），使用正确的 `new Event({ type, payload, sourceId })` 格式
- `getStats()`：完整统计（总光源数/启用数/环境光/方向光/容量/新增删除计数/可见度阈值）

**架构约束遵守：**
- 通用引擎，不硬编码具体世界属性（所有参数通过配置传入）
- 不实现灵魂认知/决策逻辑
- 只处理光照计算，不绑定具体灵魂或世界
- 事件发射使用 Event 类实例（上一轮修复的格式）

**测试：**
- light-system.test.ts 新增 24 个测试：PointLight（7个：默认值/自定义配置/全强度/超半径零/禁用零/距离衰减/彩色贡献）、LightSystem（17个：初始化/自定义配置/添加获取/重复ID/容量限制/删除/启用过滤/环境光/点光源贡献/多光源求和/钳制/时钟绑定/无时钟方向光/实体可见度/事件发射/彩色照度/World tick 集成）
- 完整测试套件 231/231 通过（上一轮 207，新增 24）

**需求覆盖：** 需求11（持续向现实世界逼近）——动态光照是虚拟世界现实感的基础组件，影响灵魂感知（环境光、可见度）、昼夜循环体验、氛围营造。

**后续可扩展方向（列入 backlog）：**
- 光照遮挡计算（障碍物阻挡光线）
- 阴影投射
- 光源闪烁/脉冲动画
- 光照对实体状态的影响（如植物生长、冰融化）
- SoulPerceptionSystem 集成光照信息到 PerceptionFrame



---

## 2026-09-05 热传导/温度系统 ThermalSystem（第12轮迭代）

**现实逼近（需求11）：** 新增热传导与温度模拟系统，支持热源辐射、牛顿冷却定律、实体间热传导、与 WeatherSimulator 环境温度集成、实体温度存储、温度阈值事件。与上一轮 LightSystem 形成互补（光照+温度都是环境物理）。

**核心模块：** `src/event/ThermalSystem.ts`

**HeatSource（热源）：**
- 位置（Vector3）、强度（任意单位，距离0处的温度贡献）、衰减半径（米）、启用状态
- `contributionAt(point)`：逆平方归一化衰减 `(1 - dist/radius)² × intensity`

**ThermalSystem（温度系统）：**
- 热源管理：addHeatSource/removeHeatSource/getHeatSource/getAllHeatSources，maxHeatSources 容量限制（默认 64），ID 去重
- `getTemperatureAt(point)`：点温度 = 环境温度 + 所有热源贡献
- `getAmbientTemperature()`：从 WeatherSimulator 读取（绑定后），否则用默认值
- `getEntityTemperature(entity)` / `setEntityTemperature(entity, temp)`：实体温度存储在 `entity.state.temperature`
- **牛顿冷却定律**：每 tick 更新实体温度 `dT/dt = -k × (T - T_env) / heatCapacity`，T_env 包含热源（实体位置处的局部环境温度）
- **实体间热传导**：近距离实体间热交换，基于双方导热率、距离、热容，`enableConduction` 可开关
- **材质属性**：从 `entity.properties` 读取 `thermalConductivity`（默认0.1，用于实体间传导）和 `heatCapacity`（默认1.0，影响温度变化速率）
- **温度阈值事件**：`thermal.hot`（超过 hotThreshold，默认60°C）、`thermal.cold`（低于 coldThreshold，默认0°C）、`thermal.normalized`（回到正常范围），使用正确的 `new Event({ type, payload, sourceId })` 格式
- 热源变更事件：`thermal.source-changed`（add/remove）
- `getStats()`：完整统计
- `bindWeather(weather)`：绑定 WeatherSimulator 获取环境温度

**架构约束遵守：**
- 通用引擎，不硬编码具体世界属性（所有参数通过配置传入）
- 不实现灵魂认知/决策逻辑
- 事件发射使用 Event 类实例
- 实体温度存储在通用 state map 中，不绑定具体实体类型

**测试：**
- thermal-system.test.ts 新增 25 个测试：HeatSource（6个：默认值/自定义配置/全强度/超半径零/禁用零/距离衰减）、ThermalSystem（19个：初始化/自定义配置/添加获取/重复ID/容量限制/删除/环境温度/热源贡献/Weather绑定/无Weather默认/实体温度直接设置/实体加热模拟/实体冷却模拟/实体间传导/thermal.hot事件/thermal.cold事件/热源变更事件/World tick集成/材质导热率与热容影响）
- 完整测试套件 256/256 通过（上一轮 231，新增 25）

**需求覆盖：** 需求11（持续向现实世界逼近）——热传导是虚拟世界现实感的核心物理，影响实体状态（冰融化、水蒸发、植物生长）、灵魂感知（环境温度、热舒适度）、世界事件（火灾、寒潮触发条件）。

**后续可扩展方向（列入 backlog）：**
- 光照与热源集成（光源也是热源，LightSystem 点光源可作为 ThermalSystem 热源）
- 温度对实体状态的影响（冰融化、水蒸发、金属膨胀）
- 热辐射的障碍物遮挡
- 对流（热空气上升）
- SoulPerceptionSystem 集成温度信息到 PerceptionFrame
- 世界事件系统集成温度条件（寒潮/热浪触发）

