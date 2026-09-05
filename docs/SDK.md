# SDK 使用指南（SDK.md）

> 基于 `src/sdk/WorldBuilder.ts`、`src/sdk/index.ts`、`src/sdk/PhysicsConfig.ts` 与
> `src/entity/EntityFactory.ts` 的真实导出编写。

---

## 1. 概述

SDK 的职责是把「引擎与世界构建」解耦：具体世界由 `WorldBuilder` 在 SDK 层组装好，再交给
`WorldEngine` 驱动。当前核心是 **`WorldBuilder` 类**，通过 fluent 调用逐步配置一个 `World`，
最后 `build()` 返回可被引擎或直接 `step()` 推进的 `World`。

> **导入提示**：`sdk/index.ts` barrel 处于跨版本对齐中（它重新导出 `WorldBuilder`、`EntityFactory`、
> `PhysicsConfig/PhysicsConfigBuilder`、`PhysicsSystem`、三个通信策略与 `Message`）。为避免 barrel
> 解析失败，**建议直接从具体文件导入**：
>
> ```ts
> // Preferred: import from concrete modules
> import { WorldBuilder } from '../sdk/WorldBuilder.js';
> import { EntityFactory } from '../entity/EntityFactory.js';
> import { PhysicsConfig } from '../physics/PhysicsConfig.js';
> ```
>
> `EntityFactory` 实际位于 `src/entity/EntityFactory.ts`（**不在 `sdk/` 下**），由 barrel 转发。

---

## 2. WorldBuilder（真实 API）

来源：`src/sdk/WorldBuilder.ts`。构造时内部 `new World({ name, tickRate: 60 })`。

```ts
class WorldBuilder {
  constructor(name?: string = 'unnamed-world');
  setConfig(cfg: Partial<{ name: string; tickRate: number }>): this;   // Set world-level config
  addEntity(entity: Entity): this;                                    // Add an entity
  addSystem(system: WorldSystem): this;                               // Register a custom system
  usePhysics(config?: PhysicsConfig): this;                           // Attach physics (default: PhysicsConfig.defaults())
  build(): World;                                                     // Finish; returns the live World
  get physicsSystem(): PhysicsSystem | null;                          // Grab wired physics after build
}
```

- `setConfig` 只更新传入字段；`addEntity` 放入 `world.entities`。
- `usePhysics` 内部 `new PhysicsSystem({ config })` 并 `world.addSystem(...)`。
- `build()` 返回**运行时 `World`**，可直接 `world.step(dt)`；**不是** `WorldConfig`。

### 使用示例

```ts
import { WorldBuilder } from '../sdk/WorldBuilder.js';
import { EntityFactory } from '../entity/EntityFactory.js';
import { PhysicsConfig } from '../physics/PhysicsConfig.js';

const world = new WorldBuilder('demo')
  .setConfig({ tickRate: 60 })
  .usePhysics(PhysicsConfig.builder().gravity(9.8).restitution(0.6).build())
  .addEntity(EntityFactory.staticBox('ground', { x: 0, y: -0.5, z: 0 }, { x: 20, y: 0.5, z: 20 }))
  .addEntity(EntityFactory.dynamicBox({ name: 'box-a', position: { x: -2, y: 5, z: 0 }, mass: 1, material: 'wood' }))
  .addEntity(EntityFactory.soulProxy({ soulId: 'vex', name: 'Vex', element: 'wind', position: { x: -1, y: 1, z: 0 } }))
  .build();

const dt = 1 / 60;
for (let i = 0; i < 120; i++) world.step(dt);
```

---

## 3. EntityFactory（实体原型）

来源：`src/entity/EntityFactory.ts`（静态方法，返回 `GameObject`）。

```ts
EntityFactory.staticBox(name, center, halfExtents);
EntityFactory.dynamicBox({ name, position, mass?, material?, velocity?, halfExtents? });
EntityFactory.zoneTrigger({ name, center, halfExtents, onEnter? });   // type='trigger'
EntityFactory.soulProxy({ soulId, name, element, position? });       // id=`soul_${soulId}`, type='soul-proxy'
EntityFactory.distance(a, b);
```

---

## 4. 物理配置

### 4.1 `physics/PhysicsConfig.ts`（类，标量 gravity，被 PhysicsSystem 使用）

```ts
new PhysicsConfig({ gravity=9.8, friction=0.1, airResistance=0.05, fixedDt=1/60, enabled=true, restitution=0.6 });
PhysicsConfig.defaults();
PhysicsConfig.builder().gravity(9.8).restitution(0.6).build();
```

### 4.2 `sdk/PhysicsConfig.ts`（预设，面向 types 的向量式配置）

```ts
import {
  defaultPhysicsConfig,   // Earth-like: gravity (0,-9.8,0)
  zeroGravityConfig, moonGravityConfig, waterPhysicsConfig,
  createPhysicsConfig, materialDensity, materialFriction, materialRestitution,
} from '../sdk/PhysicsConfig.js';
```

> **已知不一致**：§4.1 用**标量** gravity；§4.2 与 `types/index.ts` 的 `PhysicsConfig` 接口用
> **向量** gravity，尚未统一（见 DEVLOG）。

---

## 5. 通信策略

```ts
import { AcousticPropagation } from '../communication/AcousticPropagation.js';
import { Message } from '../communication/Message.js';

const received = new AcousticPropagation({ maxRadius: 30 })
  .transmit(new Message({ content: 'hi', sourceId: soulProxy.id,
    position: soulProxy.position.toObject(), medium: 'acoustic', intensity: 1 }),
    soulProxy, { entities: world.bodies(), byId: (id) => world.getEntity(id) });
```

另有 `NetworkPacket`（无衰减广播桩）、`WorldResonance`（仅 soul-proxy 桩）。

---

## 6. 理想 fluent 契约（`IWorldBuilder`，尚未实现）

`types/index.ts` 定义的目标形态：

```ts
interface IWorldBuilder {
  createWorld(options): this;
  addEntity(config: EntityConfig): string;
  addEntities(configs): string[];
  setPhysicsConfig(config): this;
  addCommunicationStrategy(strategy): this;
  addEventListener(type, handler): this;
  registerSoul(soulId, spawnPosition): this;
  build(): WorldConfig;
}
```

> **当前差距**：真实 `WorldBuilder` **没有** `createWorld/addEntities/setPhysicsConfig/
> addCommunicationStrategy/addEventListener/registerSoul/setTickRate/enableWeather/enableClock/
> enableEvents/buildAndStart`；`build()` 返回 `World` 而非 `WorldConfig`；**不存在 `RunningWorld`
> 类**。这些是未来目标，当前用 `setConfig/addEntity/addSystem/usePhysics/build`。

---

## 7. 已知问题与限制

1. barrel 与具体实现跨版本漂移；直接从具体文件导入最稳。
2. `WorldBuilder` 能力小于 `IWorldBuilder` 契约（无通信/事件/灵魂注册、无天气时钟开关）。
3. `build()` 返回 `World` 而非 `WorldConfig`。
4. 两套物理配置（标量类 vs 向量接口）。
5. `EntityFactory` 在 `src/entity/`，不在 `sdk/` 下。
