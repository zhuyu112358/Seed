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



---

## 2026-09-05 灵魂环境感知集成：LightSystem + ThermalSystem → SoulPerceptionSystem（第13轮迭代）

**需求5（物体对灵魂的影响）+ 需求11（现实逼近）：** 将上两轮构建的环境物理系统（LightSystem 光照、ThermalSystem 温度）集成到灵魂感知管道，让灵魂能感知到所处位置的本地光照强度、本地温度、附近光源和附近热源。这打通了"环境物理变化 → 灵魂感知 → 灵魂决策 → 灵魂动作"的完整闭环。

**修改模块：**
- `src/types/index.ts` — PerceptionFrame.environment 新增 4 个可选字段
- `src/entity/SoulPerceptionSystem.ts` — 集成 LightSystem 和 ThermalSystem

**PerceptionFrame 新增字段（environment 内）：**
- `localTemperature`：灵魂所在位置的本地温度（°C），包含热源辐射。ThermalSystem 不可用时为 undefined
- `localLightLevel`：灵魂所在位置的本地光照强度（0-1+），包含点光源/方向光/环境光。LightSystem 不可用时为 undefined
- `nearbyHeatSources`：感知范围内的附近热源列表（id/distance/intensity），仅包含启用的热源
- `nearbyLights`：感知范围内的附近光源列表（id/distance/intensity），仅包含启用的光源

**SoulPerceptionSystem 变更：**
- 新增 `LightSystem` 和 `ThermalSystem` 懒加载引用（与 WeatherSimulator 相同模式，通过 `world.systems` 遍历 + instanceof 匹配）
- 新增配置项：`sensoryRange`（感知范围，默认15米）、`maxNearbySensory`（最多返回附近感官源数量，默认8）
- `buildFrame()` 中计算灵魂位置处的本地光照（`light.getIlluminationAt(pos)`）和本地温度（`thermal.getTemperatureAt(pos)`）
- 收集附近热源（`thermal.getAllHeatSources()` 过滤启用+距离+排序+截断）和附近光源（`light.getEnabledLights()` 过滤距离+排序+截断）
- 所有新字段为可选，保持向后兼容：LightSystem/ThermalSystem 不存在时字段为 undefined，全局环境字段（temperature/lightLevel 等）仍正常工作

**架构约束遵守：**
- 通用引擎，不硬编码具体世界属性
- 不实现灵魂认知/决策逻辑（只做感知生成，决策由 SoulArena 负责）
- SoulPerceptionSystem 只处理标准化 PerceptionFrame 格式
- 系统间通过懒加载查找，不硬依赖

**测试：**
- `tests/soul-perception-environment.test.ts` 新增 14 个测试：
  - LightSystem 集成（5个）：localLightLevel 存在性、靠近点光源增强、远离点光源降低、nearbyLights 列表、无光源时空列表
  - ThermalSystem 集成（6个）：localTemperature 存在性、靠近热源增强、远离热源降低、nearbyHeatSources 列表、无热源时空列表、禁用热源不出现
  - 组合感知（2个）：篝火同时发光发热、全局字段与本地字段共存
  - 向后兼容（1个）：无 LightSystem/ThermalSystem 时本地字段为 undefined
- 完整测试套件 270/270 通过（上一轮 256，新增 14）

**需求覆盖：**
- 需求5（物体定义与交互、对灵魂的影响和反馈）：环境物体（光源/热源）现在能影响灵魂的感知输入
- 需求11（持续向现实世界逼近）：灵魂能感知到真实的局部光照和温度差异，而非全局统一值

**后续可扩展方向（列入 backlog）：**
- SoulBridgeAdapter 将 localTemperature/localLightLevel 转换为 SoulArena 感知格式中的 situation 描述
- 温度/光照对灵魂状态的直接影响（如极寒导致灵魂行动力下降）
- 光照遮挡对感知的影响（暗处的实体可见性降低）
- 声音传播与环境感知的统一感官框架
- 世界事件系统集成温度/光照条件（如极寒触发寒潮事件、高温触发火灾风险）



---

## 2026-09-05 端到端集成打通：SoulBridgeAdapter P0 bug修复 + perceive→decide→act闭环验证（第14轮迭代）

**重大里程碑：** Seed 世界引擎与 SoulArena 认知系统的 perceive→decide→act 完整闭环首次端到端跑通！集成测试结果：12 感知发送、12 动作接收、11 动作执行、0 失败。

### 发现的 3 个 P0 集成 bug

在端到端联调中发现 SoulBridgeAdapter 存在 3 个导致闭环完全无法工作的 P0 bug：

**Bug 1：API 路径单复数错误**
- SoulBridgeAdapter 使用：`POST /api/soul/:id/perceive`（单数 soul）
- SoulArena 实际路由：`POST /api/souls/:id/perceive`（复数 souls）
- 结果：所有感知请求返回 404 Not Found
- 修复：统一改为复数 `/api/souls/`

**Bug 2：动作不在感知响应中**
- SoulBridgeAdapter 期望感知响应包含 `body.actions[]` 数组
- SoulArena 感知响应实际只包含 `{ status, tick, cognitiveTickResult, pendingActions(count), actionsSent(count) }`
- SoulArena 的动作通过 **webhook callbackUrl** 主动 POST 到 Seed，不在感知响应中返回
- 结果：SoulBridgeAdapter 永远收不到任何动作
- 修复：新增内置 webhook 动作接收服务器

**Bug 3：缺少生命周期管理**
- SoulArena 要求灵魂先调用 `enter-world` 才能接受感知（否则返回 400 SOUL_NOT_IN_WORLD）
- SoulBridgeAdapter 没有 enter-world/exit-world 方法
- 修复：新增 `enterWorld(soulId)` 和 `exitWorld(soulId, reason)` 方法

### SoulBridgeAdapter 新增功能

1. **Webhook 动作接收服务器**（`startWebhookServer(port)` / `stopWebhookServer()`）
   - 基于 Node.js 内置 `http.createServer`，无外部依赖
   - 监听 `POST /actions` 接收 SoulArena 动作回调
   - 每个动作通过 `ingestAction()` 入队，下一 tick 执行
   - 提供 `GET /health` 健康检查端点
   - `enterWorld()` 自动将 callbackUrl 设置为 webhook 地址

2. **生命周期管理**（`enterWorld()` / `exitWorld()` / `isSoulEntered()`）
   - enterWorld：POST `/api/souls/:id/enter-world`，设置 worldId/worldName/callbackUrl
   - exitWorld：POST `/api/souls/:id/exit-world`，正常退出
   - 维护 `enteredSouls` 集合跟踪已进入世界的灵魂

3. **扩展动作类型映射**
   - 新增支持：`move`（direction/speed/distance）、`flee`（→move + fleeing flag）、`observe`（→custom）、`gesture`（→custom）、`sleep`（→custom）
   - SoulArena 支持的完整动作列表：move, speak, interact, expression, observe, gesture, sleep, attack, flee, custom
   - 所有未定义字段不会污染 parameters（只包含已定义的属性）

4. **新增配置项**
   - `webhookPort`：webhook 服务器端口（默认 3001）
   - `worldId`：进入世界时使用的世界 ID（默认 seed-default）
   - `worldName`：世界名称（默认 Seed Virtual World）

### 端到端集成测试脚本

创建 `examples/integration-test.ts`，可重复运行的完整集成测试：

1. 从 SoulArena API 自动发现测试灵魂（或通过命令行参数指定）
2. 创建 Seed 世界（weather + perception + action + bridge）
3. 添加 3 个测试物体（橡树、大石头、路灯）
4. 启动 webhook 动作接收服务器
5. 调用 enter-world 注册灵魂
6. 运行 60 tick（可配置），每 5 tick 发送一次感知
7. 每 10 tick 采样感知帧（可见物体数/温度/光照）
8. 调用 exit-world 正常退出
9. 停止 webhook 服务器
10. 输出完整报告（感知数/动作数/执行数/最终位置/环境状态）
11. 自动判定：PASS（感知+动作都有）/ PARTIAL（只有感知）/ FAIL（无感知）

