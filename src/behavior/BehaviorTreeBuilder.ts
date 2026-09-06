// BehaviorTreeBuilder: fluent API for constructing behavior trees.
// M12 Phase 4: Behavior tree enhancement.
import { BehaviorStatus } from "./BehaviorStatus.js";
import { Blackboard } from "./Blackboard.js";
import { BehaviorTree } from "./BehaviorTree.js";
import {
  BehaviorNode,
  BehaviorAgent,
  Sequence,
  Selector,
  Parallel,
  ParallelPolicy,
  Inverter,
  Repeater,
  UntilFail,
  ActionNode,
  ConditionNode,
  WaitNode,
} from "./BehaviorNode.js";
import {
  RandomSequence,
  RandomSelector,
  StatefulSelector,
  Cooldown,
  TimeLimit,
  ForceSuccess,
  ForceFailure,
  RepeatUntil,
  Counter,
  SubTree,
  LogNode,
} from "./BehaviorEnhanced.js";

/** Fluent builder for behavior trees. */
export class BehaviorTreeBuilder {
  private root: BehaviorNode | null = null;
  private blackboard: Blackboard | null = null;

  /** Set the root node. */
  rootNode(node: BehaviorNode): this {
    this.root = node;
    return this;
  }

  /** Set a custom blackboard. */
  withBlackboard(blackboard: Blackboard): this {
    this.blackboard = blackboard;
    return this;
  }

  // === Composite builders ===

  /** Create a Sequence composite. */
  sequence(...children: BehaviorNode[]): Sequence {
    const node = new Sequence();
    for (const child of children) node.addChild(child);
    return node;
  }

  /** Create a Selector composite. */
  selector(...children: BehaviorNode[]): Selector {
    const node = new Selector();
    for (const child of children) node.addChild(child);
    return node;
  }

  /** Create a Parallel composite. */
  parallel(policy: ParallelPolicy = ParallelPolicy.RequireAll, requiredCount = 1, ...children: BehaviorNode[]): Parallel {
    const node = new Parallel(policy, requiredCount);
    for (const child of children) node.addChild(child);
    return node;
  }

  /** Create a RandomSequence composite. */
  randomSequence(...children: BehaviorNode[]): RandomSequence {
    const node = new RandomSequence();
    for (const child of children) node.addChild(child);
    return node;
  }

  /** Create a RandomSelector composite. */
  randomSelector(...children: BehaviorNode[]): RandomSelector {
    const node = new RandomSelector();
    for (const child of children) node.addChild(child);
    return node;
  }

  /** Create a StatefulSelector composite. */
  statefulSelector(...children: BehaviorNode[]): StatefulSelector {
    const node = new StatefulSelector();
    for (const child of children) node.addChild(child);
    return node;
  }

  // === Decorator builders ===

  /** Create an Inverter decorator. */
  inverter(child: BehaviorNode): Inverter {
    return new Inverter(child);
  }

  /** Create a Repeater decorator. */
  repeater(count: number, child: BehaviorNode): Repeater {
    return new Repeater(count, child);
  }

  /** Create an UntilFail decorator. */
  untilFail(child: BehaviorNode): UntilFail {
    return new UntilFail(child);
  }

  /** Create a Cooldown decorator. */
  cooldown(ticks: number, child: BehaviorNode): Cooldown {
    return new Cooldown(ticks, child);
  }

  /** Create a TimeLimit decorator. */
  timeLimit(maxTicks: number, child: BehaviorNode): TimeLimit {
    return new TimeLimit(maxTicks, child);
  }

  /** Create a ForceSuccess decorator. */
  forceSuccess(child: BehaviorNode): ForceSuccess {
    return new ForceSuccess(child);
  }

  /** Create a ForceFailure decorator. */
  forceFailure(child: BehaviorNode): ForceFailure {
    return new ForceFailure(child);
  }

  /** Create a RepeatUntil decorator. */
  repeatUntil(targetStatus: BehaviorStatus, maxIterations: number, child: BehaviorNode): RepeatUntil {
    return new RepeatUntil(targetStatus, maxIterations, child);
  }

  // === Leaf builders ===

  /** Create an ActionNode. */
  action(name: string, action: (agent: BehaviorAgent, blackboard: Blackboard) => BehaviorStatus): ActionNode {
    return new ActionNode(name, action);
  }

  /** Create a ConditionNode. */
  condition(name: string, condition: (agent: BehaviorAgent, blackboard: Blackboard) => boolean): ConditionNode {
    return new ConditionNode(name, condition);
  }

  /** Create a WaitNode. */
  wait(ticks: number): WaitNode {
    return new WaitNode(ticks);
  }

  /** Create a Counter node. */
  counter(targetCount: number): Counter {
    return new Counter(targetCount);
  }

  /** Create a SubTree node. */
  subTree(treeName: string): SubTree {
    return new SubTree(treeName);
  }

  /** Create a LogNode. */
  log(message: string, logKey = "bt_log"): LogNode {
    return new LogNode(message, logKey);
  }

  // === Build ===

  /** Build the BehaviorTree. Root must be set. */
  build(): BehaviorTree {
    if (!this.root) {
      throw new Error("BehaviorTreeBuilder: root node not set. Call rootNode() first.");
    }
    return new BehaviorTree(this.root, this.blackboard ?? undefined);
  }

  /** Create a new builder instance. */
  static create(): BehaviorTreeBuilder {
    return new BehaviorTreeBuilder();
  }
}
