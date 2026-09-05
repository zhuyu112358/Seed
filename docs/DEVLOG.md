# 开发日志（DEVLOG）

> 版本：**v0.1.0**（`package.json` `name: seed-system, version: 0.1.0`）
> 记录方式：基于对 `src/` 源码的实际阅读与 `npm run build` 的真实输出。
> 快照时间：2026-09-05（Asia/Shanghai）。

---

## 1. 项目初始化

- 项目定位：Seed System —— 运行在 SoulArena 之下的虚拟物理世界引擎，提供可配置世界容器、
  物理、事件、通信与灵魂交互层。
- 技术栈：TypeScript（`strict`）+ ESM（NodeNext），运行时 Express 4 + `ws`，校验用 Ajv。
- 入口脚本：`dev`(tsx) / `start`(node dist) / `test` / `eval` / `test-world`（见 DEPLOYMENT）。

---

## 2. 核心模块清单（按目录分组）

> 源码在本次记录期间处于持续重构中，文件数从初读时的 39 个演化为约 43 个。以下为当前确认存在的分组。

- **api/（2）**：`server.ts`（REST+WS 主入口）、`soulClient.ts`（访问 SoulArena）。
- **communication/（5）**：`CommunicationStrategy.ts`、`Message.ts`、`AcousticPropagation.ts`、
  `NetworkPacket.ts`、`WorldResonance.ts`。
- **systems/（4 + strategies/3）**：`index.ts`（barrel，当前断裂）、`strategies/AcousticPropagation.ts`、
  `strategies/NetworkPacket.ts`、`strategies/WorldResonance.ts`（新一代 `ICommunicationStrategy` 实现）；
  另有 `EventSystem.ts / ConditionEngine.ts / event-types.ts / logger.ts`（部分为新补齐）。
- **engine/（约 6）**：`World.ts`（容器）、`WorldEngine.ts`（主循环）、`Entity.ts`、`ObjectPool.ts`、
  `Vector3.ts` 等。
- **entity/（3）**：`Entity.ts`（Entity/GameObject 层次）、`EntityFactory.ts`、`Vector3.ts`。
- **event/（4）**：`Event.ts`、`EventSystem.ts`、`EventPropagation.ts`、`ConditionEngine.ts`。
- **physics/（4）**：`PhysicsSystem.ts`、`IPhysicsBackend.ts`、`SimplePhysics2D.ts`、`PhysicsConfig.ts`。
- **security/（5）**：`ApiKeyAuth.ts`、`InputValidator.ts`、`RateLimiter.ts`、`PermissionSystem.ts`、
  `sanitize.ts`。
- **reliability/（4）**：`Logger.ts`、`SnapshotManager.ts`、`Transaction.ts`、`ExceptionHandler.ts`。
- **evaluator/（3）**：`runEval.ts`、`WorldEvaluator.ts`、`index.ts`。
- **sdk/（3）**：`index.ts`（barrel）、`WorldBuilder.ts`、`PhysicsConfig.ts`（预设）。
- **types/（1）**：`index.ts`（跨模块共享类型契约）。

---

## 3. 编译验证结果（重要）

**`npm run build` 当前失败，退出码 2，共 24 个 TypeScript 错误。**

完整错误清单（按文件）：

### 3.1 `examples/test-world/index.ts`（10 个）

```text
(143,19)  Type 'Entity | undefined' is not assignable to type 'GameObject | undefined'
(192,66)  Tuple type '[]' of length 0 has no element at index 0
(192,69)  Property 'worldEngine' does not exist on type 'undefined'
(193,37)  Expected 0 arguments, but got 1
(194,15)  '"eventTriggers"' is not assignable to parameter of type 'keyof EvalCounters'
(195,15)  '"communications"' is not assignable to parameter of type 'keyof EvalCounters'
(196,21)  Property 'setActiveSouls' does not exist on type 'WorldEvaluator'
(196,57)  Property 'setActiveSouls' does not exist on type 'WorldEvaluator'
(197,10)  Property 'printReport' does not exist on type 'WorldEvaluator'
(200,16)  Property 'saveReport' does not exist on type 'WorldEvaluator'
```

### 3.2 `src/api/server.ts`（9 个）

```text
(17,33)   Argument of type 'number' is not assignable to parameter of type 'RateLimitConfig'
(25,200)  schema object is not assignable to parameter of type 'string'   // validate(name, data) 误用
(25,395)  Property 'ok' does not exist on type 'ValidationResult'
(26,331)  Property 'retryAfterMs' does not exist on type '{ allowed; remaining }'
(26,388)  schema object is not assignable to parameter of type 'string'
(26,559)  Property 'ok' does not exist on type 'ValidationResult'
(26,832)  Property 'ensure' does not exist on type 'PermissionSystem'
(26,900)  Property 'value' does not exist on type 'ValidationResult'
(26,1007) Property 'value' does not exist on type 'ValidationResult'
```

### 3.3 `src/evaluator/index.ts`（2 个）

```text
(6,15)  Module './WorldEvaluator.js' has no exported member 'EvaluatorConfig'
(6,32)  Module './WorldEvaluator.js' has no exported member 'EvalActivityCounters'
```

### 3.4 `src/security/PermissionSystem.ts`（3 个）

```text
(21,21) Argument of type '"moderator"' is not assignable to parameter of type 'Role'
(31,21) Argument of type '"anonymous"' is not assignable to parameter of type 'Role'
(44,35) Argument of type 'Role | "anonymous"' is not assignable to parameter of type 'Role'
```

