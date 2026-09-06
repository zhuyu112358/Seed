# M14 预研架构文档：经济与文明系统

> 状态：预研准备（M14方向待监控评估决策确认）
> 创建时间：2026-09-07
> 基于：M3资源系统 + M7交易/领土系统 + M8建筑系统 + M13社会模拟系统

---

## 一、现有系统基础分析

### 1.1 已有的经济相关系统

| 系统 | 里程碑 | 核心能力 | 局限 |
|------|--------|---------|------|
| ResourceSystem | M3 | ResourceType/ResourceNode/ResourceInventory/HarvestSystem/CraftingSystem/ConsumptionSystem/GrowthSystem | 无价格机制、无市场、无供需 |
| TradingSystem | M7 | createOffer/acceptOffer/rejectOffer/cancelOffer（点对点交易） | 无市场定价、无货币系统、无贸易路线 |
| BuildingSystem | M8 | placeBuilding/upgradeBuilding/destroyBuilding/repairBuilding + getTotalProduction/getTotalDefense | 无城市概念、无建筑规划、无区域经济 |
| TerritorySystem | M7 | claimTerritory/abandonTerritory/expandTerritory + 位置查询 | 无领土经济、无税收、无资源分配 |
| SocialMobilitySystem | M13 | 8社会阶层 + 声望系统 + 晋升/降级/通婚 | 无经济基础支撑阶层流动 |
| CulturalEvolutionSystem | M13 | 17文化特质 + 文化演化/融合/距离 | 无文化经济产出 |

### 1.2 缺失的经济基础能力

1. **货币系统**：无统一货币、无汇率、无通货膨胀
2. **市场系统**：无供需定价、无市场场所、无价格波动
3. **生产系统**：无生产链、无投入产出、无生产率
4. **分配系统**：无税收、无工资、无福利、无资源分配
5. **城市系统**：无城市概念、无城市规划、无城市经济、无城市化进程
6. **文明系统**：无文明兴衰、无文明指标、无文明演化

---

## 二、M14候选系统设计

### 2.1 经济基础层（EconomicBaseLayer）

#### 2.1.1 CurrencySystem 货币系统

**核心功能：**
- 货币类型定义（金币/银币/铜币/信用点等，应用层定义）
- 实体钱包管理（余额/收入/支出/交易历史）
- 货币发行与回收
- 汇率转换（多货币支持）
- 通货膨胀/通货紧缩模拟

**关键API：**
```typescript
createCurrency(type, name, symbol, initialSupply)
getWallet(entityId)
transfer(fromId, toId, amount, currencyType)
addFunds(entityId, amount, reason)
removeFunds(entityId, amount, reason)
getTransactionHistory(entityId, limit?)
getExchangeRate(fromCurrency, toCurrency)
getInflationRate(currencyType)
```

**事件：**
- currency.created
- currency.transfer
- currency.income
- currency.expense
- currency.inflation_changed

#### 2.1.2 MarketSystem 市场系统

**核心功能：**
- 市场场所定义（集市/商店/拍卖行/贸易站等）
- 商品挂牌（卖家挂牌价格/数量/有效期）
- 供需定价（基于交易量和库存动态调整价格）
- 价格历史记录
- 市场波动模拟
- 市场情绪（基于社会事件/信息传播影响价格）

**关键API：**
```typescript
createMarket(name, type, location, options?)
listItem(marketId, sellerId, resourceType, quantity, price, duration?)
buyItem(marketId, listingId, buyerId, quantity?)
cancelListing(marketId, listingId, sellerId)
getMarketPrice(marketId, resourceType)
getPriceHistory(marketId, resourceType, limit?)
getMarketStats(marketId)
updatePrices() // tick自动调用，基于供需
```

**事件：**
- market.created
- market.item_listed
- market.item_sold
- market.price_changed
- market.crash / market.boom

#### 2.1.3 ProductionSystem 生产系统

**核心功能：**
- 生产链定义（输入资源→输出资源，应用层定义配方）
- 生产设施（建筑/NPC作为生产者）
- 生产率计算（基于设施等级/工人数量/资源可用性）
- 生产调度（排队/优先级/自动生产）
- 生产效率（学习曲线/规模效应/技术进步）

**关键API：**
```typescript
registerProducer(entityId, type, capabilities)
setProductionQueue(producerId, recipeId, quantity, priority?)
startProduction(producerId, recipeId, quantity?)
cancelProduction(producerId, productionId)
getProductionStatus(producerId)
getProductionHistory(producerId, limit?)
calculateProductionTime(recipeId, producerId)
calculateProductionCost(recipeId, quantity)
```

