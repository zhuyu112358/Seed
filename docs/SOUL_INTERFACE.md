# 灵魂-世界接口约定（SOUL_INTERFACE）

> 本文档是 Seed System 与 SoulArena（灵魂系统）之间的接口契约，**最重要**。
> 所有内容严格基于 `src/` 真实源码：`src/bridge/SoulBridge.ts`、`src/api/soulClient.ts`、`src/api/server.ts`、`src/types/index.ts`。
> 文档中文，代码注释英文。

---

## 1. 概述

Seed 与 SoulArena 是两个独立进程：

- **SoulArena**（默认 `http://localhost:3000`）负责“灵魂本身”：人格、情绪、价值系统、记忆。
- **Seed System**（默认 `http://localhost:3100`）负责“世界”：物理、事件、通信、空间，以及灵魂在世界中的化身（soul-proxy / soul 实体）。

两者通过 **HTTP REST** 与 **WebSocket** 解耦。Seed 侧有两个对接组件：

| 组件 | 文件 | 职责 |
|------|------|------|
| `SoulClient` | `src/api/soulClient.ts` | Seed 主动拉取灵魂花名册 / 单个灵魂详情，失败回退 mock |
| `SoulBridge` | `src/bridge/SoulBridge.ts` | 双向桥：灵魂加入/离开世界、推送感知帧、拉取并执行动作、回写世界反馈与灵魂反馈 |

数据字段命名遵循 **snake_case**（与 SoulArena 已确认契约一致），见 `SoulInfo`。

---

## 2. 核心概念

### 2.1 角色分工

```
SoulArena (soul brain)               Seed System (world body)
┌────────────────────┐               ┌─────────────────────────┐
│ 人格/情绪/价值/记忆 │  ──REST/WS──> │ 物理 / 事件 / 通信 / 空间 │
│ 决策“做什么动作”    │ <──推送感知── │ 化身 soul-proxy 在世界中 │
└────────────────────┘               └─────────────────────────┘
```

- 灵魂不直接持有世界状态，只通过 **感知帧（PerceptionFrame）** 看世界。
- 灵魂通过 **动作请求（ActionRequest）** 表达意图，世界执行后回 **动作结果（ActionResult）**。
- 世界通过 **世界影响（WorldEffect）** 作用于灵魂情绪/状态，灵魂通过 **灵魂反馈（SoulFeedback）** 回应。

### 2.2 化身（Avatar）

灵魂进入世界时，世界侧为其创建一个实体：

- 在“核心模拟层”（`entity/`）由 `EntityFactory.soulProxy({soulId, name, element, position?})` 生成，`type = 'soul-proxy'`，id 固定为 `soul_<soulId>`，`material = soul:<element>`。
- 在“运行时层”（`bridge/` 的 `SoulWorldAdapter`）由 `createSoulEntity(soulId, position)` 创建，id 同样为 `soul_<soulId>`。

---

## 3. 类型契约（`src/types/index.ts`）

### 3.1 `SoulInfo`（灵魂花名册，snake_case）

```ts
interface SoulInfo {
  id: string;
  name: string;
  element: string;                 // e.g. 'wind' | 'fire'
  status: string;
  current_game_id: string | null;
  birth_time: number;
  total_existence_ms: number;
  last_active_at: number;
  created_at: number;
  memoryStats: { episodic: number; semantic: number; core: number;
                 links: number; reflections: number; total: number };
  personality?: { bravery: number; aggression: number; sociability: number;
                  curiosity: number; loyalty: number };
  emotion?: { valence: number; arousal: number; dominance: number;
              trust: number; anticipation: number; fatigue: number };
  valueSystem?: { beliefs: string[]; priorities: Record<string, number>;
                  moralAlignment: number };
}
```

### 3.2 `PerceptionFrame`（世界 → 灵魂）

一个灵魂一帧看到的世界切片：

```ts
interface PerceptionFrame {
  soulId: string;
  timestamp: number;
  worldTime: number;
  position: IVector3;
  visibleEntities: Array<{ id: string; name: string; type: EntityType;
                           position: IVector3; distance: number; visible: boolean }>;
  nearbySouls: Array<{ id: string; name: string; element: string;
                       position: IVector3; distance: number }>;
  environment: {
    temperature: number; pressure: number; humidity: number;
    windSpeed: number; windDirection: IVector3; lightLevel: number;
    weather: WeatherState; timeOfDay: number;
  };
  events: Array<{ id: string; type: string; name: string; severity: string;
                  distance: number; affectsSoul: boolean }>;
  communications: CommunicationMessage[];
}
```

