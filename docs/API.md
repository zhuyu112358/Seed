# API 参考（API.md）

> 基于 `src/api/server.ts` 的真实路由编写（主入口：`npm run dev` → `tsx src/api/server.ts`）。
> 另存在一套更完整但未接线的服务端 `src/server/index.ts`（`SeedServer` 类），见 §8。
>
> **重要**：当前 `npm run build` 不通过，`server.ts` 与安全层之间存在实现/类型不一致（见 §7）。
> 本文档描述端点的**预期行为**，并在 §7 标注已知实现 bug。

---

## 1. 概览

- 框架：Express 4 + `ws`。
- JSON body 上限：`256kb`。
- 认证：`apiKeyAuth` 中间件，仅当 `SEED_AUTH=on` 时启用；允许 key 来自 `SEED_API_KEYS`（逗号分隔，
  默认 `dev-seed-key`）。
- 端口：`startServer({ port }) ?? process.env.PORT ?? 3100`。
- 依赖注入：`createApp({ engine, soulClient, port? })` / `startServer(...)`。

```ts
interface ServerDeps {
  engine: WorldEngine;       // 提供 currentWorld / isRunning / getEntity(...)
  soulClient: SoulClient;    // 代理 SoulArena 名册
  port?: number;
}
```

---

## 2. REST 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/world/status` | 世界运行状态 |
| GET  | `/api/entities` | 全部实体（`toJSON()` 数组） |
| GET  | `/api/entities/:id` | 单个实体 |
| POST | `/api/entities` | 校验创建请求体（当前返回占位） |
| POST | `/api/souls/:id/action` | 灵魂提交一次动作 |
| GET  | `/api/souls` | 灵魂名册（代理 SoulArena，失败回退 mock） |

---

## 3. 端点详情

### 3.1 GET /api/world/status

**预期响应**

```json
{
  "world": "test-world",
  "running": true,
  "tick": 120,
  "worldTime": 2.0,
  "entityCount": 8
}
```

字段取自 `engine.currentWorld.config.name`、`engine.isRunning`、`currentWorld.tick / worldTime /
entities.size`。无活动世界时各字段应回退默认值（`world=null`、`tick=0` 等）。

### 3.2 GET /api/entities

```json
{ "entities": [ { "id": "...", "name": "...", "type": "dynamic", "...": "..." } ] }
```

每个元素为 `Entity.toJSON()` 的输出。无世界时预期返回 `{ "entities": [] }`。

### 3.3 GET /api/entities/:id

- 命中 → `200 { "entity": { ...toJSON() } }`
- 未命中 → `404 { "error": "not_found" }`

### 3.4 POST /api/entities

**预期请求体**：

```json
{ "name": "rock", "x": 1, "y": 0, "z": 2 }
```

- 经 schema 校验：`name`（string，≤64）、`x/y/z`（number）均必填。
- 校验失败 → `400 { "error": "validation_failed", "errors": [...] }`。
- 无活动世界 → `503 { "error": "no_world" }`。
- **当前实现不真正创建实体**，成功返回：
  `201 { "ok": true, "note": "entity creation via SDK; see docs/SDK.md" }`。

### 3.5 POST /api/souls/:id/action

**预期请求体**：

```json
{ "action": "speak", "payload": { "text": "你好" } }
```

处理管线：

1. 按 `req.ip` 做令牌桶限流；超限 → `429 { "error": "rate_limited", "retryAfterMs": <ms> }`。
2. 校验 `action`（enum：`move | speak | interact | attack | use`）与可选 `payload`（object）。
   失败 → `400 validation_failed`。
3. 查找世界内代理体 `soul_<:id>`；不存在 → `404 { "error": "soul_not_in_world", "soulId": "..." }`。
4. 做 RBAC 检查（`soul` 角色对 `entity` 的 `interact`）。
5. `speak` 动作对 `payload.text` 执行 `sanitizeString` 后写日志。
6. **预期成功响应**：

```json
{ "ok": true, "action": "speak", "soulId": "<id>", "tick": 120 }
```

### 3.6 GET /api/souls

代理 `SoulClient.listSouls()`：

```json
{ "souls": [ { "id": "soul_mock_vex", "name": "Vex", "element": "wind", "...": "..." } ],
  "source": "mock" }
```

`source`：`"soul-arena"`（真实后端）或 `"mock"`（SoulArena 不可达，使用内置 mock）。

---

## 4. WebSocket（`/ws`）

挂载在同一 HTTP server 的 `path: '/ws'`。消息为 JSON 文本帧，信封
`{ "type": "...", "payload": ..., "timestamp": <ms> }`。

