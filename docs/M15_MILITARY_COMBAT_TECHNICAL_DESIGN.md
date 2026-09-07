# M15军事与战斗系统技术预研与架构设计

**日期**：2026-09-07
**状态**：技术预研，待M15方向确认后启动开发
**前置里程碑**：M14（经济基础层与文明模拟，SDK v3.0.0，2285测试）
**驱动因素**：战策/Battleplan RTS游戏发布需求
**对应未实现方向**：战策RTS核心需求 + M14 CivilizationSimulation战争维度深化

---

## 一、设计目标

### 核心目标
实现完整的军事与战斗系统——单位战斗、伤害护甲、技能能力、编队阵型、战斗AI、战争与冲突系统。为战策RTS提供核心战斗玩法，同时为Arboreus文明模拟提供战争维度。

### 与现有系统的协同
- **与M14 CivilizationSimulation协同**：战争是文明互动的一种类型，军事系统深化战争维度
- **与M14 ResourceProduction协同**：军事单位需要资源生产支持（武器/护甲/补给）
- **与M14 DistributionSystem协同**：军事资源分配/军饷/战利品分配
- **与M14 TradeExchange协同**：武器/装备贸易/战争经济
- **与M13 GroupBehavior协同**：群体战斗行为/阵型/士气
- **与M13 SocialRelation协同**：战争导致关系变化（结盟/敌对/征服）
- **与M12 GOAP协同**：战斗AI决策（目标导向行动规划）
- **与M12 BehaviorTree协同**：单位行为树（战斗/移动/巡逻）
- **与M11 ActionStateMachine协同**：战斗动作状态机
- **与战策RTS直接协同**：战斗系统是RTS核心玩法

### 设计原则
1. **可玩性优先**：战斗系统设计以游戏可玩性为核心
2. **深度与平衡**：有足够的策略深度，同时保持平衡
3. **可扩展性**：支持多种单位类型/技能/装备
4. **性能友好**：大规模战斗（1000+单位）不卡顿
5. **确定性**：战斗结果可复现（支持回放/录像）
6. **与RTS对齐**：与战策RTS的战斗设计保持一致

---

## 二、系统架构

### 整体架构

```
MilitarySystem（军事系统总控）
├── CombatUnitSystem（战斗单位系统）
│   ├── 单位管理（创建/检索/更新/销毁）
│   ├── 单位类型（步兵/骑兵/弓箭手/法师/战车/攻城器/海军/自定义）
│   ├── 单位属性（生命/攻击/防御/速度/射程/视野）
│   ├── 单位状态（空闲/移动/攻击/受击/死亡/技能/防御/撤退）
│   ├── 经验与等级（击杀获取经验/升级/属性成长）
│   └── 士气系统（士气值/士气影响/崩溃/恢复）
├── DamageArmorSystem（伤害与护甲系统）
│   ├── 伤害类型（物理/穿刺/魔法/真实/火焰/冰霜/闪电/毒素）
│   ├── 护甲类型（轻甲/中甲/重甲/魔法护甲/无甲）
│   ├── 伤害计算（基础伤害/护甲减免/暴击/格挡/闪避）
│   ├── 伤害修饰器（增益/减益/光环/装备）
│   ├── 抗性与弱点（元素抗性/种族克制）
│   └── 伤害日志（可追溯/回放支持）
├── SkillAbilitySystem（技能与能力系统）
│   ├── 技能管理（注册/检索/升级/解锁）
│   ├── 技能类型（主动/被动/光环/触发/终极）
│   ├── 技能效果（伤害/治疗/增益/减益/位移/召唤/控制）
│   ├── 冷却系统（公共冷却/独立冷却/冷却缩减）
│   ├── 资源消耗（法力/能量/怒气/生命值/弹药）
│   ├── 技能目标（单体/范围/方向/自身/友军/敌军）
│   └── 技能组合（连招/协同/组合技）
├── FormationSystem（编队与阵型系统）
│   ├── 阵型管理（创建/检索/更新/销毁）
│   ├── 阵型类型（方阵/线阵/楔形/锥形/圆形/鹤翼/鱼鳞/锋矢/自定义）
│   ├── 编队管理（单位分组/编队移动/编队旋转）
│   ├── 阵型效果（攻击加成/防御加成/移动速度/视野）
│   ├── 阵型切换（战斗中切换/切换时间/切换惩罚）
│   └── 阵型AI（自动调整/自适应阵型）
├── CombatAISystem（战斗AI系统）
│   ├── 目标选择（最近/最弱/最强/威胁最高/优先级）
│   ├── 行为决策（攻击/撤退/防御/技能/移动/集结）
│   ├── 战术AI（包抄/夹击/集火/分割/骚扰/撤退）
│   ├── 指挥官AI（整体战术/资源分配/单位生产）
│   ├── 难度等级（简单/普通/困难/极难/疯狂）
│   └── 学习与适应（根据玩家行为调整策略）
├── WarConflictSystem（战争与冲突系统）
│   ├── 战争管理（宣战/停战/议和/投降）
│   ├── 战争类型（领土战争/资源战争/宗教战争/王朝战争/内战/世界大战）
│   ├── 战争目标（占领/掠夺/摧毁/附庸/解放/统一）
│   ├── 战争进度（战线/占领区/战争分数/厌战度）
│   ├── 战役系统（战役/战斗/遭遇战/围城战/海战）
│   ├── 军事联盟（同盟/防御条约/军事通行权/联合指挥）
│   ├── 战利品与赔偿（战利品分配/战争赔偿/割地/赔款）
│   └── 战后影响（关系变化/政权更迭/文化传播/经济恢复）
└── MilitaryEconomySystem（军事经济系统）
    ├── 单位生产（训练时间/资源消耗/人口占用/建筑要求）
    ├── 维护成本（军饷/补给/装备损耗/士气维护）
    ├── 资源动员（战时经济/资源征用/生产倾斜）
    ├── 军事科技（科技树/科技解锁/单位升级）
    ├── 补给线（补给路线/补给效率/补给中断/围城）
    └── 战争经济影响（经济破坏/重建/战后繁荣/经济崩溃）
```

### 模块依赖关系
- `MilitarySystem` 依赖所有子系统，提供统一接口
- `CombatUnitSystem` 独立，但被其他系统使用
- `DamageArmorSystem` 被 `CombatUnitSystem` 和 `SkillAbilitySystem` 使用
- `SkillAbilitySystem` 依赖 `DamageArmorSystem`（技能伤害计算）
- `FormationSystem` 依赖 `CombatUnitSystem`（编队中的单位）
- `CombatAISystem` 依赖 `CombatUnitSystem`、`SkillAbilitySystem`、`FormationSystem`
- `WarConflictSystem` 依赖 `CombatAISystem`、`FormationSystem`，与M14 CivilizationSimulation集成
- `MilitaryEconomySystem` 与M14 ResourceProduction/Distribution/TradeExchange集成

