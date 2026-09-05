# M6 NPC行为系统+动态任务+世界叙事 设计文档

## 架构定位

Seed作为虚拟世界引擎，**不实现认知/决策逻辑**。M6提供的是**行为执行框架**：
- 行为树基础设施（节点类型+执行器+黑板）
- 动态任务状态管理（任务定义由应用层配置）
- 世界叙事链（事件序列+条件触发，叙事内容由应用层定义）
- 玩家影响世界反馈（动作→世界状态变化）

**具体决策逻辑（条件判断、动作选择、任务生成、叙事内容）由SoulArena/应用层通过回调函数定义。**

## 阶段1：行为树基础设施（BehaviorTree）

### 核心组件

#### 1. BehaviorStatus（枚举）
- `Success`：节点执行成功
- `Failure`：节点执行失败
- `Running`：节点正在执行（需要多tick）

#### 2. Blackboard（黑板）
- per-agent共享数据存储
- 键值对（string → unknown）
- 支持get/set/has/delete
- 支持事件通知（数据变化时触发回调）

#### 3. BehaviorNode（节点基类）
- `tick(agent, blackboard): BehaviorStatus`
- `reset()`：重置节点状态
- 抽象类，具体节点继承

#### 4. 组合节点（Composite）
- **Sequence**：顺序执行，全部成功才成功，一个失败即失败
- **Selector**：选择执行，一个成功即成功，全部失败才失败
- **Parallel**：并行执行，可配置成功策略（全部/任意/数量）

#### 5. 装饰节点（Decorator）
- **Inverter**：取反子节点结果
- **Repeater**：重复执行子节点N次
- **UntilFail**：重复执行直到子节点失败
- **RepeatUntilSuccess**：重复执行直到子节点成功

#### 6. 叶子节点（Leaf）
- **ActionNode**：执行动作（回调函数，返回BehaviorStatus）
- **ConditionNode**：检查条件（回调函数，返回true/false）
- **WaitNode**：等待N tick

#### 7. BehaviorTree（行为树容器）
- root节点 + blackboard
- `tick(agent)`：执行一次行为树
- `reset()`：重置整棵树
- 支持序列化/反序列化（ISerializable）

#### 8. BehaviorTreeSystem（WorldSystem）
- 管理多个agent的行为树
- `registerAgent(agentId, behaviorTree)`
- `unregisterAgent(agentId)`
- tick时依次执行所有agent的行为树
- 支持启用/禁用

### 架构约束遵守

1. **不实现决策逻辑**：ActionNode/ConditionNode的回调由应用层定义
2. **不硬编码具体行为**：行为树结构由应用层构建
3. **抽象可配置**：所有节点类型通用，不绑定具体游戏/世界
4. **与SoulArena分工**：SoulArena负责决策（选择行为树、定义条件/动作），Seed负责执行（行为树tick、状态管理）

### 测试计划

- BehaviorStatus枚举
- Blackboard基本操作（get/set/has/delete）
- Blackboard事件通知
- Sequence节点（全部成功/第一个失败/中间失败）
- Selector节点（第一个成功/全部失败/中间成功）
- Parallel节点（全部成功/任意成功/数量阈值）
- Inverter装饰器
- Repeater装饰器
- UntilFail装饰器
- ActionNode（成功/失败/Running）
- ConditionNode（true/false）
- WaitNode
- BehaviorTree基本执行
- BehaviorTree reset
- BehaviorTreeSystem注册/执行/注销
- ISerializable序列化/反序列化

预计20+个测试。
