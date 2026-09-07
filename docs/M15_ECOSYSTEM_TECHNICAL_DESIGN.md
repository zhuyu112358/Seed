# M15生态基础层技术预研与架构设计

**日期**：2026-09-07
**状态**：技术预研，待M15方向确认后启动开发
**前置里程碑**：M14（经济基础层与文明模拟，SDK v3.0.0，2285测试）
**对应未实现方向**：A-P0-04（生态基础层，极高优先级）、A-P0-05（能量流动系统）、A-P0-06（种群动态）

---

## 一、设计目标

### 核心目标
让世界拥有自我维持的生态系统——资源节点可再生、生物有生命周期、物种间有捕食关系、能量沿食物链流动、种群动态平衡。世界真正"活"起来。

### 与现有系统的协同
- **与M14 ResourceProduction协同**：生态资源是生产的原材料来源，采集行为影响生态
- **与M14 CivilizationSimulation协同**：生态环境影响文明兴衰（环境危机/资源枯竭）
- **与M13 SocialNorm协同**：生态保护/环境禁忌/狩猎规范等社会规范
- **与M12 DynamicNarrative协同**：生态灾难/物种迁徙/资源枯竭等叙事事件
- **与M12 NPCSchedule协同**：NPC日常采集/狩猎/农耕行为
- **与战策RTS协同**：资源点控制/地图生态/野生动物/环境破坏

### 设计原则
1. **自维持性**：生态系统能够自我维持，不需要外部干预
2. **动态平衡**：种群数量动态平衡，不会无限增长或灭绝
3. **可交互性**：玩家/NPC可以与生态系统交互（采集/狩猎/破坏/保护）
4. **可观测性**：生态状态可观测，可用于叙事和游戏机制
5. **性能友好**：大规模生态模拟不会导致性能问题

---

## 二、系统架构

### 整体架构

```
EcosystemSystem（生态系统总控）
├── ResourceNodeSystem（资源节点系统）
│   ├── 资源节点管理（创建/检索/更新/销毁）
│   ├── 资源类型（植物/矿物/水/食物/材料）
│   ├── 再生机制（自然再生/消耗/枯竭）
│   └── 采集交互（NPC/玩家采集）
├── OrganismSystem（生物代理系统）
│   ├── 生物管理（创建/检索/更新/销毁）
│   ├── 生物类型（动物/植物/微生物）
│   ├── 生命周期（出生/成长/繁殖/衰老/死亡）
│   ├── 行为系统（觅食/移动/繁殖/躲避/攻击）
│   └── AI决策（简单状态机/GOAP）
├── FoodWebSystem（食物网/捕食关系系统）
│   ├── 物种管理（物种定义/属性/生态位）
│   ├── 捕食关系（捕食者-猎物关系）
│   ├── 营养级（生产者/初级消费者/次级消费者/顶级捕食者）
│   └── 生态位（竞争/共生/寄生）
├── EnergyFlowSystem（能量流动系统）
│   ├── 能量传递（营养级间能量传递，90%损失）
│   ├── 能量获取（光合作用/捕食/分解）
│   ├── 能量消耗（基础代谢/活动/繁殖）
│   └── 能量存储（脂肪/糖原/生物量）
├── PopulationDynamicsSystem（种群动态系统）
│   ├── 种群管理（种群统计/趋势/健康度）
│   ├── 出生/死亡（出生率/死亡率/年龄结构）
│   ├── 繁殖（繁殖季节/繁殖条件/后代数量）
│   ├── 迁移（季节性迁移/资源驱动迁移）
│   └── 种群模型（Logistic增长/Lotka-Volterra捕食者-猎物模型）
└── EcosystemEventSystem（生态事件系统）
    ├── 生态灾难（干旱/洪水/火灾/瘟疫/入侵物种）
    ├── 生态恢复（自然恢复/人工恢复）
    ├── 物种灭绝/入侵
    └── 环境变化（季节/气候/长期变化）
```

### 模块依赖关系
- `EcosystemSystem` 依赖所有子系统，提供统一接口
- `ResourceNodeSystem` 独立，但被 `OrganismSystem`（觅食）和外部系统（采集）使用
- `OrganismSystem` 依赖 `FoodWebSystem`（捕食关系）和 `EnergyFlowSystem`（能量）
- `FoodWebSystem` 独立，定义物种关系
- `EnergyFlowSystem` 依赖 `FoodWebSystem`（营养级）
- `PopulationDynamicsSystem` 依赖 `OrganismSystem`（个体）和 `FoodWebSystem`（关系）
- `EcosystemEventSystem` 依赖所有子系统，触发和响应事件

---

## 三、核心数据结构

### 3.1 资源节点（ResourceNode）