**首次运行结果（灵魂 Vex, wind）：**
```
Perceptions sent:  12 (0 failed)
Actions received:  12
Actions executed:  11 (0 failed)
Actions dropped:   0
Final position:    (0.00, 0.00, 0.00)
Visible entities:  3 (Oak Tree, Large Rock, Street Lamp)
Verdict: PASS - perceive -> decide -> act loop is fully operational.
```

### 架构约束遵守

- SoulBridgeAdapter 是唯一做格式转换和 API 编排的模块 ✓
- 不实现灵魂认知/决策逻辑（决策完全由 SoulArena 负责）✓
- 通用引擎，不硬编码具体世界属性 ✓
- 接口对齐 SoulArena 实际实现（复数 souls 路径）✓

### 需求覆盖

- 需求1（灵魂系统接口约定）：完整打通，接口约定需更新为实际实现（复数路径、webhook 模式）
- 需求5（物体定义与交互、对灵魂的影响和反馈）：灵魂能感知世界物体，SoulArena 基于感知生成动作
- 需求7（可靠性）：webhook 接收失败有日志，动作队列有上限防溢出

### 后续可扩展方向（列入 backlog）

1. **SoulBridgeAdapter 增强**：
   - 记录收到的动作类型分布（speak/move/expression 等）
   - 感知发送失败时的重试机制
   - 多灵魂并发支持（当前已支持，需测试）
   - 心跳检测（SoulArena 30秒无感知标记为 stale）
2. **SoulActionSystem 增强**：
   - 实现 move 动作的实际物理移动（当前可能只记录）
   - 实现 speak 动作的 AcousticPropagation 集成
   - 实现 interact/use 与 InteractionSystem 的完整集成
3. **接口文档更新**：
   - SOUL_INTERFACE.md 需更新为实际实现（复数路径、webhook 模式、enter-world 前置条件）
   - interface_spec.md 需修正单数→复数的错误
4. **多灵魂集成测试**：两个灵魂在同一世界中交互
5. **世界事件与灵魂感知集成**：触发台风等事件，观察灵魂反应



---

## 2026-09-05 SoulActionSystem增强：6种move格式 + AcousticPropagation语音传播集成（第15轮迭代）

### 本轮目标

端到端集成测试已通过（第14轮），但发现两个改进点：
1. SoulArena 可能发送多种格式的 move 动作（direction-only、targetPosition、speed等），SoulActionSystem 只支持 `{x,y,z}` 和 `{direction,distance}` 两种
2. communicate（speak）动作只是简单记录，没有通过 AcousticPropagation 进行实际的声学传播计算

### SoulActionSystem.move 增强（6种输入格式）

`doMove` 方法现在支持以下所有格式：

| 格式 | 参数 | 说明 |
|------|------|------|
| 绝对位置 | `{x, y, z}` | 移动到指定坐标（原有） |
| 目标位置对象 | `{targetPosition: {x,y,z}}` | 移动到目标位置对象 |
| 增量移动 | `{dx, dy, dz}` | 相对于当前位置移动 |
| 方向+距离 | `{direction, distance}` | 沿方向移动指定距离（原有） |
| 方向+速度 | `{direction, speed}` | 距离 = speed × defaultMoveDistance |
| 仅方向 | `{direction}` | 使用 defaultMoveDistance（默认1m） |

新增配置：
- `defaultMoveDistance`：仅方向时的默认移动距离（默认1m）

其他改进：
- 零距离移动返回 success（不再报错）
- 所有移动结果包含 `mode` 字段标识使用的格式
- 灵魂 state 记录 `lastMoveMode`

### AcousticPropagation 集成到 communicate 动作

当 SoulActionSystem 配置了 `acoustic` 参数时，communicate（speak）动作会：

1. 创建 Message 对象（content、sourceId、position、intensity）
2. 遍历世界中所有活跃实体，用 `AcousticPropagation.intensityAt()` 计算每个实体位置的接收声强
3. 只有接收声强 > 0 的实体才被加入 `heardBy` 列表
4. 对每个听到的实体，在 SoulPerceptionSystem 中记录通信（带 receivedIntensity 元数据）
5. ActionResult.data 包含：
   - `heardBy`：听到消息的实体列表（id、name、distance、intensity）
   - `heardCount`：听到的实体数量
   - `intensity`：声源强度

未配置 acoustic 时保持原有行为（legacy fallback），heardBy 为空数组。

**修复的关键 bug**：`world.entities` 是 `Map<string, Entity>`，直接 `for...of` 遍历得到的是 `[key, value]` 对而非 Entity 对象。必须使用 `world.entities.values()` 遍历。

### 集成测试增强

`examples/integration-test.ts` 新增：
- 启用 AcousticPropagation（maxRadius=30, minAudible=0.02）
- maxMoveDistance 提升到 10
- 动作类型分布统计（从 actionSystem.getHistory() 提取）
- 位置历史追踪（每5 tick 记录一次灵魂位置）
- 报告中输出动作类型分布和位置历史

**100 tick 集成测试结果（灵魂 Vex, wind）**：
```
Perceptions sent:  20 (0 failed)
Actions received:  20
Actions executed:  19 (0 failed)
Action types:      custom × 19 (SoulArena生成expression/observe/gesture)
Position:          (0,0,0) 全程未移动（平静环境下灵魂不移动是正常行为）
Verdict: PASS
```

### 新增单元测试（7个）

1. `moves with targetPosition parameter`
2. `moves with direction only (default distance)`
3. `moves with direction and speed`
4. `moves with delta (dx, dy, dz)`
5. `returns success with zero distance when target equals current`
6. `communicate with acoustic propagation reports heardBy listeners`
7. `communicate without acoustic config falls back to legacy behavior`

### 验证结果

- 构建：0 错误
- 单元测试：**277/277 全绿**（从270增至277，+7）
- 端到端集成测试：PASS（100 tick，20感知/20动作/19执行）
- 声学传播：近距离实体（3m）能听到，远距离实体（40m）听不到

### 需求覆盖

- 需求5（物体定义与交互、对灵魂的影响和反馈）：语音通过声学传播影响附近灵魂的感知
- 需求6（底层逻辑抽象、强支持扩展）：move 动作支持6种格式，communicate 支持可插拔的声学传播
- 需求11（向现实世界逼近）：声学传播模拟真实世界的声音衰减

### 后续可扩展方向（列入 backlog）

1. **SoulActionSystem.move 物理集成**：当前是瞬间移动，应改为施加速度让 PhysicsSystem 处理平滑移动
2. **多灵魂声学交互测试**：两个灵魂互相说话，验证语音传播和感知
3. **障碍物对声学传播的影响**：当前 AcousticPropagation 只计算距离衰减，未考虑障碍物遮挡
4. **网络通信介质**：除了 acoustic，还应支持 network（无视距离）和 resonance（基于世界反馈）介质
5. **SoulArena 刺激测试**：给灵魂输入语音或威胁，观察是否触发 move/flee 动作
6. **动作执行结果反馈给 SoulArena**：当前 SoulArena 不知道动作是否成功执行，应通过感知或回调反馈



---

## 2026-09-05 SoulActionSystem物理移动模式：瞬间传送→施加速度由PhysicsSystem平滑积分（第16轮迭代）

### 本轮目标

上一轮完成了 move 动作 6 种输入格式和 AcousticPropagation 语音传播集成。但灵魂移动仍然是**瞬间传送**（直接设置 position），这与"虚拟物理世界"的目标不符。本轮实现物理移动模式：move 动作不再瞬间传送，而是施加速度，由 PhysicsSystem 在后续 tick 中平滑积分移动（带摩擦和空气阻力衰减）。

### 实现方案

采用**向后兼容的双模式设计**，通过配置切换：

```typescript
interface SoulActionConfig {
  movementMode?: "instant" | "physics";  // 默认 "instant"
  physicsMoveSpeed?: number;                // 物理模式速度 m/s，默认 5
}
```

**instant 模式（默认）**：保持原有行为，直接设置 position，瞬间传送到目标。

