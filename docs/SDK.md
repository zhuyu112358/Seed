# SDK.md — WorldBuilder / EntityFactory / PhysicsConfig 用法

## 1. WorldBuilder 链式建世界

```ts
import { WorldBuilder, EntityFactory, PhysicsConfig } from './src/sdk/index.js';
import { WorldEngine } from './src/engine/WorldEngine.js';

const world = new WorldBuilder('my-world')
  .setConfig({ tickRate: 60 })
  .usePhysics(
    PhysicsConfig.builder()
      .gravity(9.8)
      .restitution(0.6)
      .friction(0.05)
      .airResistance(0.02)
      .build(),
  )
  .addEntity(EntityFactory.staticBox('ground', {x:0,y:0,z:0}, {x:20,y:0.5,z:20}))
  .addEntity(EntityFactory.dynamicBox({name:'ball', position:{x:0,y:5,z:0}, mass:1}))
  .addEntity(EntityFactory.zoneTrigger({name:'zone', center:{x:0,y:1,z:0}, halfExtents:{x:2,y:2,z:2}}))
  .addEntity(EntityFactory.soulProxy({soulId:'soul_xxx', name:'Vex', element:'wind'}))
  .build();

const engine = new WorldEngine();
engine.load(world);
engine.runTicks(180); // 确定性跑 180 步
```

## 2. EntityFactory

| 方法 | 用途 |
|------|------|
| `staticBox(name, center, halfExtents)` | 静态不可动物体（质量无穷大） |
| `dynamicBox({name, position, mass, material, velocity, halfExtents})` | 可动刚体 |
| `zoneTrigger({name, center, halfExtents, onEnter})` | 非物理区域触发器 |
| `soulProxy({soulId, name, element, position})` | 灵魂在世界中的化身 |

## 3. PhysicsConfig builder

```ts
PhysicsConfig.builder()
  .gravity(9.8)        // Y 轴重力 m/s^2
  .friction(0.1)      // 地面摩擦
  .airResistance(0.05) // 空气阻力
  .fixedDt(1/60)       // 固定步长
  .restitution(0.6)    // 碰撞弹性
  .enabled(true)
  .build();
```

## 4. 通信介质

```ts
import { AcousticPropagation, Message } from './src/sdk/index.js';
const ac = new AcousticPropagation({ maxRadius: 30, attenuation: 0.02, absorption: 0.01 });
const received = ac.transmit(
  new Message({ content: 'hi', sourceId: a.id, position: a.position.toObject(), medium: 'acoustic' }),
  a, world,
);
```

`NetworkPacket`（网络广播）与 `WorldResonance`（仅灵魂代理可听）在 v0.1.0 为骨架实现。
