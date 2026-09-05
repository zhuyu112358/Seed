# 世界事件系统（World Event System）

## 概述

世界事件系统是 Seed 引擎的核心子系统之一，负责基于世界状态（温度、湿度、风力、气压、时间等）主动触发大规模事件，影响世界中的物体和灵魂。参考现实世界的气象和灾害机制，事件可以是天气变化（雨、风暴）、自然灾害（台风、寒潮）、季节变化等。

## 架构

世界事件系统由三个协作的 WorldSystem 组成，均接入 World 主循环：

```
World.step(dt)
  ├── WeatherSimulator.tick()   — 模拟气象数据动态变化
  ├── WorldClock.tick()          — 昼夜循环、光照计算
  └── WorldEventSystem.tick()    — 条件评估、事件触发、效果应用
```

### 1. WeatherSimulator（气象模拟器）

**文件：** `src/event/WeatherSimulator.ts`

模拟以下气象要素的动态变化：

| 要素 | 范围 | 机制 |
|------|------|------|
| 温度（temperature） | -40 ~ 50°C | 向目标温度漂移 + 昼夜周期影响 |
| 湿度（humidity） | 0 ~ 100% | 随机游走 |
| 风速（windSpeed） | 0 ~ 60 m/s | 随机游走 + 均值回归（均值 3 m/s） |
| 风向（windDirection） | 3D 向量 | 缓慢旋转 |
| 气压（pressure） | 980 ~ 1040 hPa | 随机漂移 |
| 天气状态（state） | clear/cloudy/rain/storm/fog/snow/windy/extreme | 基于条件概率转移 |

**天气状态转移规则：**
- 湿度 > 70% 且 气压 < 1005 hPa → 雨（风速 > 15 时为风暴）
- 风速 > 12 m/s → 大风
- 湿度 > 55% → 多云
- 湿度 < 40% 且 气压 > 1010 hPa → 晴朗
- 温度 < 0°C → 雪（湿度 > 60%）或雾

**API：**
```typescript
const weather = new WeatherSimulator({ initialTemperature: 20, initialHumidity: 50 });
weather.tick(dt, world, events);  // 在 World 主循环中调用
weather.getWeather();              // 获取只读气象快照
weather.setTargetTemperature(35);  // 设置温度漂移目标
weather.setWeatherState("storm");  // 直接设置天气状态
```

### 2. WorldClock（世界时钟）

**文件：** `src/event/WorldClock.ts`

模拟昼夜循环，计算光照等级，触发时段变化事件。

| 属性 | 说明 |
|------|------|
| timeOfDay | 0~1，0=午夜，0.25=日出，0.5=正午，0.75=日落 |
| dayLengthSeconds | 一天的长度（秒），默认 120 秒 |
| lightLevel | 0.05~1.0，基于正弦曲线，正午最高 |

**时段（Phase）：**
- dawn（黎明）：0.20 ~ 0.30
- day（白天）：0.30 ~ 0.70
- dusk（黄昏）：0.70 ~ 0.80
- night（夜晚）：0.80 ~ 0.20（跨午夜）

**API：**
```typescript
const clock = new WorldClock({ dayLengthSeconds: 120, startTime: 0.25 });
clock.tick(dt, world, events);
clock.getTimeOfDay();    // 0~1
clock.getLightLevel();   // 0.05~1.0
clock.getPhase();        // 'dawn' | 'day' | 'dusk' | 'night'
```

### 3. WorldEventSystem（世界事件系统）

**文件：** `src/event/WorldEventSystem.ts`

核心事件管理引擎，负责：
- 事件定义注册（WorldEventDefinition）
- 条件评估（基于气象/时钟/实体数据）
- 事件触发与生命周期管理
- 事件效果应用（对实体施力、发射事件等）
- 冷却机制（防止事件频繁触发）

**事件定义结构：**
```typescript
interface WorldEventDefinition {
  id: string;
  type: 'weather' | 'disaster' | 'seasonal' | 'biological' | 'custom';
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'extreme';
  minDuration: number;     // 最短持续时间（秒）
  maxDuration: number;     // 最长持续时间（秒）
  cooldown: number;        // 结束后冷却时间（秒）
  conditions: EventCondition[];  // 触发条件（全部满足才触发）
  effects: EventEffect[];  // 事件效果
}
```