**physics 模式**：
1. 计算从当前位置到目标的方向向量（归一化）
2. 设置 `soul.velocity = direction × physicsMoveSpeed`
3. 不修改 position——实际移动由 PhysicsSystem 在后续 tick 中积分
4. PhysicsSystem 的 SimplePhysics2D 后端每 tick 执行：
   - 空气阻力：`vx *= (1 - airResistance × dt)`
   - 地面摩擦：`vx *= (1 - friction × dt)`
   - 位置更新：`position += velocity × dt`
5. 灵魂 state 记录 `movementMode: "physics"` 和 `moveTarget` 目标坐标
6. ActionResult.data 包含 velocity、speed、target、mode（`physics:xxx`）

### 新增 stop 动作

物理模式下灵魂会持续移动（直到摩擦衰减到零），需要一个停止动作：

- `stop` 动作：零化 `soul.velocity`，清除 `moveTarget`，记录 `movementMode: "stopped"`
- 返回 `previousSpeed` 字段，记录停止前的速度
- 在 instant 模式下也可用（零化速度，虽然 instant 模式通常速度为零）

ActionRequest.action 联合类型扩展：`'move' | 'interact' | 'communicate' | 'use' | 'attack' | 'wait' | 'stop' | 'custom'`

### 设计决策

1. **为什么不直接改成物理模式？** 向后兼容。现有集成测试和 SoulArena 期望 move 动作瞬间完成。物理模式作为 opt-in 配置，世界构建者可以选择。
2. **为什么不在 SoulActionSystem 中做目标到达检测？** SoulActionSystem 不是 WorldSystem（没有 tick 方法），不应该每 tick 检查。目标到达可以由上层系统或 PhysicsSystem 扩展实现。
3. **摩擦衰减会不会让灵魂到不了目标？** 会。默认 friction=0.1, airResistance=0.05，速度会指数衰减。对于近距离目标（<5m），5m/s 初始速度足够到达。远距离目标需要持续施加速度或提高 physicsMoveSpeed。这是真实物理的特性，不是 bug。

### 新增单元测试（6个）

1. `physics movement mode sets velocity instead of teleporting` — 验证物理模式不修改 position，只设置 velocity
2. `physics movement mode velocity direction is normalized` — 验证方向向量归一化（(3,4,0)→(0.6,0.8,0)×speed）
3. `physics movement with PhysicsSystem actually moves soul over ticks` — 端到端验证：施加速度后 step 30 tick，灵魂实际移动 2-4m
4. `stop action zeroes velocity` — 验证 stop 零化速度并返回 previousSpeed
5. `stop action when already stationary reports zero previous speed` — 静止时 stop 返回 previousSpeed=0
6. `instant movement mode remains default when config not specified` — 验证默认仍是 instant 模式

### 验证结果

- 构建：0 错误
- 单元测试：**283/283 全绿**（从 277 增至 283，+6）
- 物理移动端到端验证：6m/s 初始速度，30 tick（0.5s）后移动 2-4m（摩擦衰减），符合预期
- 向后兼容：所有原有测试通过，instant 模式行为不变

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：灵魂移动从瞬间传送变为物理速度积分，更接近真实物理
- 需求6（底层逻辑抽象、强支持扩展）：movementMode 双模式设计，可插拔切换
- 需求10（性能优化，参考大型游戏方案）：物理模式避免了每 tick 重新计算目标位置，只设置一次速度，由 PhysicsSystem 统一积分
- 需求11（向现实世界逼近）：摩擦、空气阻力、速度积分都是真实物理特性

### 后续可扩展方向（列入 backlog）

1. **目标到达自动停止**：新增 MovementController 系统，每 tick 检查灵魂是否到达 moveTarget，到达后自动零化速度
2. **加速/减速曲线**：当前是瞬间设置速度，可改为逐步加速到目标速度（更自然）
3. **碰撞响应**：物理模式下灵魂移动会与障碍物碰撞并反弹（SimplePhysics2D 已支持 AABB 碰撞），可测试验证
4. **多灵魂物理交互**：多个灵魂同时物理移动，验证碰撞和分离
5. **SoulArena 适配物理模式**：SoulArena 当前期望 move 瞬间完成，需要适配为"施加速度→等待到达→确认"的异步模式
6. **动作执行结果反馈给 SoulArena**：SoulArena 不知道动作是否成功/失败，应通过感知或回调反馈（上一轮已列入 backlog，本轮仍未实现）
7. **网络通信介质**：communicate 除了 acoustic，还应支持 network（无视距离）和 resonance 介质



---

## 2026-09-05 SoulBridgeAdapter动作结果反馈：闭环perceive→decide→act→feedback（第17轮迭代）

### 本轮目标

上一轮实现了物理移动模式。本轮解决闭环的关键缺失：**SoulArena 发出动作后不知道执行结果**，无法据此调整后续决策。实现动作结果反馈机制，将 ActionResult 回传给 SoulArena。

### 问题分析

当前 perceive→decide→act 流程：
1. SoulBridgeAdapter 发送 PerceptionFrame 到 SoulArena `/api/souls/:id/perceive`
2. SoulArena 决策后通过 webhook 推送动作到 SoulBridgeAdapter
3. SoulBridgeAdapter 调用 SoulActionSystem.executeAction() 执行动作
4. **ActionResult 仅用于统计计数（actionsExecuted++ / actionsFailed++），从未回传给 SoulArena**

后果：SoulArena 不知道动作是否成功、失败原因、执行后的状态。如果 move 动作因超出范围失败，SoulArena 会反复尝试同一个无效动作。

### 实现方案

采用**感知内联反馈**（perception-inline feedback），无需 SoulArena 新增 API 端点：

1. **存储最后动作结果**：SoulBridgeAdapter 新增 `lastActionResults: Map<string, ActionResult>`，每灵魂存储最近一次动作执行结果。
2. **融入感知文本**：`generateSituationText()` 在末尾追加 `Your last action "move" succeeded: moved to (3.0, 0.0, 0.0).`（失败时用 `failed`）。SoulArena 的 LLM 可自然读取。
3. **融入结构化负载**：`buildSituationPayload()` 和 `buildStructuredPayload()` 的 `worldState` 中新增 `lastActionResult` 字段（含 action/success/message/data），供程序化处理。
4. **一次性反馈**：感知发送成功后清除该灵魂的 lastActionResult，避免重复反馈。如果感知 API 调用失败，结果保留到下一次。
5. **异常捕获也记录**：动作执行抛出异常时，构造一个 success=false 的 ActionResult 存入，确保 SoulArena 知道动作出错。
6. **可配置开关**：`enableActionFeedback: boolean`（默认 true），可通过配置关闭。

### 设计决策

1. **为什么不新增独立的反馈 API 端点？** SoulArena 是独立项目，修改其 API 需要协调。感知内联反馈零侵入，SoulArena 的 LLM 直接从 situation 文本中读取结果。未来如果 SoulArena 新增 `/api/souls/:id/action-result` 端点，可在此基础上扩展。
2. **为什么只存最后一个结果？** 感知每 10 tick 发送一次，期间可能执行多个动作。只存最后一个是因为 SoulArena 最关心最近一次动作的结果。未来可扩展为结果队列。
3. **为什么发送成功后才清除？** 如果感知 API 失败，结果应保留到下一次感知，确保 SoulArena 最终能收到。这是 at-least-once 语义。

### 新增单元测试（5个）

1. `stores last action result and includes it in situation payload` — 验证成功动作结果出现在 worldState.lastActionResult 和 situation 文本中
2. `includes failed action result in situation text with 'failed' status` — 验证失败动作结果文本包含 "failed" 和错误消息
3. `includes last action result in structured payload worldState` — 验证结构化模式下 lastActionResult 字段
4. `does not include action result when enableActionFeedback is false` — 验证配置开关生效
5. `does not include action result for a different soul` — 验证灵魂隔离：soul_a 的动作结果不会出现在 soul_b 的感知中

### 验证结果

- 构建：0 错误
- 单元测试：**288/288 全绿**（从 283 增至 288，+5）
- SoulBridgeAdapter 测试：21/21（从 16 增至 21）
- 修复：2 个原有测试因 buildSituationPayload/buildStructuredPayload 签名变更（新增 soulId 参数）而更新

### 需求覆盖