```typescript
interface ResourceNode {
  id: string;                    // 唯一标识
  type: ResourceNodeType;        // 类型：PLANT/MINERAL/WATER/FOOD/MATERIAL/CUSTOM
  name: string;                  // 名称
  position: Vector3;             // 位置
  resourceId: string;            // 产出的资源ID（与ResourceProduction系统对应）
  currentAmount: number;         // 当前资源量
  maxAmount: number;             // 最大资源量
  regenRate: number;             // 再生速率（每tick）
  regenCondition: RegenCondition; // 再生条件
  depletionThreshold: number;    // 枯竭阈值
  isDepleted: boolean;           // 是否枯竭
  depletionTime: number;         // 枯竭时间
  recoveryTime: number;          // 恢复时间
  harvestEfficiency: number;     // 采集效率
  requiredTool?: string;         // 需要的工具
  biome: BiomeType;              // 生物群系
  seasonMultiplier: Record<Season, number>; // 季节乘数
  metadata: Record<string, unknown>;
}

enum ResourceNodeType {
  PLANT = 'plant',           // 植物（树木/灌木/草）
  MINERAL = 'mineral',       // 矿物（矿石/宝石/土壤）
  WATER = 'water',           // 水源（河流/湖泊/泉水）
  FOOD = 'food',             // 食物（浆果/蘑菇/蜂蜜）
  MATERIAL = 'material',     // 材料（木材/纤维/树脂）
  CUSTOM = 'custom',
}

interface RegenCondition {
  type: 'time' | 'season' | 'rainfall' | 'temperature' | 'none';
  minValue?: number;
  maxValue?: number;
  activeSeasons?: Season[];
}
```

### 3.2 生物个体（Organism）

```typescript
interface Organism {
  id: string;                    // 唯一标识
  speciesId: string;             // 物种ID
  name: string;                  // 名称
  type: OrganismType;            // 类型：ANIMAL/PLANT/MICROBE
  position: Vector3;             // 位置
  age: number;                   // 年龄（tick）
  maxAge: number;                // 最大寿命
  lifeStage: LifeStage;          // 生命阶段：INFANT/JUVENILE/ADULT/ELDER
  health: number;                // 健康度（0-100）
  energy: number;                // 当前能量
  maxEnergy: number;             // 最大能量
  energyRegenRate: number;       // 能量恢复速率
  basalMetabolism: number;       // 基础代谢率
  isAlive: boolean;              // 是否存活
  // 行为
  currentBehavior: OrganismBehavior; // 当前行为
  behaviorState: BehaviorState;       // 行为状态
  targetPosition?: Vector3;           // 目标位置
  targetOrganismId?: string;          // 目标生物
  // 繁殖
  isReadyToBreed: boolean;      // 是否准备繁殖
  breedingCooldown: number;      // 繁殖冷却
  offspringCount: number;        // 后代数量
  // 属性
  speed: number;                 // 移动速度
  size: number;                  // 体型大小
  strength: number;              // 力量
  stealth: number;               // 隐蔽性
  perceptionRange: number;       // 感知范围
  // 生态
  trophicLevel: number;          // 营养级（1=生产者，2=初级消费者...）
  diet: DietType;                // 食性：HERBIVORE/CARNIVORE/OMNIVORE/DETRITIVORE
  homeRange: number;             // 活动范围
  territoryId?: string;          // 领地ID
  // 统计
  birthTick: number;             // 出生时间
  deathTick?: number;            // 死亡时间
  causeOfDeath?: CauseOfDeath;   // 死因
  metadata: Record<string, unknown>;
}

enum OrganismType {
  ANIMAL = 'animal',
  PLANT = 'plant',
  MICROBE = 'microbe',
}

enum LifeStage {
  INFANT = 'infant',     // 幼体
  JUVENILE = 'juvenile', // 亚成体
  ADULT = 'adult',       // 成体
  ELDER = 'elder',       // 老年
}

enum OrganismBehavior {
  IDLE = 'idle',
  FORAGING = 'foraging',     // 觅食
  HUNTING = 'hunting',       // 狩猎
  GRAZING = 'grazing',       // 吃草
  MOVING = 'moving',         // 移动
  RESTING = 'resting',       // 休息
  SLEEPING = 'sleeping',     // 睡觉
  BREEDING = 'breeding',     // 繁殖
  FLEEING = 'fleeing',       // 逃跑
  FIGHTING = 'fighting',     // 战斗
  DRINKING = 'drinking',     // 喝水
  MIGRATING = 'migrating',   // 迁徙
  DEAD = 'dead',
}

enum DietType {
  HERBIVORE = 'herbivore',     // 草食
  CARNIVORE = 'carnivore',     // 肉食
  OMNIVORE = 'omnivore',       // 杂食
  DETRITIVORE = 'detritivore', // 腐食
}

enum CauseOfDeath {
  OLD_AGE = 'old_age',
  STARVATION = 'starvation',
  DEHYDRATION = 'dehydration',
  PREDATION = 'predation',
  DISEASE = 'disease',
  ACCIDENT = 'accident',
  COMBAT = 'combat',
  ENVIRONMENT = 'environment',
  UNKNOWN = 'unknown',
}
```

### 3.3 物种（Species）

