# M14 经济与文明系统 - 集成点分析文档

> 文档版本：v1.0
> 创建日期：2026-09-07
> 关联里程碑：Arboreus M14（待监控评估决策确定）
> 前置文档：docs/M14_PREARCH_ECONOMY_CIVILIZATION.md（第124轮创建）

---

## 一、文档目的

本文档详细分析M14经济与文明系统与现有Arboreus系统的集成点，为M14开发提供API对齐参考和集成架构设计。

---

## 二、现有经济相关系统概览

### 2.1 ResourceSystem（M3资源系统）

**文件位置**：`src/resource/`

**核心模块**：
- `ResourceType`：资源类型定义
- `ResourceNode`：资源节点（世界中的资源点）
- `ResourceInventory`：资源库存（实体持有的资源）
- `HarvestSystem`：采集系统
- `CraftingSystem`：制作系统
- `ConsumptionSystem`：消费系统
- `GrowthSystem`：生长系统

**关键API**：
- `ResourceInventory.addResource(type, amount)`
- `ResourceInventory.removeResource(type, amount)`
- `ResourceInventory.getResource(type)`
- `CraftingSystem.craft(entityId, recipeId, inventory)`
- `HarvestSystem.harvest(entityId, nodeId)`

### 2.2 TradingSystem（M7交易系统）

**文件位置**：`src/trade/`

**核心模块**：
- `TradeOffer`：交易报价
- `TradeResult`：交易结果
- `TradingSystem`：交易系统

**关键API**：
- `createOffer(offererId, offeredItems, requestedItems, events)` → TradeOffer
- `acceptOffer(offerId, responderId, events)` → TradeResult
- `rejectOffer(offerId, responderId, events, reason?)` → TradeResult
- `cancelOffer(offerId, offererId, events)` → TradeResult
- `getPendingOffers(entityId)` → TradeOffer[]
- `getActiveOffers()` → TradeOffer[]

**当前限制**：
- 仅支持以物易物（item-for-item），无货币媒介
- 无市场定价机制
- 无交易历史统计

### 2.3 BuildingSystem（M8建筑系统）

**文件位置**：`src/building/`

**核心模块**：
- `Building`：建筑实体
- `BuildingType`：建筑类型
- `BuildingResult`：建筑操作结果
- `BuildingSystem`：建筑系统

**关键API**：
- `placeBuilding(ownerId, type, position, events)` → BuildingResult
- `upgradeBuilding(buildingId, events)` → BuildingResult
- `destroyBuilding(buildingId, events, reason?)` → BuildingResult
- `repairBuilding(buildingId, amount, events)` → BuildingResult
- `getBuildingsByOwner(ownerId)` → Building[]
- `getBuildingsByType(type)` → Building[]
- `getTotalProduction()` → Record<string, number>
- `getTotalDefense()` → number

**当前限制**：
- 建筑效果（生产/防御）是静态的，无动态生产调度
- 无建筑工人/雇员系统
- 无建筑经济产出统计

### 2.4 TerritorySystem（M7领土系统）

**文件位置**：`src/territory/`

**核心模块**：
- `Territory`：领土实体
- `TerritoryPosition`：领土位置
- `TerritoryResult`：领土操作结果
- `TerritorySystem`：领土系统

**关键API**：
- `claimTerritory(ownerId, name, center, radius, events)` → TerritoryResult
- `abandonTerritory(territoryId, ownerId, events)` → TerritoryResult
- `expandTerritory(territoryId, ownerId, newRadius, events)` → TerritoryResult
- `getTerritoriesByOwner(ownerId)` → Territory[]
- `isPositionInTerritory(position)` → boolean
- `isPositionInSpecificTerritory(position, territoryId)` → boolean

**当前限制**：
- 领土仅定义空间范围，无领土经济属性（税收/资源产出）
- 无领土边界争议系统
- 无城市/定居点与领土的关联

---

## 三、M14候选系统与现有系统集成点

### 3.1 CurrencySystem（货币系统）