| 方向 | type | 说明 |
|------|------|------|
| 服务端→客户端 | `hello` | 连接建立立即发送：`{ protocol: "seed-soul", version: "0.1.0" }` |
| 客户端→服务端 | 任意 | 服务端解析后回 ack |
| 服务端→客户端 | `ack` | `{ echo: "<收到的 type>" }` |
| 服务端→客户端 | `error` | 非法 JSON 时：`{ message: "invalid json" }` |

当前未按 `type` 分派业务（感知帧/订阅等），仅回显。

---

## 5. 错误响应约定

| HTTP | body |
|------|------|
| 400 | `{ "error": "validation_failed", "errors": [...] }` |
| 401 | `{ "error": "unauthorized", "message": "..." }`（SEED_AUTH 开启时） |
| 404 | `{ "error": "not_found" }` / `{ "error": "soul_not_in_world", "soulId": "..." }` |
| 429 | `{ "error": "rate_limited", "retryAfterMs": <ms> }` |
| 503 | `{ "error": "no_world" }` |

---

## 6. 快速调用示例

```bash
# 世界状态
curl http://localhost:3100/api/world/status

# 灵魂说话
curl -X POST http://localhost:3100/api/souls/eval_vex/action \
  -H 'content-type: application/json' \
  -d '{"action":"speak","payload":{"text":"hello world"}}'

# 灵魂名册
curl http://localhost:3100/api/souls
```

开启认证后需带请求头：`-H "X-API-Key: dev-seed-key"`。

---

## 7. 已知实现问题（与安全层的 API 不一致）

当前 `server.ts` 在调用安全层时，与这些类的**真实实现签名**存在不一致，是 `npm run build` 报错的主要来源
（具体行号与数量见 `docs/DEVLOG.md`）：

1. **`new RateLimiter(...)` 构造参数不匹配**：`RateLimiter` 构造函数要求一个 `RateLimitConfig`
   对象（`{ enabled, maxRequests, windowMs, perSoul, perIP, burstMultiplier }`），而 `server.ts` 中
   仍按「数字 QPS / 旧固定窗口」形态调用，类型不兼容。
2. **`InputValidator` 调用方式不匹配**：真实 API 是
   `validate(name, data)`（按已注册 schema 名校验）与 `validateInline(schema, data)`（内联 schema），
   返回 `ValidationResult { valid, errors }`。`server.ts` 中存在把 schema 当 `name` 字符串传入、
   以及读取 `result.ok` / `result.value` 的旧写法；真实结果上没有 `ok` / `value` 字段。
3. **`RateLimiter.check()` 返回值**：真实 `check(key)` 只返回 `{ allowed, remaining }`，**没有
   `retryAfterMs`**；需要带 `retryAfterMs` 应改用 `consume(key)`。`server.ts` 在 429 分支读取
   `rl.retryAfterMs` 对不上。
4. **`permissions.ensure(...)` 不存在**：新 `PermissionSystem` 提供的是 `hasPermission(entityId,
   resource, action)` 与 `checkPermission(entityId, resource, action)`，没有 `ensure(role,...)`。
   因此动作端点里的权限检查当前无法编译，RBAC 拦截实际未生效。
5. **`POST /api/entities` 是占位实现**：只校验不创建，真正建实体要走 SDK。

> 这些是「预期行为 vs 当前代码」的差距：本文档按端点**应当**如何工作来描述，修复方向见
> `docs/ROADMAP.md`。

---

## 8. 另一套服务端：`src/server/index.ts`（SeedServer）

`SeedServer` 类实现了更完整的 REST 表面（当前未被 `startServer` 使用，需自行接线）：

- `GET /api/health`、`GET /api/world`
- `GET /api/entities?limit&offset`、`GET/POST/DELETE /api/entities/:id`
- `GET /api/events`、`POST /api/events/trigger`
- `GET /api/souls`、`POST /api/souls/:id/join`、`POST /api/souls/:id/action`
- `GET /api/weather`、`GET /api/clock`、`GET /api/evaluation`、`POST /api/evaluation/run`
- `/ws` 支持 `subscribe` / `action` / `perception_request` → `subscribed` /
  `action_result` / `perception_frame`，以及 `broadcast(type, payload)`。

它通过 `WorldHandle` 接口与世界解耦，默认端口 `3001`，并自带 per-IP 限流与基于 `x-soul-token` 的
角色解析。两套服务端最终应合并为一套（见 ROADMAP）。