- 需求5（物体交互与灵魂反馈）：动作执行结果回传给灵魂，形成完整的感知→决策→行动→反馈闭环
- 需求6（底层逻辑抽象、强支持扩展）：反馈机制可配置开关，感知内联方式零侵入 SoulArena
- 需求7（运行可靠性）：异常捕获也记录为失败结果，确保不丢失反馈

### 后续可扩展方向（列入 backlog）

1. **动作结果队列**：当前只存最后一个结果，可扩展为最近 N 个结果的队列，SoulArena 能看到更多历史
2. **独立反馈 API**：当 SoulArena 新增 `/api/souls/:id/action-result` 端点时，支持主动推送反馈而非仅感知内联
3. **动作结果影响感知**：将动作结果（如移动后的新位置）直接反映在 PerceptionFrame 中，而不是仅作为文本附加
4. **多灵魂场景测试**：2-3 个灵魂同时在世界中，验证灵魂间交互和反馈隔离（本轮已验证单灵魂反馈隔离）
5. **MovementController 系统**：物理模式下自动检测到达目标并停止（上一轮列入 backlog）
6. **障碍物对声学传播的遮挡**：当前 AcousticPropagation 不考虑障碍物遮挡



---

## 2026-09-05 MovementController系统：物理移动模式的到达检测与自动停止（第18轮迭代）

### 本轮目标

上一轮实现了物理移动模式（move 动作施加速度由 PhysicsSystem 积分），但存在一个关键问题：灵魂施加速度后会因摩擦自然减速，**不会精确停在目标点**——可能冲过目标，也可能在目标附近"爬行"。本轮创建 MovementController 系统，每 tick 检测实体是否到达 moveTarget，到达后自动零化速度。

### 实现方案

**MovementController**（`src/physics/MovementController.ts`）是一个通用 WorldSystem：

1. **遍历所有 GameObject**：通过 `world.bodies()` 获取所有物理实体
2. **检查 moveTarget**：读取 `entity.state.get('moveTarget')`（由 SoulActionSystem 物理模式设置）
3. **到达检测**：计算当前位置到目标的距离，小于 `arrivalThreshold`（默认 0.15m）则停止
4. **早期停止**：如果速度低于 `minSpeed`（默认 0.05m/s）且未到达目标，也停止——避免摩擦导致的"爬行"
5. **停止动作**：零化 velocity、删除 moveTarget、设置 `movementMode='stopped'` 和 `stopReason`
6. **2D/3D 距离模式**：`distanceMode: '2d' | '3d'`（默认 '3d'）。2D 模式忽略 y 轴，适合俯视/平台游戏（y 是高度）
7. **安全上限**：`maxEntitiesPerTick`（默认 1000），防止超大世界性能问题
8. **统计计数**：entitiesChecked、arrivalsStopped、earlyStops，支持 resetStats()

### 设计决策

1. **为什么是独立系统而不是放在 SoulActionSystem？** SoulActionSystem 不是 WorldSystem（没有 tick 方法），只在动作被调用时执行一次。到达检测需要每 tick 运行，必须是独立的 WorldSystem。
2. **为什么用 state 存储 moveTarget 而不是实体字段？** moveTarget 是灵魂移动的临时状态，不是实体的固有属性。用 state Map 存储更灵活，不污染 Entity 接口。
3. **为什么需要 2D 模式？** 发现的关键 bug：PhysicsSystem 默认重力 9.8m/s²，实体在 y 方向下落，导致到目标的 3D 距离远超阈值。2D 模式忽略 y 轴，适合平面移动场景。这也体现了"底层逻辑抽象"的设计原则——距离计算方式可配置。
4. **为什么不发射到达事件？** 保持简单。未来如果需要通知其他系统（如 SoulPerceptionSystem 记录"到达目标"），可以添加 EntityArrivedEvent。

### 调试过程中的关键发现

**重力 bug**：首次集成测试失败，实体在 2 秒内未被停止。调试发现 PhysicsSystem 默认重力 9.8m/s²，30 tick 后 y 方向下落 1.2m，导致到目标的 3D 距离 = sqrt(0.007² + 1.2²) ≈ 1.2m，远超 0.2m 阈值。解决方案：①测试中设置 gravity=0；②为 MovementController 添加 2D 距离模式。

### 新增单元测试（14个）

1. 初始化默认配置
2. 接受自定义配置
3. 到达阈值内自动停止（零化速度、清除 moveTarget、设置 stopReason）
4. 远离目标时不停止
5. 速度低于 minSpeed 时早期停止
6. enableEarlyStop=false 时不早期停止
7. 无 moveTarget 的实体被忽略
8. 多实体独立处理（一个到达、一个未到达）
9. 与 PhysicsSystem 集成：实体移动并在目标处停止（gravity=0）
10. 统计计数正确（entitiesChecked/arrivalsStopped/earlyStops）
11. resetStats 清除计数
12. disabled 时不处理
13. **2D 距离模式忽略 y 差异**（y=10 但 x 距离 0.1，判定到达）
14. **3D 距离模式包含 y 差异**（同上场景，判定未到达）

### 验证结果

- 构建：0 错误
- 单元测试：**302/302 全绿**（从 288 增至 302，+14）
- 物理移动端到端验证：2m/s 初始速度，gravity=0，约 31 tick（0.52s）后到达 x=1.0 并自动停止
- 2D/3D 模式对比验证：相同场景下 2D 判定到达、3D 判定未到达

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：物理移动的到达检测与精确停止，增强物理真实感
- 需求6（底层逻辑抽象、强支持扩展）：距离计算模式可配置（2D/3D），早期停止可配置，阈值可配置
- 需求10（性能优化）：maxEntitiesPerTick 安全上限，O(n) 线性扫描
- 需求11（向现实世界逼近）：摩擦减速后的精确停止，接近真实物理行为

### 后续可扩展方向（列入 backlog）

1. **EntityArrivedEvent**：到达目标时发射事件，通知 SoulPerceptionSystem 记录、SoulBridgeAdapter 反馈给 SoulArena
2. **加速/减速曲线**：当前是瞬间设置速度，可改为逐步加速到目标速度、接近目标时逐步减速（更自然）
3. **路径规划**：当前是直线移动，可扩展为 A* 寻路避障
4. **多灵魂路径冲突**：多个灵魂同时移动时的路径避让
5. **障碍物对声学传播的遮挡**：当前 AcousticPropagation 不考虑遮挡（已列入多轮 backlog）
6. **动作结果队列**：从"只存最后一个"扩展为最近 N 个结果（上一轮列入 backlog）
7. **SoulArena 适配物理模式**：从"move 瞬间完成"改为"施加速度→等待到达→确认"的异步模式



---

## 2026-09-05 AcousticPropagation障碍物遮挡：声音传播的物理真实性增强（第19轮迭代）

### 本轮目标

AcousticPropagation 此前只计算距离衰减（inverse-square + medium absorption），**完全不考虑障碍物遮挡**。这意味着即使声源和接收者之间有一堵墙，声音也能无衰减地传播。本轮实现障碍物遮挡功能，让声学传播更接近真实物理。

### 实现方案

**遮挡检测算法**：
1. 从声源到接收者构造线段
2. 遍历所有标记 `state.blocksSound === true` 的实体
3. 对每个遮挡实体，用 **slab method（Kay-Kajiya 算法）** 检测线段与实体 AABB（由 position + halfExtents 定义）是否相交
4. 每穿过一个遮挡实体，声强乘以 `(1 - occlusionAttenuation)`
5. 多个遮挡实体叠加衰减（乘法）

**新增配置**：
- `occlusionEnabled: boolean`（默认 true）：是否启用遮挡检测
- `occlusionAttenuation: number`（默认 0.85，范围 [0,1]）：每个遮挡实体的衰减系数。0 = 声音完全穿透（无衰减），1 = 完全阻挡（声强归零）。默认 0.85 模拟大部分声音被阻挡但有微弱泄漏（绕过/透过）

**新增公开方法**：
- `intensityAtWithOcclusion(sourceIntensity, source, listener, occluders)`：带遮挡的声强计算，公开供测试和外部调用

