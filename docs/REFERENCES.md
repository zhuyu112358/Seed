# Seed 参考项目调研

> 版本：v0.1.0 | 最后更新：2026-09-05

本文档记录 Seed 系统参考的类似项目及其可借鉴的架构要点。持续更新。

## 1. Minecraft

**类型**：沙盒游戏 | **引擎**：自研（Java/Bedrock）| **参考价值**：★★★★★

### 可借鉴架构

| 方面 | Minecraft 方案 | Seed 对应 |
|------|---------------|-----------|
| 区块系统 | 16x256x16 Chunk，按需加载/卸载 | 区域分片（Zone Sharding）规划 |
| 实体系统 | Entity + TileEntity，组件化 | Entity + GameObject + EntityComponent |
| 物理 | 简单 AABB 碰撞 + 重力 + 流体 | SimplePhysics2D + IPhysicsEngine 接口 |
| 红石 | 信号传播 + 逻辑门 + 事件驱动 | EventSystem + ConditionEngine |
| 世界生成 | Perlin noise + 生物群系 + 结构生成 | 程序化地形生成（v0.3.0 规划） |
| 实体 AI | 目标选择器 + 行为树 + 记忆 | NPC 系统（v0.7.0 规划） |
| 通信 | 聊天 + 命令 + 红石信号 | CommunicationStrategy（声音/网络/共振） |
| 持久化 | 区域文件（.mca）+ NBT 格式 | SnapshotManager + 数据库存储（规划） |

### 关键经验

- **区块是分布式的基础**：Minecraft 的区块加载/卸载机制是大规模世界的核心。Seed 的 Zone Sharding 参考此设计。
- **简单物理足够好玩**：Minecraft 的 AABB 碰撞+重力虽然简单，但配合交互系统产生了丰富玩法。Seed 先实现简单物理，预留高级物理接口。
- **事件驱动的红石**：红石系统本质是事件传播+条件触发，Seed 的 EventSystem+ConditionEngine 参考此模式。

## 2. Valheim

**类型**：生存沙盒 | **引擎**：Unity | **参考价值**：★★★★☆

### 可借鉴架构

| 方面 | Valheim 方案 | Seed 对应 |
|------|-------------|-----------|
| 区域生成 | 程序生成 + 生物群系边界 | 世界生成（v0.3.0） |
| 事件系统 | 随机事件（袭击/血月）基于条件触发 | EventSystem + ConditionEngine |
| 建造系统 | 结构稳定性 + 材料属性 | 建造系统（v0.7.0） |
| 物理 | Unity PhysX + 自定义交互 | IPhysicsEngine 可插拔 |
| 天气 | 动态天气 + 环境影响 | WeatherSystem（v0.3.0） |
| 多人 | P2P + 主机迁移 | 分布式（v0.6.0） |

### 关键经验

- **条件触发的事件**：Valheim 的袭击事件基于玩家进度/位置/时间等条件触发，Seed 的 ConditionEngine 参考此设计。
- **建造的结构稳定性**：建筑物需要支撑，否则倒塌。这增加了建造的深度和趣味性。

## 3. Second Life / OpenSimulator

**类型**：虚拟世界平台 | **引擎**：自研 | **参考价值**：★★★★★

### 可借鉴架构

| 方面 | Second Life 方案 | Seed 对应 |
|------|-----------------|-----------|
| 脚本化对象 | LSL（Linden Scripting Language） | 脚本系统（v0.9.0 规划） |
| 通信 | 本地聊天 + 区域消息 + IM | CommunicationStrategy |
| 经济 | LindeX 货币 + 土地交易 | 经济系统（v0.7.0） |
| 区域 | 256x256 Region，独立服务器 | Zone Sharding（v0.6.0） |
| 资产 | 资产服务器 + UUID 引用 | 资源管理（规划） |
| 权限 | 对象权限 + 土地权限 | PermissionSystem |
| 物理 | Havok / Bullet 物理引擎 | IPhysicsEngine 可插拔 |

### 关键经验

- **脚本化对象是 UGC 的核心**：Second Life 的成功很大程度上归功于 LSL 让用户可以创建交互对象。Seed 的脚本系统规划参考此设计。
- **区域即服务器**：每个 Region 运行在独立服务器上，区域间通过消息传递通信。Seed 的分布式架构参考此模式。
- **经济系统驱动内容**：虚拟货币和土地交易激励了用户创造内容。

## 4. MMORPG（魔兽世界 / 最终幻想14）

**类型**：大型多人在线角色扮演 | **引擎**：自研 | **参考价值**：★★★★☆

### 可借鉴架构

| 方面 | MMORPG 方案 | Seed 对应 |
|------|------------|-----------|
| 分布式地图 | 地图分线 + 区域服务器 | Zone Sharding |
| 状态同步 | 增量同步 + 优先级 + 带宽控制 | StateSyncProtocol（规划） |
| 副本 | 独立实例 + 隔离环境 | 世界实例（规划） |
| 任务系统 | 任务链 + 阶段 + 条件 | 任务系统（v0.7.0） |
| 社交 | 公会 + 团队 + 聊天频道 | 通信系统 |
| 经济 | 拍卖行 + 商人 + 制造 | 经济系统 |
| 战斗 | 技能 + 冷却 + 仇恨 | 魔法/技能系统 |

