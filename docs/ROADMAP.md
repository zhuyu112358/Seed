# ROADMAP.md — backlog

## 本轮未完成 / 需深化（按优先级）

1. **真实 WebSocket 双向帧**：当前仅 hello/ack；需实现 SOUL_INTERFACE 定义的 enter/exit/perception/action/world-effect/soul-feedback 全套帧。
2. **感知帧 LOD 过滤**：perception 按距离/LOD 裁剪实体与事件。
3. **世界对灵魂的情绪/价值映射**：把物理伤害、环境影响映射回 emotion/valueSystem 字段（协议已定义，未实现回写）。
4. **NetworkPacket / WorldResonance 真实化**：当前为 stub；需实现真实路由与共振亲和规则。
5. **POST /api/entities 真正创建实体**：当前返回占位；需接入 EntityFactory。
6. **日志轮转**：当前为单文件 append；需按大小/天切割。
7. **WorldTransaction 完善**：当前仅位置 undo；需覆盖属性/状态变更。
8. **灵魂动作 -> 物理冲量**：attack/move 动作目前仅记录日志，未真正驱动 soul-proxy 运动。
9. **空间分区**：当前碰撞 O(n^2)，需 octree/quadtree 加速。
10. **3D 物理后端**：当前 SimplePhysics2D 近似；可接 cannon-es / rapier / Jolt。

## 其他可扩展方向

- 天气系统（WeatherEvent 已预留）、昼夜循环
- 热力学 / 温度场、流体模拟
- 分布式世界分片与跨片灵魂迁移
- LOD（远距离实体简化）
- 场景序列化（世界可从 JSON 加载/保存为可分享的"卡带"）
- 编辑器 / 可视化调试视图
- 性能：tick 时间分位数直方图、火焰图集成
- 多世界并行（Seed 世界观核心：一个底层引擎跑多个世界）

## v0.1.0 已交付

引擎主循环、实体/向量、2D 物理与 AABB 碰撞、事件总线、声学通信、结构化日志、快照、异常处理、输入校验/权限/限流/API Key、SDK、评估器、REST+WebSocket 骨架、25 个单元测试、测试世界、9 份文档。