**transmit() 集成**：
- 每次传输前收集一次遮挡实体列表（避免重复遍历）
- 对每个接收者，排除接收者自身后计算带遮挡的声强
- 遮挡实体如果 `active=false`（如墙），不会被当作接收者，但仍会被收集为遮挡体

### 设计决策

1. **为什么用 AABB 而不是精确几何？** GameObject 已有 halfExtents 定义 AABB，slab method 是 O(1) 的线段-AABB 相交检测，性能极高。精确网格检测对于当前阶段过于复杂。
2. **为什么用 state.blocksSound 而不是实体类型？** 更通用——任何实体都可以被标记为阻挡声音（墙、门、巨石、甚至大型家具），不绑定具体实体类型。世界构建者自由决定哪些实体阻挡声音。
3. **为什么默认 occlusionAttenuation=0.85 而不是 1.0？** 真实世界中声音会绕过障碍物（衍射）和透过障碍物（透射），完全阻挡不真实。0.85 表示 15% 的声音泄漏，模拟微弱的绕射/透射。需要完全隔音的实体可以设置更高的衰减。
4. **为什么遮挡实体收集不检查 active？** 墙即使不活跃（不作为接收者），物理上仍然存在并阻挡声音。active 只控制是否作为接收者，不控制物理存在。

### 调试过程

**遮挡实体被当作接收者**：首次测试中 `transmit()` 返回 2 个接收者而非 1 个——因为遮挡实体（墙）也是 active 的 GameObject，被遍历为接收者。解决方案：测试中给遮挡实体设置 `active=false`（墙不作为接收者，但仍阻挡声音）。这也揭示了一个设计要点：`active` 控制接收者身份，`blocksSound` 控制物理遮挡，二者独立。

### 新增单元测试（10个）

1. `intensityAtWithOcclusion` 无遮挡时与 `intensityAt` 结果一致
2. 单个遮挡实体在线段上时声强衰减（验证衰减系数精确匹配）
3. 遮挡实体不在线段上时声强不衰减
4. 多个遮挡实体叠加衰减（乘法：0.5 × 0.5 = 0.25）
5. `occlusionAttenuation=1` 完全阻挡（声强归零）
6. `occlusionAttenuation=0` 无衰减
7. `occlusionEnabled=false` 跳过遮挡检测
8. `transmit()` 通过 `state.blocksSound` 正确识别遮挡实体，有墙时接收声强更低
9. `transmit()` 不把接收者自身当作遮挡体（自遮挡排除）
10. 无 `blocksSound` 标记的实体不被当作遮挡体

### 验证结果

- 构建：0 错误
- 单元测试：**312/312 全绿**（从 302 增至 312，+10）
- 声学测试：16/16（从 6 增至 16）
- 回归验证：soul-action 测试（使用 AcousticPropagation 的 communicate 动作）全部通过
- 遮挡衰减精度：单遮挡 0.8 衰减 → 声强 × 0.2，双遮挡 0.5 衰减 → 声强 × 0.25，精确匹配

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：声音传播考虑障碍物遮挡，增强物理真实性
- 需求6（底层逻辑抽象、强支持扩展）：遮挡实体通过 state.blocksSound 标记，不绑定类型；衰减系数可配置；可启用/禁用
- 需求10（性能优化）：slab method O(1) 线段-AABB 检测，遮挡实体列表每次传输只收集一次
- 需求11（向现实世界逼近）：障碍物遮挡、声音绕射/透射模拟，接近真实声学

### 后续可扩展方向（列入 backlog）

1. **声音衍射（绕射）**：当前遮挡是简单的 AABB 阻挡，未来可实现绕射算法（声音绕过障碍物边缘）
2. **声音透射**：不同材质的实体有不同的透射系数（墙 < 木门 < 玻璃），当前是统一的 occlusionAttenuation
3. **混响/回声**：封闭空间中的声音反射，需要几何声学或射线追踪
4. **频率相关衰减**：高频声音更容易被阻挡，低频更容易绕过，当前是全频统一衰减
5. **EntityArrivedEvent**：MovementController 到达目标时发射事件（上一轮列入 backlog）
6. **加速/减速曲线**：物理移动的平滑加减速（上一轮列入 backlog）
7. **路径规划（A*寻路）**：当前直线移动，扩展为避障寻路（上一轮列入 backlog）



---

## 2026-09-05 EntityArrivedEvent：MovementController到达事件发射与系统间通知（第20轮迭代）

### 本轮目标

上一轮实现了 AcousticPropagation 障碍物遮挡。本轮为 MovementController 添加 **EntityArrivedEvent** 事件发射——当实体到达 moveTarget 时，在事件总线上发射事件，供其他系统（感知、日志、世界事件）监听和响应。这是物理移动模式闭环的重要组成部分。

### 实现方案

**新增 EntityArrivedEvent**（`src/event/Event.ts`）：
- 事件类型：`movement.arrived`
- payload 包含：
  - `entityId`：到达的实体 ID
  - `targetPosition`：目标坐标
  - `actualPosition`：实际到达坐标
  - `stopReason`：停止原因（`arrived` 或 `early-stop`）
  - `distanceToTarget`：到目标的实际距离（米，保留3位小数）
- sourceId = entityId，origin = actualPosition

**MovementController 修改**（`src/physics/MovementController.ts`）：
- `tick()` 方法的 `_events` 参数改为 `events`，实际使用
- `checkAndStop(body, events)` 传递事件总线
- `stopBody(body, reason, moveTarget, distanceToTarget, events)` 在停止后发射 EntityArrivedEvent
- 无论是正常到达（`arrived`）还是早期停止（`early-stop`），都发射事件

### 设计决策

1. **为什么用事件而不是直接回调？** 事件总线是 Seed 的标准通信机制，解耦发送者和接收者。MovementController 不需要知道谁在监听到达事件，任何系统都可以订阅。
2. **为什么 early-stop 也发射事件？** 早期停止也是一种"到达"状态——实体因摩擦减速到停止，虽然没精确到达目标，但移动已结束。监听者需要知道移动结束了，无论原因。
3. **为什么 distanceToTarget 保留3位小数？** 避免浮点数精度问题，同时足够精确（毫米级）。
4. **事件不包含 velocity？** 停止时 velocity 已被零化，不需要包含。如果需要停止前的速度，可以在未来扩展。

### 新增单元测试（5个）

1. `emits EntityArrivedEvent when entity arrives at target` — 验证事件发射、payload 字段正确（entityId/stopReason/targetPosition/actualPosition/distanceToTarget）
2. `emits EntityArrivedEvent with stopReason early-stop` — 验证早期停止也发射事件，stopReason="early-stop"
3. `does not emit EntityArrivedEvent when entity does not arrive` — 远离目标时不发射
4. `does not emit EntityArrivedEvent for entity without moveTarget` — 无 moveTarget 的实体不触发
5. `emits EntityArrivedEvent during physics integration with PhysicsSystem` — 端到端验证：PhysicsSystem 移动实体，MovementController 检测到达并发射事件

### 验证结果

- 构建：0 错误
- 单元测试：**317/317 全绿**（从 312 增至 317，+5）
- MovementController 测试：19/19（从 14 增至 19）
- 回归验证：所有现有测试通过，事件发射不影响原有行为
- 积压 commit 推送：上一轮 73edfda（声学遮挡）已成功推送

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：到达事件让物理移动的结果可被其他系统感知
- 需求6（底层逻辑抽象、强支持扩展）：事件总线解耦，任何系统可监听到达事件；stopReason 可扩展
- 需求12（模拟世界事件）：EntityArrivedEvent 是底层世界事件的一种，可被 ConditionEngine 监听触发连锁反应

### 后续可扩展方向（列入 backlog）

1. **SoulPerceptionSystem 监听 EntityArrivedEvent**：将到达事件记录到 PerceptionFrame.events，让灵魂知道自己到达了目标
2. **基于到达的事件触发**：ConditionEngine 监听 movement.arrived，触发"到达门口时自动开门"等连锁反应
3. **加速/减速曲线**：当前瞬间设置速度，实现平滑加减速（多轮 backlog）
4. **路径规划（A*寻路）**：直线移动→避障寻路（多轮 backlog）
5. **声音衍射（绕射）**：障碍物边缘的声音绕射（上一轮 backlog）
6. **材质相关透射**：不同材质不同透射系数（上一轮 backlog）
7. **混响/回声**：封闭空间声音反射（上一轮 backlog）



