# SOUL_INTERFACE.md — 灵魂-世界交互协议

> 版本：seed-soul@0.1.0 · 本文档由 Seed 侧定义；SoulArena 侧待其下一次迭代时同步。
> 字段命名以 SoulArena 实际返回为准（snake_case），不臆造 camelCase。

## 1. 设计目标

灵魂系统（SoulArena）管理灵魂的"内在"：人格、情绪、价值系统、记忆。
种子系统（Seed）管理"外在"：世界、物理、事件、空间、通信。
本协议定义两者之间的握手、感知、动作、世界反馈与回传。

通信通道：
- **REST**：一次性请求/响应（进入/离开、动作、查询）。
- **WebSocket**（`/ws`）：实时双向流（持续感知、事件推送、长连接动作）。

所有消息均为 JSON，顶层结构统一为：

```json
{ "type": "<消息类型>", "payload": { ... }, "timestamp": 1725..., "soulId": "soul_xxx" }
```

## 2. 握手（进入 / 离开）

### 2.1 灵魂进入世界 enter

灵魂通过 REST 或 WebSocket 声明进入。Seed 为其创建 `soul-proxy` 实体。

REST：`POST /api/souls/:id/action`（见第 5 节）或 WebSocket：

```json
{
  "type": "soul.enter",
  "payload": { "position": { "x": 0, "y": 1, "z": 0 }, "world": "test-world" },
  "timestamp": 1725...,
  "soulId": "soul_mtmtqt4pm7zdne"
}
```

Seed 回复：

```json
{ "type": "soul.enter.ack", "payload": { "proxyId": "soul_soul_mtmtqt4pm7zdne", "tick": 42 }, "timestamp": ..., "soulId": "..." }
```

### 2.2 灵魂离开 exit

```json
{ "type": "soul.exit", "payload": { "reason": "logout" }, "timestamp": ..., "soulId": "..." }
```

Seed 删除/停用其 `soul-proxy`，回复 `soul.exit.ack`。

## 3. 感知输入 perception

世界按距离 / LOD 过滤后，周期性（或事件触发）向灵魂推送感知帧：

```json
{
  "type": "soul.perception",
  "payload": {
    "self": { "proxyId": "soul_...", "position": {"x":0,"y":1,"z":0}, "velocity": {"x":0,"y":0,"z":0} },
    "entities": [
      { "id": "ent_...", "name": "crate", "kind": "dynamic", "distance": 3.1, "position": {"x":-3,"y":0.24,"z":0} }
    ],
    "events": [ { "type": "physics.collision", "distance": 2.0 } ],
    "environment": { "timeOfDay": "day", "weather": "clear" },
    "messages": [ { "from": "soul_...", "text": "hello", "intensity": 0.9 } ]
  },
  "timestamp": ...,
  "soulId": "..."
}
```

过滤规则：
- 只推送 `distance <= maxDistance` 的实体（maxDistance 由灵魂侧在 enter 时声明，默认 30m）。
- 远距离实体只给 {id,name,distance}，近距离才给完整位置/速度。
- 事件同样按距离衰减（见 `EventPropagation`）。

## 4. 执行动作 action

灵魂发动作，Seed 校验（InputValidator + PermissionSystem + RateLimiter）后转成世界事件。

REST：`POST /api/souls/:id/action`

```json
{
  "action": "move",
  "payload": { "target": { "x": 5, "y": 0, "z": 0 }, "speed": 2.0 }
}
```

动作枚举与参数 schema：

| action | 必选 payload | 说明 |
|--------|--------------|------|
| move | target{x,y,z}, speed | 灵魂代理向目标移动 |
| speak | text(string,<=500) | 经 AcousticPropagation 广播，按距离衰减 |
| interact | targetId | 与可交互实体交互 |
| attack | targetId, power | 对目标施加冲量/伤害 |
| use | targetId | 使用实体（门、开关等） |

成功响应：
```json
{ "ok": true, "action": "move", "soulId": "...", "tick": 42 }
```

## 5. 世界对灵魂的影响 world-effect

世界把物理/环境影响映射回灵魂系统的字段（见第 7 节映射表）：

