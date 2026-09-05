# 安全文档（SECURITY）

> 基于 `src/security/` 下的真实实现编写：`ApiKeyAuth.ts`、`InputValidator.ts`、`RateLimiter.ts`、
> `PermissionSystem.ts`、`sanitize.ts`，以及 `src/reliability/Logger.ts` 的审计日志。

---

## 1. 威胁模型

Seed 暴露 HTTP + WebSocket 服务，外部（灵魂/客户端）可以读取世界、提交实体创建、提交灵魂动作。
主要威胁：

| 威胁 | 缓解层 |
|------|--------|
| 未授权访问 API | ApiKeyAuth（API Key） |
| 恶意/畸形请求体 | InputValidator（schema 校验） |
| 暴力刷接口 / DoS | RateLimiter（令牌桶） |
| 越权操作（灵魂改世界） | PermissionSystem（RBAC） |
| 注入（XSS / 命令 / 模板注入） | sanitize（sanitizeString / looksInjective） |
| 故障后的取证与恢复 | Logger（结构化 JSON）+ ExceptionHandler 紧急快照 |

安全是**纵深**的：认证 → 限流 → 校验 → 授权 → 输出清洗，逐层兜底。

---

## 2. 认证授权（ApiKeyAuth）

来源：`src/security/ApiKeyAuth.ts`。

```ts
apiKeyAuth({ enabled: boolean; validKeys: string[] })  // Express 中间件工厂
```

- 请求头：`X-API-Key`（Express 不区分大小写，代码读 `req.header('x-api-key')`）。
- `enabled=false` 时直接 `next()`（开发模式全放行）。
- `enabled=true` 时：缺 key 或 key 不在 `validKeys` 中 → `401 { "error": "unauthorized",
  "message": "missing or invalid X-API-Key" }`。
- 在 `server.ts` 中由环境变量驱动：
  - `enabled = process.env.SEED_AUTH === 'on'`
  - `validKeys = (process.env.SEED_API_KEYS ?? 'dev-seed-key').split(',')`

> 生产务必 `SEED_AUTH=on` 并配置强 `SEED_API_KEYS`；默认 `dev-seed-key` 仅供本地开发。

---

## 3. 输入验证（InputValidator）

来源：`src/security/InputValidator.ts`，基于 **Ajv**（`new Ajv({ allErrors: true, strict: false })`）。

### 3.1 API

```ts
class InputValidator {
  constructor(logger?);
  registerSchema(name: string, schema: ValidationSchema): void;
  validate(name: string, data: unknown): ValidationResult;        // 按已注册 schema 名校验
  validateInline(schema: ValidationSchema, data: unknown): ValidationResult; // 内联 schema
  sanitize(input: unknown, maxLen?): { clean: unknown; injected: boolean };
  getRegisteredSchemas(): string[];
}

interface ValidationResult { valid: boolean; errors: { field: string; message: string }[] }
```

`ValidationSchema`（`types/index.ts`）：`{ type, required?, properties?, min?, max?, pattern?,
enum?, items? }`；内部会把 `min/max` 转成 Ajv 的 `minimum/maximum`。

### 3.2 5 个内置 schema（构造时自动注册）

| schema 名 | 必填 | 要点 |
|-----------|------|------|
| `ActionRequest` | `action`, `soulId` | `action` enum：`move/interact/communicate/observe`；`soulId/targetId` 匹配 `^[A-Za-z0-9_-]{1,64}$` |
| `PerceptionFrameConfig` | `distance` | `distance` 0–5000，`fov` 0–360，`includeSounds/includeVisuals` 布尔 |
| `EntityConfig` | `type` | `type` 匹配 `^[A-Za-z0-9_-]{1,32}$`，`name` ≤64 |
| `CommunicationMessage` | `from`, `body` | `from` 匹配 id 正则，`body` ≤1000，`channel` ≤64 |
| `WorldEventTrigger` | `eventType` | `eventType` 匹配 `^[a-z_]{2,32}$` |

### 3.3 与 server.ts 的对接现状

> **已知不一致**（见 DEVLOG）：`server.ts` 仍按旧写法调用安全层——把 schema 对象当 `validate` 的
> `name` 字符串传入、读取 `result.ok/result.value`。正确用法是
> `validator.validateInline(schema, body)` 并判断 `result.valid`。修复前 REST 校验不生效。

---

## 4. 速率限制（RateLimiter）

来源：`src/security/RateLimiter.ts`，**令牌桶**算法。

### 4.1 配置（RateLimitConfig，types/index.ts）

