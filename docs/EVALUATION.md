# Seed 评估系统文档

## 1. 评估系统目的

Seed 评估系统（WorldEvaluator）用于在每次优化后量化评估虚拟世界引擎的性能、稳定性和交互质量。通过构建标准化测试世界、运行固定 tick 数、采集多维度指标，生成可对比的 JSON 评估报告，为持续优化提供数据支撑。

评估系统对应项目需求第 14 条：「创建评估系统，评估每次优化」。

---

## 2. 评估指标体系

### 2.1 性能指标（performance）

| 指标 | 字段 | 说明 | 单位 |
|---|---|---|---|
| 平均 tick 耗时 | `tickTimeAvgMs` | 所有采样 tick 的平均 wall-clock 耗时 | ms |
| P95 tick 耗时 | `tickTimeP95Ms` | 95 分位 tick 耗时，反映长尾延迟 | ms |
| P99 tick 耗时 | `tickTimeP99Ms` | 99 分位 tick 耗时，反映极端延迟 | ms |
| 等效帧率 | `fps` | `1000 / tickTimeAvgMs`，非渲染帧率而是模拟吞吐 | fps |
| 内存占用 | `rssBytes` | 进程常驻内存集大小 | bytes |

### 2.2 活动指标（activity）

| 指标 | 字段 | 说明 |
|---|---|---|
| 每 tick 事件数 | `eventsPerTick` | 事件总线发射的事件总数 / tick 数 |
| 每 tick 碰撞数 | `collisionsPerTick` | 物理系统检测到的碰撞数 / tick 数 |
| 每 tick 消息数 | `messagesPerTick` | 通信系统传输的消息数 / tick 数 |
| 每 tick 移动实体数 | `movedEntitiesPerTick` | 位置发生变化的实体数 / tick 数 |

### 2.3 灵魂交互指标（soulInteraction）

| 指标 | 字段 | 说明 |
|---|---|---|
| 动作成功率 | `actionSuccessRate` | 灵魂动作成功数 / 总动作数，无动作时为 1 |
| 感知事件数 | `perceivedEvents` | 灵魂代理感知到的世界事件总数 |
| 连接灵魂数 | `connectedSouls` | 世界中 `soul-proxy` 类型实体的数量 |

### 2.4 世界状态（world）

| 字段 | 说明 |
|---|---|
| `name` | 世界名称 |
| `tick` | 已运行的 tick 数 |
| `worldTime` | 世界内模拟时间（秒） |
| `entityCount` | 世界中的实体总数 |

### 2.5 子系统状态（subsystems）

数组，每个元素包含 `name`（系统名）和 `enabled`（是否启用），用于记录评估时各子系统的运行状态。

---

## 3. 评估流程

```
构建测试世界 → 初始化评估器 → 运行固定 tick 数（每 tick 计时）→ 
采集活动指标（事件/碰撞/消息/移动）→ 生成评估报告 → 
写入 logs/eval-<timestamp>.json → 控制台输出摘要
```

### 3.1 详细步骤

1. **构建测试世界**：使用 `WorldBuilder` 创建包含地面、动态物体、灵魂代理的标准化世界
2. **附加物理系统**：通过 `usePhysics()` 配置重力、摩擦、弹性等物理参数
3. **注册事件监听**：监听 `physics.collision`、`world.tick` 等事件，通过 `evaluator.bump()` 累积计数
4. **运行模拟**：调用 `world.step(dt)` 运行固定 tick 数（默认 120 tick），每 tick 用 `performance.now()` 计时并通过 `evaluator.recordTick(ms)` 记录
5. **通信演示**：运行一次声波通信（`AcousticPropagation.transmit()`），记录消息接收数
6. **生成报告**：调用 `evaluator.flush(world)`，内部调用 `buildReport()` 计算所有指标，写入 JSON 文件并输出控制台摘要

---

## 4. 运行方式

### 4.1 命令行运行

```bash
cd D:\Seed
npm run eval
```

该命令执行 `tsx src/evaluator/runEval.ts`，构建评估世界、运行 120 tick、生成报告。

### 4.2 编程式使用

```typescript
import { WorldBuilder, EntityFactory, PhysicsConfig } from '../sdk/index.js';
import { WorldEvaluator } from './WorldEvaluator.js';

// 1. 构建世界
const world = new WorldBuilder('my-eval')
  .setConfig({ tickRate: 60 })
  .usePhysics(PhysicsConfig.builder().gravity(9.8).restitution(0.6).build())
  .addEntity(EntityFactory.staticBox('ground', { x: 0, y: -0.5, z: 0 }, { x: 20, y: 0.5, z: 20 }))
  .addEntity(EntityFactory.dynamicBox({ name: 'box', position: { x: 0, y: 5, z: 0 }, mass: 1 }))
  .build();

// 2. 初始化评估器
const evaluator = new WorldEvaluator();
world.events.on('physics.collision', () => evaluator.bump('collisions'));
world.events.on('world.tick', () => evaluator.bump('events'));

// 3. 运行模拟并计时
const TICKS = 120;
const dt = 1 / 60;
for (let i = 0; i < TICKS; i++) {
  const t0 = performance.now();
  world.step(dt);
  evaluator.recordTick(performance.now() - t0);
}

// 4. 生成报告（写入 logs/eval-<timestamp>.json）
const reportPath = evaluator.flush(world);
console.log('Report:', reportPath);
```