```typescript
interface Species {
  id: string;                    // 唯一标识
  name: string;                  // 名称
  scientificName: string;        // 学名
  type: OrganismType;            // 类型
  description: string;           // 描述
  // 生态属性
  trophicLevel: number;          // 营养级
  diet: DietType;                // 食性
  preySpecies: string[];         // 猎物物种ID列表
  predatorSpecies: string[];     // 捕食者物种ID列表
  competitorSpecies: string[];   // 竞争者物种ID列表
  symbioticSpecies: string[];    // 共生物种ID列表
  // 种群属性
  baseBirthRate: number;         // 基础出生率
  baseDeathRate: number;         // 基础死亡率
  carryingCapacity: number;       // 环境容纳量（每平方公里）
  minPopulation: number;          // 最小可存活种群
  growthRate: number;             // 内禀增长率（r）
  // 个体属性模板
  baseMaxAge: number;             // 基础最大寿命
  baseMaxEnergy: number;          // 基础最大能量
  baseSpeed: number;              // 基础速度
  baseSize: number;               // 基础体型
  baseStrength: number;           // 基础力量
  basePerceptionRange: number;    // 基础感知范围
  // 繁殖属性
  breedingSeason: Season[];       // 繁殖季节
  breedingAge: number;            // 繁殖年龄
  gestationPeriod: number;        // 妊娠期
  litterSize: [number, number];   // 每胎数量范围
  breedingCooldown: number;       // 繁殖冷却
  // 行为属性
  socialStructure: SocialStructure; // 社会结构
  groupSize: [number, number];      // 群体大小范围
  territoriality: number;            // 领地性（0-1）
  aggression: number;                // 攻击性（0-1）
  fearfulness: number;               // 胆怯性（0-1）
  activityPattern: ActivityPattern;  // 活动模式
  // 栖息地
  preferredBiomes: BiomeType[];      // 偏好生物群系
  temperatureRange: [number, number]; // 适宜温度范围
  rainfallRange: [number, number];    // 适宜降雨量范围
  altitudeRange: [number, number];    // 适宜海拔范围
  // 状态
  isExtinct: boolean;                 // 是否灭绝
  extinctionTick?: number;            // 灭绝时间
  conservationStatus: ConservationStatus; // 保护状态
  metadata: Record<string, unknown>;
}

enum SocialStructure {
  SOLITARY = 'solitary',           // 独居
  PAIR_BONDED = 'pair_bonded',     // 成对
  FAMILY_GROUP = 'family_group',   // 家庭群
  HERD = 'herd',                    // 兽群
  PACK = 'pack',                    // 狼群
  COLONY = 'colony',                // 群体
  FLOCK = 'flock',                  // 鸟群
  SCHOOL = 'school',                // 鱼群
  HIERARCHICAL = 'hierarchical',   // 等级制
}

enum ActivityPattern {
  DIURNAL = 'diurnal',       // 昼行性
  NOCTURNAL = 'nocturnal',   // 夜行性
  CREPUSCULAR = 'crepuscular', // 晨昏性
  CATHEMERAL = 'cathemeral', // 昼夜活动
}

enum ConservationStatus {
  LEAST_CONCERN = 'least_concern',
  NEAR_THREATENED = 'near_threatened',
  VULNERABLE = 'vulnerable',
  ENDANGERED = 'endangered',
  CRITICALLY_ENDANGERED = 'critically_endangered',
  EXTINCT_IN_WILD = 'extinct_in_wild',
  EXTINCT = 'extinct',
}
```

### 3.4 食物网关系（FoodWebRelation）

```typescript
interface FoodWebRelation {
  id: string;
  predatorSpeciesId: string;
  preySpeciesId: string;
  relationType: FoodWebRelationType;
  strength: number;              // 关系强度（0-1）
  energyTransferEfficiency: number; // 能量传递效率（通常10%）
  predationRate: number;         // 捕食率
  isActive: boolean;
  metadata: Record<string, unknown>;
}

enum FoodWebRelationType {
  PREDATION = 'predation',           // 捕食
  HERBIVORY = 'herbivory',           // 植食
  PARASITISM = 'parasitism',         // 寄生
  COMPETITION = 'competition',       // 竞争
  MUTUALISM = 'mutualism',           // 互利共生
  COMMENSALISM = 'commensalism',     // 偏利共生
  AMENSALISM = 'amensalism',         // 偏害共生
}
```

### 3.5 种群（Population）

```typescript
interface Population {
  id: string;
  speciesId: string;
  regionId: string;               // 区域ID
  currentSize: number;            // 当前种群大小
  previousSize: number;           // 上一周期种群大小
  growthRate: number;             // 实际增长率
  carryingCapacity: number;        // 环境容纳量
  birthRate: number;               // 出生率
  deathRate: number;               // 死亡率
  immigrationRate: number;         // 迁入率
  emigrationRate: number;          // 迁出率
  ageStructure: AgeStructure;      // 年龄结构
  sexRatio: number;                // 性别比（雄性:雌性）
  healthIndex: number;             // 健康指数（0-100）
  geneticDiversity: number;        // 遗传多样性（0-100）
  trend: PopulationTrend;          // 趋势
  isStable: boolean;               // 是否稳定
  isEndangered: boolean;           // 是否濒危
  isExtinct: boolean;              // 是否灭绝
  history: PopulationRecord[];     // 历史记录
  metadata: Record<string, unknown>;
}

interface AgeStructure {
  infant: number;      // 幼体比例
  juvenile: number;    // 亚成体比例
  adult: number;       // 成体比例
  elder: number;       // 老年比例
}

interface PopulationRecord {
  tick: number;
  size: number;
  birthRate: number;
  deathRate: number;
  growthRate: number;
}

enum PopulationTrend {
  GROWING = 'growing',
  STABLE = 'stable',
  DECLINING = 'declining',
  FLUCTUATING = 'fluctuating',
  EXTINCT = 'extinct',
}
```