---

## 三、核心数据结构

### 3.1 战斗单位（CombatUnit）

```typescript
interface CombatUnit {
  id: string;                    // 唯一标识
  typeId: string;                // 单位类型ID
  name: string;                  // 名称
  factionId: string;             // 阵营ID
  ownerId: string;               // 所有者ID（玩家/AI）
  position: Vector3;             // 位置
  rotation: number;              // 朝向
  // 基础属性
  maxHealth: number;             // 最大生命值
  currentHealth: number;         // 当前生命值
  healthRegen: number;           // 生命恢复速率
  maxMana: number;               // 最大法力值
  currentMana: number;           // 当前法力值
  manaRegen: number;             // 法力恢复速率
  attackDamage: number;          // 基础攻击力
  attackSpeed: number;           // 攻击速度（次/秒）
  attackRange: number;           // 攻击范围
  armor: number;                 // 基础护甲
  magicResist: number;           // 魔法抗性
  moveSpeed: number;             // 移动速度
  visionRange: number;           // 视野范围
  // 战斗属性
  critChance: number;            // 暴击率（0-1）
  critDamage: number;            // 暴击伤害倍率
  dodgeChance: number;           // 闪避率（0-1）
  blockChance: number;           // 格挡率（0-1）
  lifeSteal: number;             // 吸血比例（0-1）
  // 状态
  status: UnitStatus;            // 单位状态
  targetId?: string;             // 当前目标ID
  attackCooldown: number;        // 攻击冷却剩余
  isAlive: boolean;              // 是否存活
  // 经验与等级
  level: number;                 // 等级
  experience: number;            // 经验值
  experienceToNext: number;      // 下一级所需经验
  killCount: number;             // 击杀数
  // 士气
  morale: number;                // 士气值（0-100）
  moraleState: MoraleState;      // 士气状态
  // 技能
  skills: string[];              // 已学技能ID列表
  activeSkillCooldowns: Record<string, number>; // 技能冷却
  // 装备
  equipment: EquipmentSlots;      // 装备槽
  // 修饰器
  buffs: Buff[];                 // 增益效果
  debuffs: Debuff[];             // 减益效果
  // 阵型
  formationId?: string;          // 所属阵型ID
  formationPosition?: number;    // 阵型中的位置
  // 统计
  damageDealt: number;           // 总造成伤害
  damageTaken: number;           // 总受到伤害
  healingDone: number;           // 总治疗量
  // 其他
  spawnTime: number;             // 生成时间
  deathTime?: number;            // 死亡时间
  metadata: Record<string, unknown>;
}

enum UnitStatus {
  IDLE = 'idle',               // 空闲
  MOVING = 'moving',           // 移动
  ATTACKING = 'attacking',     // 攻击
  CASTING = 'casting',         // 施法
  DEFENDING = 'defending',     // 防御
  RETREATING = 'retreating',   // 撤退
  STUNNED = 'stunned',         // 眩晕
  ROOTED = 'rooted',           // 定身
  SILENCED = 'silenced',       // 沉默
  DEAD = 'dead',               // 死亡
}

enum MoraleState {
  HIGH = 'high',               // 高昂
  NORMAL = 'normal',           // 正常
  LOW = 'low',                 // 低落
  SHAKEN = 'shaken',           // 动摇
  ROUTING = 'routing',         // 溃逃
  BROKEN = 'broken',           // 崩溃
}

interface EquipmentSlots {
  weapon?: Equipment;
  offhand?: Equipment;
  helmet?: Equipment;
  chest?: Equipment;
  legs?: Equipment;
  boots?: Equipment;
  gloves?: Equipment;
  ring1?: Equipment;
  ring2?: Equipment;
  amulet?: Equipment;
  trinket?: Equipment;
}
```

### 3.2 单位类型（UnitType）

```typescript
interface UnitType {
  id: string;
  name: string;
  description: string;
  category: UnitCategory;       // 单位类别
  tier: number;                 // 等级（1-4）
  cost: ResourceCost;           // 生产资源消耗
  trainTime: number;            // 训练时间（秒）
  populationCost: number;       // 人口占用
  // 基础属性模板
  baseHealth: number;
  healthPerLevel: number;
  baseMana: number;
  manaPerLevel: number;
  baseAttack: number;
  attackPerLevel: number;
  baseArmor: number;
  armorPerLevel: number;
  baseMagicResist: number;
  baseMoveSpeed: number;
  baseAttackSpeed: number;
  baseAttackRange: number;
  baseVisionRange: number;
  // 战斗特性
  damageType: DamageType;       // 伤害类型
  armorType: ArmorType;         // 护甲类型
  attackType: AttackType;       // 攻击类型（近战/远程/魔法）
  canAttackAir: boolean;        // 能否对空
  canAttackGround: boolean;     // 能否对地
  splashDamage: boolean;        // 是否溅射伤害
  splashRadius?: number;        // 溅射半径
  // 技能
  defaultSkills: string[];      // 默认技能
  uniqueAbility?: string;       // 独特能力
  // 升级
  upgrades: string[];           // 可升级项
  // 要求
  requiredBuildings: string[];  // 需要的建筑
  requiredTech: string[];       // 需要的科技
  // 阵营
  factionRestriction?: string[]; // 阵营限制
  // 其他
  isHero: boolean;              // 是否英雄单位
  isUnique: boolean;            // 是否唯一单位
  metadata: Record<string, unknown>;
}

enum UnitCategory {
  INFANTRY = 'infantry',         // 步兵
  CAVALRY = 'cavalry',           // 骑兵
  ARCHER = 'archer',             // 弓箭手
  MAGE = 'mage',                 // 法师
  SIEGE = 'siege',               // 攻城器
  CHARIOT = 'chariot',           // 战车
  NAVAL = 'naval',               // 海军
  FLYING = 'flying',             // 飞行单位
  HERO = 'hero',                 // 英雄
  SUPPORT = 'support',           // 辅助
  WORKER = 'worker',             // 工人
  CUSTOM = 'custom',
}

interface ResourceCost {
  gold?: number;
  wood?: number;
  stone?: number;
  food?: number;
  iron?: number;
  [key: string]: number | undefined;
}
```

### 3.3 伤害与护甲（Damage & Armor）

