# REFERENCES.md — 架构调研

> 以下基于公开常识整理，作为 Seed 设计参考。

## 1. Minecraft（Mojang）

- 分块（chunk）世界：16x16 区块流式加载/卸载，只加载玩家周围区块。
- 实体按区块归属；红石更新按区块传播。
- **对 Seed 的启发**：未来用空间分区（octree/region）替代 O(n^2) 碰撞；世界可序列化（区块=可分享卡带）。

## 2. Valheim（Iron Gate）

- 单机 + 专用服务器混合：一个世界文件，地形由程序化种子生成。
- 实体分 active / distant / inactive 三档（LOD）：active 跑完整逻辑，distant 只更新位置。
- **对 Seed 的启发**：perception 按距离 LOD 过滤；世界可由种子确定性生成。

## 3. Second Life（Linden Lab）

- Region（区域）是服务器单元，约 256m x 256m，可跨区域（teleport）。
- 脚本（LSL）运行在实体上，事件驱动。
- **对 Seed 的启发**：soul-proxy 上可挂"世界侧脚本"；区域触发器思路同源。

## 4. OpenSimulator（开源 Second Life 复刻）

- Region 插件化架构，支持网格（grid）互联。
- 通信使用消息总线，实体状态定期快照。
- **对 Seed 的启发**：子系统插件化（WorldSystem）、快照/回滚、跨区域迁移。

## 5. 共性总结

- 固定时间步长（Minecraft tick=20/s，Valheim 60/s）保证确定性。
- 事件总线 + 空间衰减是"活"世界的通用模式。
- 世界与"角色/灵魂"分离：世界只管物理与空间，角色状态在外部系统。Seed 与 SoulArena 的拆分正是这一模式。
