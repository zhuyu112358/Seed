# 部署文档（DEPLOYMENT）

> 严格基于 `package.json`、`tsconfig.json`、`src/api/server.ts`、`src/reliability/Logger.ts`。
> 文档中文，代码注释英文。

---

## 1. 环境要求

- **Node.js**：ESM 项目（`"type": "module"`），目标 `ES2022`，建议 Node ≥ 18（使用了原生 `fetch`、`AbortSignal.timeout`）。
- **包管理器**：npm（仓库内含 `package-lock.json`）。
- **操作系统**：开发环境为 Windows / PowerShell；生产可跑在任意支持 Node 的 Linux 上。

运行时依赖：`express`、`ws`、`pino`（代码实际用自研 logger，pino 为预留依赖）。
开发依赖：`tsx`（直接跑 TS）、`typescript`、`@types/node`、`@types/express`、`@types/ws`。

---

## 2. 安装

```powershell
# Clone / enter project
cd D:\Seed

# Install dependencies
npm install
```

---

## 3. 脚本（`package.json`）

| 命令 | 作用 |
|------|------|
| `npm run build` | `tsc -p tsconfig.json`，输出到 `dist/`（**当前失败，见已知问题**） |
| `npm start` | 运行编译产物 `node dist/api/server.js` |
| `npm run dev` | `tsx src/api/server.ts`，开发模式直跑 TS |
| `npm test` | `tsx --test tests/**/*.test.ts` |
| `npm run eval` | `tsx src/evaluator/runEval.ts`，跑评估并写报告 |
| `npm run evaluate` | `tsx src/evaluator/runEvaluation.ts`（**文件缺失**，见已知问题） |
| `npm run test-world` | `tsx examples/test-world/index.ts` 演示世界 |

> `tsconfig.json`：`module/moduleResolution = NodeNext`，`strict`，`rootDir = "."`，`outDir = "dist"`，`include = ["src/**/*.ts", "examples/**/*.ts"]`，排除 `tests/` 与 `dist/`。

---

## 4. 配置（环境变量）

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3100` | HTTP + WebSocket 端口 |
| `SEED_AUTH` | 关 | `on` 时开启 `X-API-Key` 鉴权 |
| `SEED_API_KEYS` | `dev-seed-key` | 允许的 API Key，逗号分隔 |
| `SOUL_URL` | `http://localhost:3000` | SoulArena 地址（`SoulClient` / `SoulBridge`） |
| `SEED_LOG_LEVEL` | `info` | 日志级别：`debug/info/warn/error/fatal` |

PowerShell 下设置：

```powershell
$env:PORT = "3100"
$env:SEED_AUTH = "on"
$env:SEED_API_KEYS = "prod-key-1,prod-key-2"
$env:SOUL_URL = "http://soul-arena.internal:3000"
$env:SEED_LOG_LEVEL = "info"
```

---

## 5. 运行

### 5.1 开发模式（推荐，免编译）

```powershell
npm run dev
# -> Seed API listening on :3100
```

### 5.2 生产模式（先编译）

```powershell
npm run build   # NOTE: currently failing, see DEVLOG
npm start
```

### 5.3 演示世界 / 评估

```powershell
npm run test-world   # headless physics demo
npm run eval         # writes logs/eval-<timestamp>.json
```

---

## 6. 目录与持久化

- `logs/`：运行日志（`seed.log`）与评估报告（`eval-<ts>.json`）。由 `Logger` / `WorldEvaluator` 自动创建。
- `snapshots/`：世界快照 JSON，由 `SnapshotManager` 写入，自动只保留最新 N 份。
- `dist/`：`tsc` 编译产物。

这些目录均已 git 忽略，运行时自动创建。

---

## 7. 与 SoulArena 联调

1. 先启动 SoulArena（默认 `http://localhost:3000`）。
2. 启动 Seed（`npm run dev`）。
3. `GET /api/souls` 应返回 `"source": "soul-arena"`；若 SoulArena 未启动则自动回退 mock（`"source": "mock"`）。
4. WebSocket 客户端连接 `ws://<host>:3100/ws` 接收握手帧。

---

## 8. 生产部署建议

- **鉴权**：务必设置 `SEED_AUTH=on` 并配置强随机 `SEED_API_KEYS`。
- **进程管理**：用 `pm2` / `systemd` / Docker 托管 `node dist/api/server.js`，崩溃自动重启；`ExceptionHandler` 会在未捕获异常时尝试紧急快照（可选 `setExitOnFatal(true)` 让其退出以便进程管理器拉起）。
- **端口**：默认 3100，置于反向代理之后；WebSocket `/ws` 需要转发 Upgrade 头。
- **日志**：把 `logs/seed.log` 接入日志收集；`SEED_LOG_LEVEL` 生产建议 `info` 或 `warn`。
- **快照**：定期备份 `snapshots/`。

---

## 9. 已知问题 / 限制

1. **`npm run build` 当前失败**：约 14 个 TypeScript 错误（示例、`server.ts`、`evaluator/index.ts`），见 `build_errors.txt` 与 `DEVLOG.md`。生产模式 `npm start` 暂不可用，建议先用 `npm run dev`（tsx）。
2. **`npm run evaluate` 指向不存在的 `src/evaluator/runEvaluation.ts`**，执行会报错；可用的评估入口是 `npm run eval`。
3. **演示世界** `examples/test-world/index.ts` 按 `new WorldEngine({name, tickRate})` 构造，但真实构造函数还需要 `bounds` 与 `physics`，运行时会报错，见 `DEVLOG.md`。
4. **`server.ts` 与 `WorldEngine` 未接通**，REST 端点在接入完成前为降级行为。
5. 尚无 Dockerfile / CI 配置，容器化与流水线待补（见 `ROADMAP.md`）。
