# 安全文档（SECURITY）

> 本文件为新建文档。严格基于 `src/security/` 真实源码：
> `InputValidator.ts`、`PermissionSystem.ts`、`RateLimiter.ts`、`ApiKeyAuth.ts`、`sanitize.ts`。
> 文档中文，代码注释英文。

---

## 1. 概述

Seed 的安全层由五部分组成，均为零依赖、可独立使用的小模块：

| 模块 | 文件 | 职责 |
|------|------|------|
| 输入校验 | `InputValidator` | 按字段规则校验入参对象 |
| 访问控制 | `PermissionSystem` | 基于角色的简单 RBAC |
| 限流 | `RateLimiter` | 按客户端固定窗口限流 |
| API Key | `apiKeyAuth()` | Express 中间件，校验 `X-API-Key` |
| 文本清洗 | `sanitizeString` / `looksInjective` | 自由文本二次清洗与注入检测 |

这些模块在 `api/server.ts` 中被组装到 HTTP 入口。

---

## 2. 输入校验 `InputValidator`（`src/security/InputValidator.ts`）

> **与早期设想不同**：当前实现**没有** `registerSchema` / `validate(name, data)` / `validateInline` / `sanitize` / `getRegisteredSchemas`，也**没有内置 schema**。使用时每次直接传 schema。

```ts
class InputValidator {
  constructor(); // no arguments
  validate(schema: Schema, input: unknown): ValidationResult;
}

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';
interface FieldRule {
  type: FieldType;
  required?: boolean;
  min?: number;      // string length or numeric lower bound
  max?: number;      // string length or numeric upper bound
  enum?: Array<string | number | boolean>;
  pattern?: RegExp;
}
type Schema = Record<string, FieldRule>;
interface ValidationResult {
  ok: boolean;
  errors: string[];
  value: Record<string, unknown>;
}
```

校验规则：非对象/数组/null 直接失败；缺失必填字段报错；按 `type` 做类型检查；`string` 额外查长度/pattern；`number` 额外查上下界；`enum` 查枚举；通过的字段进入 `value`。

示例（与 `server.ts` 中实体创建一致）：

```ts
import { InputValidator } from './security/InputValidator.js';

const v = new InputValidator();
const result = v.validate(
  {
    name: { type: 'string', required: true, max: 64 },
    x: { type: 'number', required: true },
    y: { type: 'number', required: true },
    z: { type: 'number', required: true },
  },
  req.body,
);
if (!result.ok) {
  // handle result.errors
}
```

---

## 3. 访问控制 `PermissionSystem`（`src/security/PermissionSystem.ts`）

> **与早期设想不同**：当前是规则数组 + 通配匹配，**没有** `defineRole/assignRole/hasPermission/checkPermission/addPermissionToRole`。

```ts
interface PermissionRule { role: Role; resource: string; action: string; }
type Role = 'admin' | 'moderator' | 'soul' | 'observer' | 'anonymous';

class PermissionSystem {
  constructor();
  grant(rule: PermissionRule): void;
  isAllowed(role: Role, resource: string, action: string): boolean;
  ensure(role: Role, resource: string, action: string): void; // throws if denied
}
```

匹配规则：规则满足 `role` 相同，且 `resource` 为 `*` 或等于请求资源，且 `action` 为 `*` 或等于请求动作。

**构造时内置的默认授权**：

| 角色 | resource | action |
|------|----------|--------|
| `admin` | `*` | `*` |
| `observer` | `*` | `read` |
| `soul` | `entity` | `read` |
| `soul` | `entity` | `interact` |
| `soul` | `soul` | `self-action` |

示例：

```ts
import { PermissionSystem } from './security/PermissionSystem.js';

const perms = new PermissionSystem();
perms.grant({ role: 'moderator', resource: 'entity', action: 'delete' });

perms.isAllowed('soul', 'entity', 'interact'); // true
perms.ensure('soul', 'entity', 'interact');    // ok
perms.ensure('anonymous', 'entity', 'interact'); // throws "permission denied"
```

> 角色集合来自 `types/index.ts`：`admin/moderator/soul/observer/anonymous`。当前默认只授权了其中 admin/observer/soul 三者；`moderator`/`anonymous` 需自行 `grant`。

---

## 4. 限流 `RateLimiter`（`src/security/RateLimiter.ts`）

> **与早期设想不同**：构造为 `(qps, windowMs)`，方法为 `check(clientId, now?)` / `reset()`，**没有** `consume/resetAll/getStats`。但 `check` 返回值**确实包含** `retryAfterMs`。