```typescript
enum DamageType {
  PHYSICAL = 'physical',         // 物理
  PIERCING = 'piercing',         // 穿刺
  SLASHING = 'slashing',         // 挥砍
  BLUDGEONING = 'bludgeoning',   // 钝击
  MAGIC = 'magic',               // 魔法
  FIRE = 'fire',                 // 火焰
  FROST = 'frost',               // 冰霜
  LIGHTNING = 'lightning',       // 闪电
  POISON = 'poison',             // 毒素
  HOLY = 'holy',                 // 神圣
  SHADOW = 'shadow',             // 暗影
  TRUE = 'true',                 // 真实伤害（无视护甲）
}

enum ArmorType {
  NONE = 'none',                 // 无甲
  LIGHT = 'light',               // 轻甲
  MEDIUM = 'medium',             // 中甲
  HEAVY = 'heavy',               // 重甲
  MAGIC = 'magic',               // 魔法护甲
  NATURAL = 'natural',           // 天然护甲（皮肤/鳞片）
  REINFORCED = 'reinforced',     // 强化护甲
}

interface DamageResult {
  attackerId: string;
  targetId: string;
  baseDamage: number;
  damageType: DamageType;
  armorReduction: number;
  resistanceReduction: number;
  critMultiplier: number;
  isCrit: boolean;
  isBlocked: boolean;
  isDodged: boolean;
  finalDamage: number;
  overkill: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

interface DamageModifier {
  id: string;
  type: 'incoming' | 'outgoing';
  damageType?: DamageType;       // 限定伤害类型，undefined表示所有
  modifier: number;               // 修饰值（正数增加，负数减少）
  modifierType: 'flat' | 'percentage' | 'multiplier';
  source: string;                 // 来源（技能/装备/光环/buff）
  duration?: number;              // 持续时间，undefined表示永久
  stacks?: number;                // 层数
  maxStacks?: number;
}
```

### 3.4 技能（Skill）

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  type: SkillType;               // 技能类型
  category: SkillCategory;       // 技能类别
  tier: number;                  // 技能等级（1-4）
  // 施放
  castTime: number;              // 施法时间（秒）
  cooldown: number;              // 冷却时间（秒）
  gcd: boolean;                  // 是否触发公共冷却
  // 消耗
  resourceCost: SkillResourceCost; // 资源消耗
  // 目标
  targetType: TargetType;        // 目标类型
  targetRange: number;           // 目标范围
  castRange: number;             // 施法距离
  // 效果
  effects: SkillEffect[];        // 技能效果列表
  // 条件
  requirements: SkillRequirement[]; // 学习条件
  // 升级
  maxLevel: number;              // 最大等级
  levelEffects: Record<number, SkillEffect[]>; // 每级效果
  // 其他
  isUltimate: boolean;           // 是否终极技能
  isPassive: boolean;            // 是否被动技能
  isHidden: boolean;             // 是否隐藏技能
  icon?: string;
  metadata: Record<string, unknown>;
}

enum SkillType {
  ACTIVE = 'active',             // 主动技能
  PASSIVE = 'passive',           // 被动技能
  TOGGLE = 'toggle',             // 开关技能
  CHANNEL = 'channel',           // 通道技能
  AURA = 'aura',                 // 光环技能
  TRIGGERED = 'triggered',       // 触发技能
  ULTIMATE = 'ultimate',         // 终极技能
}

enum SkillCategory {
  DAMAGE = 'damage',             // 伤害
  HEALING = 'healing',           // 治疗
  BUFF = 'buff',                 // 增益
  DEBUFF = 'debuff',             // 减益
  MOVEMENT = 'movement',         // 位移
  CONTROL = 'control',           // 控制
  SUMMON = 'summon',             // 召唤
  UTILITY = 'utility',           // 实用
  DEFENSIVE = 'defensive',       // 防御
  OFFENSIVE = 'offensive',       // 进攻
  CUSTOM = 'custom',
}

enum TargetType {
  SINGLE_ENEMY = 'single_enemy',
  SINGLE_ALLY = 'single_ally',
  SELF = 'self',
  AREA_ENEMY = 'area_enemy',
  AREA_ALLY = 'area_ally',
  AREA_ALL = 'area_all',
  DIRECTION = 'direction',
  LINE = 'line',
  CONE = 'cone',
  CIRCLE = 'circle',
  RANDOM_ENEMY = 'random_enemy',
  LOWEST_HEALTH_ALLY = 'lowest_health_ally',
  HIGHEST_THREAT_ENEMY = 'highest_threat_enemy',
}

interface SkillEffect {
  type: SkillEffectType;
  value: number;
  duration?: number;
  radius?: number;
  damageType?: DamageType;
  tickRate?: number;             // 每跳间隔（持续伤害/治疗）
  modifier?: Partial<CombatUnit>; // 属性修饰
  condition?: SkillCondition;    // 触发条件
  metadata: Record<string, unknown>;
}

enum SkillEffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  DAMAGE_OVER_TIME = 'damage_over_time',
  HEAL_OVER_TIME = 'heal_over_time',
  STAT_BUFF = 'stat_buff',
  STAT_DEBUFF = 'stat_debuff',
  STUN = 'stun',
  ROOT = 'root',
  SILENCE = 'silence',
  SLOW = 'slow',
  SPEED_BOOST = 'speed_boost',
  KNOCKBACK = 'knockback',
  PULL = 'pull',
  TELEPORT = 'teleport',
  DASH = 'dash',
  SHIELD = 'shield',
  INVULNERABLE = 'invulnerable',
  INVISIBLE = 'invisible',
  SUMMON = 'summon',
  TAUNT = 'taunt',
  THREAT = 'threat',
  LIFE_STEAL = 'life_steal',
  DAMAGE_REFLECTION = 'damage_reflection',
  CUSTOM = 'custom',
}
```

### 3.5 阵型（Formation）

```typescript
interface Formation {
  id: string;
  name: string;
  description: string;
  type: FormationType;
  // 阵型位置
  positions: FormationPosition[]; // 相对位置列表
  maxUnits: number;               // 最大单位数
  // 阵型效果
  attackBonus: number;            // 攻击加成（百分比）
  defenseBonus: number;           // 防御加成（百分比）
  moveSpeedBonus: number;         // 移动速度加成（百分比）
  visionBonus: number;            // 视野加成（百分比）
  // 阵型特性
  isOffensive: boolean;           // 是否进攻型
  isDefensive: boolean;           // 是否防御型
  isMobile: boolean;              // 是否机动型
  // 切换
  switchTime: number;             // 切换时间（秒）
  switchCost?: ResourceCost;      // 切换消耗
  // 要求
  requiredUnitTypes?: string[];   // 需要的单位类型
  minUnits: number;               // 最少单位数
  // 其他
  icon?: string;
  metadata: Record<string, unknown>;
}

