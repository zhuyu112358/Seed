# Seed 安全文档

> 版本：v0.1.0 | 最后更新：2026-09-05

## 1. 威胁模型

### 1.1 攻击面

| 攻击面 | 风险 | 防护措施 |
|--------|------|----------|
| REST API | 未授权访问、注入、越权 | API Key 认证、输入验证、RBAC 权限 |
| WebSocket | 未授权连接、消息注入、洪水攻击 | 认证、输入验证、速率限制 |
| 灵魂动作 | 恶意动作、越权交互、状态篡改 | 动作验证、权限检查、实体隔离 |
| 世界状态 | 快照篡改、回滚攻击 | 快照校验、事务隔离 |
| 通信内容 | 消息注入、伪造身份 | 消息验证、发送者认证 |

### 1.2 信任边界

```
SoulArena (信任) ←→ Seed API (半信任) ←→ 外部客户端 (不信任)
     │                      │
     └── 灵魂动作 ──────────┘
         (经 InputValidator + PermissionSystem + RateLimiter)
```

## 2. 认证（ApiKeyAuth）

### 2.1 启用

```bash
# 启用认证
export SEED_AUTH=on
export SEED_API_KEYS=key1,key2,key3
```

### 2.2 使用

```bash
# REST API
curl -H "X-API-Key: your-key" http://localhost:3100/api/world/status

# WebSocket（在连接时通过查询参数或首条消息传递）
wscat -c "ws://localhost:3100/ws?apiKey=your-key"
```

### 2.3 实现

- 中间件：`apiKeyAuth({ enabled, validKeys })`
- 未认证请求返回 `401 Unauthorized`
- 多密钥支持，逗号分隔
- 默认密钥 `dev-seed-key`（仅开发用，生产必须替换）

## 3. 输入验证（InputValidator）

### 3.1 Schema 验证

所有外部输入必须通过 schema 验证：

```typescript
const validator = new InputValidator();

const result = validator.validate(
  {
    name: { type: 'string', required: true, max: 64 },
    x: { type: 'number', required: true },
    action: { type: 'string', required: true, enum: ['move', 'speak', 'interact', 'attack', 'use'] },
  },
  req.body
);

if (!result.ok) {
  return res.status(400).json({ error: 'validation_failed', errors: result.errors });
}
```

### 3.2 验证规则

| 规则 | 说明 |
|------|------|
| `type` | 类型检查：string, number, boolean, object, array |
| `required` | 必填检查 |
| `min` / `max` | 数值范围或字符串长度 |
| `enum` | 枚举值检查 |
| `pattern` | 正则匹配 |
| `properties` | 嵌套对象验证 |
| `items` | 数组元素验证 |

### 3.3 字符串净化（sanitize）

- `sanitizeString(input)`：去除危险字符，防止注入
- 所有灵魂说话内容自动经过 sanitize
- 防止 XSS、SQL 注入、命令注入

## 4. 权限系统（PermissionSystem）

### 4.1 角色

| 角色 | 权限 |
|------|------|
| `admin` | 全部权限：世界管理、实体管理、灵魂管理、系统配置 |
| `soul` | 有限权限：执行自身动作、感知世界、与实体交互 |
| `observer` | 只读权限：查询世界状态、实体列表、灵魂列表 |

### 4.2 权限检查

```typescript
const permissions = new PermissionSystem();

// 检查权限
permissions.ensure('soul', 'entity', 'interact');

// 权限表结构：resource × action × role
// {
//   entity: {
//     create: ['admin'],
//     read: ['admin', 'soul', 'observer'],
//     update: ['admin'],
//     delete: ['admin'],
//     interact: ['admin', 'soul'],
//   },
//   world: {
//     start: ['admin'],
//     stop: ['admin'],
//     status: ['admin', 'soul', 'observer'],
//   },
//   soul: {
//     action: ['admin', 'soul'],
//     list: ['admin', 'soul', 'observer'],
//   }
// }
```

### 4.3 资源级权限

- 每个资源类型有独立的权限表
- 支持条件权限（`condition` 字段）
- 权限不足抛出异常，API 层捕获返回 403

## 5. 速率限制（RateLimiter）

### 5.1 算法

令牌桶（Token Bucket）算法：
- 桶容量：最大突发请求数
- 填充速率：每秒填充的令牌数
- 每个请求消耗 1 个令牌
- 令牌耗尽时拒绝请求

### 5.2 配置

```typescript
const limiter = new RateLimiter(100);  // 每分钟 100 次

interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;      // 窗口内最大请求数
  windowMs: number;         // 时间窗口（毫秒）
  perSoul: boolean;         // 按灵魂 ID 限流
  perIP: boolean;           // 按 IP 限流
  burstMultiplier: number;  // 突发倍数
}
```

### 5.3 使用

```typescript
const clientId = req.ip ?? 'anonymous';
const rl = limiter.check(clientId);

if (!rl.allowed) {
  return res.status(429).json({
    error: 'rate_limited',
    retryAfterMs: rl.retryAfterMs,
  });
}
```

### 5.4 限流维度

- **按 IP**：默认维度，防止单 IP 洪水攻击
- **按灵魂 ID**：防止单灵魂滥用动作接口
- **全局**：保护服务器整体负载

## 6. 异常隔离（ExceptionHandler）

### 6.1 全局异常捕获

- API 层：express 错误处理中间件
- 引擎层：每个子系统 try/catch 隔离
- 通信策略：单个策略错误不影响世界运行
- 事件监听：单个监听器错误不影响其他监听器

### 6.2 故障实体隔离

- 实体更新异常时标记为 `active: false`
- 记录错误日志，包含实体 ID 和错误详情
- 不影响其他实体的正常更新
- 管理员可通过 API 查询故障实体

### 6.3 降级策略

- 物理系统故障：关闭碰撞检测，保留位置更新
- 事件系统故障：停止事件触发，保留世界运行
- 通信策略故障：移除故障策略，使用剩余策略
- 快照系统故障：暂停快照，不影响主循环

## 7. 数据安全

### 7.1 快照完整性

- 快照包含 `schema` 和 `version` 字段
- 加载时验证 schema 版本兼容性
- 保留多个快照版本，可回滚到任意时间点

### 7.2 事务隔离

- 世界状态修改通过 Transaction 进行
- Undo log 记录修改前状态
- 支持回滚到 checkpoint
- 事务失败时自动 rollback

### 7.3 日志安全

- 结构化日志，不记录敏感信息（API Key、密码）
- 日志文件权限控制
- 日志轮转防止磁盘占满

## 8. 安全更新流程

1. 发现安全漏洞 → 记录到 issue
2. 评估严重程度（critical / high / medium / low）
3. 开发修复 → 编写回归测试
4. 代码审查 → 合并到 main
5. 发布安全更新 → DEVLOG 记录
6. 通知用户（如适用）

## 9. 安全检查清单

部署前检查：

- [ ] `SEED_AUTH=on` 已启用
- [ ] `SEED_API_KEYS` 已替换为强密钥
- [ ] 默认密钥 `dev-seed-key` 已移除
- [ ] 速率限制已配置
- [ ] 权限系统已配置角色
- [ ] 输入验证覆盖所有 API 端点
- [ ] 日志不包含敏感信息
- [ ] 快照目录权限已设置
- [ ] 防火墙已限制端口访问
- [ ] HTTPS 已配置（生产环境）
