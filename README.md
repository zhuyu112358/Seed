# Seed System（种子系统）

> 版本：v0.1.0 · 底层世界引擎 · 与 SoulArena（灵魂系统）对接

Seed System 是一个虚拟物理世界引擎，灵感来自《刀剑神域》的「种子系统（Seed）」世界观：它本身不规定某一个具体世界，而是提供一个可配置的底层世界容器——在它之上可以构建不同的世界（森林、地下城、竞技场……）。当前它与已运行的灵魂系统 SoulArena（Node.js，`localhost:3000`）对接，让灵魂（soul）可以进入世界、感知环境、执行动作、承受世界反馈。

## 状态徽章

- 构建：`npm run build`（tsc 严格模式，零错误）
- 测试：25 个单元测试全部通过
- 评估：`npm run eval` 输出 JSON 报告
- 灵魂连通：v0.1.0 可从 `localhost:3000/api/souls` 拉取真实灵魂（Vex / Nova），拉取失败自动回退内置 mock

## 快速开始

```powershell
# 安装依赖（仅需一次）
npm install

# 编译 TypeScript
npm run build

# 跑单元测试
npm test

# 跑一次性能/功能评估，输出 logs/eval-<时间戳>.json
npm run eval

# 跑内置 2D 测试世界（物理 + 碰撞 + 声学通信 + 评估）
npm run test-world

# 启动 HTTP + WebSocket API（默认端口 3100）
npm run dev
```

## 目录结构

```
D:\Seed
├── src/
│   ├── engine/        World 容器 + WorldEngine 主循环
│   ├── entity/        Entity / GameObject / EntityFactory / Vector3
│   ├── physics/       PhysicsConfig / IPhysicsBackend / SimplePhysics2D / PhysicsSystem
│   ├── event/         Event 总线 / ConditionEngine / EventPropagation
│   ├── communication/  AcousticPropagation / NetworkPacket / WorldResonance / Message
│   ├── reliability/   Logger / SnapshotManager / ExceptionHandler / Transaction
│   ├── security/      InputValidator / PermissionSystem / RateLimiter / ApiKeyAuth / sanitize
│   ├── sdk/           WorldBuilder（链式建世界）
│   ├── evaluator/     WorldEvaluator + runEval 入口
│   ├── api/           Express REST + ws WebSocket + SoulClient
│   ├── types/         全局类型
│   └── utils/
├── tests/             node:test 单元测试（25 个用例）
├── examples/test-world/  内置演示世界
├── docs/              9 份中文文档
├── logs/              运行日志与评估报告（git 忽略）
└── snapshots/         世界快照（git 忽略）
```

## 与灵魂系统的关系

- **SoulArena** 负责灵魂本身：人格、情绪、价值系统、记忆。
- **Seed System** 负责世界：物理、事件、通信、空间、灵魂在世界中的化身（soul-proxy）。
- 两者通过 REST + WebSocket 解耦，协议见 [`docs/SOUL_INTERFACE.md`](docs/SOUL_INTERFACE.md)。
- Seed 启动时可主动拉取灵魂列表；测试世界中把 Vex / Nova 作为灵魂代理实体放进世界。

## 文档索引

| 文档 | 内容 |
|------|------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 整体架构、tick 循环、数据流、扩展点 |
| [API.md](docs/API.md) | REST 端点 + WebSocket 协议 |
| [SDK.md](docs/SDK.md) | WorldBuilder / EntityFactory / PhysicsConfig 用法 |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | 环境、安装、运行、部署 |
| [DEVLOG.md](docs/DEVLOG.md) | 本次迭代记录与决策 |
| [ROADMAP.md](docs/ROADMAP.md) | backlog 与未来方向 |
| [REFERENCES.md](docs/REFERENCES.md) | 架构调研（Minecraft / Valheim / Second Life / OpenSimulator） |
| [SOUL_INTERFACE.md](docs/SOUL_INTERFACE.md) | **灵魂-世界交互协议（最重要）** |

## 设计原则

- 引擎与具体世界分离：`World` 是可配置容器，具体世界由 SDK 的 `WorldBuilder` 构建。
- 严格 TypeScript；代码注释一律英文，文档一律中文。
- 子系统可插拔：物理后端 `IPhysicsBackend`、通信 `CommunicationStrategy` 均可替换。