```ts
interface RateLimitResult { allowed: boolean; remaining: number; retryAfterMs: number; }

class RateLimiter {
  constructor(qps: number, windowMs?: number); // default windowMs = 1000
  check(clientId: string, now?: number): RateLimitResult;
  reset(): void; // clear all windows
}
```

语义：固定窗口，每个 `clientId` 在 `windowMs` 内最多 `qps` 次；超限返回 `allowed=false` 与剩余窗口 `retryAfterMs`。

`server.ts` 中按 `req.ip` 使用：

```ts
import { RateLimiter } from './security/RateLimiter.js';

const limiter = new RateLimiter(100); // 100 requests / second / ip
const rl = limiter.check(req.ip ?? 'anonymous');
if (!rl.allowed) {
  // respond 429 with rl.retryAfterMs
}
```

---

## 5. API Key 中间件 `apiKeyAuth`（`src/security/ApiKeyAuth.ts`）

```ts
interface ApiKeyAuthOptions {
  enabled: boolean;          // false => allow all (dev mode)
  validKeys: string[];
}
function apiKeyAuth(opts: ApiKeyAuthOptions):
  (req: Request, res: Response, next: NextFunction) => void;
```

- 开启时校验请求头 `x-api-key` 是否在 `validKeys` 中；缺失/不匹配返回 `401 { error: 'unauthorized', ... }`。
- `server.ts` 的接线：`enabled = process.env.SEED_AUTH === 'on'`，`validKeys = (process.env.SEED_API_KEYS ?? 'dev-seed-key').split(',')`。

```ts
import { apiKeyAuth } from './security/ApiKeyAuth.js';

app.use(apiKeyAuth({
  enabled: process.env.SEED_AUTH === 'on',
  validKeys: (process.env.SEED_API_KEYS ?? 'dev-seed-key').split(','),
}));
```

---

## 6. 文本清洗 `sanitize`（`src/security/sanitize.ts`）

```ts
// Strip control chars + HTML-escape < > & " ', cap length.
function sanitizeString(input: string, maxLen?: number): string; // maxLen default 500

// Heuristic: reject strings that look like shell / SQL / HTML injection.
function looksInjective(input: string): boolean;
```

- `sanitizeString`：移除 `\u0000-\u001F` / `\u007F` 控制字符，把 `< > & " '` 转义为 `\uXXXX`，超长截断。用于灵魂发言、聊天、对象名等自由文本（`server.ts` 的 `speak` 动作即调用它）。
- `looksInjective`：命中 `<script`、`DROP TABLE`、`rm -rf`、`${...}`、反引号等模式即判为疑似注入。

> 这是第二道防线；第一道是 `InputValidator` 的 pattern/枚举白名单。

---

## 7. 在 API 中的实际装配（`server.ts`）

一个请求穿过的安全链路：

```
HTTP request
  → express.json({ limit: '256kb' })      // body 体积上限
  → apiKeyAuth(...)                        // X-API-Key（仅 SEED_AUTH=on）
  → RateLimiter.check(clientId)            // 固定窗口限流
  → InputValidator.validate(schema, body)  // 字段级校验
  → PermissionSystem.ensure(role, ...)     // RBAC
  → sanitizeString(...)                    // 自由文本清洗（speak）
```

---

## 8. 安全建议与已知限制

1. **生产务必开启鉴权**：`SEED_AUTH=on` 并配置强随机 `SEED_API_KEYS`；当前默认 key `dev-seed-key` 仅限本地。
2. **限流粒度**：当前按 `req.ip` 固定窗口，未按灵魂 id 区分；反代后需正确透传 `X-Forwarded-For` 否则所有请求会被算成同一 IP。
3. **RBAC 较粗**：`PermissionSystem` 仅支持 `(role, resource, action)` 三元组通配，无数据级/条件级权限；`moderator`/`anonymous` 角色无默认授权。
4. **`InputValidator` 无内置 schema**：常用 schema（ActionRequest、PerceptionFrameConfig 等）需调用方自行定义，建议后续内置。
5. **`looksInjective` 是启发式**：仅作辅助，不能替代参数化/白名单；当前无数据库，SQL 注入风险暂不适用，但未来接入存储时需复查。
6. **输入校验与桥接不兼容**：`SoulBridge` 期望 `validateInline(schema, data)`，而 `InputValidator` 是 `validate(schema, input)`，需要适配层（见 `DEVLOG.md` K10）。
7. **无 CORS / CSRF / Helmet 配置**：当前未装配，浏览器直接接入时需补充。
8. **WebSocket `/ws` 无鉴权**：当前握手后任意客户端可发消息，需在生产前加 token 校验。