**事件：**
- production.started
- production.completed
- production.cancelled
- production.failed（资源不足）

### 2.2 城市生成系统（CityGenerationSystem）

#### 2.2.1 CitySystem 城市系统

**核心功能：**
- 城市定义（名称/位置/人口/面积/等级）
- 城市区划（住宅区/商业区/工业区/农业区/行政区/文化区）
- 城市规划（建筑放置规则/区划限制/基础设施需求）
- 城市增长（人口增长/面积扩张/等级提升）
- 城市经济（GDP/产业结构/贸易额/税收）
- 城市文化（文化设施/文化活动/文化影响力）
- 城市间关系（同盟/敌对/贸易/竞争）

**关键API：**
```typescript
createCity(name, position, founderId, options?)
getCity(cityId)
getCities()
getCityAtPosition(position)
expandCity(cityId, direction, amount)
setZone(cityId, zoneType, area)
getCityStats(cityId)
getCityEconomy(cityId)
getCityCulture(cityId)
addInfrastructure(cityId, type, position)
```

**事件：**
- city.founded
- city.expanded
- city.upgraded
- city.economy_changed
- city.culture_changed
- city.disaster（火灾/瘟疫/饥荒等）

#### 2.2.2 SettlementGenerator 定居点生成器

**核心功能：**
- 程序化生成定居点（村庄/小镇/城市/大都市）
- 基于地形/资源/文化的选址算法
- 建筑布局生成（网格/有机/放射状等布局模式）
- 道路网络生成
- 基础设施生成（水井/市场/神庙/城墙等）
- 文化差异化生成（不同文化有不同建筑风格/布局）

**关键API：**
```typescript
generateSettlement(seed, position, cultureId, size, options?)
generateBuildingLayout(settlementId, layoutType)
generateRoadNetwork(settlementId)
generateInfrastructure(settlementId, cultureId)
getGenerationStats(settlementId)
```

### 2.3 贸易与文明交流系统（TradeAndCivilizationSystem）

#### 2.3.1 TradeRouteSystem 贸易路线系统

**核心功能：**
- 贸易路线定义（起点/终点/路径/商品/风险）
- 商队管理（商队创建/移动/到达/损失）
- 贸易利润计算（价格差×数量-成本-风险损失）
- 贸易风险（强盗/天气/地形/政治不稳定）
- 贸易协定（关税/配额/最惠国待遇/禁运）
- 贸易网络分析（枢纽/孤立/贸易量/贸易多样性）

**关键API：**
```typescript
createTradeRoute(startCityId, endCityId, path, goods, options?)
dispatchCaravan(routeId, goods, quantity, options?)
getCaravanStatus(caravanId)
getTradeRouteStats(routeId)
calculateTradeProfit(routeId, goods, quantity)
createTradeAgreement(cityAId, cityBId, terms)
getTradeNetworkStats()
```

**事件：**
- traderoute.created
- caravan.dispatched
- caravan.arrived
- caravan.attacked
- caravan.lost
- trade.agreement_signed
- trade.embargo_declared

#### 2.3.2 CivilizationExchangeSystem 文明交流系统

**核心功能：**
- 技术传播（技术从一个文明传播到另一个文明）
- 文化交流（文化特质的传播/融合/冲突）
- 知识共享（书籍/学者/学术交流）
- 宗教传播（信仰的传播/皈依/宗教冲突）
- 艺术交流（艺术风格的传播/影响/创新）
- 文明影响力计算（基于经济/军事/文化/科技的综合影响力）

**关键API：**
```typescript
spreadTechnology(techId, fromCivilizationId, toCivilizationId)
spreadCulture(traitId, fromCultureId, toCultureId)
createExchange(civilizationAId, civilizationBId, type, content)
getCivilizationInfluence(civilizationId)
getExchangeHistory(civilizationId, limit?)
calculateCulturalDistance(civilizationAId, civilizationBId)
```

---

## 三、与现有系统的集成点

### 3.1 与M3资源系统集成
- MarketSystem使用ResourceType作为商品类型
- ProductionSystem使用CraftingRecipe作为生产配方
- HarvestSystem产出进入MarketSystem
- ConsumptionSystem需求影响MarketSystem价格