### 关键经验

- **增量状态同步**：只同步变化的实体，按距离/优先级排序，控制带宽。Seed 的 DirtyFlag + 优先级同步参考此设计。
- **地图分线**：高负载区域分多个实例，平衡服务器负载。
- **副本隔离**：副本运行在独立实例中，不影响主世界。

## 5. ECS 架构（Bevy / Unity DOTS）

**类型**：实体组件系统架构 | **语言**：Rust / C# | **参考价值**：★★★★☆

### 可借鉴架构

| 方面 | ECS 方案 | Seed 对应 |
|------|---------|-----------|
| 数据布局 | 组件数组（SoA），缓存友好 | EntityComponent + 数据布局优化（规划） |
| 系统 | 纯函数处理组件子集 | 子系统（Physics/Event/Communication） |
| 查询 | 按组件类型查询实体 | 实体查询（规划） |
| 多线程 | 系统并行执行，无共享状态 | Worker Threads（v0.5.0） |
| 性能 | 极高吞吐量，适合大量实体 | 性能优化目标 |

### 关键经验

- **数据导向设计**：将实体数据存储为连续数组，最大化 CPU 缓存命中率。Seed 的性能优化方向参考此设计。
- **系统无状态**：每个系统只处理特定组件组合，不共享可变状态，便于并行化。
- **Bevy 的调度器**：自动分析系统依赖关系，并行执行无依赖的系统。

## 6. 物理引擎

### 6.1 cannon-es

**类型**：3D 物理引擎 | **语言**：JavaScript | **参考价值**：★★★★☆

- 轻量级 3D 刚体物理
- 支持刚体、碰撞、约束、力场
- Three.js 生态常用
- Seed 可通过 IPhysicsEngine 接口接入

### 6.2 rapier

**类型**：2D/3D 物理引擎 | **语言**：Rust（WASM）| **参考价值**：★★★★★

- 高性能物理，Rust 编写，WASM 运行
- 支持 2D 和 3D
- 跨平台，性能接近原生
- 适合大规模实体模拟
- Seed 的首选物理引擎候选

### 6.3 ammo.js

**类型**：3D 物理引擎 | **语言**：C++（WASM，Bullet 移植）| **参考价值**：★★★☆☆

- Bullet 物理引擎的 WASM 移植
- 功能完整，但体积较大
- 性能中等

## 7. 分布式游戏服务器

### 7.1 SpatialOS (Improbable)

**类型**：分布式游戏模拟平台 | **参考价值**：★★★★★

- 核心概念：Worker 架构，不同系统运行在不同 Worker 上
- 区域分配：空间自动分区，负载均衡
- 状态同步：兴趣管理（Interest Management），只同步相关实体
- 跨 Worker 通信：实体属性同步 + 事件
- Seed 的分布式架构深度参考此设计

### 7.2 DOTS + Netcode for Entities (Unity)

**类型**：多线程 + 网络框架 | **参考价值**：★★★★☆

- ECS + 多线程 + 网络同步一体化
- 幽灵对象（Ghost）：服务器权威 + 客户端预测
- 兴趣管理：按距离/优先级同步
- 快照插值：网络延迟补偿

## 8. 其他参考

### 8.1 Dual Universe

- 连续单一世界（no instances）
- 体素建造 + Lua 脚本
- 经济系统 + 政治系统
- 参考：连续世界的分布式处理

### 8.2 Star Citizen

- 服务器网格（Server Meshing）
- 持久化宇宙（Persistent Universe）
- 物理网格（Physics Grid）
- 参考：大规模分布式世界的最新技术

### 8.3 EVE Online

- 单服务器宇宙（所有玩家在同一世界）
- 时间膨胀（Time Dilation）：高负载区域减速
- 玩家驱动经济 + 政治
- 参考：单服务器大规模世界的极限优化

## 9. 技术选型总结

| 领域 | 当前方案 | 未来升级 | 参考来源 |
|------|---------|---------|---------|
| 物理 | SimplePhysics2D（自实现） | rapier / cannon-es | Minecraft, Unity PhysX |
| 空间分区 | 接口预留（ISpatialIndex） | Quadtree / Octree | Minecraft Chunk |
| 对象池 | 接口预留（IObjectPool） | 通用对象池 | ECS 架构 |
| 通信 | 策略模式（3 种媒介） | 更多媒介 + 路由 | Second Life |
| 事件 | EventSystem + ConditionEngine | 复杂条件 + 传播 | Valheim, 红石 |
| 分布式 | 接口预留 | Zone Sharding + StateSync | SpatialOS, MMORPG |
| 脚本 | 规划中 | Lua / JS 沙箱 | Second Life LSL |
| 渲染 | 无（纯模拟） | Three.js / Babylon.js | Minecraft, Unity |
| 持久化 | JSON 快照 | 数据库 + 增量存储 | Minecraft .mca |