**核心功能**：货币类型、钱包、转账、汇率、通胀

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| TradingSystem | 扩展TradeOffer支持货币定价 | 当前仅以物易物，M14增加货币报价 |
| ResourceInventory | 扩展Inventory支持货币余额 | 货币作为特殊资源类型存储 |
| SocialMobilitySystem | 财富与阶层关联 | 货币财富影响社会阶层晋升 |
| NPCMemorySystem | 交易记忆 | NPC记忆中记录交易历史和价格 |

**API设计建议**：
```typescript
// CurrencySystem
createCurrency(code, name, symbol, initialSupply)
getWallet(entityId) → Wallet
transfer(fromId, toId, amount, currency) → TransferResult
getExchangeRate(fromCurrency, toCurrency) → number
getInflationRate(currency) → number
```

### 3.2 MarketSystem（市场系统）

**核心功能**：市场场所、商品挂牌、供需定价、价格历史、市场情绪

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| TradingSystem | 整合交易offer到市场 | 市场系统聚合所有交易offer |
| ResourceSystem | 资源类型作为商品 | 所有ResourceType可作为市场商品 |
| CurrencySystem | 货币定价 | 市场价格以货币单位表示 |
| BuildingSystem | 市场建筑 | 特定建筑类型（如市场、交易所）作为交易场所 |
| InformationSpreadModel | 市场信息传播 | 价格信息和市场谣言通过信息模型传播 |
| SocialEventSystem | 市场事件 | 市场崩盘/繁荣作为社会事件触发 |

**API设计建议**：
```typescript
// MarketSystem
createMarket(name, location, currency)
listItem(marketId, sellerId, resourceType, amount, price) → Listing
buyItem(listingId, buyerId) → TradeResult
getMarketPrice(marketId, resourceType) → number
getPriceHistory(marketId, resourceType, days) → PricePoint[]
getMarketSentiment(marketId) → MarketSentiment
```

### 3.3 ProductionSystem（生产系统）

**核心功能**：生产链、生产设施、生产率、生产调度、效率

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| BuildingSystem | 建筑作为生产设施 | 特定建筑类型（农场/工坊/矿山）有生产能力 |
| ResourceSystem | 资源作为原料和产品 | 生产消耗原料资源，产出产品资源 |
| CraftingSystem | 制作配方作为生产配方 | 扩展CraftingRecipe支持批量生产 |
| SocialMobilitySystem | 生产者阶层 | 工匠/商人阶层影响生产效率 |
| NPCScheduleSystem | 生产时间调度 | NPC作息系统决定生产时间 |
| CulturalEvolutionSystem | 文化影响生产 | 文化特质（如技术/经济）影响生产效率 |

**API设计建议**：
```typescript
// ProductionSystem
registerProductionBuilding(buildingId, productionType, recipe)
startProduction(buildingId, recipeId, amount) → ProductionJob
getProductionStatus(buildingId) → ProductionStatus
getProductionEfficiency(buildingId) → number
getTotalProduction(ownerId) → Record<string, number>
```

### 3.4 CitySystem（城市系统）

**核心功能**：城市定义、区划、规划、增长、经济、文化、城市间关系

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| BuildingSystem | 城市包含建筑 | 城市聚合其领土内的所有建筑 |
| TerritorySystem | 城市关联领土 | 城市拥有自己的领土范围 |
| SocialRelationGraph | 城市间关系 | 城市作为实体参与社会关系网络 |
| SocialMobilitySystem | 城市人口阶层 | 城市内人口的阶层分布 |
| CulturalEvolutionSystem | 城市文化 | 城市拥有自己的文化特质 |
| InformationSpreadModel | 城市信息中心 | 城市作为信息传播的节点 |
| SocialEventSystem | 城市事件 | 城市级别的社会事件（节日/庆典） |
| GroupBehaviorEngine | 城市群体 | 城市人口作为群体行为的对象 |

**API设计建议**：
```typescript
// CitySystem
foundCity(name, founderId, center, territoryId) → City
getCity(cityId) → City
getCitiesByOwner(ownerId) → City[]
getCityPopulation(cityId) → number
getCityEconomy(cityId) → CityEconomy
getCityCulture(cityId) → Culture
getCityRelations(cityId) → CityRelation[]
```

