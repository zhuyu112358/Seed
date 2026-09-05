# M3 里程碑：资源系统 + 经济规则 + 成长规则

## 概述

M3里程碑为Seed虚拟世界引擎添加通用资源系统，支持资源点、采集、库存、生产、消耗和成长机制。所有系统保持通用，不硬编码具体世界的资源类型或经济规则。

## 架构约束

- 资源类型通过配置定义，不硬编码具体世界的资源（矿石/木材/食物等只是示例）
- 采集/生产/消耗的**决策**由SoulArena负责，Seed只负责**执行**
- SoulActionSystem只处理标准化ActionRequest格式
- 通用的资源系统可以存在，具体游戏的经济规则由上层定义
- 代码注释用英语

## 模块划分

### 阶段1：核心资源系统（本轮）

1. **ResourceType** (`src/resource/ResourceType.ts`)
   - 资源类型定义：id、name、description、maxStackSize、icon
   - 预定义通用资源类型示例（通过配置注册，不硬编码到内核）

2. **ResourceNode** (`src/resource/ResourceNode.ts`)
   - 资源点组件：resourceType、currentAmount、maxAmount、regenRate、harvestTime
   - 可附加到GameObject（通过state或component）
   - 资源再生：每tick按regenRate恢复数量（不超过maxAmount）

3. **ResourceInventory** (`src/resource/ResourceInventory.ts`)
   - 实体库存组件：Map<resourceTypeId, amount>
   - addResource()、removeResource()、hasResource()、getAmount()
   - 容量限制（可选）

4. **HarvestSystem** (`src/resource/HarvestSystem.ts`)
   - WorldSystem实现，处理采集动作
   - 灵魂靠近资源点→开始采集→等待harvestTime→获得资源→减少资源点数量
   - 发射HarvestStartEvent和HarvestCompleteEvent

5. **事件** (`src/event/Event.ts` 新增)
   - HarvestStartEvent (resource.harvest.start)
   - HarvestCompleteEvent (resource.harvest.complete)
   - ResourceDepletedEvent (resource.node.depleted)
   - ResourceRegeneratedEvent (resource.node.regenerated)

### 阶段2：生产与消耗

6. **CraftingSystem** — 配方系统，消耗资源生产物品
7. **ConsumptionSystem** — 灵魂生存消耗（食物/水等），可配置消耗规则
8. **CraftingRecipe** — 配方定义（输入资源→输出物品）

### 阶段3：成长与经济

9. **GrowthSystem** — 经验/等级系统，通过采集/生产获得经验
10. **EconomySystem** — 资源稀缺性、价格波动（可选，上层可扩展）
11. **TradeSystem** — 灵魂间资源交易（可选）

## 接口设计

### HarvestAction (ActionRequest)

```typescript
{
  type: "harvest",
  targetId: string,  // 资源点实体ID
  // 可选：指定采集数量，默认采集1次
  amount?: number
}
```

### ActionResult (harvest)

```typescript
{
  success: boolean,
  actionType: "harvest",
  data: {
    resourceType: string,
    amount: number,
    targetId: string,
    remaining: number  // 资源点剩余数量
  }
}
```

### PerceptionFrame 扩展

- 资源点感知：可见范围内的资源点（类型、数量、位置）
- 采集事件感知：HarvestCompleteEvent

## 完成标准

M3完成时应达到：
1. ✅ 核心资源系统（ResourceType/ResourceNode/ResourceInventory/HarvestSystem）
2. ✅ 采集动作集成到SoulActionSystem
3. ✅ 资源点感知集成到SoulPerceptionSystem
4. ✅ 采集事件发射+感知
5. ✅ 资源再生机制
6. ✅ 单元测试覆盖（新增20+测试）
7. ✅ 集成测试验证（灵魂采集资源）
8. ✅ 设计文档+CHANGELOG更新
9. （可选）生产系统+消耗系统
10. （可选）成长系统+经济系统

## 与现有系统的集成点

- **EntitySystem**：ResourceNode和ResourceInventory作为实体组件
- **SoulActionSystem**：新增harvest动作类型
- **SoulPerceptionSystem**：新增资源点感知和采集事件感知
- **EventSystem**：新增资源相关事件
- **PhysicsSystem**：采集需要距离检测（灵魂靠近资源点）
- **InteractionSystem**：采集可视为一种交互
