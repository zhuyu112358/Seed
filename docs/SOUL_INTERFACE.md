# 灵魂-世界接口约定（SOUL_INTERFACE）

> 本文档基于 `src/api/server.ts`、`src/api/soulClient.ts` 与 `src/types/index.ts` 中的真实实现编写。
> 它定义了一个外部「灵魂」（Soul，由 SoulArena 后端托管）如何进入 Seed 世界、感知世界、执行动作、被世界影响并回传反馈。

---

## 1. 概述

Seed 是一个运行在 SoulArena **之下** 的虚拟物理世界引擎。灵魂本身并不生活在 Seed 进程里，而是由
SoulArena（独立后端，默认 `http://localhost:3000`）托管其人格、记忆与情绪。Seed 通过两个面向外部的
通道与灵魂交互：

1. **REST（HTTP/JSON）**——短请求-响应，用于查询世界状态、实体列表、灵魂名册、提交一次动作。
2. **WebSocket（`/ws`）**——长连接，用于握手与实时消息往返。

`SoulClient`（`src/api/soulClient.ts`）是 Seed 进程**主动**访问 SoulArena 的客户端；
`createApp` / `startServer`（`src/api/server.ts`）是 Seed **暴露**给外部世界的服务端。两者方向相反，
字段命名均采用与 SoulArena 确认过的 **snake_case** 契约。

### 1.1 数据流总览

```
        SoulArena (灵魂托管, :3000)
              ▲  GET /api/souls            ▲  GET /api/souls/:id
              │  SoulClient.listSouls()    │  SoulClient.getSoul(id)
              │                            │
   ┌──────────┴─────────────────────────────┘
   │  Seed 进程 (src/api/server.ts, 默认 :3100)
   │
   │   外部调用方 / 灵魂代理 ──HTTP/JSON──▶ REST 端点
   │   外部调用方 / 灵魂代理 ──WebSocket──▶ /ws
   ▼
 WorldEngine → World.step → systems.tick（世界模拟主循环）
```

---

## 2. 灵魂生命周期

| 阶段 | 触发方 | 机制 | 世界内表现 |
|------|--------|------|-----------|
| 名册加载 | Seed 启动 | `SoulClient.listSouls()` 拉取 `/api/souls` | 不可达时回退内置 mock 灵魂 |
| 进入世界 | 外部请求加入 | 在世界内创建一个 **soul-proxy** 实体（`EntityFactory.soulProxy`，id = `soul_<soulId>`） | proxy 占据物理位置，可被感知/交互 |
| 感知输入 | 灵魂侧轮询/订阅 | 世界每个 tick 汇聚 `PerceptionFrame`（见 §6） | 可见实体、附近灵魂、环境、事件、通信 |
| 动作执行 | 外部 POST | `POST /api/souls/:id/action` → 校验 → 查找 proxy → 执行 | 动作结果回传 `ActionResult` |
| 世界影响 | 世界系统 | 碰撞/天气/区域等事件 → `WorldEffect` | 情绪/身体/社交状态变化 |
| 反馈回传 | 灵魂侧 | `SoulFeedback` 描述对世界影响的反应 | 闭环 |
| 离开世界 | 移除 proxy | `World.removeEntity('soul_<soulId>')` | proxy 销毁 |

> 说明：进入/离开世界的**实体创建**当前由 SDK 完成（`POST /api/entities` 仅做校验并返回占位响应，
> 见 `server.ts` 与 `docs/SDK.md`）。soul-proxy 的标准 id 为 `` `soul_${soulId}` ``。

---

## 3. REST 端点（服务端）

所有端点挂在 Seed API 服务（默认端口由 `PORT` 决定，缺省 `3100`）。响应均为 `application/json`。

### 3.1 世界状态

`GET /api/world/status`

```json
{ "world": "test-world", "running": true, "tick": 120, "worldTime": 2.0, "entityCount": 8 }
```

| 字段 | 含义 |
|------|------|
| `world` | 当前世界名（`engine.currentWorld.config.name`） |
| `running` | 引擎是否在跑（`engine.isRunning`） |
| `tick` | 已推进的 tick 数 |
| `worldTime` | 世界内累计秒数 |
| `entityCount` | 实体总数 |

### 3.2 实体

- `GET /api/entities` → `{ entities: [...Entity.toJSON()] }`
- `GET /api/entities/:id` → 命中 `{ entity }`，否则 `404 { error: "not_found" }`
- `POST /api/entities`：要求 `name`(≤64)、`x`、`y`、`z`；校验失败 `400 validation_failed`；
  当前**不真正创建**，返回 `201 { ok: true, note: "entity creation via SDK; see docs/SDK.md" }`。

