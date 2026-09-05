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

响应体：

```json
{
  "world": "test-world",
  "running": true,
  "tick": 120,
  "worldTime": 2.0,
  "entityCount": 8
}
```

| 字段 | 含义 |
|------|------|
| `world` | 当前世界名（`engine.currentWorld.config.name`） |
| `running` | 引擎是否在跑（`engine.isRunning`） |
| `tick` | 已推进的 tick 数 |
| `worldTime` | 世界内累计秒数 |
| `entityCount` | 实体总数 |

### 3.2 实体

`GET /api/entities`

```json
{ "entities": [ { /* Entity.toJSON() */ } ] }
```

`GET /api/entities/:id`

- 命中：`{ "entity": { ... } }`
- 未命中：`404 { "error": "not_found" }`

`POST /api/entities`

- 请求体经 `InputValidator.validateInline` 校验（要求 `name`(≤64)、`x`、`y`、`z`）。
- 校验失败：`400 { "error": "validation_failed", "errors": [...] }`。
- 当前**不真正创建实体**，返回 `201 { "ok": true, "note": "entity creation via SDK; see docs/SDK.md" }`。

### 3.3 灵魂动作

`POST /api/souls/:id/action`

请求体：

```json
{ "action": "speak", "payload": { "text": "你好，世界" } }
```

- `action` 必须是 `move | speak | interact | attack | use` 之一。
- 先按调用方 IP 做令牌桶限流；超限返回 `429 { "error": "rate_limited", "retryAfterMs": <ms> }`。
- 再校验请求体；失败返回 `400 validation_failed`。
- 查找世界内 proxy：`soul_<:id>`；不存在返回 `404 { "error": "soul_not_in_world", "soulId": "..." }`。
- `speak` 动作会对 `payload.text` 做 `sanitizeString` 清洗后写入日志。
- 成功响应：`{ "ok": true, "action": "speak", "soulId": "<id>", "tick": <n> }`。

### 3.4 灵魂名册（代理到 SoulArena）

`GET /api/souls`

```json
{ "souls": [ { /* SoulInfo */ } ], "source": "soul-arena" }
```

`source` 为 `"soul-arena"` 表示来自真实后端；为 `"mock"` 表示 SoulArena 不可达，使用内置 mock。

---

## 4. SoulClient（主动访问 SoulArena）

`src/api/soulClient.ts`，构造：

```ts
new SoulClient(baseUrl?)
// baseUrl 默认 = process.env.SOUL_URL ?? 'http://localhost:3000'
```

| 方法 | 请求 | 成功返回 | 失败行为 |
|------|------|----------|----------|
| `listSouls()` | `GET {baseUrl}/api/souls`（1.5s 超时） | `{ souls: SoulInfo[], usedMock: false }` | 抛错被捕获 → 返回内置 mock，`usedMock: true` |
| `getSoul(id)` | `GET {baseUrl}/api/souls/:id`（1.5s 超时） | `SoulInfo \| null`（404/错误 → `null`） | 记 warn，返回 `null` |

`listSouls()` 同时兼容数组响应与 `{ souls: [...] }` 包装：
`Array.isArray(body) ? body : body.souls ?? []`。

### 4.1 SoulInfo 结构（snake_case，与 SoulArena 确认契约）

```ts
interface SoulInfo {
  id: string;
  name: string;
  element: string;                 // e.g. 'wind' | 'fire'
  status: string;
  current_game_id: string | null;
  birth_time: number;
  total_existence_ms: number;
  last_active_at: number;
  created_at: number;
  memoryStats: {
    episodic: number; semantic: number; core: number;
    links: number; reflections: number; total: number;
  };
  personality?: { bravery: number; aggression: number; sociability: number; curiosity: number; loyalty: number };
  emotion?: { valence: number; arousal: number; dominance: number; trust: number; anticipation: number; fatigue: number };
  valueSystem?: { beliefs: string[]; priorities: Record<string, number>; moralAlignment: number };
}
```

### 4.2 内置 mock 灵魂

SoulArena 不可达时，`listSouls()` 返回两个内置 mock：`Vex`（wind）与 `Nova`（fire），
`memoryStats` 全为 0，用于无后端时的本地开发。

---

## 5. WebSocket 协议（`/ws`）

服务端通过 `WebSocketServer({ server, path: '/ws' })` 挂载。连接建立后**服务端立即**发送握手消息，
之后对每条客户端消息回 `ack`（或 `error`）。所有消息均为 JSON 文本帧。

### 5.1 消息信封

```json
{ "type": "<type>", "payload": <unknown>, "timestamp": <ms> }
```

### 5.2 服务端 → 客户端

| type | 触发时机 | payload |
|------|----------|---------|
| `hello` | 连接建立时立即发送 | `{ "protocol": "seed-soul", "version": "0.1.0" }` |
| `ack` | 收到任意可解析客户端消息后 | `{ "echo": "<收到的消息 type>" }` |
| `error` | 客户端消息不是合法 JSON | `{ "message": "invalid json" }` |