### 3.5 SettlementGenerator（定居点生成器）

**核心功能**：程序化生成、布局、道路、基础设施、文化差异化

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| BuildingSystem | 生成建筑布局 | 程序化放置建筑（住宅/商业/工业） |
| TerritorySystem | 生成领土范围 | 自动计算定居点的领土边界 |
| CitySystem | 生成城市初始状态 | 为新城市生成初始人口/经济/文化 |
| CulturalEvolutionSystem | 文化差异化布局 | 不同文化产生不同的建筑风格和布局 |
| ResourceSystem | 资源导向选址 | 定居点倾向于在资源丰富的地方建立 |

**API设计建议**：
```typescript
// SettlementGenerator
generateSettlement(name, center, cultureId, options) → Settlement
generateRoadNetwork(settlementId) → Road[]
generateBuildings(settlementId, count) → Building[]
generateInfrastructure(settlementId) → Infrastructure
```

### 3.6 TradeRouteSystem（贸易路线系统）

**核心功能**：贸易路线、商队、利润、风险、协定、网络分析

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| TradingSystem | 路线上的交易 | 贸易路线促进城市间的交易 |
| CitySystem | 路线连接城市 | 贸易路线连接两个或多个城市 |
| TerritorySystem | 路线经过领土 | 贸易路线可能经过不同的领土 |
| CurrencySystem | 路线利润计算 | 贸易利润以货币计算 |
| MarketSystem | 路线价格差 | 利用不同市场的价格差进行套利 |
| InformationSpreadModel | 路线信息传播 | 贸易路线作为信息传播的通道 |
| SocialEventSystem | 路线事件 | 商队遇袭/贸易协定签署等事件 |
| SocialRelationGraph | 路线关系 | 贸易路线建立城市间的商业伙伴关系 |

**API设计建议**：
```typescript
// TradeRouteSystem
createTradeRoute(fromCityId, toCityId, routeType) → TradeRoute
sendCaravan(routeId, goods, senderId) → Caravan
getCaravanStatus(caravanId) → CaravanStatus
getRouteProfitability(routeId) → number
getTradeNetwork(cityId) → TradeNetwork
signTradeAgreement(cityAId, cityBId, terms) → TradeAgreement
```

### 3.7 CivilizationExchangeSystem（文明交流系统）

**核心功能**：技术传播、文化交流、知识共享、宗教传播、影响力

**集成点**：

| 集成对象 | 集成方式 | 说明 |
|---------|---------|------|
| CulturalEvolutionSystem | 文化特质传播 | 文明交流促进文化特质在不同文化间传播 |
| InformationSpreadModel | 知识/技术信息传播 | 技术和知识作为信息通过模型传播 |
| SocialRelationGraph | 文明间关系 | 文明作为实体参与社会关系网络 |
| CitySystem | 城市作为交流节点 | 城市是文明交流的中心 |
| TradeRouteSystem | 贸易促进交流 | 贸易路线是文明交流的通道 |
| SocialMobilitySystem | 交流影响阶层 | 外来文化/技术影响社会阶层流动 |
| NPCPersonalitySystem | 文化影响个性 | 外来文化特质影响NPC个性 |
| DynamicNarrativeSystem | 交流事件叙事 | 文明交流事件生成叙事 |

**API设计建议**：
```typescript
// CivilizationExchangeSystem
registerCivilization(cityId, cultureId) → Civilization
spreadTechnology(fromCityId, toCityId, technologyId) → SpreadResult
spreadCultureTrait(fromCultureId, toCultureId, traitId) → SpreadResult
getCivilizationInfluence(cityId) → InfluenceMap
getExchangeHistory(cityId) → ExchangeEvent[]
```

---

## 四、M14系统间内部集成

### 4.1 经济系统内部依赖链