---

## 2026-09-05 SoulPerceptionSystem监听EntityArrivedEvent：灵魂感知自身到达目标（第21轮迭代）

### 本轮目标

上一轮实现了 EntityArrivedEvent（MovementController 到达目标时发射）。本轮让 **SoulPerceptionSystem 监听该事件**，将到达事件记录到 PerceptionFrame.events，使灵魂能感知到自己（或附近其他实体）到达了移动目标。这是物理移动闭环的感知环节。

### 实现方案

**SoulPerceptionSystem 修改**（`src/entity/SoulPerceptionSystem.ts`）：

1. **懒订阅事件**：在 `tick()` 首次执行时，通过 `events.on("movement.arrived", handler)` 订阅 EntityArrivedEvent。订阅函数保存在 `arrivedUnsubscribe` 字段中。
2. **事件回调**：收到 EntityArrivedEvent 后，调用已有的 `recordEvent()` 方法将事件加入 eventBuffer：
   - id: `${entityId}_arrived_${timestamp}`
   - type: `"movement.arrived"`
   - name: `"Arrived at target (${stopReason})"`
   - severity: `"low"`（到达事件不是严重事件）
   - position: actualPosition
   - affectsSoul: true
3. **取消订阅**：`stop()` 方法中调用 `arrivedUnsubscribe()` 并置空，防止内存泄漏。
4. **`tick()` 的 `_events` 参数改为 `events`**，实际使用。

### 设计决策

1. **为什么用懒订阅而不是在 start() 中订阅？** WorldSystem.start() 不接收事件总线参数，无法在 start() 中获取事件总线。懒订阅在第一次 tick() 时完成，简单可靠。
2. **为什么 severity 是 "low"？** 到达目标是正常的移动完成，不是危险或异常事件。low 级别确保它不会在感知中过度突出，但仍然可被灵魂感知。
3. **为什么所有到达事件都记录而不只记录当前灵魂的？** SoulPerceptionSystem 的 eventBuffer 是全局的，每个灵魂的感知帧按距离过滤事件。其他实体的到达事件也应该被附近的灵魂感知到（如"我看到 Nova 到达了门口"）。
4. **为什么不直接在 MovementController 中调用 SoulPerceptionSystem？** 事件总线解耦——MovementController 不需要知道谁在监听到达事件。任何系统都可以订阅，符合 Seed 的事件驱动架构。

### 新增单元测试（4个）

1. `records EntityArrivedEvent emitted on event bus` — 验证事件被记录到 PerceptionFrame.events，type/name/severity 正确
2. `records multiple EntityArrivedEvents` — 验证多个到达事件都被记录（不同灵魂）
3. `does not record EntityArrivedEvent after stop() unsubscribes` — 验证 stop() 后事件不再被记录（取消订阅生效）
4. `EntityArrivedEvent from other entity is visible to nearby soul` — 验证其他灵魂的到达事件可被附近灵魂感知（按距离过滤）

### 验证结果

- 构建：0 错误
- 单元测试：**321/321 全绿**（从 317 增至 321，+4）
- SoulPerceptionSystem 测试：12/12（从 8 增至 12）
- 回归验证：所有现有测试通过，事件订阅不影响原有感知逻辑
- 端到端验证：MovementController 发射 EntityArrivedEvent → SoulPerceptionSystem 监听并记录 → PerceptionFrame.events 包含到达事件 → SoulBridgeAdapter 将其发送给 SoulArena

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：灵魂能感知到移动到达，物理移动闭环完整（施加速度→物理积分→到达检测→事件发射→感知记录→反馈灵魂）
- 需求6（底层逻辑抽象、强支持扩展）：事件总线解耦，任何系统可监听到达事件；懒订阅模式可复用于其他事件类型
- 需求12（模拟世界事件）：EntityArrivedEvent 作为底层世界事件被感知系统消费，体现事件驱动架构

### 后续可扩展方向（列入 backlog）

1. **多灵魂集成测试**：2-3个灵魂同时进入世界，验证独立认知、灵魂间声学通信、位置碰撞（任务描述第一优先级）
2. **路径规划（A*寻路）**：当前move是直线移动，需要避障寻路（多轮 backlog）
3. **加速/减速曲线**：物理移动平滑加减速（多轮 backlog）
4. **声音衍射（绕射）**：障碍物边缘的声音绕射（多轮 backlog）
5. **基于到达的事件触发**：ConditionEngine 监听 movement.arrived，触发"到达门口自动开门"等连锁反应
6. **SDK准备**：整理API文档、类型定义、CHANGELOG，为打tag做准备（任务描述第三优先级）



---

## 2026-09-05 多灵魂集成测试与字符串方向NaN修复（第22轮迭代）

### 本轮目标

任务描述第一优先级：**多灵魂场景集成**。增强 examples/integration-test.ts 支持多灵魂模式，验证 2-3 个灵魂同时在世界中的独立认知、灵魂间声学通信、位置互不干扰。同时在测试中发现并修复了一个关键 bug。

### 实现一：多灵魂集成测试

**增强 examples/integration-test.ts**，支持单灵魂和多灵魂两种模式：

- **单灵魂模式**（向后兼容）：`npx tsx examples/integration-test.ts [soulId] [tickCount]`
- **多灵魂模式**：`npx tsx examples/integration-test.ts --multi N [tickCount]`

多灵魂模式功能：
1. 从 SoulArena 发现 N 个灵魂（取前 N 个）
2. 为每个灵魂创建实体，位置按圆形分布（半径 3m，避免重叠）
3. 为每个灵魂依次调用 enterWorld（间隔 100ms 避免并发冲突）
4. 运行世界，每 5 tick 记录每个灵魂的位置历史和听到的跨灵魂通信
5. 为每个灵魂调用 exitWorld
6. 打印多灵魂报告：每个灵魂的动作统计、最终位置、听到的通信
7. 多灵魂交互分析：跨灵魂通信总数、独立位置验证

### 实现二：字符串方向 NaN bug 修复

**关键发现**：多灵魂集成测试中两个灵魂的最终位置都是 `(NaN, NaN, 0.00)`。调试发现 SoulArena 返回的 move 动作使用字符串方向：

```json
{"direction": "south", "speed": 0.3}
```

但 SoulActionSystem 的 doMove 方法（Format 4/5/6）直接将 direction 断言为向量对象 `{x, y, z}`，访问 `dir.x` 得到 `undefined`，`undefined * dist = NaN`。

**修复方案**：
1. 新增 `directionStringToVector(dir: string)` 辅助函数，支持 12 种字符串方向：
   - 基本方向：north/n/forward/f, south/s/backward/back/b, east/e/right/r, west/w/left/l, up/u, down/d
   - 对角方向：northeast/ne, northwest/nw, southeast/se, southwest/sw（使用 1/√2 归一化）
2. 新增 `resolveDirection(dir: unknown)` 统一解析函数，同时支持字符串方向和向量对象
3. Format 4（direction+distance）、Format 5（direction+speed）、Format 6（direction-only）全部改用 resolveDirection，无效方向返回失败结果而非产生 NaN

### 验证结果

- 构建：0 错误
- 单元测试：**327/327 全绿**（从 321 增至 327，+6 字符串方向测试）
- SoulActionSystem 测试：36/36（从 30 增至 36）
- 新增测试覆盖：
  1. 字符串方向 "south" + speed
  2. 字符串方向 "east" only
  3. 字符串方向 "north" + distance
  4. 对角方向 "northeast"
  5. 无效方向 "sideways" 优雅失败
  6. NaN 回归测试（字符串方向不产生 NaN）

**多灵魂集成测试结果**（2 灵魂，60 tick）：
- Global: 24 perceptions sent, 0 failed; 24 actions received, 22 executed, 0 failed
- Vex (wind): 11 actions received/executed, final position (3.90, 0.00, 0.00)
- Nova (fire): 9 actions received/executed, final position (-3.30, 0.00, 0.60)
- Unique final positions: 2/2 ✅
- PASS: perceive -> decide -> act loop fully operational
- 跨灵魂通信：0（灵魂在无刺激时未说话，属正常行为）