enum FormationType {
  PHALANX = 'phalanx',           // 方阵
  LINE = 'line',                 // 线阵
  WEDGE = 'wedge',               // 楔形
  CONE = 'cone',                 // 锥形
  CIRCLE = 'circle',             // 圆形
  CRANE_WING = 'crane_wing',     // 鹤翼
  FISH_SCALE = 'fish_scale',     // 鱼鳞
  ARROW = 'arrow',               // 锋矢
  SQUARE = 'square',             // 方阵（方形）
  DIAMOND = 'diamond',           // 菱形
  VANGUARD = 'vanguard',         // 前锋
  REARGUARD = 'rearguard',       // 后卫
  FLANK_LEFT = 'flank_left',     // 左翼
  FLANK_RIGHT = 'flank_right',   // 右翼
  ENCIRCLEMENT = 'encirclement', // 包围
  CUSTOM = 'custom',
}

interface FormationPosition {
  index: number;
  x: number;                     // 相对X位置
  y: number;                     // 相对Y位置
  z: number;                     // 相对Z位置
  role: FormationRole;           // 位置角色
  unitTypePreference?: string;   // 偏好单位类型
}

enum FormationRole {
  FRONT = 'front',               // 前排
  MIDDLE = 'middle',             // 中排
  BACK = 'back',                 // 后排
  LEFT_FLANK = 'left_flank',     // 左翼
  RIGHT_FLANK = 'right_flank',   // 右翼
  CENTER = 'center',             // 中央
  RESERVE = 'reserve',           // 预备队
  COMMAND = 'command',           // 指挥位
}
```

### 3.6 战争（War）

```typescript
interface War {
  id: string;
  name: string;
  description: string;
  type: WarType;
  status: WarStatus;
  // 参战方
  attackers: WarParticipant[];   // 进攻方
  defenders: WarParticipant[];   // 防御方
  allies: WarAlliance[];         // 同盟
  // 战争目标
  warGoals: WarGoal[];           // 战争目标
  primaryGoal?: string;          // 主要目标
  // 战争进度
  startDate: number;             // 开始日期
  endDate?: number;              // 结束日期
  duration: number;              // 持续时间
  warScore: number;              // 战争分数（-100到100）
  attackerWarScore: number;      // 进攻方战争分数
  defenderWarScore: number;      // 防御方战争分数
  // 占领
  occupiedTerritories: string[]; // 被占领领土
  contestedTerritories: string[]; // 争议领土
  // 战役
  battles: BattleRecord[];       // 战役记录
  sieges: SiegeRecord[];         // 围城记录
  // 厌战
  attackerWarWeariness: number;  // 进攻方厌战度
  defenderWarWeariness: number;  // 防御方厌战度
  // 经济
  warEconomy: WarEconomy;        // 战争经济状态
  // 和谈
  peaceOffers: PeaceOffer[];     // 和谈提议
  currentPeaceDeal?: PeaceDeal;  // 当前和平协议
  // 其他
  casusBelli?: string;           // 宣战理由
  metadata: Record<string, unknown>;
}

enum WarType {
  TERRITORIAL = 'territorial',   // 领土战争
  RESOURCE = 'resource',         // 资源战争
  RELIGIOUS = 'religious',       // 宗教战争
  DYNASTIC = 'dynastic',         // 王朝战争
  CIVIL = 'civil',               // 内战
  WORLD = 'world',               // 世界大战
  COLONIAL = 'colonial',         // 殖民战争
  IDEOLOGICAL = 'ideological',   // 意识形态战争
  HOLY = 'holy',                 // 圣战
  RAID = 'raid',                 // 劫掠
  CUSTOM = 'custom',
}

enum WarStatus {
  PENDING = 'pending',           // 待宣战
  ACTIVE = 'active',             // 进行中
  STALEMATE = 'stalemate',       // 僵持
  NEGOTIATING = 'negotiating',   // 和谈中
  ENDED = 'ended',               // 已结束
  CEASEFIRE = 'ceasefire',       // 停火
}

interface WarParticipant {
  factionId: string;
  role: 'attacker' | 'defender' | 'ally';
  contribution: number;          // 贡献度
  casualties: number;            // 伤亡数
  warWeariness: number;          // 厌战度
  isLeading: boolean;            // 是否主导方
  joinedDate: number;
  leftDate?: number;
}

interface WarGoal {
  id: string;
  type: WarGoalType;
  description: string;
  target?: string;               // 目标（领土/政权/资源）
  warScoreCost: number;          // 所需战争分数
  isCompleted: boolean;
  completionDate?: number;
}

enum WarGoalType {
  CONQUEST = 'conquest',         // 征服领土
  PILLAGE = 'pillage',           // 掠夺
  DESTROY = 'destroy',           // 摧毁
  VASSALIZE = 'vassalize',       // 附庸
  LIBERATE = 'liberate',         // 解放
  UNIFY = 'unify',               // 统一
  CONVERT = 'convert',           // 皈依
  PUPPET = 'puppet',             // 傀儡
  REPARATIONS = 'reparations',   // 赔款
  HUMILIATE = 'humiliate',       // 羞辱
  CUSTOM = 'custom',
}

interface BattleRecord {
  id: string;
  name: string;
  location: string;
  date: number;
  duration: number;
  attackerUnits: number;
  defenderUnits: number;
  attackerCasualties: number;
  defenderCasualties: number;
  winner: 'attacker' | 'defender' | 'draw';
  isDecisive: boolean;
  commanders: string[];
  metadata: Record<string, unknown>;
}

interface PeaceDeal {
  id: string;
  warId: string;
  proposedBy: string;
  date: number;
  terms: PeaceTerm[];
  isAccepted: boolean;
  acceptedDate?: number;
  expiresAt?: number;
}

interface PeaceTerm {
  type: PeaceTermType;
  target?: string;
  value?: number;
  description: string;
}

enum PeaceTermType {
  TERRITORY_CEDE = 'territory_cede',     // 割地
  REPARATIONS = 'reparations',             // 赔款
  HUMILIATION = 'humiliation',             // 羞辱
  VASSALIZATION = 'vassalization',         // 附庸
  PUPPET = 'puppet',                       // 傀儡
  LIBERATION = 'liberation',               // 解放
  CONVERSION = 'conversion',               // 皈依
  DISARMAMENT = 'disarmament',             // 裁军
  TRADE_AGREEMENT = 'trade_agreement',     // 贸易协定
  ALLIANCE = 'alliance',                   // 同盟
  CEASEFIRE = 'ceasefire',                 // 停火
  CUSTOM = 'custom',
}
```

---

## 四、核心API设计（摘要）

### 4.1 MilitarySystem（军事系统总控）

```typescript
class MilitarySystem {
  units: CombatUnitSystem;
  damage: DamageArmorSystem;
  skills: SkillAbilitySystem;
  formations: FormationSystem;
  ai: CombatAISystem;
  wars: WarConflictSystem;
  economy: MilitaryEconomySystem;

