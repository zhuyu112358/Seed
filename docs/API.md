# API.md — REST 端点与 WebSocket 协议

> 默认端口 **3100**（避免与 SoulArena 的 3000 冲突），可通过环境变量 `PORT` 覆盖。
> 认证：开发期 `SEED_AUTH=off`（默认）；生产设 `SEED_AUTH=on` 并在 `X-API-Key` 头校验 `SEED_API_KEYS`。

## 1. REST 端点

### GET /api/world/status
世界状态。
```json
{ "world": "test-world", "running": true, "tick": 180, "worldTime": 3.0, "entityCount": 7 }
```

### GET /api/entities
返回全部实体（toJSON 数组）。
```json
{ "entities": [ { "id": "...", "name": "crate", "type": "dynamic", "position": {"x":-3,"y":0.24,"z":0}, ... } ] }
```

### POST /api/entities
注册实体（v0.1.0 返回占位说明，实际创建走 SDK）。
请求体校验：`name`(string<=64, 必填), `x/y/z`(number, 必填)。

### GET /api/entities/:id
返回单个实体；不存在返回 404 `{error:"not_found"}`。

### POST /api/souls/:id/action
灵魂动作入口。
请求体：
```json
{ "action": "speak", "payload": { "text": "hello" } }
```
- `action` 枚举：`move | speak | interact | attack | use`
- 校验失败 400；限流 429；灵魂不在世界 404。
成功：`{ "ok": true, "action": "speak", "soulId": "...", "tick": 42 }`

### GET /api/souls
代理 SoulArena 灵魂列表。
```json
{ "souls": [ { "id": "soul_...", "name": "Vex", "element": "wind", ... } ], "source": "soul-arena" }
```
SoulArena 不可达时 `source` 为 `"mock"` 并返回内置 mock。

## 2. WebSocket 协议（/ws）

连接后服务端先发 hello：
```json
{ "type": "hello", "payload": { "protocol": "seed-soul", "version": "0.1.0" }, "timestamp": 1725... }
```

客户端消息统一格式：
```json
{ "type": "<type>", "payload": { ... }, "soulId": "..." }
```

服务端对每条消息回 ack：
```json
{ "type": "ack", "payload": { "echo": "<type>" }, "timestamp": ... }
```

完整消息类型见 [SOUL_INTERFACE.md](SOUL_INTERFACE.md)（enter/exit/perception/action/world-effect/soul-feedback）。

## 3. 错误格式

```json
{ "error": "validation_failed", "errors": ["\"action\" not in allowed set"] }
```