### 3.3 灵魂动作

`POST /api/souls/:id/action`，请求体 `{ "action": "speak", "payload": { "text": "..." } }`。

- `action` ∈ `move | speak | interact | attack | use`。
- 先按 IP 限流 → `429 { error: "rate_limited", retryAfterMs }`。
- 再校验请求体 → `400 validation_failed`。
- 查找 `soul_<:id>` proxy，缺失 → `404 { error: "soul_not_in_world", soulId }`。
- `speak` 对 `payload.text` 做 `sanitizeString` 后记日志。
- 成功：`{ ok: true, action, soulId, tick }`。

### 3.4 灵魂名册（代理 SoulArena）

`GET /api/souls` → `{ souls: SoulInfo[], source: "soul-arena" | "mock" }`。

---

## 4. SoulClient（主动访问 SoulArena）

`src/api/soulClient.ts`，`new SoulClient(baseUrl?)`，`baseUrl` 默认 `process.env.SOUL_URL ??
'http://localhost:3000'`。

| 方法 | 请求 | 成功 | 失败 |
|------|------|------|------|
| `listSouls()` | `GET {base}/api/souls`（1.5s 超时） | `{ souls, usedMock: false }` | 返回内置 mock，`usedMock: true` |
| `getSoul(id)` | `GET {base}/api/souls/:id`（1.5s 超时） | `SoulInfo \| null` | 记 warn，返回 `null` |

兼容数组与 `{ souls: [...] }` 两种响应。

### 4.1 SoulInfo（snake_case 契约）

```ts
{
  id, name, element, status,
  current_game_id: string | null,
  birth_time, total_existence_ms, last_active_at, created_at,
  memoryStats: { episodic, semantic, core, links, reflections, total },
  personality?: { bravery, aggression, sociability, curiosity, loyalty },
  emotion?: { valence, arousal, dominance, trust, anticipation, fatigue },
  valueSystem?: { beliefs: string[], priorities: Record<string, number>, moralAlignment: number }
}
```

### 4.2 内置 mock

SoulArena 不可达时返回两个 mock：`Vex`(wind)、`Nova`(fire)，`memoryStats` 全 0。

---

## 5. WebSocket 协议（`/ws`）

挂载于同一 HTTP server 的 `path: '/ws'`。消息为 JSON 文本帧，信封
`{ "type": "...", "payload": ..., "timestamp": <ms> }`。

| 方向 | type | 说明 |
|------|------|------|
| 服务端→客户端 | `hello` | 连接即发：`{ protocol: "seed-soul", version: "0.1.0" }` |
| 客户端→服务端 | 任意 | 服务端解析后回 ack |
| 服务端→客户端 | `ack` | `{ echo: "<收到的 type>" }` |
| 服务端→客户端 | `error` | 非法 JSON：`{ message: "invalid json" }` |

当前未按 `type` 分派业务，仅回显。`src/server/index.ts` 的 `SeedServer` 提供更完整的
`subscribe/action/perception_request` → `subscribed/action_result/perception_frame`，但未接线。

---

## 6. 感知与反馈数据契约（types 层）

### 6.1 PerceptionFrame

`{ soulId, timestamp, worldTime, position, visibleEntities[], nearbySouls[],
environment{temperature,pressure,humidity,windSpeed,windDirection,lightLevel,weather,timeOfDay},
events[], communications[] }`。

### 6.2 ActionRequest / ActionResult

`ActionRequest = { soulId, action: 'move'|'interact'|'communicate'|'use'|'attack'|'wait'|'custom',
targetId?, parameters, timestamp }`；`ActionResult = { soulId, action, success, message, data?, timestamp }`。

### 6.3 WorldEffect / SoulFeedback

`WorldEffect`：世界对灵魂的情绪/身体/社交影响；`SoulFeedback`：灵魂对该影响的反应（闭环）。

> 这些类型是**契约**，逐帧填充尚未实现（见已知问题）。

---

## 7. 错误码

| HTTP | `error` | 含义 |
|------|---------|------|
| 400 | `validation_failed` | schema 校验失败 |
| 401 | `unauthorized` | 缺/错 `X-API-Key`（SEED_AUTH=on） |
| 404 | `not_found` / `soul_not_in_world` | 实体/灵魂 proxy 缺失 |
| 429 | `rate_limited` | 限流，附 `retryAfterMs` |
| 503 | `no_world` | 无活动世界 |

---

## 8. 已知问题与限制