  // 战斗模拟
  simulateCombat(units1: CombatUnit[], units2: CombatUnit[], options?: CombatOptions): CombatResult;
  simulateBattle(battleSetup: BattleSetup): BattleResult;

  // 查询
  getMilitaryPower(factionId: string): MilitaryPower;
  getUnitCount(factionId: string): number;
  getActiveWars(factionId: string): War[];

  // 序列化
  serialize(): MilitarySnapshot;
  deserialize(snapshot: MilitarySnapshot): void;
}
```

### 4.2 CombatUnitSystem（战斗单位系统）

```typescript
class CombatUnitSystem {
  createUnit(id: string, typeId: string, factionId: string, position: Vector3, options?): CombatUnit;
  getUnit(id: string): CombatUnit | undefined;
  updateUnit(id: string, updates: Partial<CombatUnit>): void;
  removeUnit(id: string, cause?: DeathCause): void;
  listUnits(filters?: UnitFilters): CombatUnit[];
  getUnitsInRange(position: Vector3, range: number, factionId?: string): CombatUnit[];
  getUnitsByFaction(factionId: string): CombatUnit[];
  getUnitsByType(typeId: string): CombatUnit[];

  // 战斗操作
  attack(attackerId: string, targetId: string): DamageResult;
  takeDamage(unitId: string, damage: number, damageType: DamageType, sourceId?: string): DamageResult;
  heal(unitId: string, amount: number, sourceId?: string): void;
  kill(unitId: string, cause: DeathCause, killerId?: string): void;

  // 经验与等级
  addExperience(unitId: string, amount: number): void;
  levelUp(unitId: string): void;

  // 士气
  updateMorale(unitId: string, delta: number): void;
  checkMoraleState(unitId: string): MoraleState;

  // 更新
  update(tick: number, deltaTime: number): void;
}
```

### 4.3 DamageArmorSystem（伤害与护甲系统）

```typescript
class DamageArmorSystem {
  calculateDamage(attacker: CombatUnit, target: CombatUnit, baseDamage: number, damageType: DamageType): DamageResult;
  applyDamage(target: CombatUnit, damageResult: DamageResult): void;
  getArmorReduction(armor: number, armorType: ArmorType, damageType: DamageType): number;
  getResistanceReduction(unit: CombatUnit, damageType: DamageType): number;
  checkCrit(unit: CombatUnit): { isCrit: boolean; multiplier: number };
  checkBlock(unit: CombatUnit): boolean;
  checkDodge(unit: CombatUnit): boolean;

  // 修饰器
  addDamageModifier(unitId: string, modifier: DamageModifier): void;
  removeDamageModifier(unitId: string, modifierId: string): void;
  getDamageModifiers(unitId: string, type: 'incoming' | 'outgoing'): DamageModifier[];

  // 伤害日志
  getDamageLog(unitId?: string, limit?: number): DamageResult[];
  clearDamageLog(): void;
}
```

### 4.4 SkillAbilitySystem（技能与能力系统）

```typescript
class SkillAbilitySystem {
  registerSkill(skill: Skill): void;
  getSkill(id: string): Skill | undefined;
  updateSkill(id: string, updates: Partial<Skill>): void;
  listSkills(filters?: SkillFilters): Skill[];

  // 单位技能
  learnSkill(unitId: string, skillId: string): void;
  unlearnSkill(unitId: string, skillId: string): void;
  upgradeSkill(unitId: string, skillId: string): void;
  getUnitSkills(unitId: string): Skill[];

  // 施放技能
  castSkill(unitId: string, skillId: string, target?: SkillTarget): CastResult;
  canCastSkill(unitId: string, skillId: string): { canCast: boolean; reason?: string };
  getSkillCooldown(unitId: string, skillId: string): number;

  // 被动技能
  applyPassiveSkills(unit: CombatUnit): void;
  triggerPassiveSkills(unit: CombatUnit, event: SkillTriggerEvent): void;

  // 效果
  applyEffect(target: CombatUnit, effect: SkillEffect, sourceId?: string): void;
  removeEffect(targetId: string, effectId: string): void;
  getActiveEffects(unitId: string): ActiveEffect[];

  // 更新
  update(tick: number, deltaTime: number, units: CombatUnit[]): void;
}
```

### 4.5 FormationSystem（编队与阵型系统）

```typescript
class FormationSystem {
  createFormation(id: string, type: FormationType, name: string, options?): Formation;
  getFormation(id: string): Formation | undefined;
  updateFormation(id: string, updates: Partial<Formation>): void;
  removeFormation(id: string): void;
  listFormations(filters?): Formation[];

  // 编队管理
  createSquad(id: string, unitIds: string[], formationId?: string): Squad;
  getSquad(id: string): Squad | undefined;
  addUnitToSquad(squadId: string, unitId: string): void;
  removeUnitFromSquad(squadId: string, unitId: string): void;
  setSquadFormation(squadId: string, formationId: string): void;
  moveSquad(squadId: string, target: Vector3): void;
  rotateSquad(squadId: string, angle: number): void;

  // 阵型效果
  applyFormationEffects(squad: Squad): void;
  getFormationBonus(formationId: string): FormationBonus;

  // 更新
  update(tick: number, deltaTime: number): void;
}
```

### 4.6 CombatAISystem（战斗AI系统）

```typescript
class CombatAISystem {
  // 目标选择
  selectTarget(unit: CombatUnit, enemies: CombatUnit[], strategy?: TargetStrategy): CombatUnit | undefined;
  getThreatLevel(unit: CombatUnit, target: CombatUnit): number;

  // 行为决策
  decideAction(unit: CombatUnit, context: AIContext): AIDecision;
  shouldRetreat(unit: CombatUnit, context: AIContext): boolean;
  shouldUseSkill(unit: CombatUnit, context: AIContext): { shouldUse: boolean; skillId?: string };

  // 战术AI
  executeTactic(squad: Squad, tactic: Tactic, context: AIContext): void;
  getAvailableTactics(squad: Squad): Tactic[];

  // 指挥官AI
  updateCommanderAI(commanderId: string, context: AIContext): CommanderOrder[];
  getDifficultyLevel(): DifficultyLevel;
  setDifficultyLevel(level: DifficultyLevel): void;

