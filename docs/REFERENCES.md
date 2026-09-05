# 参考项目调研（REFERENCES）

> 架构选型参考。每个条目列出可借鉴的架构要点，用于指导 Seed 的后续演进。

---

## 1. Minecraft

- **可借鉴**：体素世界 + 区块（chunk）按需加载；实体与世界严格分离；红石式「事件/条件」驱动玩法；
  服务器无状态 tick + 持久化快照（region 文件）的世界存储思路。
- **对 Seed 的启发**：`SnapshotManager` 的世界快照/恢复、`ConditionEngine` 的规则求值，以及未来按
  区域分片（区块）的分布式规划。

## 2. Valheim

- **可借鉴**：固定 tick 但物理只在加载半径内推进；地点（zone）生成与事件（raid）触发；
  客户端预测 + 服务器权威。
- **对 Seed 的启发**：`zoneTrigger` 区域进入检测、`EventPropagation` 的空间衰减/可见半径；
  未来只对灵魂附近实体做物理与感知计算。

## 3. Second Life / OpenSimulator

- **可借鉴**：实体作为可脚本化对象（LSL），资产/对象与脚本分离；多网格（region）分布式世界，
  跨 region 边界平滑迁移；用户生成内容的权限与归属。
- **对 Seed 的启发**：soul-proxy 作为灵魂在世界内的可脚本化身；`CommunicationStrategy` 的多媒介；
  未来世界分片与灵魂跨区迁移；资产/实体的归属与权限（RBAC）。

## 4. MMORPG（通用客户端-服务器模型）

- **可借鉴**：服务器权威 + 客户端插值；AOI（Area of Interest）只同步玩家附近实体；
  兴趣管理与状态同步协议；聊天/通信分频道。
- **对 Seed 的启发**：`PerceptionFrame` 的可见实体/附近灵魂裁剪；`NetworkPacket` 通信；
  `/ws` 的订阅（subscribe）模型；灵魂只收自己附近的事件。

## 5. ECS（Entity-Component-System）架构

- **可借鉴**：实体只是 id，数据放组件表，系统按组件过滤处理；数据导向布局利于缓存与并行；
  易于扩展新行为而不改实体类。
- **对 Seed 的启发**：当前 `Entity/GameObject` 是类层次，`EntityState/EntityComponent` 接口已预留
  （`types/index.ts`）；未来可向 ECS 迁移以支撑大量实体；`WorldEngine` 的 system tick 已是 ECS 雏形。

## 6. 物理引擎

### 6.1 Bullet
- 成熟 3D 刚体/碰撞库，宽/窄相分明、碰撞回调丰富。可借鉴其 broadphase/narrowphase 分层。

### 6.2 Box2D
- 2D 刚体参考实现，AABB/圆形窄相、冲量求解、静态/动态/运动体分类。Seed 的 `SimplePhysics2D`
  与之同构（重力积分 + AABB 反射）。

### 6.3 Rapier
- Rust 写的现代刚体引擎，性能优秀、API 现代；`IPhysicsBackend` 契约的 `step/applyImpulse` 形态
  与之一致，适合作为 Node 侧 wasm/native 后端替换。

### 6.4 Jolt
- 高性能多线程刚体引擎（《 horizon 》等使用），适合大量动态体；Seed 的 `substeps`、
  `maxVelocity` 配置项即为其预留。

> **对 Seed 的结论**：当前 `SimplePhysics2D` 是 v0.1 参考实现；`IPhysicsBackend` 已抽象，后续可在
> 玩法复杂后接入 Rapier/Jolt（通过 wasm 或 native binding），上层 `PhysicsSystem` 无需改动。

---

## 7. 小结：Seed 各模块对应的参考范式

| Seed 模块 | 主要参考 |
|-----------|----------|
| 世界存储/快照 | Minecraft region、Second Life 对象持久化 |
| 区域/事件 | Valheim raid、MMORPG AOI |
| 通信策略 | Second Life 频道、MMORPG 聊天分频道 |
| 实体模型 | ECS（未来迁移方向） |
| 物理后端 | Box2D（当前）→ Rapier/Jolt（未来） |
| 分布式 | OpenSimulator 多 region、MMORPG 服务器权威 |