---

## 4. 评估结果

- `npm run eval`（`tsx src/evaluator/runEval.ts`）与 `npm run test-world` 依赖上述仍在漂移的 API。
- 由于 `tsc` 编译未通过、且 `runEval.ts` 调用的 `WorldEvaluator` API（`bump('collisions'/'events'/
  'messages')`、`recordTick`、`flush`）与当前 `WorldEvaluator.ts` 的 `EvalCounters` 键集不一致，
- **当前无法产出可信的评估报告**；`WorldEvaluator.flush()` 已能写 `logs/eval-*.json` 的形态已就绪，
  待入口与计数器键对齐后即可运行。

---

## 5. 已知问题（代码审查发现）

### 5.1 server.ts ↔ 安全层签名不一致（最高优先级）

1. **`RateLimiter` 构造**：真实实现要求 `RateLimitConfig` 对象（`enabled/maxRequests/windowMs/
   perSoul/perIP/burstMultiplier`），server.ts 仍按旧的数字 QPS 调用 → TS 错误。
2. **`InputValidator` 调用**：真实 API 为 `validate(name, data)` 与 `validateInline(schema, data)`，
   返回 `ValidationResult { valid, errors }`；server.ts 仍有「把 schema 当 name 传字符串」「读
   `result.ok` / `result.value`」的旧写法。
3. **`RateLimiter.check()` 无 `retryAfterMs`**：`check(key)` 只返回 `{allowed, remaining}`；需要
   `retryAfterMs` 应用 `consume(key)`。server.ts 的 429 分支读错了方法。
4. **`PermissionSystem.ensure()` 不存在**：新实现只有 `hasPermission(entityId, resource, action)` /
   `checkPermission(...)`，没有 `ensure(role,...)`，动作端点 RBAC 未真正生效。

### 5.2 PermissionSystem 的角色与类型不一致

5. `types/index.ts` 的 `Role = 'admin' | 'soul' | 'observer'`，但 `PermissionSystem` 新增了
   `moderator`、`anonymous` 两个默认角色 → 3 个 TS 错误。需要把 `Role` 扩展为
   `admin | moderator | soul | observer | anonymous`。

### 5.3 物理配置两套不兼容

6. `physics/PhysicsConfig.ts` 是**类、标量 gravity（number）**；`types/index.ts` 的 `PhysicsConfig`
   是**接口、向量 gravity（IVector3）**。`sdk/PhysicsConfig.ts` 的预设用后者，`PhysicsSystem` /
   `SimplePhysics2D` 用前者。

### 5.4 通信策略两代接口并存

7. `communication/CommunicationStrategy.ts`（`medium + transmit(Message, GameObject, WorldView)`）
   与 `types/index.ts` 的 `ICommunicationStrategy`（`medium + name + initialize/send/canReach/
   getPropagationDelay/update/destroy`）互不兼容；`systems/strategies/*` 实现的是后者。

### 5.5 barrel / 入口断裂

8. `src/systems/index.ts` 引用 `./EventSystem.js`、`./CommunicationSystem.js`、`./ClockSystem.js`、
   `./WeatherSystem.js`、`./event-types.js` 等当前不存在的模块。
9. `evaluator/index.ts` 导出 `EvaluatorConfig` / `EvalActivityCounters`，但当前 `WorldEvaluator.ts`
   只导出 `EvalCounters` 与 `WorldEvaluator`（且 `WorldEvaluator` 构造不接受 config）。
10. `runEval.ts` 经 barrel 导入 `PhysicsConfig` / `AcousticPropagation`，与 barrel 当前导出状态耦合，
    易因上游漂移失败。

### 5.6 演示/示例与实现漂移

11. `examples/test-world/index.ts` 使用了与当前 `WorldEvaluator` / `WorldEngine` 不符的 API
    （`worldEngine`、`setActiveSouls`、`printReport`、`saveReport`、`bump('eventTriggers'/'communications')`）。

### 5.7 架构层遗留

12. 早期 `WorldEngine` 设计依赖 `engine/` 下的 `EntitySystem/SpatialIndex/ObjectPool`，当前已收敛为
    直接持有 `World + PhysicsSystem`；旧文件/引用需清理。
13. 两套服务端并存：`api/server.ts`（主入口）与 `server/index.ts`（更完整但未接线），接口不统一。

---

## 6. 下一步计划

1. **统一安全层调用**：把 `server.ts` 改为 `validateInline(schema, data)` + `result.valid`；
   `RateLimiter` 用配置对象构造、429 用 `consume()`；权限检查改用 `checkPermission(...)`。
2. **扩展 `Role` 联合类型**为五角色，消除 PermissionSystem 的 3 个错误。
3. **统一物理配置**：决定保留标量类还是向量接口，迁移另一处。
4. **统一通信策略接口**：让 `communication/` 与 `systems/strategies/` 收敛到一套。
5. **修复 barrel**：补齐 `systems/index.ts` 缺失文件，或删掉断裂的再导出。
6. **对齐评估入口**：`runEval.ts` / `test-world` 改用真实 `WorldEvaluator` API（`EvalCounters`
   键、`buildReport/flush`）。
7. 跑通 `npm run build`（0 错误）→ `npm run eval` 出第一份真实报告 → 补齐 `server.ts` 的世界装配 main。
