# API 文档（REST + WebSocket）

> 严格基于 `src/api/server.ts`、`src/api/soulClient.ts`。文档中文，代码注释英文。
> 默认端口 **3100**（可用 `PORT` 环境变量覆盖）。

---

## 1. 概述

Seed 进程用 Express 提供 REST，并在同一 HTTP server 上挂一个 WebSocket 端点 `/ws`。入口函数：

```ts
// src/api/server.ts
interface ServerDeps {
  engine: WorldEngine;
  soulClient: SoulClient;
  port?: number;
}

function createApp(deps: ServerDeps): express.Express;
function startServer(deps: ServerDeps): Promise<{ close: () => void }>;
```

中间件：

- `express.json({ limit: '256kb' })`
- API Key 鉴权（见下）。仅当 `SEED_AUTH=on` 时开启；开启后校验请求头 `x-api-key` 是否在 `SEED_API_KEYS`（逗号分隔）白名单内，默认 key 为 `dev-seed-key`。

环境变量：

| 变量 | 作用 | 默认 |
|------|------|------|
| `PORT` | HTTP/WebSocket 端口 | `3100` |
| `SEED_AUTH` | `on` 时强制 API Key | 关 |
| `SEED_API_KEYS` | 允许的 key，逗号分隔 | `dev-seed-key` |
| `SOUL_URL` | SoulArena 地址（透传给 SoulClient） | `http://localhost:3000` |

---

## 2. REST 端点

### 2.1 `GET /api/world/status`

世界运行状态。

响应 `200`：

```json
{
  "world": "test-world",
  "running": true,
  "tick": 123,
  "worldTime": 2.05,
  "entityCount": 12
}
```

### 2.2 `GET /api/entities`

全部实体（逐个 `toJSON()`）。

```json
{ "entities": [ { "id": "...", "name": "...", "type": "...", "...": "..." } ] }
```

> 若当前无世界，返回 `{ "entities": [] }`。

### 2.3 `GET /api/entities/:id`

单个实体。找到返回 `200`：

```json
{ "entity": { "id": "...", "...": "..." } }
```

未找到返回 `404`：

```json
{ "error": "not_found" }
```

### 2.4 `POST /api/entities`

创建实体。请求体会被 `InputValidator.validate` 按下表校验（见 `SECURITY.md`）：

| 字段 | 类型 | 要求 |
|------|------|------|
| `name` | string | 必填，最长 64 |
| `x` | number | 必填 |
| `y` | number | 必填 |
| `z` | number | 必填 |

校验失败返回 `400`：

```json
{ "error": "validation_failed", "errors": ["\"name\" is required", "..."] }
```

成功返回 `201`：

```json
{ "ok": true, "note": "entity creation via SDK; see docs/SDK.md" }
```

> 当前实现仅做校验并返回提示，真正的实体创建走 SDK/引擎，尚未在该端点内接线（见已知问题）。

### 2.5 `POST /api/souls/:id/action`

灵魂动作入口（最核心的写路径）。流程：

1. 若当前无世界 → `503 { "error": "no_world" }`。
2. 以 `req.ip`（无则 `anonymous`）做限流；超限 → `429 { "error": "rate_limited", "retryAfterMs": <ms> }`。
3. 校验 body：`action`（string，必填，枚举 `move/speak/interact/attack/use`）、`payload`（object，可选）。失败 → `400 { "error": "validation_failed", "errors": [...] }`。
4. 按 `soul_<id>` 查找世界中的化身；不存在 → `404 { "error": "soul_not_in_world", "soulId": "..." }`。
5. 权限检查 `permissions.ensure('soul', 'entity', 'interact')`（无权限抛错）。
6. `speak` 动作会对 `payload.text` 做 `sanitizeString` 并写日志。

成功返回 `200`：

```json
{ "ok": true, "action": "speak", "soulId": "vex", "tick": 123 }
```

请求体示例：

```json
{ "action": "speak", "payload": { "text": "hello world" } }
```

### 2.6 `GET /api/souls`

转发 `SoulClient.listSouls()`：

```json
{
  "souls": [ { "id": "soul_mock_vex", "name": "Vex", "element": "wind", "...": "..." } ],
  "source": "mock"
}
```

`soruce` 为 `mock` 表示 SoulArena 不可达、使用内置 mock；为 `soul-arena` 表示来自真实后端。

---

## 3. WebSocket `/ws`

连接建立后，服务端立即下发握手帧：

```json
{ "type": "hello", "payload": { "protocol": "seed-soul", "version": "0.1.0" }, "timestamp": 1700000000000 }
```

客户端可发送 JSON：

```json
{ "type": "move", "payload": { "...": "..." }, "soulId": "vex" }
```

- 合法 JSON → 回一个 ack：`{ "type": "ack", "payload": { "echo": "<客户端 type>" }, "timestamp": ... }`。
- 非法 JSON → 回 `{ "type": "error", "payload": { "message": "invalid json" }, "timestamp": ... }`。

> 当前 `/ws` 仅做回显与日志，尚未把消息路由到世界/动作执行（见已知问题）。

---

## 4. 错误码约定

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 已创建 |
| 400 | 请求体校验失败 |
| 401 | 缺失/非法 `X-API-Key` |
| 404 | 实体 / 灵魂化身不存在 |
| 429 | 触发限流 |
| 503 | 尚无世界 |

---

## 5. 使用示例

```bash
# Health / status
curl http://localhost:3100/api/world/status

# List entities
curl http://localhost:3100/api/entities

# A soul action (with API key when SEED_AUTH=on)
curl -X POST http://localhost:3100/api/souls/vex/action \
  -H "content-type: application/json" \
  -H "x-api-key: dev-seed-key" \
  -d '{"action":"speak","payload":{"text":"hi"}}'
```

---

## 6. 已知问题 / 限制

1. **`currentWorld` 缺失（运行时崩溃级）**：`createApp` 各处理器读取 `deps.engine.currentWorld`，但真实 `WorldEngine` **没有该 getter**，也没有 `entities/tick/worldTime` 字段。因此在未桥接实现前，这些端点会走到“无世界”降级分支或运行时报错；TypeScript 也无法通过。需要为 `WorldEngine` 增加对当前 `World` 的暴露，或改造处理器改用 `EngineSystem` 查询。详见 `DEVLOG.md`。
2. **动作端点仅为骨架**：除 `speak` 外，`move/interact/attack/use` 目前只回 `ok:true`，未真正驱动物理或化身。
3. **动作枚举不一致**：本端点允许 `move/speak/interact/attack/use`，而 `types/ActionRequest` 允许 `move/interact/communicate/use/attack/wait/custom`。需统一。
4. **`POST /api/entities` 不落库**：只校验、不创建实体。
5. **`/ws` 仅回显**：未连接到事件总线或动作执行。
6. **限流维度**：当前按 `req.ip` 固定窗口（构造为 `new RateLimiter(100)`，即 100 QPS/IP），未按灵魂 id 区分。