```
CurrencySystem
    ↓ (货币定价)
MarketSystem
    ↓ (市场需求)
ProductionSystem
    ↓ (生产产品)
TradingSystem (现有)
    ↓ (交易场所)
BuildingSystem (现有)
    ↓ (城市建筑)
CitySystem
    ↓ (城市间贸易)
TradeRouteSystem
    ↓ (贸易促进交流)
CivilizationExchangeSystem
```

### 4.2 关键集成场景

**场景1：城市经济循环**
1. CitySystem定义城市及其领土
2. BuildingSystem在城市内放置生产建筑
3. ProductionSystem调度建筑进行生产
4. MarketSystem在城市市场销售产品
5. CurrencySystem处理货币交易
6. TradingSystem执行具体交易

**场景2：跨城市贸易**
1. TradeRouteSystem连接两个城市
2. MarketSystem获取两个城市的价格差
3. CurrencySystem计算利润
4. TradingSystem执行跨城市交易
5. CivilizationExchangeSystem传播文化/技术
6. InformationSpreadModel传播贸易信息

**场景3：文明兴衰**
1. CulturalEvolutionSystem定义文化特质
2. CitySystem关联文化和城市
3. CivilizationExchangeSystem促进文化交流
4. SocialMobilitySystem反映社会阶层变化
5. DynamicNarrativeSystem生成文明兴衰叙事
6. SocialEventSystem触发文明级事件

---

## 五、实施优先级建议

### Phase 1：经济基础（高优先级）
1. **CurrencySystem**：货币系统是所有经济系统的基础
2. **MarketSystem**：市场系统整合现有交易系统
3. 集成：CurrencySystem ↔ TradingSystem ↔ ResourceSystem

### Phase 2：生产与城市（中优先级）
1. **ProductionSystem**：生产系统利用现有建筑系统
2. **CitySystem**：城市系统整合建筑/领土/社会系统
3. 集成：ProductionSystem ↔ BuildingSystem ↔ ResourceSystem

### Phase 3：贸易与文明（中优先级）
1. **TradeRouteSystem**：贸易路线连接城市
2. **CivilizationExchangeSystem**：文明交流促进文化/技术传播
3. 集成：TradeRouteSystem ↔ CitySystem ↔ TradingSystem

### Phase 4：定居点生成（低优先级）
1. **SettlementGenerator**：程序化生成定居点
2. 集成：SettlementGenerator ↔ BuildingSystem ↔ CitySystem

---

## 六、风险与注意事项

### 6.1 架构约束
- 所有M14系统必须遵循WorldSystem接口（name/enabled/tick）
- 不得硬编码具体世界属性（货币名称/城市名称/建筑类型）
- 具体世界配置放examples/目录
- 接口变更必须先更新interface_spec.md

### 6.2 性能考虑
- 城市系统可能涉及大量实体（建筑/NPC/资源），需注意性能
- 市场系统的价格计算可能频繁，需考虑缓存
- 贸易路线的路径计算可能耗时，需考虑预计算

### 6.3 向后兼容
- 扩展TradingSystem时需保持现有API兼容
- 扩展BuildingSystem时需保持现有建筑效果兼容
- 新增货币系统不应破坏现有以物易物功能

---

## 七、测试计划

### 单元测试目标
- CurrencySystem：25+测试
- MarketSystem：35+测试
- ProductionSystem：25+测试
- CitySystem：40+测试
- SettlementGenerator：20+测试
- TradeRouteSystem：30+测试
- CivilizationExchangeSystem：25+测试
- **总计：200+新增测试**

### 集成测试
- 城市经济循环集成测试
- 跨城市贸易集成测试
- 文明交流集成测试
- M14与M13社会模拟集成测试

### 端到端演示
- M14端到端演示：城市建立→经济循环→跨城市贸易→文明交流

---

## 八、参考文档

- docs/M14_PREARCH_ECONOMY_CIVILIZATION.md（第124轮创建，M14预研架构）
- D:\Sojourn\management\docs\interface_spec.md（接口规范）
- D:\Sojourn\management\docs\ARCHITECTURE_CONSTRAINTS_Seed.md（架构约束）
- D:\Sojourn\research\shared\unimplemented_directions.md（未实现方向分析）