### 3.6 生态事件（EcosystemEvent）

```typescript
interface EcosystemEvent {
  id: string;
  type: EcosystemEventType;
  name: string;
  description: string;
  severity: number;               // 严重程度（0-100）
  startTime: number;              // 开始时间
  endTime?: number;               // 结束时间
  duration: number;               // 持续时间
  regionId: string;               // 影响区域
  affectedSpecies: string[];      // 受影响物种
  affectedResourceNodes: string[]; // 受影响资源节点
  impact: EcosystemImpact;        // 影响
  isActive: boolean;
  isResolved: boolean;
  resolutionProgress: number;     // 解决进度（0-100）
  metadata: Record<string, unknown>;
}

enum EcosystemEventType {
  DROUGHT = 'drought',               // 干旱
  FLOOD = 'flood',                   // 洪水
  WILDFIRE = 'wildfire',             // 野火
  DISEASE_OUTBREAK = 'disease_outbreak', // 疾病爆发
  INVASIVE_SPECIES = 'invasive_species', // 入侵物种
  OVERGRAZING = 'overgrazing',       // 过度放牧
  DEFORESTATION = 'deforestation',   // 森林砍伐
  POLLUTION = 'pollution',           // 污染
  CLIMATE_CHANGE = 'climate_change', // 气候变化
  SPECIES_EXTINCTION = 'species_extinction', // 物种灭绝
  MASS_MIGRATION = 'mass_migration', // 大规模迁徙
  BLOOM = 'bloom',                   // 生物爆发（如藻华）
  DIE_OFF = 'die_off',               // 大规模死亡
  RECOVERY = 'recovery',             // 生态恢复
  CUSTOM = 'custom',
}

interface EcosystemImpact {
  resourceNodeImpact: Record<string, number>;  // 资源节点影响（ID -> 影响程度）
  speciesImpact: Record<string, number>;        // 物种影响（ID -> 影响程度）
  populationImpact: Record<string, number>;     // 种群影响（ID -> 影响程度）
  overallImpact: number;                          // 总体影响
  recoveryTime: number;                           // 预计恢复时间
}
```

---

## 四、核心API设计

### 4.1 EcosystemSystem（生态系统总控）

```typescript
class EcosystemSystem {
  // 子系统
  resourceNodes: ResourceNodeSystem;
  organisms: OrganismSystem;
  foodWeb: FoodWebSystem;
  energyFlow: EnergyFlowSystem;
  populationDynamics: PopulationDynamicsSystem;
  events: EcosystemEventSystem;

  // 生命周期
  constructor(config?: EcosystemConfig);
  initialize(): void;
  update(tick: number, deltaTime: number): void;
  dispose(): void;

  // 查询
  getEcosystemHealth(regionId?: string): EcosystemHealth;
  getBiodiversity(regionId?: string): BiodiversityIndex;
  getSpeciesList(): Species[];
  getOrganismsBySpecies(speciesId: string): Organism[];
  getResourceNodesByType(type: ResourceNodeType): ResourceNode[];
  getActiveEvents(regionId?: string): EcosystemEvent[];

  // 交互
  harvestResource(nodeId: string, amount: number, harvesterId?: string): HarvestResult;
  huntOrganism(organismId: string, hunterId?: string): HuntResult;
  introduceSpecies(speciesId: string, regionId: string, count: number): IntroduceResult;
  removeSpecies(speciesId: string, regionId: string): RemoveResult;
  triggerEvent(type: EcosystemEventType, regionId: string, options?: EventOptions): EcosystemEvent;

  // 序列化
  serialize(): EcosystemSnapshot;
  deserialize(snapshot: EcosystemSnapshot): void;
}
```

### 4.2 ResourceNodeSystem（资源节点系统）

```typescript
class ResourceNodeSystem {
  // 管理
  createNode(id: string, type: ResourceNodeType, resourceId: string, position: Vector3, options?: Partial<ResourceNode>): ResourceNode;
  getNode(id: string): ResourceNode | undefined;
  updateNode(id: string, updates: Partial<ResourceNode>): void;
  removeNode(id: string): void;
  listNodes(filters?: NodeFilters): ResourceNode[];
  getNodesInRange(position: Vector3, range: number, type?: ResourceNodeType): ResourceNode[];

  // 资源操作
  harvest(nodeId: string, amount: number, harvesterId?: string): HarvestResult;
  deposit(nodeId: string, amount: number): void;
  regenerate(nodeId: string, amount: number): void;

  // 查询
  getTotalResourceAmount(resourceId: string, regionId?: string): number;
  getNodeDensity(type: ResourceNodeType, regionId?: string): number;
  getDepletedNodes(regionId?: string): ResourceNode[];

  // 更新
  update(tick: number, deltaTime: number, environment?: EnvironmentState): void;
}
```

### 4.3 OrganismSystem（生物代理系统）