```ts
interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;       // 窗口内预算
  windowMs: number;          // 窗口
  perSoul: boolean;          // 按灵魂分桶
  perIP: boolean;            // 按 IP 分桶
  burstMultiplier: number;   // 突发容量 = max(maxRequests, burstMultiplier*maxRequests)
}
```

### 4.2 API

```ts
new RateLimiter(config: RateLimitConfig, logger?);
consume(key, tokens=1): { allowed; remaining; retryAfterMs };  // 扣令牌，拒绝时给 retryAfterMs
check(key): { allowed; remaining };                            // 只看不扣（无 retryAfterMs）
reset(key): void;  resetAll(): void;
getStats(): { totalRequests; allowed; rejected; activeKeys; topKeys };
```

桶按 `windowMs * 5` 闲置期自动清理（`reapStale`）；`!enabled` 时直接放行。

> **已知不一致**：需要带 `retryAfterMs` 的限流响应应使用 `consume()`；`check()` 不返回
> `retryAfterMs`。`server.ts` 当前 429 分支与构造参数仍在迁移中。

---

## 5. RBAC 权限（PermissionSystem）

来源：`src/security/PermissionSystem.ts`。

### 5.1 5 个默认角色

| 角色 | 默认权限 |
|------|----------|
| `admin` | `*:*`（全部资源全部动作） |
| `moderator` | `entity.*` 的 read/update/delete，`event.*` 的 execute |
| `soul` | `world.*:read`、`entity.*:read`、`entity.own:update`、`action.*:execute`、`communication.*:execute` |
| `observer` | `*:read` |
| `anonymous` | `world.public:read` |

### 5.2 API

```ts
new PermissionSystem(logger?);
defineRole(role, permissions: Permission[]): void;
assignRole(entityId, role): void;  removeRole(entityId): void;  getRole(entityId): Role | null;
hasPermission(entityId, resource, action): boolean;          // 带缓存
checkPermission(entityId, resource, action): { allowed; reason? };
addPermissionToRole(role, permission): void;
removePermissionFromRole(role, resource, action): void;
```

资源匹配支持 `*` 通配与 `prefix.*` 前缀（如 `entity.*` 匹配 `entity.own`）。未分配角色的实体按
`anonymous` 处理。

> **已知类型不一致**：`types/index.ts` 的 `Role` 联合类型目前只有 `'admin'|'soul'|'observer'`，
> 缺少 `moderator` / `anonymous`，导致 PermissionSystem 有 3 个编译错误。修复方向是把 `Role`
> 扩展为五角色。
>
> 另外旧文档假设的 `permissions.ensure(role, resource, action)` 在新实现中**不存在**，应使用
> `hasPermission` / `checkPermission`。

---

## 6. 审计日志（Logger）

来源：`src/reliability/Logger.ts`。

- 零依赖结构化 **JSON** 日志：`{ time, level, module, message, ...meta }`。
- `Logger.for(module)` 子 logger，支持 `(message, meta?)` 与 `(bindings, message)` 两种重载。
- 同时输出到控制台与 `logs/seed.log`；级别由 `SEED_LOG_LEVEL`（默认 `info`）控制。
- 日志写入失败被静默吞掉，不会拖垮模拟——这是有意的「日志绝不影响仿真」。
- 灵魂动作（如 `speak`）会被记录，作为审计线索。

---

## 7. 输入清洗（sanitize）

来源：`src/security/sanitize.ts`。

- **`sanitizeString(input, maxLen=500)`**：删除控制字符（`\u0000-\u001F\u007F`），把 `< > & " '`
  转义为 `\u00xx`，超长截断。用于自由文本（灵魂说话、聊天、物体名）。
- **`looksInjective(input)`**：识别 `<script>`、`DROP TABLE`、`; rm -rf`、模板插值 `${...}`、
  反引号命令 `` `...` `` 等注入特征。
- `InputValidator.sanitize()` 会同时调用二者，返回 `{ clean, injected }`。

---

## 8. 当前安全状态总结

| 控制项 | 状态 |
|--------|------|
| API Key 认证 | 已实现，`SEED_AUTH` 开关 |
| 输入校验（Ajv） | 已实现 5 个 schema；与 server.ts 调用尚未对齐 |
| 令牌桶限流 | 已实现；server.ts 仍在迁移到配置对象/consume |
| RBAC | 已实现 5 角色；`Role` 类型需扩展 |
| 输出清洗 | 已实现 |
| 审计日志 | 已实现结构化 JSON |
| 紧急快照 | `ExceptionHandler` 已实现 |

> 因编译未通过，上述控制层在 `server.ts` 中的接线尚未全部生效；对齐计划见 `docs/ROADMAP.md`。