### 3.3 `ActionRequest` / `ActionResult`（灵魂 ↔ 世界）

```ts
interface ActionRequest {
  soulId: string;
  action: 'move' | 'interact' | 'communicate' | 'use' | 'attack' | 'wait' | 'custom';
  targetId?: string;
  parameters: Record<string, unknown>;
  timestamp: number;
}

interface ActionResult {
  soulId: string;
  action: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
```

### 3.4 `WorldEffect` / `SoulFeedback`（世界 ↔ 灵魂情绪）

```ts
interface WorldEffect {
  soulId: string;
  source: string;
  effectType: 'emotion' | 'physical' | 'mental' | 'social' | 'custom';
  magnitude: number;
  emotionDelta?: { valence?: number; arousal?: number; dominance?: number;
                   trust?: number; anticipation?: number };
  physicalDelta?: { health?: number; energy?: number; fatigue?: number };
  description: string;
  timestamp: number;
}

interface SoulFeedback {
  soulId: string;
  worldEffectId: string;
  emotionalResponse: string;
  actionTaken: string;
  intensity: number;
  timestamp: number;
}
```

---

## 4. SoulClient API（`src/api/soulClient.ts`）

Seed 主动从 SoulArena 拉数据，失败回退内置 mock。

```ts
class SoulClient {
  constructor(baseUrl?: string); // default: process.env.SOUL_URL ?? 'http://localhost:3000'
  listSouls(): Promise<{ souls: SoulInfo[]; usedMock: boolean }>;
  getSoul(id: string): Promise<SoulInfo | null>;
}
```

- `listSouls()`：请求 `GET {baseUrl}/api/souls`，超时 1500ms；失败时 `usedMock = true` 并返回内置 Vex / Nova 两个 mock 灵魂。
- `getSoul(id)`：请求 `GET {baseUrl}/api/souls/:id`；失败返回 `null`。

```ts
import { SoulClient } from './api/soulClient.js';

const client = new SoulClient();
// Try to fetch the roster; fall back to built-in mocks on failure.
const { souls, usedMock } = await client.listSouls();
```

---

## 5. SoulBridge API（`src/bridge/SoulBridge.ts`）

双向桥，负责完整的“加入—感知—动作—反馈”循环。

### 5.1 配置与构造

```ts
interface SoulBridgeConfig {
  soulSystemUrl: string;
  worldId: string;
  logger?: ILogger;
  validator?: BridgeValidator;          // optional action-payload validator
  pollIntervalSec?: number;             // default 0.5s
}
type BridgeValidator = {
  validateInline(schema: ValidationSchema, data: unknown):
    { valid: boolean; errors: unknown[] };
};
```

世界侧必须实现适配器才能真正执行动作：

```ts
interface SoulWorldAdapter {
  createSoulEntity(soulId: string, position: IVector3): string;
  removeSoulEntity(entityId: string): boolean;
  getEntityPosition(entityId: string): IVector3 | undefined;
  executeAction(request: ActionRequest): ActionResult;
  buildPerceptionFrame(soulId: string): PerceptionFrame;
}
```

### 5.2 方法签名

```ts
class SoulBridge {
  constructor(config: SoulBridgeConfig);
  attachWorld(world: SoulWorldAdapter): this;

  on(event: SoulBridgeEvent, listener: SoulBridgeListener): this;
  off(event: SoulBridgeEvent, listener: SoulBridgeListener): this;

  connect(): Promise<boolean>;
  disconnect(): void;

  getSoulList(): Promise<SoulInfo[]>;
  getSoulDetail(soulId: string): Promise<SoulInfo | null>;

  joinWorld(soulId: string, spawnPosition: IVector3):
    Promise<{ success: boolean; entityId: string }>;
  leaveWorld(soulId: string): Promise<boolean>;

  sendPerceptionFrame(soulId: string, frame: PerceptionFrame): Promise<boolean>;
  requestAction(soulId: string): Promise<ActionRequest | null>;
  executeAction(request: ActionRequest): Promise<ActionResult>;
  applyWorldEffect(effect: WorldEffect): Promise<boolean>;
  receiveSoulFeedback(soulId: string): Promise<SoulFeedback | null>;

  getConnectedSouls(): string[];
  update(deltaTime: number): void;      // call every tick; polls souls
  get nextBackoffMs(): number;
  get isConnected(): boolean;
}
```

