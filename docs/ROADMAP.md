# 路线图（ROADMAP）

> 基于 `src/` 现状与 `DEVLOG.md` 已知问题制定。文档中文。
> 路线图按里程碑组织；优先级与已知问题编号（K1–K11）对应 `DEVLOG.md`。

---

## 1. 总体方向

Seed 的目标是成为 SoulArena 之下一个**可配置、可扩展、可靠**的虚拟物理世界层：灵魂可进入世界、感知环境、执行动作、承受世界反馈，世界本身支持可插拔物理、通信、事件与安全策略。

---

## 2. M0 — 构建转绿与接口收敛（最高优先）

> 对应 K1 / K2 / K8，目标：`npm run build` 零错误、`npm start` 可跑。

- [ ] 让 `server.ts` 能拿到当前世界：为 `WorldEngine` 暴露对 `World` 的访问，或改造处理器直接查询 `EntitySystem`。
- [ ] 修复 `evaluator/index.ts`：删除不存在的 `EvaluatorConfig` / `EvalActivityCounters` 导出。
- [ ] 重写/修复 `runEval.ts`：改用真实 `WorldBuilder` / 核心 `World` API。
- [ ] 修复或删除 `examples/test-world/index.ts`：补齐 `WorldEngine` 所需 `bounds`/`physics`，或改用 `EntitySystem`。
- [ ] 移除或补全 `runEvaluation.ts`（`npm run evaluate` 指向的缺失文件）。
- [ ] 使 `tests/` 在 CI 中可运行并全绿。

**完成标准**：`npm run build`、`npm test`、`npm run eval`、`npm run dev` 全部可执行。

---

## 3. M1 — 架构收敛（去重）

> 对应 K3 / K4 / K5 / K6 / K7。

- [ ] 合并 `entity/` 与 `engine/` 的 `Entity` / `Vector3`：选定一套（建议保留 `entity/` 不可变向量 + `GameObject`，把运行时迁移过去）。
- [ ] 合并 `event/` 与 `systems/` 的 `EventSystem` / `ConditionEngine`：明确“通用总线”与“玩法事件定义”两层职责，消除同名类。
- [ ] 统一 `PhysicsConfig`：选定“类”还是“types 接口”，统一字段名（标量 vs 向量 gravity、friction vs frictionCoefficient）。
- [ ] 统一通信策略接口：让 `CommunicationStrategy`（core）与 `ICommunicationStrategy`（types）对齐，或明确二者分层。
- [ ] 决定 `sdk/EntityFactory.ts` / `sdk/PhysicsConfig.ts` / `sdk/WorldEventListener.ts` 的去留：接入 `sdk/index.ts` 桶导出，或删除。
- [ ] 让 `WorldBuilder` 的 `build()` / `buildAndStart()` 与真实引擎闭环。

---

## 4. M2 — 灵魂闭环（SoulBridge）

> 对应 `SOUL_INTERFACE.md` 已知问题。

- [ ] 实现 `SoulWorldAdapter`：`buildPerceptionFrame` / `executeAction` / `createSoulEntity` / `removeSoulEntity`。
- [ ] 对齐动作枚举（K11）：统一 `server.ts` 与 `types/ActionRequest`。
- [ ] 把 `POST /api/souls/:id/action` 的 `move/interact/attack/use` 真正接到物理与化身。
- [ ] 把 `/ws` 事件接到世界事件总线（碰撞、进入区域、感知帧推送）。
- [ ] 为 `SoulBridge.validator` 写一个到 `security/InputValidator` 的适配层（桥期望 `validateInline`，见 K10）。

---

## 5. M3 — 可靠性与运维

- [ ] 快照/事务闭环：`WorldTransaction` 支持更多可撤销操作（不止位置）；与 `ExceptionHandler` 紧急快照联动验证。
- [ ] Dockerfile + 生产部署样例（systemd / pm2）。
- [ ] CI：`build + test + eval` 流水线。
- [ ] 指标：把 `WorldEvaluator` 的报告接入运行时 metrics（`/api/world/status` 已有雏形）。
- [ ] 日志轮转（当前 `Logger` 只追加 `logs/seed.log`）。

---

## 6. M4 — 能力增强

- [ ] **物理后端替换**：`IPhysicsBackend` 之后接 `cannon-es` / `rapier`；当前 `SimplePhysics2D` 是 O(n²) 参考实现。
- [ ] **真实通信介质**：`NetworkPacket`（WebRTC/WebSocket 网状路由、延迟/带宽）与 `WorldResonance`（与灵魂元素/价值系统亲和）从 stub 升级。
- [ ] **天气 / 时钟子系统**：`WeatherEvent` 已预留，`WorldBuilder.enableWeather/enableClock` 已有开关但无实现。
- [ ] **玩法事件**：`systems/EventSystem` 的 `EventDefinition` + 条件自动触发。
- [ ] **安全增强**：按灵魂 id 限流、RBAC 角色完善、`InputValidator` 内置常用 schema。
- [ ] **空间查询**：`Quadtree` 目前仅 XZ 平面；评估是否需要 3D / 多层级。

---

## 7. 远期愿景

- 多世界 / 多房间：一个 Seed 进程承载多个 `World`，灵魂跨世界迁移。
- 确定性回放：快照 + 事务 + 固定步长，支持录屏/回放与回归测试。
- 可视化调试：暴露调试端点与 `/ws` 调试客户端，便于观察实体、碰撞、感知帧。
- 与 SoulArena 的长连接替代轮询（`SoulBridge.update` 当前按 `pollIntervalSec` 轮询）。