**条件类型：**
- `temperature` / `humidity` / `windSpeed` / `pressure` — 气象条件
- `weather` — 天气状态匹配
- `timeOfDay` / `lightLevel` — 时间/光照条件
- `entityCount` — 实体数量条件
- 比较运算符：`gt` / `gte` / `lt` / `lte` / `eq` / `neq` / `between`

**效果类型：**
- `applyForce` — 对目标实体施加风力（基于当前风速和风向）
- `emitEvent` — 向事件系统发射自定义事件
- 目标范围：`all` / `souls` / `dynamicEntities` / `staticEntities`

**内置事件定义：**

| 事件 ID | 类型 | 严重度 | 触发条件 | 效果 |
|---------|------|--------|----------|------|
| `wind-gust` | weather | medium | 风速 > 10 m/s | 对动态实体施力 |
| `rain-storm` | weather | medium | 湿度 > 70% 且 气压 < 1005 | 发射降雨事件 |
| `typhoon` | disaster | extreme | 风速 > 25 m/s 且 湿度 > 80% | 对所有实体施力 + 警告事件 |
| `cold-snap` | seasonal | high | 温度 < 0°C | 发射霜冻事件 |

**API：**
```typescript
const eventSystem = new WorldEventSystem();
eventSystem.bindSystems(weather, clock);  // 绑定气象和时钟系统
eventSystem.registerDefinition(WIND_GUST_EVENT);
eventSystem.tick(dt, world, events);
eventSystem.getActiveEvents();     // 当前活跃事件
eventSystem.getEventsTriggered();  // 累计触发次数
eventSystem.stop();                 // 停止并清除活跃事件
```

## 集成方式

```typescript
import { World } from "./engine/World.js";
import { WeatherSimulator } from "./event/WeatherSimulator.js";
import { WorldClock } from "./event/WorldClock.js";
import { WorldEventSystem, WIND_GUST_EVENT, TYPHOON_EVENT } from "./event/WorldEventSystem.js";

const world = new World({ name: "my-world", tickRate: 60 });

const weather = new WeatherSimulator({ initialTemperature: 22 });
const clock = new WorldClock({ dayLengthSeconds: 180 });
const events = new WorldEventSystem();

events.bindSystems(weather, clock);
events.registerDefinition(WIND_GUST_EVENT);
events.registerDefinition(TYPHOON_EVENT);

world.addSystem(weather);
world.addSystem(clock);
world.addSystem(events);

world.start();
// 主循环中 world.step(dt) 会自动驱动三个系统
```

## 扩展指南

### 自定义事件

```typescript
const earthquake: WorldEventDefinition = {
  id: "earthquake",
  type: "disaster",
  name: "Earthquake",
  description: "Sudden seismic activity shakes all entities.",
  severity: "high",
  minDuration: 5,
  maxDuration: 15,
  cooldown: 300,
  conditions: [
    { type: "custom", operator: "eq", value: "trigger" }  // 自定义条件
  ],
  effects: [
    { type: "applyForce", target: "all", parameters: { forceMultiplier: 5.0 } },
    { type: "emitEvent", target: "all", parameters: { eventType: "disaster.earthquake" } }
  ]
};
eventSystem.registerDefinition(earthquake);
```

### 自定义条件类型

扩展 `WorldEventSystem.getConditionValue()` 方法，添加新的条件类型映射。

### 自定义效果类型

扩展 `WorldEventSystem.applyEventEffects()` 方法，添加新的效果处理逻辑。

## 未来优化方向

- [ ] 气象要素空间分布（不同区域不同天气）
- [ ] 事件链式触发（台风引发洪水，洪水引发疾病）
- [ ] 事件对灵魂心理状态的直接影响
- [ ] 季节性事件（春夏秋冬循环）
- [ ] 事件历史记录与统计分析
- [ ] 基于实体行为的事件触发（如大量灵魂聚集引发庆典）