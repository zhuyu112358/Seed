# DEVLOG.md — 开发日志

## 2026-09-05 · v0.1.0 首次迭代

### 做了什么
- 在 D:\Seed 从零搭建种子系统 v0.1.0：引擎、实体、物理、事件、通信、可靠性、安全、SDK、评估、API、测试世界、25 个单元测试、9 份中文文档。
- 与 SoulArena（localhost:3000）连通：成功拉取真实灵魂列表（Vex=wind、Nova=fire 等 24 个）。
- 测试世界运行 180 tick：物体受重力下落、562 次碰撞、4 次区域触发、Vex 经 AcousticPropagation 说话按距离衰减（Nova 在 5m 处接收强度 0.633）。

### 遇到的问题与决策
1. **D:\Seed 已存在旧版残留**：开工时发现 D:\Seed 并非空目录，而是上一次未完成尝试的另一套架构（commonjs/jest/winston，实体放在 src/engine/）。决策：按 Organizer 指定的新架构（ESM/NodeNext/tsx，实体在 src/entity/）重建；旧文件（src/engine/EntitySystem.ts、src/infra/、src/systems/、jest.config.js 等）逐一删除。
2. **文件被还原**：部分"旧项目也存在"的文件路径会在回合间隙被回灌成旧版。决策：改用 PowerShell Set-Content（Bash 层）写入，写后立即同命令编译，避免间隙。
3. **Logger 依赖 pino**：pino 在 NodeNext 下模块解析异常，改为零依赖自实现结构化 JSON 日志（console + 文件 append，支持 pino 风格重载调用）。
4. **日志/快照路径**：最初用 `../../../logs` 从 src/reliability 解析会落到 D:\，改为 `process.cwd()` 相对项目根。
5. **PhysicsSystem 签名对齐**：WorldSystem.tick 为 (dt, world, events)，PhysicsSystem 从 world.bodies() 取刚体。

### 质量门禁
- `npm run build`：tsc 严格模式，零错误。
- `npm test`：25/25 通过。
- `npm run eval`：输出 logs/eval-*.json。
- `npm run test-world`：物理/碰撞/通信/评估全部跑通。

### 未完成项
见 ROADMAP.md：WebSocket 双向帧、perception LOD、world-effect 回写、NetworkPacket/Resonance 真实化、空间分区、3D 物理后端等。

### GitHub 推送状态
**失败**。本地 commit 完整：`1047c75ce7fda7ea2893df618c7ca701ff9933bf`。
已尝试 3 次 `git push -u origin main`：
1. 第一次：`Recv failure: Connection was reset`
2. 第二次：挂起 2 分钟无响应，手动停止
3. 第三次：`Failed to connect to github.com port 443 after 21061 ms: Couldn't connect to server`
原因：本机到 github.com:443 网络不通（可能需代理）。本地仓库 D:\Seed 完整可运行，待网络恢复后执行 `git push -u origin main` 即可。