1. `POST /api/entities` 只校验不创建，建实体走 SDK。
2. 动作枚举不一致：REST 用 `move/speak/interact/attack/use`，类型层 `ActionRequest` 用另一组。
3. PerceptionFrame 逐帧汇聚未实现，`/ws` 仅回 echo。
4. 两套服务端并存（`api/server.ts` 与 `server/index.ts`）。
5. `permissions.ensure(...)` 在当前 PermissionSystem 中不存在（新实现用 `hasPermission/checkPermission`），
   动作端点 RBAC 暂未生效。
6. SoulClient 1.5s 超时硬编码；mock 回退单向。


## 7. 感知系统实现（SoulPerceptionSystem）

src/entity/SoulPerceptionSystem.ts 已实现 PerceptionFrame 逐帧汇聚。每 tick 为每个 soul 类型实体生成感知帧，包含：

- **visibleEntities**：视野距离内的非灵魂实体，按距离排序，默认上限 20 个
- **nearbySouls**：视野距离内的其他灵魂，含元素属性和距离
- **environment**：从 WeatherSimulator 读取温度/气压/湿度/风速/风向/光照/天气
- **events**：最近的世界事件（通过 recordEvent 记录），保留 600 tick（10秒）
- **communications**：最近的通信消息（通过 recordCommunication 记录），保留 300 tick（5秒）

配置项：viewDistance（默认30）、maxVisibleEntities（默认20）、commRetentionTicks（默认300）、eventRetentionTicks（默认600）。

获取感知：perception.getPerception(soulId) 返回最新 PerceptionFrame，getAllPerceptions() 返回全部。

未来扩展：视野锥（FOV cone）、障碍物遮挡、注意力过滤、感官模态阈值。


## 8. 动作系统实现（SoulActionSystem）

src/entity/SoulActionSystem.ts 已实现 ActionRequest/ActionResult 执行引擎。与 SoulPerceptionSystem 形成感知→决策→动作闭环。

支持七种动作：
- **move**：移动灵魂proxy，支持目标坐标 {x,y,z} 或方向+距离 {direction,distance}，最大移动距离默认 5m
- **interact**：与 interactive 类型物体交互，需 targetId，最大交互距离 3m，记录 interactionCount
- **communicate**：发送通信消息，需 content，自动记录到 SoulPerceptionSystem 通信缓冲区，附近灵魂可感知
- **use**：使用目标物体，需 targetId，记录 useCount
- **attack**：攻击目标，需 targetId，施加击退冲量（与质量成反比），最大攻击距离 6m
- **wait**：等待，总是成功
- **custom**：自定义动作扩展点

配置项：maxMoveDistance（默认5）、maxInteractDistance（默认3）、maxQueuePerSoul（默认10）。

API：executeAction(request, world) 同步执行、queueAction(request) 排队（tick中处理）、getHistory(soulId) 动作历史、executedCount/failedCount/queueLength 统计。


## 9. 世界事件系统（WorldEventSystem）

src/event/WorldEventSystem.ts 实现基于条件的世界事件触发与大规模影响。事件可基于天气/时间/实体数等条件自动触发，对物体和灵魂产生持续影响。

### 内置事件定义

调用 `registerBuiltinEvents()` 自动注册以下 4 个事件：

| 事件 | 类型 | 严重度 | 触发条件 | 持续时间 | 冷却 |
|------|------|--------|----------|----------|------|
| Wind Gust（阵风） | weather | medium | 风速 > 10 | 10-30s | 60s |
| Rain Storm（暴雨） | weather | medium | 湿度 > 70 且 气压 < 1005 | 20-60s | 120s |
| Typhoon（台风） | disaster | extreme | 风速 > 25 且 湿度 > 80 | 30-90s | 300s |
| Cold Snap（寒潮） | seasonal | high | 温度 < 0 | 30-120s | 180s |

### 条件评估

支持 9 种条件类型：temperature、humidity、windSpeed、pressure、weather、timeOfDay、lightLevel、entityCount、custom。操作符：gt、gte、lt、lte、eq、neq、between。多个条件为 AND 关系。

### 事件效果

- **applyForce**：对目标实体施加风力（基于风速和风向），支持 all/souls/dynamicEntities/staticEntities 目标筛选
- **modifyProperty**：修改实体 state 属性（如 `wet: true`、`frozen: true`）
- **emitEvent**：通过 EventSystem 广播事件（如 `weather.rain`、`disaster.typhoon`）
- **damage / heal / custom**：预留扩展点

### 灵魂感知集成

