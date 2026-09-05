# ARCHITECTURE.md — Seed System 架构

## 1. 总览

Seed 是一个"底层世界引擎"：它不规定具体世界，只提供可配置的世界容器、物理、事件、通信与灵魂交互层。具体世界由 SDK 构建后注入引擎。

```
┌─────────────────────────────────────────────────────────────┐
│                      SoulArena (localhost:3000)             │
│              灵魂：personality / emotion / memory            │
└───────────────▲───────────────────────────┬─────────────────┘
                │ REST /api/souls           │ WebSocket /ws
                ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Seed API 层 (:3100)                   │
│        Express REST  +  ws WebSocket  +  SoulClient         │
└───────────────▲───────────────────────────┬─────────────────┘
                │                           │
                ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      WorldEngine（主循环）                  │
│   固定时间步长 tickRate；管理 World 与各子系统生命周期       │
└───────────────▲───────────────────────────┬─────────────────┘
                │                           │
                ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         World（容器）                       │
│   entities(Map)  +  systems[]  +  events(EventSystem)       │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
   Physics    Event     Communication Reliability Security
   System     System    Strategy     (Logger/   (Validator/
   (AABB/     (总线/     (Acoustic/   Snapshot/  Permission/
   积分)      优先级)    Network/     Exception)  RateLimit)
                         Resonance)
```

## 2. tick 循环

`WorldEngine.runTicks(n)` 或 `start()` 驱动 `World.step(dt)`：

1. `tick++`，`worldTime += dt`
2. 派发 `WorldTickEvent`
3. 依次调用每个启用的 `WorldSystem.tick(dt, world, events)`
   - PhysicsSystem：积分位置、重力、AABB 碰撞检测、派发 `CollisionEvent`、区域触发器
4. Evaluator 采样 tick 耗时（由调用方在 step 前后计时）

固定时间步长：`dt = 1 / tickRate`（默认 60），保证确定性。

## 3. 子系统职责

| 子系统 | 文件 | 职责 |
|--------|------|------|
| entity | entity/Vector3, Entity, EntityFactory | 实体模型、AABB、工厂 |
| physics | physics/* | 积分、碰撞、冲量；后端可替换 |
| event | event/* | 事件总线、条件谓词、空间衰减 |
| communication | communication/* | 声波/网络/共振三种介质 |
| reliability | reliability/* | 结构化日志、快照、异常处理、事务 |
| security | security/* | 校验、权限、限流、API Key、防注入 |
| sdk | sdk/* | WorldBuilder 链式建世界 |
| evaluator | evaluator/* | 性能/功能/活跃度指标 + JSON 报告 |
| api | api/* | REST + WebSocket + SoulClient |

## 4. 数据流（一次灵魂说话）

1. 灵魂 `POST /api/souls/:id/action {action:"speak", payload:{text}}`
2. InputValidator 校验 → PermissionSystem 检查 soul 角色 → RateLimiter 限流
3. API 层在世界中找到 `soul_:id` 代理实体，经 AcousticPropagation.transmit 计算接收
4. 接收者收到 Message（按距离衰减 intensity）
5. Evaluator 统计 messagesPerTick
6. 响应 `{ok:true}`

## 5. 扩展点

- **物理后端**：实现 `IPhysicsBackend`（step / applyImpulse），替换 SimplePhysics2D，未来可接 cannon-es / rapier。
- **通信介质**：实现 `CommunicationStrategy`，新增介质。
- **世界系统**：实现 `WorldSystem`（name/enabled/tick），通过 `World.addSystem` 接入。
- **世界容器**：`WorldBuilder` 可配置任意 tickRate / 实体 / 系统。