```typescript
class OrganismSystem {
  // 管理
  createOrganism(id: string, speciesId: string, position: Vector3, options?: Partial<Organism>): Organism;
  getOrganism(id: string): Organism | undefined;
  updateOrganism(id: string, updates: Partial<Organism>): void;
  removeOrganism(id: string, cause?: CauseOfDeath): void;
  listOrganisms(filters?: OrganismFilters): Organism[];
  getOrganismsInRange(position: Vector3, range: number, speciesId?: string): Organism[];

  // 生命周期
  birth(speciesId: string, position: Vector3, parentId?: string): Organism;
  kill(organismId: string, cause: CauseOfDeath, killerId?: string): void;
  age(organismId: string, ticks: number): void;
  reproduce(parentId: string, partnerId?: string): Organism[];

  // 行为
  setBehavior(organismId: string, behavior: OrganismBehavior): void;
  moveTo(organismId: string, target: Vector3): void;
  feed(organismId: string, foodId: string, amount: number): void;
  drink(organismId: string, waterSourceId: string): void;
  rest(organismId: string, duration: number): void;
  flee(organismId: string, threatId: string): void;
  attack(organismId: string, targetId: string): AttackResult;

  // 能量
  addEnergy(organismId: string, amount: number): void;
  consumeEnergy(organismId: string, amount: number): void;
  isStarving(organismId: string): boolean;

  // 查询
  getAliveOrganisms(speciesId?: string): Organism[];
  getDeadOrganisms(speciesId?: string): Organism[];
  getOrganismCount(speciesId?: string, regionId?: string): number;
  getAverageAge(speciesId: string): number;
  getAverageHealth(speciesId: string): number;

  // 更新
  update(tick: number, deltaTime: number, environment?: EnvironmentState): void;
}
```

### 4.4 FoodWebSystem（食物网系统）

```typescript
class FoodWebSystem {
  // 物种管理
  registerSpecies(species: Species): void;
  getSpecies(id: string): Species | undefined;
  updateSpecies(id: string, updates: Partial<Species>): void;
  listSpecies(filters?: SpeciesFilters): Species[];
  getSpeciesByTrophicLevel(level: number): Species[];
  getSpeciesByDiet(diet: DietType): Species[];

  // 关系管理
  addRelation(predatorId: string, preyId: string, type: FoodWebRelationType, options?: Partial<FoodWebRelation>): FoodWebRelation;
  getRelation(id: string): FoodWebRelation | undefined;
  removeRelation(id: string): void;
  getRelationsBySpecies(speciesId: string): FoodWebRelation[];
  getPreyOf(speciesId: string): Species[];
  getPredatorsOf(speciesId: string): Species[];
  getCompetitorsOf(speciesId: string): Species[];

  // 食物网分析
  getFoodWebGraph(): FoodWebGraph;
  getTrophicLevel(speciesId: string): number;
  getKeystoneSpecies(): Species[];
  getInvasiveSpecies(): Species[];
  getExtinctionRisk(): ExtinctionRisk[];
  calculateConnectance(): number;          // 食物网连接度
  calculateStability(): number;             // 食物网稳定性
  calculateBiodiversity(): BiodiversityIndex;

  // 模拟
  simulatePredation(tick: number): PredationEvent[];
  simulateCompetition(tick: number): CompetitionResult[];
}
```

### 4.5 EnergyFlowSystem（能量流动系统）

```typescript
class EnergyFlowSystem {
  // 能量获取
  photosynthesize(organismId: string, sunlight: number, water: number, co2: number): number;
  consume(consumerId: string, preyId: string, amount: number): EnergyTransferResult;
  absorbNutrients(organismId: string, amount: number): number;

  // 能量消耗
  basalMetabolism(organismId: string, deltaTime: number): number;
  activityCost(organismId: string, activity: string, duration: number): number;
  reproductionCost(organismId: string): number;
  growthCost(organismId: string, amount: number): number;

  // 能量存储
  storeEnergy(organismId: string, amount: number, storageType: EnergyStorageType): void;
  retrieveEnergy(organismId: string, amount: number, storageType: EnergyStorageType): number;
  getEnergyBudget(organismId: string): EnergyBudget;

  // 生态系统能量
  getTotalEnergyInput(regionId?: string): number;
  getTotalEnergyOutput(regionId?: string): number;
  getEnergyFlowBetweenTrophicLevels(): EnergyFlowRecord[];
  getEcologicalEfficiency(regionId?: string): number;  // 生态效率
  getProductivity(regionId?: string): ProductivityData;

  // 更新
  update(tick: number, deltaTime: number, organisms: Organism[], environment?: EnvironmentState): void;
}

enum EnergyStorageType {
  FAT = 'fat',
  GLYCOGEN = 'glycogen',
  BIOMASS = 'biomass',
  NECTAR = 'nectar',
  SEED = 'seed',
}
```

### 4.6 PopulationDynamicsSystem（种群动态系统）