事件类型 `SoulBridgeEvent = 'soulJoined' | 'soulLeft' | 'actionReceived' |
'effectApplied' | 'connectionLost' | 'connectionRestored'`。

### 5.3 SoulArena 侧端点约定

SoulBridge 假定 SoulArena 暴露以下 HTTP 端点（相对 `soulSystemUrl`）：

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/souls` | 灵魂花名册（`connect()` 探活、`getSoulList()`） |
| GET | `/api/souls/:id` | 单个灵魂详情 |
| POST | `/api/souls/:id/join` | 灵魂加入世界（body: `{worldId, position}`） |
| POST | `/api/souls/:id/leave` | 灵魂离开世界（body: `{worldId}`） |
| POST | `/api/souls/:id/perception` | 推送感知帧 |
| GET | `/api/souls/:id/action` | 拉取待执行动作（返回 `ActionRequest` 或 `{action: null}`） |
| POST | `/api/souls/:id/action/result` | 回写动作结果 `ActionResult` |
| GET | `/api/souls/:id/feedback` | 拉取灵魂对世界影响的反馈 |
| POST | `/api/effects` | 上报世界影响 `WorldEffect` |

所有请求超时 2000ms；连接丢失时按指数退避（`500ms * 2^n`，上限 30s）。

### 5.4 使用示例

```ts
import { SoulBridge } from './bridge/index.js';

const bridge = new SoulBridge({
  soulSystemUrl: 'http://localhost:3000',
  worldId: 'seed-arena-01',
  pollIntervalSec: 0.5,
});

// Attach the world adapter that actually executes actions / builds perception.
bridge.attachWorld(myWorldAdapter);
bridge.on('soulJoined', ({ soulId }) => console.log(`${soulId} joined`));

await bridge.connect();
await bridge.joinWorld('soul_mock_vex', { x: 0, y: 1, z: 0 });

// Inside the world loop, once per tick:
// bridge.update(deltaSeconds);
```

---

## 6. Seed 对外 API 一览（详见 API.md）

Seed 进程暴露给外部（含 SoulArena / 监控）的 HTTP + WebSocket 接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/world/status` | 世界运行状态 |
| GET | `/api/entities` | 全部实体（toJSON） |
| GET | `/api/entities/:id` | 单个实体 |
| POST | `/api/entities` | 创建实体（校验 name/x/y/z） |
| POST | `/api/souls/:id/action` | 灵魂动作入口（限流 + 校验 + 权限） |
| GET | `/api/souls` | 转发 SoulClient 花名册 |
| WS | `/ws` | 实时事件通道（`hello` / `ack` / `error`） |

---

## 7. 已知问题 / 限制

1. **`server.ts` 与 `WorldEngine` 未对接**：`createApp` 读取 `deps.engine.currentWorld`，但真实 `WorldEngine`（`src/engine/WorldEngine.ts`）**没有 `currentWorld` getter**，也没有 `entities` / `tick` / `worldTime` 字段。因此 REST 端点在运行时会因为 `w` 为 `undefined` 而返回降级结果，类型检查也无法通过。这是当前最主要的集成缺口，详见 `DEVLOG.md`。
2. **`SoulBridge.validator` 与 `InputValidator` 接口不一致**：桥期望的 `BridgeValidator.validateInline(schema, data)` 对应 `types/ValidationSchema` 形状；而真实 `security/InputValidator` 的方法是 `validate(schema, input)`，schema 形状为 `Record<string, FieldRule>`，**没有 `validateInline`**。需要一个适配层。
3. **动作白名单不一致**：`server.ts` 的 `POST /api/souls/:id/action` 只允许 `move/speak/interact/attack/use`，而 `types/ActionRequest.action` 允许 `move/interact/communicate/use/attack/wait/custom`。两处需要对齐。
4. **感知帧尚未真正实现**：`PerceptionFrame` 类型已定义，但世界侧没有现成的 `buildPerceptionFrame` 实现（依赖 `World` 实体遍历与空间查询），接入时需自行补全 `SoulWorldAdapter`。
5. **Mock 兜底**：SoulArena 不可达时 `SoulClient` 返回写死的 Vex（wind）/ Nova（fire），仅用于本地开发，不可用于真实联调。
