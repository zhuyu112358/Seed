# 路线图（ROADMAP）

> v0.1 → v1.0 规划。优先级：**P0**=阻塞当前可用，**P1**=近期必备，**P2**=增强，**P3**=远期/探索。

---

## 1. 版本主线

### v0.1.x —— 「可用基线」（当前）

目标：编译通过、可跑一个世界、REST/WS 基本可用。

- [ ] **P0** 修复全部 24 个 TS 错误（安全层调用、Role 类型、评估入口）。
- [ ] **P0** 统一物理配置（标量类 vs 向量接口）。
- [ ] **P0** 修复 `systems/index.ts` 断裂 barrel。
- [ ] **P0** 提供世界装配 main（把 `WorldEngine + SoulClient + startServer` 串起来）。
- [ ] **P1** `npm run build` 0 错误 → `npm run eval` 出第一份真实报告。
- [ ] **P1** 合并两套服务端（`api/server.ts` 与 `server/index.ts`）。

### v0.2 —— 灵魂闭环

- [ ] **P1** 实现 PerceptionFrame 逐帧汇聚，经 `/ws` 推送真实感知帧。
- [ ] **P1** `POST /api/souls/:id/action` 真正执行动作（move/attack/use）并回 `ActionResult`。
- [ ] **P1** 世界影响（`WorldEffect`）与灵魂反馈（`SoulFeedback`）闭环。
- [ ] **P1** 统一动作枚举（REST 与 `ActionRequest` 类型对齐）。

### v0.3 —— 玩法系统

- [ ] **P1** 时钟系统（昼夜、`ClockSystem`）与天气系统（`WeatherSystem`）落地。
- [ ] **P1** 事件触发（`WorldEventTrigger`）与 `ConditionEngine` 规则接线到玩法。
- [ ] **P2** NPC 行为树/简单 AI。

### v0.5 —— 世界深度

- [ ] **P2** 经济系统（物品/货币/交易）。
- [ ] **P2** 建造系统（放置/拆除/耐久）。
- [ ] **P2** 农业/生长系统。
- [ ] **P2** 魔法/技能系统（与 `WorldResonance` 媒介挂钩）。
- [ ] **P2** 载具/物理移动平台。

### v0.8 —— 多人与分布式

- [ ] **P2** 多人同步（状态快照增量同步、`NetworkPacket` 真实路由）。
- [ ] **P2** 世界分片与跨节点通信。
- [ ] **P2** 网关层（统一认证、per-soul/IP 限流）。

### v1.0 —— 产品化

- [ ] **P3** VR 客户端接入。
- [ ] **P3** 可视化世界编辑器。
- [ ] **P3** AI 角色（自主灵魂）深度集成。
- [ ] **P3** 热力学/流体等高级物理。

---

## 2. Backlog（带优先级）

| 特性 | 描述 | 优先级 |
|------|------|--------|
| 编译清零 | 修复 24 个 TS 错误 | P0 |
| 安全层对齐 | server.ts 改用 `validateInline/result.valid/consume/checkPermission` | P0 |
| Role 五角色 | `Role` 扩展为 admin/moderator/soul/observer/anonymous | P0 |
| 物理配置统一 | 标量类 ↔ 向量接口二选一 | P0 |
| 世界装配 main | 引导脚本串起 engine+soulClient+server | P0 |
| 感知帧推送 | `/ws` 推真实 `PerceptionFrame` | P1 |
| 动作真正执行 | 动作改物理状态并回结果 | P1 |
| 世界影响闭环 | `WorldEffect`/`SoulFeedback` | P1 |
| 时钟/天气系统 | `ClockSystem`/`WeatherSystem` | P1 |
| 事件触发接线 | `WorldEventTrigger` + ConditionEngine | P1 |
| 通信接口统一 | `communication/` 与 `systems/strategies/` 收敛 | P1 |
| 评估入口修复 | runEval/test-world 对齐 WorldEvaluator | P1 |
| NPC | 非玩家角色行为 | P2 |
| 经济系统 | 货币/交易/商店 | P2 |
| 建造系统 | 放置/拆除/结构 | P2 |
| 农业 | 生长/收获/土壤 | P2 |
| 魔法 | 技能/谐振媒介 | P2 |
| 载具 | 移动平台/物理 | P2 |
| 多人同步 | 状态增量同步 | P2 |
| 世界编辑器 | 可视化编辑 | P3 |
| AI 角色 | 自主灵魂 | P3 |
| VR | 头显接入 | P3 |
| 热力学 | 温度/热传导 | P3 |
| 流体 | 液体模拟 | P3 |

---

## 3. 依赖与里程碑

- **v0.1.x → v0.2**：必须先完成编译清零与世界装配 main，否则灵魂闭环无处挂载。
- **v0.2 → v0.3**：感知帧与动作闭环稳定后，再叠时钟/天气/事件。
- **v0.5 → v0.8**：玩法稳定后再考虑多人；否则同步成本随玩法复杂度暴涨。
- 物理后端升级（Rapier/Jolt）建议在 v0.3 后、玩法复杂度上来时再做，避免过早优化。