```typescript
class PopulationDynamicsSystem {
  // 种群管理
  createPopulation(speciesId: string, regionId: string, initialSize: number): Population;
  getPopulation(id: string): Population | undefined;
  getPopulationBySpeciesRegion(speciesId: string, regionId: string): Population | undefined;
  updatePopulation(id: string, updates: Partial<Population>): void;
  listPopulations(filters?: PopulationFilters): Population[];

  // 种群模型
  logisticGrowth(populationId: string, deltaTime: number): number;  // Logistic增长
  lotkaVolterra(predatorId: string, preyId: string, deltaTime: number): [number, number]; // 捕食者-猎物模型
  rickerModel(populationId: string, deltaTime: number): number;      // Ricker模型
  bevertonHoltModel(populationId: string, deltaTime: number): number; // Beverton-Holt模型

  // 出生/死亡
  calculateBirths(populationId: string, deltaTime: number): number;
  calculateDeaths(populationId: string, deltaTime: number): number;
  calculateNaturalDeaths(populationId: string, deltaTime: number): number;
  calculatePredationDeaths(populationId: string, deltaTime: number): number;
  calculateStarvationDeaths(populationId: string, deltaTime: number): number;

  // 迁移
  calculateImmigration(populationId: string, deltaTime: number): number;
  calculateEmigration(populationId: string, deltaTime: number): number;
  triggerMigration(speciesId: string, fromRegion: string, toRegion: string, count: number): MigrationEvent;

  // 种群健康
  calculateHealthIndex(populationId: string): number;
  calculateGeneticDiversity(populationId: string): number;
  calculateExtinctionRisk(populationId: string): ExtinctionRisk;
  calculateMinimumViablePopulation(speciesId: string): number;

  // 查询
  getPopulationTrend(populationId: string, historyLength?: number): PopulationTrend;
  getPopulationGrowthRate(populationId: string): number;
  getCarryingCapacity(speciesId: string, regionId: string): number;
  getTotalPopulation(speciesId: string): number;

  // 更新
  update(tick: number, deltaTime: number, organisms: Organism[], foodWeb: FoodWebSystem, environment?: EnvironmentState): void;
}
```

### 4.7 EcosystemEventSystem（生态事件系统）

```typescript
class EcosystemEventSystem {
  // 事件管理
  createEvent(type: EcosystemEventType, name: string, regionId: string, options?: Partial<EcosystemEvent>): EcosystemEvent;
  getEvent(id: string): EcosystemEvent | undefined;
  updateEvent(id: string, updates: Partial<EcosystemEvent>): void;
  resolveEvent(id: string): void;
  cancelEvent(id: string): void;
  listActiveEvents(regionId?: string): EcosystemEvent[];
  listEvents(filters?: EventFilters): EcosystemEvent[];

  // 事件触发
  triggerDrought(regionId: string, severity: number, duration: number): EcosystemEvent;
  triggerFlood(regionId: string, severity: number, duration: number): EcosystemEvent;
  triggerWildfire(regionId: string, severity: number, duration: number): EcosystemEvent;
  triggerDiseaseOutbreak(regionId: string, speciesId: string, severity: number): EcosystemEvent;
  triggerInvasiveSpecies(regionId: string, speciesId: string, count: number): EcosystemEvent;
  triggerMassMigration(speciesId: string, fromRegion: string, toRegion: string): EcosystemEvent;

  // 事件影响
  calculateEventImpact(eventId: string): EcosystemImpact;
  applyEventImpact(eventId: string): void;
  calculateRecoveryTime(eventId: string): number;
  getEventSeverity(eventId: string): number;

  // 事件检测
  detectDroughtRisk(regionId: string): number;
  detectFloodRisk(regionId: string): number;
  detectWildfireRisk(regionId: string): number;
  detectDiseaseRisk(regionId: string, speciesId: string): number;
  detectInvasiveRisk(regionId: string): number;
  detectExtinctionRisk(speciesId: string): ExtinctionRisk;

  // 事件历史
  getEventHistory(regionId?: string, type?: EcosystemEventType): EcosystemEvent[];
  getEventFrequency(type: EcosystemEventType, regionId?: string): number;
  getAverageEventDuration(type: EcosystemEventType, regionId?: string): number;

  // 更新
  update(tick: number, deltaTime: number, ecosystem: EcosystemSystem, environment?: EnvironmentState): void;
}
```

---

## 五、与现有系统的集成点

### 5.1 与M14 ResourceProduction集成
- **资源节点→生产配方**：ResourceNode的resourceId对应ProductionRecipe的输入资源
- **采集行为→生产任务**：NPC采集资源节点的行为可以触发生产任务
- **资源枯竭→生产限制**：资源节点枯竭会限制相关生产配方
- **生态影响→生产效率**：生态事件（干旱/洪水）会影响资源产量和生产效率

### 5.2 与M14 CivilizationSimulation集成
- **生态环境→文明指标**：生态健康度影响文明的ENVIRONMENTAL领域分数
- **资源枯竭→文明危机**：资源枯竭可以触发文明的economic/environmental危机
- **生态灾难→文明事件**：生态灾难（干旱/洪水/瘟疫）可以触发文明事件和叙事
- **文明活动→生态影响**：文明的生产/建设/战争活动会影响生态环境

### 5.3 与M13 SocialNorm集成
- **生态保护规范**：可以创建与生态保护相关的社会规范（如狩猎限制/森林保护）
- **禁忌物种**：某些物种可以成为社会禁忌，影响NPC行为
- **仪式与生态**：生态事件（丰收/干旱）可以触发社会仪式和节日
- **环境伦理**：文化演化可以产生不同的环境伦理观念