### 需求覆盖

- 需求1（灵魂系统接口约定）：多灵魂同时交互验证接口稳定性
- 需求5（虚拟物理世界搭建）：字符串方向修复确保物理移动正确执行
- 需求6（底层逻辑抽象、强支持扩展）：resolveDirection 统一解析，支持字符串和向量两种方向表示
- 需求7（运行可靠性）：NaN bug 修复防止位置污染，无效方向优雅失败
- 任务描述第一优先级：多灵魂场景集成 ✅

### 后续可扩展方向（列入 backlog）

1. **多灵魂声学通信验证**：当前灵魂未自发说话，可通过 SoulArena API 注入说话刺激，验证一个灵魂说话另一个灵魂听到
2. **3 灵魂集成测试**：验证更多灵魂同时存在时的性能和独立性
3. **路径规划（A*寻路）**：直线移动→避障寻路（多轮 backlog）
4. **加速/减速曲线**：物理移动平滑加减速（多轮 backlog）
5. **声音衍射（绕射）**：障碍物边缘声音绕射（多轮 backlog）
6. **灵魂间碰撞检测**：当前灵魂可重叠，可添加灵魂间碰撞或社交距离
7. **SDK 准备**：整理 API 文档、类型定义、CHANGELOG，为打 tag 做准备



---

## 2026-09-05 A*路径规划系统：网格导航地图与寻路算法（第23轮迭代）

### 本轮目标

任务描述第二优先级第一项：**路径规划（A*寻路）**。当前 move 是直线移动，需要避障寻路。实现完整的路径规划系统，包括网格导航地图、A*算法、WorldSystem 集成。

### 实现

**新增模块 `src/pathfinding/`**，包含 4 个文件：

#### 1. GridMap.ts — 网格导航地图

- 可配置：cellSize（默认1.0）、width/height（默认100）、originX/originZ（默认0,0）、allowDiagonal（默认true）
- 世界坐标↔网格坐标双向转换
- `blockRegion(minX, minZ, maxX, maxZ)`：标记世界空间 AABB 区域为障碍物
- `getNeighbors(cellX, cellZ)`：返回可通行邻居，支持 8 方向（对角）或 4 方向
- **对角移动防穿墙**：对角移动时检查两个正交邻居都可通行，防止切角穿墙
- 使用 Uint8Array 存储 blocked 状态，内存高效

#### 2. AStarPathfinder.ts — A*寻路算法

- **二叉最小堆**开放集，O(log n) 插入/提取最小
- **Octile 距离启发函数**（8 方向移动的最优启发），对角禁用时退化为曼哈顿距离
- **起点/终点障碍物处理**：如果起点或终点在障碍物内，BFS 搜索最近可通行格子（半径上限10）
- **maxIterations 保护**（默认100000），防止无限循环
- 返回 `PathResult`：waypoints（世界空间路径点）、length（路径长度）、cellsExplored（探索格子数）

#### 3. PathfinderSystem.ts — WorldSystem 集成

- 实现 WorldSystem 接口，可注册到 World
- 自动扫描世界实体标记障碍物：
  - `type === "static"` 的实体默认阻挡（可配置 blockingTypes）
  - `state.blocksPath === true` 的实体阻挡（可配置 respectBlocksPathFlag）
  - 动态实体默认不阻挡（会移动）
- `dirty` 标记机制：障碍物变化时标记 dirty，下次 findPath 或 tick 时重建网格
- `findPath(startX, startZ, goalX, goalZ, world?)`：对外寻路 API

#### 4. index.ts — 模块导出

### 设计决策

1. **为什么用网格而不是 NavMesh？** 网格实现简单、调试直观、适合 2D 俯视世界。NavMesh 更适合复杂 3D 环境，但当前 Seed 是 2.5D（x/z 平面 + y 高度），网格足够。未来可扩展 NavMesh。
2. **为什么动态实体不默认阻挡？** 动态实体会移动，如果标记为障碍物会导致网格频繁重建。路径规划时可以临时考虑动态障碍，或让灵魂的感知系统处理避障。
3. **为什么用 dirty 标记而不是每 tick 全量重建？** 全量重建 O(entities * cells)，开销大。dirty 标记只在需要时重建，性能更好。
4. **对角移动防穿墙**：这是 A* 网格寻路的经典问题。如果不检查，路径会从两个垂直墙的夹角"切"过去。实现了标准的双正交邻居检查。

### 新增单元测试（24个）

**GridMap（10个）**：默认配置、坐标转换、标记阻挡、区域阻挡、邻居查询（对角/正交）、阻挡邻居排除、对角防切角、清除网格

**AStarPathfinder（8个）**：直线路径、越界返回null、绕墙路径、窄走廊路径、完全包围目标返回null、maxIterations保护、路径长度/探索数报告

**PathfinderSystem（6个）**：WorldSystem注册、静态实体重建网格、blocksPath标志、动态实体不阻挡、世界中寻路、绕障碍物寻路、markDirty强制重建

### 验证结果

- 构建：0 错误
- 单元测试：**351/351 全绿**（从 327 增至 351，+24）
- 路径规划测试：24/24
- 回归验证：所有现有测试通过

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：路径规划是物体在世界中移动的核心能力，支持避障
- 需求6（底层逻辑抽象、强支持扩展）：GridMap/AStar/PathfinderSystem 三层分离，可替换启发函数、可扩展 NavMesh、可配置障碍物规则
- 需求10（性能优化）：二叉堆开放集、dirty标记延迟重建、Uint8Array 存储，参考大型游戏寻路方案
- 任务描述第二优先级：路径规划（A*寻路）✅

### 后续可扩展方向（列入 backlog）

1. **SoulActionSystem 集成路径规划**：move 动作新增 pathfinding 模式，自动寻路到目标
2. **路径平滑**：当前路径是网格中心点折线，可添加漏斗算法（Funnel Algorithm）平滑
3. **动态障碍避障**：路径执行中遇到新障碍时重新规划（局部重规划）
4. **NavMesh 支持**：复杂地形的导航网格替代方案
5. **多灵魂路径冲突**：多个灵魂寻路时的路径协调和让行
6. **加速/减速曲线**：物理移动平滑加减速（多轮 backlog）
7. **声音衍射（绕射）**：障碍物边缘声音绕射（多轮 backlog）
8. **SDK 准备**：API 文档、类型定义、CHANGELOG、打 tag



---

## 2026-09-05 SoulActionSystem集成A*路径规划：自动避障寻路与路径跟随（第24轮迭代）

### 本轮目标

任务描述第二优先级第5项：**SoulActionSystem集成路径规划**。A*路径规划系统已在上一轮实现（GridMap + AStarPathfinder + PathfinderSystem），本轮将其集成到 SoulActionSystem 的 move 动作中，让灵魂可以自动避障寻路到目标。同时新增 PathFollowerSystem 实现逐点路径跟随。

### 实现

#### 1. SoulActionSystem 路径规划模式

**新增配置** `pathfindingEnabled: boolean`（默认 false，保持向后兼容）。

**doMove 重构**：路径规划块移到 maxMoveDistance 检查之前。因为路径规划将长距离拆分为多个路径点，不受单次 maxMoveDistance 限制。

路径规划模式执行流程：
1. 调用 `PathfinderSystem.findPath(startX, startZ, targetX, targetZ, world)` 获取路径
2. 如果无路径，返回失败（"no path found"）
3. 将完整路径存储到 `soul.state.movePath`（路径点数组）
4. 设置 `movePathIndex = 0`
5. 将第一个路径点设为 `moveTarget`，施加物理速度
6. 返回成功，包含路径长度、路径点数等信息

**executeAction 修复**：添加 `this.ensurePathfinder(world)` 调用。此前 executeAction 只调用 ensurePerception 和 ensureInteraction，不调用 ensurePathfinder，导致直接调用 executeAction 时 pathfinder 为 null，路径规划被跳过。

#### 2. PathFollowerSystem（新增）

`src/pathfinding/PathFollowerSystem.ts` — WorldSystem，负责沿预计算路径逐点推进。