---

## 5. 报告格式

评估报告为 JSON 格式，完整结构如下：

```typescript
interface EvalReport {
  generatedAt: string;           // ISO 8601 时间戳
  world: {
    name: string;
    tick: number;
    worldTime: number;
    entityCount: number;
  };
  performance: {
    tickTimeAvgMs: number;
    tickTimeP95Ms: number;
    tickTimeP99Ms: number;
    fps: number;
    rssBytes: number;
  };
  subsystems: { name: string; enabled: boolean }[];
  activity: {
    eventsPerTick: number;
    collisionsPerTick: number;
    messagesPerTick: number;
    movedEntitiesPerTick: number;
  };
  soulInteraction: {
    actionSuccessRate: number;
    perceivedEvents: number;
    connectedSouls: number;
  };
}
```

### 5.1 示例报告

```json
{
  "generatedAt": "2026-09-05T03:43:46.712Z",
  "world": {
    "name": "eval-world",
    "tick": 120,
    "worldTime": 2.0,
    "entityCount": 5
  },
  "performance": {
    "tickTimeAvgMs": 0.021,
    "tickTimeP95Ms": 0.05,
    "tickTimeP99Ms": 0.359,
    "fps": 47744.092,
    "rssBytes": 73400320
  },
  "subsystems": [
    { "name": "physics", "enabled": true }
  ],
  "activity": {
    "eventsPerTick": 1.0,
    "collisionsPerTick": 1.2,
    "messagesPerTick": 0.033,
    "movedEntitiesPerTick": 0.5
  },
  "soulInteraction": {
    "actionSuccessRate": 1,
    "perceivedEvents": 0,
    "connectedSouls": 2
  }
}
```

---

## 6. 评估历史与对比

- 所有评估报告自动保存在 `logs/eval-<timestamp>.json`，文件名包含 ISO 时间戳
- 报告按时间排序，可对比不同版本/优化前后的指标变化
- 建议在每次重大优化后运行评估，将报告路径和关键指标记录到 `docs/DEVLOG.md`

---

## 7. 评估合格标准

以下阈值为 v0.1.0 的参考标准，后续版本根据目标硬件调整：

| 指标 | 合格阈值 | 说明 |
|---|---|---|
| `tickTimeAvgMs` | < 16ms | 满足 60 tick/s 实时模拟 |
| `tickTimeP99Ms` | < 33ms | 极端延迟不超过两帧 |
| `fps` | > 30 | 等效模拟帧率 |
| `actionSuccessRate` | = 1 | 灵魂动作全部成功 |
| 构建 | tsc 0 错误 | TypeScript 编译通过 |
| 测试 | 100% 通过 | 单元测试全部通过 |

---

## 8. WorldEvaluator API 参考

### 8.1 构造函数

```typescript
new WorldEvaluator()
```

无参数构造，初始化内部采样数组和计数器。

### 8.2 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `recordTick` | `(ms: number) => void` | 记录一次 tick 的 wall-clock 耗时（ms） |
| `bump` | `(field: keyof EvalCounters, by?: number) => void` | 增加指定活动计数器，默认 +1 |
| `buildReport` | `(world: World) => EvalReport` | 基于当前采样和世界状态计算并返回评估报告（不写文件） |
| `flush` | `(world: World) => string` | 生成报告、写入 `logs/eval-<timestamp>.json`、输出控制台摘要，返回文件路径 |

### 8.3 EvalCounters 字段

```typescript
interface EvalCounters {
  events: number;
  collisions: number;
  messages: number;
  moved: number;
  soulActions: number;
  soulActionsSucceeded: number;
  perceivedEvents: number;
}
```

---

## 9. 未来扩展规划

- **自动化 CI 评估**：集成到 CI/CD 流水线，每次提交自动运行评估并对比基准
- **性能回归检测**：自动对比当前报告与基准报告，关键指标退化超过阈值时告警
- **多场景评估基准**：除默认测试世界外，增加大规模实体（1000+）、高频事件、复杂通信等压力测试场景
- **火焰图集成**：结合 `--prof` 或 clinic.js 生成 CPU 火焰图，定位性能瓶颈
- **灵魂交互质量评估**：增加灵魂决策质量、情绪变化合理性、记忆使用效率等高级指标
- **可视化仪表盘**：基于评估历史数据生成趋势图表，直观展示优化效果

---

## 10. 相关文档

- [架构文档](./ARCHITECTURE.md) — 评估系统在整体架构中的位置
- [开发日志](./DEVLOG.md) — 记录每次评估的关键指标
- [路线图](./ROADMAP.md) — 评估系统的未来优化方向
- [SDK 文档](./SDK.md) — WorldBuilder 和 EntityFactory 的使用方法