### 5.4 与M12 DynamicNarrative集成
- **生态事件→叙事事件**：生态灾难/物种灭绝/大规模迁徙可以触发叙事事件
- **NPC与生态互动→叙事**：NPC的采集/狩猎/保护行为可以生成叙事内容
- **生态变化→任务链**：生态变化可以生成任务链（如应对干旱/防治入侵物种）
- **玩家行为→生态后果**：玩家的环境破坏/保护行为会产生叙事后果

### 5.5 与M12 NPCSchedule集成
- **采集/狩猎日程**：NPC的日常作息可以包含采集/狩猎活动
- **季节活动**：NPC的活动可以随季节变化（如秋收/冬猎）
- **资源驱动行为**：NPC会根据资源节点的位置和状态调整行为
- **生态事件响应**：生态事件会改变NPC的日程和行为

### 5.6 与战策RTS集成
- **资源点控制**：资源节点可以成为RTS中的资源点，玩家可以控制和采集
- **野生动物单位**：生物可以成为RTS中的中立单位（可猎杀/可驯服）
- **地图生态**：地图可以有不同的生物群系和生态特征
- **环境破坏**：玩家的建设/战斗会破坏环境，影响生态
- **天气/季节**：生态系统的天气/季节系统可以影响RTS游戏玩法

---

## 六、开发计划与Phase划分

### Phase 1: 资源节点系统（ResourceNodeSystem）
**目标**：实现可交互、可再生的资源节点系统
**核心功能**：
- 资源节点管理（创建/检索/更新/销毁）
- 6种资源节点类型（植物/矿物/水/食物/材料/自定义）
- 再生机制（自然再生/消耗/枯竭/恢复）
- 采集交互（NPC/玩家采集，效率/工具要求）
- 季节乘数（不同季节资源产量不同）
- 资源节点查询（按类型/位置/范围过滤）
- 序列化
**预估测试**：50-60个

### Phase 2: 物种与食物网系统（Species + FoodWebSystem）
**目标**：定义物种属性和物种间的生态关系
**核心功能**：
- 物种管理（注册/检索/更新/列表）
- 物种属性模板（生态/种群/个体/繁殖/行为/栖息地）
- 食物网关系管理（捕食/植食/寄生/竞争/共生）
- 营养级计算
- 食物网分析（连接度/稳定性/关键物种/生物多样性）
- 保护状态评估
- 序列化
**预估测试**：50-60个

### Phase 3: 生物代理系统（OrganismSystem）
**目标**：实现有生命周期和行为的生物个体
**核心功能**：
- 生物管理（创建/检索/更新/销毁）
- 生命周期（出生/成长/繁殖/衰老/死亡）
- 生命阶段（幼体/亚成体/成体/老年）
- 行为系统（13种行为：闲置/觅食/狩猎/吃草/移动/休息/睡觉/繁殖/逃跑/战斗/喝水/迁徙/死亡）
- 能量系统（获取/消耗/存储）
- 健康系统（健康度/疾病/受伤）
- 简单AI决策（基于需求的行为选择）
- 生物查询（按物种/位置/范围/状态过滤）
- 统计（数量/平均年龄/平均健康）
- 序列化
**预估测试**：60-70个

### Phase 4: 能量流动系统（EnergyFlowSystem）
**目标**：实现生态系统的能量流动和营养级传递
**核心功能**：
- 能量获取（光合作用/捕食/吸收营养）
- 能量消耗（基础代谢/活动/繁殖/生长）
- 能量存储（脂肪/糖原/生物量）
- 能量传递效率（营养级间10%传递，90%损失）
- 能量预算（个体级能量收支）
- 生态系统能量（总输入/总输出/流动记录）
- 生态效率计算
- 生产力计算
- 序列化
**预估测试**：40-50个

### Phase 5: 种群动态系统（PopulationDynamicsSystem）
**目标**：实现种群动态平衡和数学模型
**核心功能**：
- 种群管理（创建/检索/更新/列表）
- 种群模型（Logistic增长/Lotka-Volterra捕食者-猎物/Ricker/Beverton-Holt）
- 出生/死亡计算（自然/捕食/饥饿/疾病）
- 迁移（迁入/迁出/季节性迁移/资源驱动迁移）
- 年龄结构（幼体/亚成体/成体/老年比例）
- 种群健康（健康指数/遗传多样性/灭绝风险）
- 最小可存活种群计算
- 种群趋势分析（增长/稳定/下降/波动/灭绝）
- 历史记录
- 序列化
**预估测试**：50-60个

### Phase 6: 生态事件系统（EcosystemEventSystem）
**目标**：实现生态灾难和环境变化事件
**核心功能**：
- 事件管理（创建/检索/更新/解决/取消）
- 16种事件类型（干旱/洪水/野火/疾病/入侵物种/过度放牧/森林砍伐/污染/气候变化/物种灭绝/大规模迁徙/生物爆发/大规模死亡/生态恢复/自定义）
- 事件影响计算（资源节点/物种/种群/总体影响/恢复时间）
- 事件触发（手动触发/自动检测）
- 风险检测（干旱/洪水/野火/疾病/入侵/灭绝风险）
- 事件历史（频率/平均持续时间）
- 事件进度（严重程度/持续时间/解决进度）
- 序列化
**预估测试**：50-60个