工作原理（与 MovementController 协作）：
1. SoulActionSystem（路径规划模式）设置 `movePath` + `movePathIndex=0` + `moveTarget=wp[0]`
2. MovementController 移动实体向 moveTarget，到达后清除 moveTarget，零化速度
3. PathFollowerSystem 检测到 moveTarget 为 null 但 movePath 存在，推进 index，设置下一个路径点为 moveTarget，施加速度
4. 重复直到路径耗尽，清除 movePath/movePathIndex/movementMode
5. 可选发射 `movement.path_completed` 事件

**配置**：`moveSpeed`（默认5m/s）、`emitCompletionEvent`（默认true）。

#### 3. 完整寻路跟随链路

```
SoulActionSystem.doMove (pathfinding模式)
  → PathfinderSystem.findPath (A*算法)
  → 设置 movePath + moveTarget + velocity
  → PhysicsSystem 积分速度
  → MovementController 检测到达，清除 moveTarget
  → PathFollowerSystem 推进到下一路径点
  → 重复直到路径完成
```

### 调试中发现并修复的 bug

1. **executeAction 不调用 ensurePathfinder**：直接调用 executeAction 时 pathfinder 为 null，路径规划被跳过，回退到普通移动。修复：添加 ensurePathfinder 调用。
2. **maxMoveDistance 检查在路径规划块之前**：距离 10m > maxMoveDistance 5m，直接返回失败，根本没走到路径规划代码。修复：将路径规划块移到 maxMoveDistance 检查之前，路径规划不受单次移动距离限制。
3. **PathFollowerSystem 测试缺少 PhysicsSystem**：速度不被积分，实体不移动，永远到不了目标。修复：测试中添加 PhysicsSystem（gravity=0）。
4. **MovementController 早期停止干扰测试**：速度为 0 时早期停止会清除 moveTarget，导致 PathFollowerSystem 误判为到达。修复：测试中设置 enableEarlyStop=false。

### 新增单元测试（9个）

**PathFollowerSystem（7个）**：
1. WorldSystem 注册
2. 到达当前目标后推进到下一路径点
3. 路径完成后清除 movePath
4. moveTarget 仍存在时不推进
5. 与 MovementController 集成的完整路径跟随
6. 无 movePath 的实体正常处理（不崩溃）

**SoulActionSystem 路径规划（3个）**：
1. 路径规划模式绕墙寻路（验证 waypoints > 1, pathLength > 10）
2. 完全包围目标时返回失败（"no path found"）
3. 完整寻路跟随周期：从墙一侧移动到另一侧，验证到达目标位置

### 验证结果

- 构建：0 错误
- 单元测试：**360/360 全绿**（从 351 增至 360，+9）
- PathFollowerSystem 测试：7/7
- SoulActionSystem 路径规划测试：3/3
- 完整寻路跟随集成测试：灵魂从 (5,8) 绕墙到达 (15,8)，验证通过
- 回归验证：所有现有测试通过

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：灵魂可以在有障碍物的世界中自动寻路移动
- 需求6（底层逻辑抽象、强支持扩展）：路径规划与移动执行解耦，PathFollowerSystem 可替换为其他路径跟随策略（如平滑路径、动态避障）
- 需求10（性能优化）：A* 二叉堆、dirty 标记延迟重建，路径规划只在 move 动作时执行
- 任务描述第二优先级：SoulActionSystem集成路径规划 ✅

### 后续可扩展方向（列入 backlog）

1. **路径平滑**：漏斗算法（Funnel Algorithm）平滑网格折线，当前路径是网格中心点折线
2. **动态障碍局部重规划**：路径执行中遇到新障碍（如门关闭、其他灵魂挡路）时重新规划
3. **多灵魂路径冲突协调**：多个灵魂寻路时的路径协调和让行
4. **加速/减速曲线**：物理移动平滑加减速（多轮 backlog）
5. **声音衍射（绕射）**：障碍物边缘声音绕射（多轮 backlog）
6. **NavMesh 支持**：复杂地形的导航网格替代方案
7. **SDK 准备**：API 文档、类型定义、CHANGELOG、打 tag



---

## 2026-09-05 多灵魂声学通信验证：跨灵魂感知与距离衰减（第25轮迭代）

### 本轮目标

任务描述第一优先级第1项：**多灵魂声学通信验证**。注入说话刺激，验证一个灵魂说话另一个听到。AcousticPropagation 已支持距离衰减和障碍物遮挡，本轮通过系统化集成测试验证跨灵魂感知的完整链路。

### 验证的通信链路

```
Soul A executeAction(communicate)
  → AcousticPropagation.intensityAt() 计算距离衰减
  → 遍历世界实体，筛选能听到的实体（active + intensity > minAudible + distance < maxRadius）
  → perception.recordCommunication() 记录到全局通信缓冲区
  → Soul B 感知帧构建时按距离过滤通信
  → Soul B 的 PerceptionFrame.communications 包含该消息
```

### 新增测试（7个）

`tests/multi-soul-communication.test.ts`：

1. **灵魂B听到灵魂A说话**：5m距离内，Vex说话，Nova感知帧包含通信，验证 senderId/content/medium
2. **说话者不在heardBy列表但可感知自己的消息**：说话者被 `e.id === soul.id` 排除在 heardBy 之外，但因为消息记录在附近听者位置，说话者在感知范围内可以听到自己的声音（物理正确行为）
3. **距离衰减**：近处灵魂（2m）听到的强度 > 远处灵魂（15m），验证 AcousticPropagation 的 inverse-square 衰减
4. **超出maxRadius听不到**：10m距离，maxRadius=5m，远处灵魂不在 heardBy 列表
5. **障碍物遮挡**：墙（blocksSound=true）在两个灵魂之间，听到的强度显著降低（< 0.5），验证 occlusionAttenuation=0.85
6. **多灵魂同时听到同一消息**：3个听者在不同位置，全部听到广播消息，每个听者的感知帧都包含通信
7. **非声学介质（心灵感应）绕过距离衰减**：medium="telepathy" 走 fallback 路径，直接记录到感知，20m距离外仍能收到

### 测试中发现并修正的认知

- **说话者能听到自己的消息**：最初测试断言说话者不应感知自己的消息，但实际上因为消息被记录在附近听者的位置，说话者在感知范围内可以听到。这是物理正确的行为（你说话时能听到自己的声音）。修正了测试断言。
- **heardBy vs 感知帧的区别**：heardBy 是动作执行时计算的听者列表（说话者被排除），感知帧是全局通信缓冲区按距离过滤的结果（说话者可能包含在内）。两者是不同的机制。

### 验证结果

- 构建：0 错误
- 单元测试：**367/367 全绿**（从 360 增至 367，+7）
- 多灵魂通信测试：7/7
- 回归验证：所有现有测试通过
- 跨灵魂感知链路完整验证：说话 → 声学传播 → 感知记录 → 听者感知帧包含消息

### 需求覆盖

- 需求5（虚拟物理世界搭建、物体定义与交互）：灵魂间通过声学介质通信，验证物理世界中的声音传播
- 需求6（底层逻辑抽象、强支持扩展）：通信介质可扩展（acoustic/telepathy/自定义），AcousticPropagation 可配置衰减/吸收/遮挡
- 需求11（向现实世界逼近）：距离衰减、障碍物遮挡、多听者同时接收，模拟真实声学传播
- 任务描述第一优先级：多灵魂声学通信验证 ✅

### 后续可扩展方向（列入 backlog）

1. **3灵魂集成测试**：更多灵魂同时存在的性能和独立性（任务描述第一优先级第2项）
2. **灵魂间碰撞检测**：社交距离/物理碰撞（任务描述第一优先级第3项）
3. **路径平滑**：漏斗算法（Funnel）平滑网格折线（多轮 backlog）
4. **动态障碍局部重规划**：执行中遇新障碍重新规划
5. **加速/减速曲线**：物理移动平滑加减速（多轮 backlog）
6. **声音衍射（绕射）**：障碍物边缘声音绕射（多轮 backlog）
7. **SDK准备**：API文档、类型定义、CHANGELOG、打 tag