  // 更新
  update(tick: number, deltaTime: number, units: CombatUnit[]): void;
}
```

### 4.7 WarConflictSystem（战争与冲突系统）

```typescript
class WarConflictSystem {
  // 战争管理
  declareWar(attackerId: string, defenderId: string, type: WarType, casusBelli?: string): War;
  endWar(warId: string, peaceDeal: PeaceDeal): void;
  getWar(id: string): War | undefined;
  updateWar(id: string, updates: Partial<War>): void;
  listActiveWars(filters?): War[];
  listWars(filters?): War[];

  // 战争操作
  addWarGoal(warId: string, goal: WarGoal): void;
  completeWarGoal(warId: string, goalId: string): void;
  updateWarScore(warId: string, delta: number, side: 'attacker' | 'defender'): void;
  addBattleRecord(warId: string, battle: BattleRecord): void;
  occupyTerritory(warId: string, territoryId: string, occupierId: string): void;

  // 和谈
  proposePeace(warId: string, proposerId: string, terms: PeaceTerm[]): PeaceDeal;
  acceptPeace(peaceDealId: string): void;
  rejectPeace(peaceDealId: string): void;
  counterPeace(peaceDealId: string, terms: PeaceTerm[]): PeaceDeal;

  // 联盟
  createAlliance(name: string, memberIds: string[], options?): Alliance;
  joinAlliance(allianceId: string, factionId: string): void;
  leaveAlliance(allianceId: string, factionId: string): void;
  getAlliance(id: string): Alliance | undefined;

  // 查询
  getWarHistory(factionId: string): War[];
  getCasualties(factionId: string, warId?: string): number;
  getWarWeariness(factionId: string, warId?: string): number;

  // 更新
  update(tick: number, deltaTime: number): void;
}
```

### 4.8 MilitaryEconomySystem（军事经济系统）

```typescript
class MilitaryEconomySystem {
  // 单位生产
  trainUnit(typeId: string, factionId: string, trainingGroundId?: string): TrainResult;
  cancelTraining(trainQueueId: string): void;
  getTrainingQueue(factionId: string): TrainQueueItem[];
  canTrainUnit(typeId: string, factionId: string): { canTrain: boolean; reason?: string };

  // 维护成本
  calculateMaintenanceCost(factionId: string): ResourceCost;
  payMaintenance(factionId: string): void;
  getUpkeepPerUnit(typeId: string): ResourceCost;

  // 资源动员
  mobilizeEconomy(factionId: string, level: MobilizationLevel): void;
  demobilizeEconomy(factionId: string): void;
  getMobilizationLevel(factionId: string): MobilizationLevel;
  getMobilizationEffects(level: MobilizationLevel): MobilizationEffects;

  // 军事科技
  researchTech(techId: string, factionId: string): void;
  getAvailableTechs(factionId: string): MilitaryTech[];
  getResearchedTechs(factionId: string): string[];
  applyTechEffects(factionId: string): void;

  // 补给线
  createSupplyLine(fromId: string, toId: string, options?): SupplyLine;
  getSupplyLine(id: string): SupplyLine | undefined;
  updateSupplyLine(id: string, updates: Partial<SupplyLine>): void;
  removeSupplyLine(id: string): void;
  calculateSupplyEfficiency(supplyLineId: string): number;
  isSupplyInterrupted(supplyLineId: string): boolean;

  // 围城
  startSiege(siegeId: string, targetId: string, attackerId: string): Siege;
  updateSiege(siegeId: string, deltaTime: number): void;
  endSiege(siegeId: string, result: SiegeResult): void;
  getSiege(id: string): Siege | undefined;

  // 查询
  getMilitaryBudget(factionId: string): MilitaryBudget;
  getWarEconomicImpact(warId: string): EconomicImpact;