事件触发时自动查找 SoulPerceptionSystem（按 name="soul-perception"），调用 `recordEvent()` 将事件记录到灵魂感知缓冲区。灵魂在 PerceptionFrame.events 中可感知到事件名称、类型、严重度。

### API

- `registerDefinition(def)` / `registerBuiltinEvents()` / `removeDefinition(id)`
- `bindSystems(weather, clock)` 绑定天气和时钟系统
- `getActiveEvents()` / `getEventsTriggered()` / `getDefinitions()`
- `tick(dt, world, events)` 每帧检查条件、触发事件、应用效果、结束过期事件


## 10. SoulBridgeAdapter 桥接适配器（perceive→decide→act 闭环）

src/bridge/SoulBridgeAdapter.ts 是 Seed 与 SoulArena 之间的**唯一桥接组件**，负责格式转换和 API 编排，打通感知→决策→动作完整循环。

### 架构约束

- SoulBridgeAdapter 是**唯一允许**做格式转换和 SoulArena API 调用编排的模块
- 其他模块（SoulPerceptionSystem/SoulActionSystem）只处理标准化格式（PerceptionFrame/ActionRequest），不得直接调用 SoulArena API
- 不得在 Seed 内核中实现灵魂认知/决策逻辑，决策完全由 SoulArena 负责

### 工作流程

```
SoulPerceptionSystem          SoulBridgeAdapter              SoulArena
     │                              │                            │
     │  PerceptionFrame             │                            │
     │─────────────────────────────>│                            │
     │                              │  格式转换（situation文本）  │
     │                              │───────────────────────────>│
     │                              │  POST /api/soul/:id/perceive
     │                              │                            │  认知决策
     │                              │<───────────────────────────│
     │                              │  actions[] (speak/move/...)│
     │                              │  格式转换                   │
     │  ActionRequest               │                            │
     │<─────────────────────────────│                            │
     │  executeAction()             │                            │
```

### 感知格式转换

支持两种模式（通过 `enableSituationMode` 配置，默认 true）：

1. **简化模式（推荐）**：从 PerceptionFrame 生成人类可读的 situation 文本，包含位置、天气、可见物体、附近灵魂、听到的声音、世界事件。SoulArena 直接使用该文本作为情境。
2. **结构化模式**：转换为 SoulArena 原生格式（perception.visual/auditory/proprioception + events + worldState）。

### 动作格式转换

SoulArena 动作 → Seed ActionRequest 映射：

| SoulArena 动作 | Seed 动作 | 说明 |
|---------------|----------|------|
| speak | communicate | content → parameters.content, medium=acoustic |
| expression | custom | expression/intensity 存入 parameters |
| move | move | parameters 透传 |
| attack | attack | targetId + parameters |
| interact | interact | targetId + parameters |
| use | use | targetId + parameters |
| wait | wait | 总是成功 |
| 其他 | custom | originalType 保留在 parameters |

### 动作接收方式

1. **API 返回**：perceive API 响应体中包含 `actions[]` 时自动解析并入队
2. **Webhook 推送**：调用 `ingestAction(soulId, action)` 方法入队（供 HTTP 服务器接收 SoulArena 回调）
3. 队列每 tick 处理，每灵魂上限 20 个（超出丢弃最旧）

### API

- `constructor(config?)`：配置 soulArenaUrl、perceiveIntervalTicks、enableSituationMode 等
- `bindSystems(perception, actionSystem)`：手动绑定感知和动作系统
- `tick(dt, world, events)`：WorldSystem 接口，自动按 name 懒加载感知/动作系统
- `sendAllPerceptions()`：发送所有灵魂的感知到 SoulArena
- `sendPerception(soulId, frame)`：发送单个灵魂感知
- `ingestAction(soulId, action)`：接收 SoulArena 动作并入队
- `getStats()`：获取统计（perceptionsSent/actionsReceived/actionsExecuted 等）
- `clearQueue()`：清空动作队列

### 使用示例

```typescript
import { SoulBridgeAdapter } from "./src/bridge/SoulBridgeAdapter.js";

const bridge = new SoulBridgeAdapter({
  soulArenaUrl: "http://localhost:3000",
  perceiveIntervalTicks: 10,
  enableSituationMode: true,
});

// 方式1：添加到 world，自动绑定感知和动作系统
world.addSystem(bridge);

// 方式2：手动绑定
bridge.bindSystems(perceptionSystem, actionSystem);

// Webhook 接收 SoulArena 动作回调
app.post("/webhook/soul-action", (req, res) => {
  bridge.ingestAction(req.body.soulId, req.body.action);
  res.json({ status: "queued" });
});
```