握手示例：

```json
{ "type": "hello",
  "payload": { "protocol": "seed-soul", "version": "0.1.0" },
  "timestamp": 1730000000000 }
```

### 5.3 客户端 → 服务端

当前实现会把每条合法消息的 `type` 原样回显在 `ack.echo` 中：

```json
{ "type": "perception_request", "payload": { "soulId": "soul_mock_vex" } }
```

服务端仅记日志并回 `ack`；尚未按 `type` 分派具体动作（订阅/感知帧等完整语义见
`src/server/index.ts` 的 `SeedServer` 与 `docs/ROADMAP.md`）。

> 另有 `src/server/index.ts` 中的 `SeedServer` 类提供了更完整的 `/ws` 语义（`subscribe` /
> `action` / `perception_request` → `subscribed` / `action_result` / `perception_frame`），
> 但它与 `api/server.ts` 是两套并行实现，当前主入口使用 `api/server.ts`。

---

## 6. 感知与反馈数据契约（types 层）

以下类型定义在 `src/types/index.ts`，是灵魂感知世界与回传反馈的目标形状。它们是**契约**，
当前主循环对它们的逐帧填充由后续迭代实现（见已知问题）。

### 6.1 PerceptionFrame（灵魂每一帧的感知）

```ts
{
  soulId: string; timestamp: number; worldTime: number;
  position: IVector3;
  visibleEntities: { id; name; type; position; distance; visible }[];
  nearbySouls: { id; name; element; position; distance }[];
  environment: {
    temperature; pressure; humidity; windSpeed;
    windDirection: IVector3; lightLevel; weather: WeatherState; timeOfDay: number;
  };
  events: { id; type; name; severity; distance; affectsSoul }[];
  communications: CommunicationMessage[];
}
```

### 6.2 ActionRequest / ActionResult

```ts
// 灵魂请求动作
{
  soulId: string;
  action: 'move' | 'interact' | 'communicate' | 'use' | 'attack' | 'wait' | 'custom';
  targetId?: string;
  parameters: Record<string, unknown>;
  timestamp: number;
}

// 世界回传动作结果
{ soulId; action; success: boolean; message: string; data?: Record<string, unknown>; timestamp: number }
```

> 注意：REST 端点 `POST /api/souls/:id/action` 实际接受的动作枚举是
> `move | speak | interact | attack | use`（见 §3.3），与类型层 `ActionRequest.action` 的并集
> 存在差异（`speak`、`wait`、`custom` 等），属于契约未对齐的已知问题。

### 6.3 WorldEffect / SoulFeedback

```ts
// 世界对灵魂的影响（情绪/身体/社交）
{
  soulId; source;
  effectType: 'emotion' | 'physical' | 'mental' | 'social' | 'custom';
  magnitude: number;
  emotionDelta?: { valence?; arousal?; dominance?; trust?; anticipation? };
  physicalDelta?: { health?; energy?; fatigue? };
  description: string; timestamp: number;
}

// 灵魂对世界影响的反馈
{ soulId; worldEffectId; emotionalResponse; actionTaken; intensity; timestamp: number }
```

---

## 7. 错误码

| HTTP | `error` 字段 | 含义 |
|------|---------------|------|
| 400 | `validation_failed` | 请求体未通过 schema 校验，附带 `errors` |
| 401 | `unauthorized` | 开启 `SEED_AUTH=on` 后缺少/错误的 `X-API-Key` |
| 404 | `not_found` | `GET /api/entities/:id` 未命中 |
| 404 | `soul_not_in_world` | 世界内不存在 `soul_<id>` proxy |
| 429 | `rate_limited` | 令牌桶耗尽，附带 `retryAfterMs` |
| 503 | `no_world` | 当前没有活动世界（实体/动作端点） |

WebSocket 层错误仅 `{ type: "error", payload: { message: "invalid json" } }`。

---

## 8. 已知问题与限制

1. **`POST /api/entities` 不真正创建实体**，只做校验并返回占位 note；实体创建需走 SDK（见 `docs/SDK.md`）。
2. **动作枚举不一致**：REST 层用 `move/speak/interact/attack/use`，类型层 `ActionRequest` 用
   `move/interact/communicate/use/attack/wait/custom`，尚未统一。
3. **PerceptionFrame 的逐帧汇聚未实现**：`/ws` 目前只回 echo，未推送真实感知帧。
4. **两套服务端并存**：`api/server.ts`（当前主入口）与 `server/index.ts`（更完整但未接线）接口不统一。
5. **`permissions.ensure(...)` 在当前 PermissionSystem 实现中不存在**（新实现用 `hasPermission` /
   `checkPermission`），server.ts 对它的调用是编译错误之一，动作的 RBAC 拦截暂未真正生效。
6. SoulClient 对 SoulArena 的 1.5s 超时是硬编码；mock 回退是单向的，恢复真实后端需要重启或重连。