```json
{
  "type": "world.effect",
  "payload": {
    "damage": 5.0,
    "environment": { "temperature": 0.2, "wind": 0.8 },
    "emotionDelta": { "valence": -0.1, "arousal": 0.2, "fatigue": 0.05 },
    "valueTriggers": [ "danger" ]
  },
  "timestamp": ...,
  "soulId": "..."
}
```

- 物理伤害：碰撞速度 * 系数 -> damage。
- 环境影响：天气/温度 -> emotion.valence / arousal。
- 情绪触发：进入危险区 -> emotion.arousal 上升、valueSystem.moralAlignment 临时偏移。

## 6. 灵魂反馈回传 soul-feedback

Seed 把动作结果与状态变化回传给灵魂：

```json
{
  "type": "soul.feedback",
  "payload": {
    "action": "move",
    "ok": true,
    "resultingPosition": {"x":3.2,"y":0.54,"z":0},
    "eventsObserved": 3,
    "errors": []
  },
  "timestamp": ...,
  "soulId": "..."
}
```

## 7. 字段映射表（Seed 字段 ↔ SoulArena 实际 snake_case 字段）

> 以下 SoulArena 字段名基于已确认的实际接口（GET /api/souls 与 /api/souls/:id），全部为 snake_case。

| 含义 | Seed 侧字段 | SoulArena 实际字段 |
|------|-------------|--------------------|
| 灵魂 ID | soulId | `id` |
| 灵魂名 | proxy.name | `name` |
| 元素 | proxy.properties.element | `element` |
| 在线状态 | proxy.state.insideWorld | `status` |
| 当前所在世界 | current_game | `current_game_id` |
| 出生时间 | — | `birth_time` |
| 累计存在时长 | — | `total_existence_ms` |
| 最后活跃 | — | `last_active_at` |
| 创建时间 | — | `created_at` |
| 记忆-情景 | perceivedEvents | `memoryStats.episodic` |
| 记忆-语义 | — | `memoryStats.semantic` |
| 记忆-核心 | — | `memoryStats.core` |
| 记忆-链接 | — | `memoryStats.links` |
| 记忆-反思 | — | `memoryStats.reflections` |
| 记忆-总计 | — | `memoryStats.total` |
| 人格-勇敢 | bravery | `personality.bravery` |
| 人格-攻击 | aggression | `personality.aggression` |
| 人格-社交 | sociability | `personality.sociability` |
| 人格-好奇 | curiosity | `personality.curiosity` |
| 人格-忠诚 | loyalty | `personality.loyalty` |
| 情绪-效价 | emotionDelta.valence | `emotion.valence` |
| 情绪-唤醒 | emotionDelta.arousal | `emotion.arousal` |
| 情绪-支配 | — | `emotion.dominance` |
| 情绪-信任 | — | `emotion.trust` |
| 情绪-期待 | — | `emotion.anticipation` |
| 情绪-疲劳 | emotionDelta.fatigue | `emotion.fatigue` |
| 价值-信念 | valueTriggers | `valueSystem.beliefs[]` |
| 价值-优先级 | — | `valueSystem.priorities{}` |
| 价值-道德对齐 | moralAlignmentDelta | `valueSystem.moralAlignment` |

## 8. 版本与兼容性

- 协议版本：`seed-soul@0.1.0`（在 WebSocket hello 中下发）。
- 规则：**新增可选字段不破坏旧客户端**；删除/重命名字段必须升主版本号。
- 未知字段：接收方必须忽略（forward-compatible）。
- 时间戳统一 Unix 毫秒（UTC）。

## 9. REST 端点对应

| 协议动作 | 端点 |
|----------|------|
| 拉取灵魂列表 | GET /api/souls（Seed 代理 localhost:3000） |
| 进入/动作 | POST /api/souls/:id/action |
| 世界状态 | GET /api/world/status |
| 实体列表 | GET /api/entities |

## 10. 备注

- 本协议目前由 Seed 侧单方面定义；SoulArena 侧应在其下次迭代中实现对应处理（enter/exit/perception/action/world-effect/soul-feedback）。
- v0.1.0 仅打通了拉取灵魂列表与 action 入口；完整 WebSocket 双向帧在后续迭代完善。