### Phase 7: 生态系统总控与集成（EcosystemSystem + Integration）
**目标**：整合所有子系统，实现完整的生态系统模拟
**核心功能**：
- EcosystemSystem总控类（统一接口/子系统管理/生命周期）
- 生态健康度评估（整体/区域）
- 生物多样性指数（物种丰富度/均匀度/Shannon-Wiener指数）
- 与M14 ResourceProduction集成（资源节点→生产）
- 与M14 CivilizationSimulation集成（生态→文明指标/危机）
- 与M13 SocialNorm集成（生态保护规范/禁忌物种）
- 与M12 DynamicNarrative集成（生态事件→叙事）
- 与M12 NPCSchedule集成（采集/狩猎日程）
- 跨系统集成测试
- 端到端生态模拟演示
- 序列化（完整生态系统快照）
**预估测试**：40-50个（含集成测试）

### Phase 8: 性能优化与大规模验证 + SDK发布
**目标**：优化性能，验证大规模生态模拟，发布SDK v3.1.0
**核心功能**：
- 性能优化（空间分区/对象池/LOD/休眠机制）
- 大规模实体测试（1000+生物/1000+资源节点）
- 性能基准测试
- 内存占用优化
- ECS架构评估（是否需要迁移）
- 完整测试回归
- SDK v3.1.0发布（版本号/CHANGELOG/DEVLOG/tag）
**预估测试**：30-40个

### 总预估
- **Phase数量**：8个
- **总测试数**：370-450个
- **总源文件**：约14个（7个系统 + 7个类型）
- **目标SDK版本**：v3.1.0
- **完成标准**：2650+测试全绿，构建0错误，无P0/P1 bug，端到端演示通过

---

## 七、性能优化策略

### 7.1 空间分区
- 使用网格/四叉树进行空间分区
- 生物和资源节点按位置分区存储
- 查询时只检查相关分区，减少O(n²)复杂度

### 7.2 对象池
- 生物对象使用对象池，避免频繁创建/销毁
- 死亡生物回收到对象池，出生时复用
- 减少GC压力

### 7.3 LOD（细节层次）
- 远距离生物使用简化模拟（种群级而非个体级）
- 近距离生物使用详细模拟（个体行为）
- 根据玩家/NPC距离动态调整

### 7.4 休眠机制
- 不活跃区域的生物进入休眠状态
- 休眠生物只进行基础代谢和种群更新
- 玩家/NPC接近时唤醒

### 7.5 批量处理
- 生物更新批量处理，减少函数调用开销
- 能量消耗/代谢计算向量化
- 使用类型化数组存储连续数据

### 7.6 种群级模拟
- 对于数量庞大的物种（如昆虫/小鱼），使用种群级模拟
- 不创建个体对象，只维护种群统计数据
- 需要交互时才创建个体对象

---

## 八、风险与挑战

### 8.1 性能风险
- **风险**：大规模生物模拟（1000+）可能导致性能问题
- **缓解**：空间分区/对象池/LOD/休眠机制/种群级模拟
- **验证**：Phase 8进行大规模性能基准测试

### 8.2 生态平衡风险
- **风险**：生态系统可能不稳定，导致物种灭绝或无限增长
- **缓解**：使用成熟的种群模型（Logistic/Lotka-Volterra），设置环境容纳量
- **验证**：长时间模拟测试，验证生态平衡

### 8.3 集成复杂度
- **风险**：与M12/M13/M14多个系统集成，复杂度高
- **缓解**：分阶段集成，先集成核心系统，再扩展
- **验证**：跨系统集成测试，端到端演示

### 8.4 数据量风险
- **风险**：生态系统产生大量数据（生物/资源节点/事件/历史）
- **缓解**：高效数据结构，历史数据压缩，定期清理
- **验证**：内存占用测试

### 8.5 AI决策风险
- **风险**：生物AI决策可能过于简单或过于复杂
- **缓解**：使用基于需求的简单状态机，预留GOAP接口
- **验证**：行为合理性测试

---

## 九、参考资料

### 研究文档
- `D:\Sojourn\research\arboreus\002_ecosystem_social_simulation_emergence.md`（生态模拟核心参考）
- `D:\Sojourn\research\shared\unimplemented_directions.md`（A-P0-04/05/06）

### 经典理论
- **Lotka-Volterra模型**：捕食者-猎物动态
- **Logistic增长模型**：种群S型增长
- **Ricker模型**：鱼类种群动态
- **Beverton-Holt模型**：竞争种群动态
- **10%定律**：营养级间能量传递效率
- **Shannon-Wiener指数**：生物多样性
- **最小可存活种群（MVP）**：保护生物学

### 游戏参考
- **Minecraft**：生态群系/动物行为/资源再生
- **Dwarf Fortress**：复杂生态系统/种群动态
- **Stardew Valley**：季节/作物/野生动物
- **Eco**：生态模拟/环境影响
- **Planet Zoo**：动物管理/生态系统
- **Cities: Skylines**：资源/环境/灾难

---

## 十、下一步行动

1. **等待M15方向确认**：监控评估确定M15是否为生态基础层
2. **详细设计评审**：如果确认，进行详细设计评审
3. **接口规范更新**：更新 `interface_spec.md`（如果需要）
4. **Phase 1启动**：开始资源节点系统开发
5. **迭代开发**：按Phase顺序开发，每轮1-2个子系统