### 3.2 与M7交易系统集成
- TradingSystem的点对点交易作为MarketSystem的补充
- TradeRouteSystem使用TradingSystem的offer机制
- CurrencySystem为TradingSystem提供货币支持

### 3.3 与M8建筑系统集成
- CitySystem使用BuildingSystem放置城市建筑
- ProductionSystem使用BuildingSystem的建筑作为生产设施
- BuildingSystem的getTotalProduction()与CitySystem的经济统计集成

### 3.4 与M7领土系统集成
- CitySystem的位置与TerritorySystem的领土关联
- 城市扩张触发领土扩张
- 领土资源影响城市经济

### 3.5 与M13社会模拟系统集成
- SocialMobilitySystem的阶层流动基于经济基础（财富/职业）
- SocialNormSystem的规范影响经济行为（交易伦理/禁忌）
- SocialEventSystem的事件影响市场（战争/节日/灾荒）
- InformationSpreadModel的信息传播影响市场情绪
- CulturalEvolutionSystem的文化影响城市规划/贸易偏好
- GroupBehaviorEngine的群体行为影响经济（罢工/抗议/消费热潮）

### 3.6 与M12 NPC AI系统集成
- NPCPersonalitySystem影响经济决策（风险偏好/消费倾向/投资风格）
- NPCMemorySystem记录经济交互历史
- GOAP系统规划经济目标（赚钱/购物/投资）
- ScheduleSystem安排经济活动（工作时间/购物时间）

---

## 四、测试计划

### 4.1 单元测试目标
- CurrencySystem: 25+测试（钱包/转账/汇率/通胀/序列化）
- MarketSystem: 35+测试（挂牌/购买/定价/价格历史/市场情绪/序列化）
- ProductionSystem: 25+测试（生产链/生产率/调度/效率/序列化）
- CitySystem: 40+测试（城市创建/区划/增长/经济/文化/城市间关系/序列化）
- SettlementGenerator: 20+测试（生成/布局/道路/基础设施/文化差异化）
- TradeRouteSystem: 30+测试（路线/商队/利润/风险/协定/网络分析/序列化）
- CivilizationExchangeSystem: 25+测试（技术传播/文化交流/影响力/历史/序列化）

**M14测试目标：200+新增测试，总测试2068+**

### 4.2 端到端演示
- examples/m14-demo.ts：覆盖全部系统，80+断言
- 场景：两个城市从建立到贸易繁荣，经济周期波动，文化交流融合

---

## 五、实施顺序建议

### Phase 1: 经济基础（CurrencySystem + MarketSystem）
- 货币系统是所有经济活动的基础
- 市场系统连接供需和定价
- 与M3资源系统和M7交易系统集成

### Phase 2: 生产系统（ProductionSystem）
- 连接资源采集→加工→消费的完整链条
- 与M8建筑系统集成（建筑作为生产设施）

### Phase 3: 城市系统（CitySystem + SettlementGenerator）
- 城市是经济活动的空间载体
- 与M8建筑系统和M7领土系统集成

### Phase 4: 贸易路线（TradeRouteSystem）
- 连接城市间的经济交流
- 与M7交易系统和M13社会事件系统集成

### Phase 5: 文明交流（CivilizationExchangeSystem）
- 最高层次的文明互动
- 与M13文化演化系统和M12 NPC AI系统集成

### Phase 6: 全系统集成 + 端到端演示 + SDK发布

---

## 六、风险与注意事项

1. **架构抽象**：所有具体内容（货币名称/商品类型/建筑风格/文化特质）由应用层定义，内核只提供框架
2. **性能**：市场定价/贸易路线/城市增长可能计算密集，需要空间分区和对象池优化
3. **确定性**：价格波动/商队损失/城市增长需要可复现的随机数（使用SeededRandom）
4. **向后兼容**：不修改M3/M7/M8现有API，只做扩展和集成
5. **不实现灵魂认知**：经济决策由应用层/Ember负责，内核只提供计算框架
6. **不硬编码具体世界**：所有城市/市场/贸易路线参数通过构造函数/配置传入

---

## 七、参考

- 预研报告：D:\Sojourn\research\arboreus\002_ecosystem_social_simulation_emergence.md
- 未实现方向：D:\Sojourn\research\shared\unimplemented_directions.md（A-P1-13经济基础层/A-P1-05城市生成/A-P1-07贸易系统）
- 现有系统：src/resource/、src/trade/、src/building/、src/territory/、src/social/
