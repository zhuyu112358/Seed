# DEPLOYMENT.md — 部署指南

## 1. 环境要求

- Windows（当前开发机）/ Linux / macOS 均可
- Node.js >= 18（开发机为 v22）
- npm >= 9
- SoulArena 运行在 `http://localhost:3000`（可选；不可达时自动回退 mock）

## 2. 安装

```powershell
cd D:\Seed
npm install
```

## 3. 配置（环境变量）

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | 3100 | Seed API 端口 |
| `SOUL_URL` | http://localhost:3000 | SoulArena 地址 |
| `SEED_AUTH` | off | on 时启用 API Key 校验 |
| `SEED_API_KEYS` | dev-seed-key | 允许的 API Key，逗号分隔 |
| `SEED_LOG_LEVEL` | info | debug/info/warn/error/fatal |

## 4. 运行

```powershell
npm run build      # tsc -> dist/
npm run dev       # tsx 直接跑（开发）
npm start         # 跑编译产物
npm test          # 单元测试
npm run eval      # 评估一次，输出 logs/eval-*.json
npm run test-world # 内置演示世界
```

## 5. 单机部署

1. `npm run build`
2. 用 `node dist/api/server.js` 启动（配合 pm2 / nssm 守护）
3. 反向代理到 3100；WebSocket `/ws` 需要升级头

## 6. 分布式预留（未实现）

- 当前为单进程。未来：
  - 用 `NetworkPacket` 骨架替换为真实节点间路由
  - 世界按空间分片（octree / 区域），每片一个进程
  - 灵魂代理跨片迁移
- 详见 ROADMAP.md。
