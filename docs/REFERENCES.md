# 参考项目调研（REFERENCES）

> Seed 的架构参考了以下开源/知名虚拟世界与游戏引擎项目。本文记录它们与 Seed 设计决策的对应关系。文档中文。

---

## 1. 为什么调研这些项目

Seed 是“底层世界容器 + 灵魂接入层”，需要在以下维度做取舍：实体模型、物理、事件/玩法、持久化/可靠性、多客户端通信、安全与多租户。下面每个项目对应 Seed 的一个或多个子系统。

---

## 2. Minecraft（Mojang）

- **借鉴点**：
  - 固定步长 tick 主循环（20 TPS），客户端/服务器分离。Seed 的 `World.step(dt)` / `WorldEngine.start(setInterval)` 即此意。
  - 实体按类型（`EntityType`）分类，区块化空间管理。Seed 的 `Quadtree`（XZ 平面）是其区块思想的简化版。
- **取舍**：Minecraft 是方块/体素世界；Seed 走 AABB/球 连续刚体路线，不做体素。物理只做参考实现（`SimplePhysics2D`），将来可换 `rapier/cannon-es`。

## 3. Valheim（Iron Gate）

- **借鉴点**：
  - 小型、可自托管的专用服务器；世界状态文件 + 自动保存/回滚。对应 Seed 的 `SnapshotManager`（自动保留最新 N 份）与 `WorldTransaction`（撤销日志）。
  - 玩家 = 世界中的一个化身，世界事件对玩家施加影响。对应 Seed 的 soul-proxy / `WorldEffect`。
- **取舍**：Valheim 是确定性较差的单机+协作；Seed 面向多灵魂在线，需要更严格的权限与限流（`security/`）。

## 4. Second Life（Linden Lab）

- **借鉴点**：
  - 世界对象与“居民（resident）”分离的对象模型；对象有属性表（properties/state bag）。对应 Seed 的 `Entity.properties` / `Entity.state` 两个 `Map`。
  - 区域（region）边界与跨区。对应 Seed 的 `zoneTrigger` / `area` 实体与 `EventPropagation` 半径衰减。
- **取舍**：Second Life 有完整脚本系统（LSL）；Seed v0.1 只做 `ConditionEngine` 谓词，不做通用脚本沙箱（安全风险高，列入远期）。

## 5. OpenSimulator（开源 Second Life 兼容）

- **借鉴点**：
  - 区域服务器网格（grid）架构、Avatar 作为外部实体进入区域、感知（viewer）与仿真分离。对应 Seed 的 `SoulBridge`（外部灵魂系统 ↔ 世界化身）。
  - 开放的 REST/WebSocket 接口。对应 Seed 的 `api/server.ts` + `/ws`。
- **取舍**：OpenSimulator 庞大且耦合；Seed 保持小内核 + 可插拔子系统。

## 6. ECS / 游戏引擎通用实践

- **借鉴点**：
  - World（实体集合）+ System（按 tick 推进）的组合，而非每对象 update。对应 Seed 的 `WorldSystem` 接口与 `World.step`。
  - 对象池避免热分配：`ObjectPool<CollisionResult>`。
  - 空间分区做广义相位碰撞：`Quadtree`。
- **取舍**：Seed 没有引入完整 ECS（实体=普通类 + Map 状态），以降低 v0.1 复杂度。

## 7. 物理引擎参考

- **cannon-es / Rapier / Jolt**：`IPhysicsBackend` 接口就是为它们预留的——`step(dt, bodies, config)` + `applyImpulse`，参考了这类引擎的“积分 + 广义/窄相位碰撞”职责划分。
- **当前 `SimplePhysics2D`**：O(n²) AABB 碰撞 + 速度反射，仅作 v0.1 参考实现，不代表最终性能曲线。

## 8. 通信模型参考

- **声学衰减**：`AcousticPropagation` 的 `1/(1+att·d²)` × 吸收模型，参考了真实声能衰减（平方反比 + 介质吸收）。
- **“网络/共鸣”介质**：`NetworkPacket` / `WorldResonance` 是占位，分别参考分布式网状通信与“远距离共情/心灵感应”的抽象，留待 M4 实现。

## 9. 可靠性参考

- **结构化日志**：`Logger` 的 pino 风格 `(message, meta?)` / `(bindings, message?)` 双重载，参考 pino。
- **快照/事务**：`SnapshotManager` + `WorldTransaction` + `ExceptionHandler` 的“崩溃即快照、可回滚”策略，参考了游戏服务器与数据库 undo log 的常见做法。

---

## 10. 对 Seed 的启示（已落地 vs 待办）

| 维度 | 参考 | Seed 现状 | 待办 |
|------|------|-----------|------|
| 主循环 | Minecraft | `World.step` / `WorldEngine.start` | 固定步长 + 插值 |
| 空间索引 | Minecraft/ECS | `Quadtree`（XZ） | 3D / 多层级 |
| 物理 | cannon-es/Rapier | `SimplePhysics2D`（参考实现） | 换后端 |
| 持久化 | Valheim | `SnapshotManager` + `WorldTransaction` | 更多撤销操作、回放 |
| 灵魂接入 | OpenSim/Second Life | `SoulBridge` + `SoulClient` | 实现 `SoulWorldAdapter` |
| 通信 | 声学/网状 | `AcousticPropagation` + 2 stub | 升级 network/resonance |
| 安全 | 多租户服务器 | `security/` 基础件 | 角色/限流完善 |

> 注：以上为架构调研笔记，不构成对第三方项目代码的引用；Seed 未直接复制任何参考项目源码。