  // 更新
  update(tick: number, deltaTime: number): void;
}
```

---

## 五、与现有系统的集成点

### 5.1 与M14 CivilizationSimulation集成
- **战争作为文明互动**：M14已有10种文明互动类型，军事系统深化WAR类型
- **军事影响文明指标**：战争胜负影响MILITARY/POLITICAL领域分数
- **战争触发文明危机**：战败/长期战争可以触发economic/social/political危机
- **军事胜利→里程碑**：征服/统一可以触发文明里程碑
- **战争影响文化**：征服导致文化传播/融合/抵抗

### 5.2 与M14 ResourceProduction集成
- **武器装备生产**：军事单位需要武器/护甲，由ResourceProduction生产
- **战争资源消耗**：战争消耗大量资源（食物/木材/铁/金）
- **战时生产倾斜**：MilitaryEconomy的mobilizeEconomy可以调整生产优先级
- **战利品→资源**：战利品转化为资源，进入生产系统

### 5.3 与M14 DistributionSystem集成
- **军饷分配**：军事单位的军饷由DistributionSystem分配
- **战利品分配**：战利品在参战方之间分配
- **战争赔偿**：战败方支付赔偿，影响财富分配
- **军事阶层**：军人形成特殊经济阶层，影响社会流动

### 5.4 与M14 TradeExchange集成
- **武器贸易**：武器/装备可以在市场交易
- **战争经济**：战争影响商品价格（粮食/武器涨价）
- **贸易路线与战争**：战争中断贸易路线，影响经济
- **战后贸易协定**：和平协议可以包含贸易条款

### 5.5 与M13 GroupBehavior集成
- **群体战斗行为**：GroupBehavior的Boids算法用于单位群体移动
- **暴民心理→士气**：群体行为影响士气（溃逃传染/集体勇气）
- **群体情绪传播**：战斗中的情绪（恐惧/愤怒/兴奋）在群体中传播
- **阵型与群体行为**：FormationSystem与GroupBehavior协同

### 5.6 与M13 SocialRelation集成
- **战争→关系变化**：战争导致阵营间关系变化（敌对/结盟）
- **军事同盟→社会关系**：军事同盟转化为社会关系（盟友/保护国）
- **征服→领主-臣民**：征服产生新的领主-臣民关系
- **联姻→和平**：联姻可以作为和平手段

### 5.7 与M12 GOAP/BehaviorTree集成
- **战斗AI决策**：GOAP用于战斗中的目标导向决策（攻击/撤退/技能）
- **单位行为树**：BehaviorTree用于单位行为（巡逻/警戒/战斗/撤退）
- **指挥官AI**：GOAP用于指挥官的战术决策
- **技能选择**：GOAP规划技能使用顺序

### 5.8 与M11 ActionStateMachine集成
- **战斗动作状态机**：ActionStateMachine用于单位战斗动作（攻击/受击/死亡/技能）
- **动作-战斗同步**：动作播放与战斗计算同步
- **动画事件**：动画事件触发伤害判定
- **动作取消**：技能/移动可以取消当前动作

### 5.9 与战策RTS直接集成
- **战斗系统核心**：军事系统是战策RTS的核心战斗玩法
- **单位系统**：CombatUnitSystem直接对应RTS的单位
- **科技树**：MilitaryTech对应RTS的科技树
- **建筑系统**：训练建筑/防御建筑与军事系统集成
- **资源系统**：军事经济与RTS资源系统集成
- **AI对手**：CombatAI对应RTS的AI对手

---

## 六、开发计划与Phase划分

### Phase 1: 战斗单位系统（CombatUnitSystem）
**目标**：实现基础战斗单位和属性系统
**核心功能**：
- 单位管理（创建/检索/更新/销毁）
- 12种单位类别（步兵/骑兵/弓箭手/法师/攻城器/战车/海军/飞行/英雄/辅助/工人/自定义）
- 单位属性（生命/法力/攻击/护甲/魔抗/速度/射程/视野）
- 单位状态（11种状态：空闲/移动/攻击/施法/防御/撤退/眩晕/定身/沉默/死亡）
- 经验与等级系统
- 士气系统（6种士气状态）
- 装备槽系统
- Buff/Debuff系统
- 单位统计（伤害/治疗/击杀）
- 序列化
**预估测试**：60-70个

### Phase 2: 伤害与护甲系统（DamageArmorSystem）
**目标**：实现完整的伤害计算和护甲系统
**核心功能**：
- 13种伤害类型（物理/穿刺/挥砍/钝击/魔法/火焰/冰霜/闪电/毒素/神圣/暗影/真实）
- 7种护甲类型（无甲/轻甲/中甲/重甲/魔法护甲/天然护甲/强化护甲）
- 伤害计算（基础伤害/护甲减免/抗性减免/暴击/格挡/闪避）
- 伤害修饰器系统（增益/减益/光环/装备）
- 元素抗性与弱点
- 种族克制
- 伤害日志（可追溯/回放支持）
- 伤害结果对象
- 序列化
**预估测试**：50-60个

### Phase 3: 技能与能力系统（SkillAbilitySystem）
**目标**：实现完整的技能和能力系统
**核心功能**：
- 技能管理（注册/检索/升级/解锁）
- 8种技能类型（主动/被动/开关/通道/光环/触发/终极）
- 12种技能类别（伤害/治疗/增益/减益/位移/控制/召唤/实用/防御/进攻/自定义）
- 14种目标类型（单体/范围/方向/自身/友军/敌军等）
- 技能效果系统（24种效果类型）
- 冷却系统（公共冷却/独立冷却/冷却缩减）
- 资源消耗（法力/能量/怒气/生命/弹药）
- 技能组合（连招/协同/组合技）
- 持续效果（DoT/HoT）
- 控制效果（眩晕/定身/沉默/减速/击退）
- 序列化
**预估测试**：60-70个

### Phase 4: 编队与阵型系统（FormationSystem）
**目标**：实现编队管理和阵型系统
**核心功能**：
- 阵型管理（创建/检索/更新/销毁）
- 16种阵型类型（方阵/线阵/楔形/锥形/圆形/鹤翼/鱼鳞/锋矢等）
- 阵型位置（相对位置/角色/偏好单位类型）
- 阵型效果（攻击/防御/速度/视野加成）
- 编队管理（单位分组/编队移动/编队旋转）
- 阵型切换（切换时间/切换消耗/切换惩罚）
- 阵型AI（自动调整/自适应阵型）
- 阵型要求（单位类型/最少单位数）
- 序列化
**预估测试**：40-50个

### Phase 5: 战斗AI系统（CombatAISystem）
**目标**：实现战斗AI和战术系统
**核心功能**：
- 目标选择（最近/最弱/最强/威胁最高/优先级）
- 行为决策（攻击/撤退/防御/技能/移动/集结）
- 战术AI（包抄/夹击/集火/分割/骚扰/撤退）
- 指挥官AI（整体战术/资源分配/单位生产）
- 5种难度等级（简单/普通/困难/极难/疯狂）
- 学习与适应（根据玩家行为调整策略）
- 威胁评估系统
- AI上下文（战场态势感知）
- AI决策日志（可调试/可回放）
- 序列化
**预估测试**：50-60个

### Phase 6: 战争与冲突系统（WarConflictSystem）
**目标**：实现战争管理和冲突系统
**核心功能**：
- 战争管理（宣战/停战/议和/投降）
- 12种战争类型（领土/资源/宗教/王朝/内战/世界大战/殖民/意识形态/圣战/劫掠）
- 6种战争状态（待宣战/进行中/僵持/和谈中/已结束/停火）
- 战争目标（12种目标类型：征服/掠夺/摧毁/附庸/解放/统一等）
- 战争分数系统
- 占领系统（被占领/争议领土）
- 战役记录系统
- 围城记录系统
- 厌战度系统
- 和谈系统（提议/接受/拒绝/还价）
- 12种和平条款（割地/赔款/羞辱/附庸/傀儡/解放等）
- 军事联盟系统
- 战争历史查询
- 序列化
**预估测试**：60-70个

### Phase 7: 军事经济系统（MilitaryEconomySystem）
**目标**：实现军事经济和后勤系统
**核心功能**：
- 单位生产（训练时间/资源消耗/人口占用/建筑要求）
- 训练队列管理
- 维护成本（军饷/补给/装备损耗/士气维护）
- 资源动员（4种动员等级/战时经济/生产倾斜）
- 军事科技树（科技解锁/单位升级/属性加成）
- 补给线（路线/效率/中断/围城）
- 围城系统（开始/更新/结束/结果）
- 军事预算管理
- 战争经济影响评估
- 与M14 ResourceProduction/Distribution/TradeExchange集成
- 序列化
**预估测试**：50-60个

### Phase 8: 军事系统总控与集成（MilitarySystem + Integration）
**目标**：整合所有子系统，实现完整的军事与战斗模拟
**核心功能**：
- MilitarySystem总控类（统一接口/子系统管理/生命周期）
- 战斗模拟（单场战斗/大规模战斗/自动战斗）
- 战役模拟（战役设置/战役结果/战役回放）
- 军事力量评估（军力评分/单位组成/科技水平）
- 与M14 CivilizationSimulation集成（战争维度深化）
- 与M14 ResourceProduction集成（武器装备生产）
- 与M14 DistributionSystem集成（军饷/战利品分配）
- 与M14 TradeExchange集成（武器贸易/战争经济）
- 与M13 GroupBehavior集成（群体战斗行为）
- 与M13 SocialRelation集成（战争→关系变化）
- 与M12 GOAP/BehaviorTree集成（战斗AI）
- 与M11 ActionStateMachine集成（战斗动作）
- 跨系统集成测试
- 端到端战斗演示
- 序列化（完整军事系统快照）
**预估测试**：50-60个（含集成测试）

### Phase 9: 性能优化与大规模验证 + SDK发布
**目标**：优化性能，验证大规模战斗，发布SDK v3.1.0
**核心功能**：
- 性能优化（空间分区/对象池/批量处理/LOD）
- 大规模战斗测试（1000+单位同屏战斗）
- 性能基准测试
- 内存占用优化
- 战斗回放系统
- 网络同步支持（确定性战斗）
- 完整测试回归
- SDK v3.1.0发布（版本号/CHANGELOG/DEVLOG/tag）
**预估测试**：30-40个

### 总预估
- **Phase数量**：9个
- **总测试数**：450-550个
- **总源文件**：约16个（8个系统 + 8个类型）
- **目标SDK版本**：v3.1.0
- **完成标准**：2750+测试全绿，构建0错误，无P0/P1 bug，端到端演示通过

---

## 七、性能优化策略

### 7.1 空间分区
- 使用网格/四叉树进行空间分区
- 战斗单位按位置分区存储
- 目标查询/范围伤害只检查相关分区
- 减少O(n²)的目标搜索复杂度

### 7.2 对象池
- 战斗单位/投射物/伤害数字使用对象池
- 死亡单位回收到对象池，生成时复用
- 减少GC压力和内存分配

### 7.3 批量处理
- 伤害计算批量处理，减少函数调用开销
- 属性更新向量化
- 使用类型化数组存储连续数据
- SIMD友好的数据布局

### 7.4 LOD（细节层次）
- 远距离单位使用简化模拟（不计算每帧动画）
- 超大规模战斗使用营级模拟（不模拟单个士兵）
- 根据玩家距离动态调整模拟精度

### 7.5 确定性计算
- 固定时间步长（fixed timestep）
- 确定性随机数生成器
- 浮点运算精度控制
- 支持战斗回放和网络同步

### 7.6 多线程（远期）
- 战斗计算可以多线程并行
- 不同阵营/不同区域的战斗并行计算
- 主线程只负责渲染和输入

---

## 八、风险与挑战

### 8.1 平衡性风险
- **风险**：战斗系统可能不平衡，某些单位/技能过强或过弱
- **缓解**：详细的数值设计/大量测试/平衡性调整工具/玩家反馈
- **验证**：自动化平衡性测试/大量对战模拟/胜率统计

### 8.2 性能风险
- **风险**：大规模战斗（1000+单位）可能导致性能问题
- **缓解**：空间分区/对象池/批量处理/LOD/营级模拟
- **验证**：Phase 9进行大规模性能基准测试

### 8.3 复杂度风险
- **风险**：军事系统涉及8个子系统，复杂度高
- **缓解**：分阶段开发/每个子系统独立测试/清晰的接口定义
- **验证**：每个Phase完成后进行集成测试

### 8.4 与战策对齐风险
- **风险**：Arboreus军事系统可能与战策RTS的战斗设计不一致
- **缓解**：与战策团队对齐设计/共享接口定义/战策优先
- **验证**：战策集成测试/战策团队评审

### 8.5 网络同步风险
- **风险**：如果战策需要多人对战，战斗需要网络同步
- **缓解**：确定性计算/固定时间步长/状态同步
- **验证**：网络同步测试/回放验证

### 8.6 AI难度风险
- **风险**：AI可能太简单（玩家无聊）或太难（玩家挫败）
- **缓解**：多难度等级/AI学习适应/可调参数
- **验证**：AI对战测试/玩家体验测试

---

## 九、参考资料

### 研究文档
- `D:\Sojourn\research\arboreus\004_action_physics_interaction_large_scale.md`（动作物理与大规模模拟）
- `D:\Sojourn\research\shared\unimplemented_directions.md`

### 经典理论
- **Lanchester方程**：兵力损耗模型（线性律/平方律）
- **战争论（克劳塞维茨）**：战争哲学/战略战术
- **孙子兵法**：东方军事思想
- **博弈论**：冲突与合作的数学模型
- **寻路算法**：A*/NavMesh/群体寻路
- **行为树**：AI行为决策
- **GOAP**：目标导向行动规划

### 游戏参考
- **星际争霸2**：RTS战斗系统标杆/平衡性/单位设计
- **帝国时代4**：历史RTS/文明/科技树/阵型
- **全面战争系列**：大规模战斗/阵型/士气/战术
- **文明6**：回合战略/战争系统/外交/科技树
- **十字军之王3**：王朝/战争/联姻/阴谋
- **欧陆风云4**：大战略/战争/外交/经济
- **魔兽争霸3**：英雄单位/技能/物品/RPG元素
- **命令与征服**：经典RTS/单位/科技树
- **英雄连**：二战RTS/掩体/士气/战术
- **战锤40K：战争黎明**：科幻RTS/种族/技能

---

## 十、下一步行动

1. **等待M15方向确认**：监控评估确定M15是否为军事与战斗系统
2. **与战策团队对齐**：如果确认，与战策团队对齐战斗设计
3. **详细设计评审**：进行详细设计评审和数值设计
4. **接口规范更新**：更新 `interface_spec.md`（如果需要）
5. **Phase 1启动**：开始战斗单位系统开发
6. **迭代开发**：按Phase顺序开发，每轮1-2个子系统

---

## 附录：与生态基础层方向对比

| 维度 | 生态基础层 | 军事与战斗系统 |
|------|-----------|--------------|
| 优先级 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 战策协同 | 高（资源点/地图） | 极高（核心战斗玩法） |
| 世界活力 | 极高（生态系统） | 中（战斗系统） |
| 工作量 | 大（8 Phase，370-450测试） | 极大（9 Phase，450-550测试） |
| 风险 | 中（生态平衡） | 高（平衡性/性能/复杂度） |
| 架构影响 | 低 | 中 |
| 与M14协同 | 高（生产→资源→生态） | 高（战争维度/军事经济） |
| 紧迫性 | 中（世界活力基础） | 高（战策发布需求） |

**建议**：如果战策发布是当前最高优先级，建议M15选择军事与战斗系统；如果世界引擎自身发展是优先，建议M15选择生态基础层。也可以考虑M15军事+M16生态的顺序。
