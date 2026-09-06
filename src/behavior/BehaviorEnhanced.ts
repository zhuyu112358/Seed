// Enhanced behavior tree nodes for M12 Phase 4.
// Additional composites, decorators, and utilities beyond the base set.
import { BehaviorStatus } from "./BehaviorStatus.js";
import { Blackboard } from "./Blackboard.js";
import { BehaviorNode, BehaviorAgent } from "./BehaviorNode.js";

// === Enhanced Composite Nodes ===

/**
 * RandomSequence: executes children in random order each tick.
 * Succeeds if all succeed, fails on first failure.
 */
export class RandomSequence extends BehaviorNode {
  private currentIndex = 0;
  private order: number[] = [];

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    // Build random order on first tick or after reset.
    if (this.order.length === 0) {
      this.order = this.children.map((_, i) => i);
      this.shuffle(this.order);
    }

    while (this.currentIndex < this.order.length) {
      const childIndex = this.order[this.currentIndex];
      const child = this.children[childIndex];
      const result = child.tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running;
      }
      if (result === BehaviorStatus.Failure) {
        this.status = BehaviorStatus.Failure;
        this.reset();
        return BehaviorStatus.Failure;
      }
      this.currentIndex++;
    }
    this.status = BehaviorStatus.Success;
    this.reset();
    return BehaviorStatus.Success;
  }

  reset(): void {
    super.reset();
    this.currentIndex = 0;
    this.order = [];
  }

  private shuffle(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

/**
 * RandomSelector: executes children in random order each tick.
 * Succeeds on first success, fails if all fail.
 */
export class RandomSelector extends BehaviorNode {
  private currentIndex = 0;
  private order: number[] = [];

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    if (this.order.length === 0) {
      this.order = this.children.map((_, i) => i);
      this.shuffle(this.order);
    }

    while (this.currentIndex < this.order.length) {
      const childIndex = this.order[this.currentIndex];
      const child = this.children[childIndex];
      const result = child.tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running;
      }
      if (result === BehaviorStatus.Success) {
        this.status = BehaviorStatus.Success;
        this.reset();
        return BehaviorStatus.Success;
      }
      this.currentIndex++;
    }
    this.status = BehaviorStatus.Failure;
    this.reset();
    return BehaviorStatus.Failure;
  }

  reset(): void {
    super.reset();
    this.currentIndex = 0;
    this.order = [];
  }

  private shuffle(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

/**
 * StatefulSelector: like Selector but remembers the last running child
 * and resumes from it on the next tick, rather than restarting from the first child.
 */
export class StatefulSelector extends BehaviorNode {
  private currentIndex = 0;

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const result = child.tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running; // Keep currentIndex for resume.
      }
      if (result === BehaviorStatus.Success) {
        this.status = BehaviorStatus.Success;
        this.currentIndex = 0;
        return BehaviorStatus.Success;
      }
      this.currentIndex++;
    }
    this.status = BehaviorStatus.Failure;
    this.currentIndex = 0;
    return BehaviorStatus.Failure;
  }

  reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}

// === Enhanced Decorator Nodes ===

/**
 * Cooldown: after child completes (success or failure), prevents it from
 * running again for N ticks. During cooldown, returns Failure.
 */
export class Cooldown extends BehaviorNode {
  private cooldownRemaining = 0;

  constructor(
    private cooldownTicks: number,
    child: BehaviorNode,
  ) {
    super();
    this.children.push(child);
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining--;
      this.status = BehaviorStatus.Failure;
      return BehaviorStatus.Failure;
    }

    const result = this.children[0].tick(agent, blackboard);
    if (result === BehaviorStatus.Running) {
      this.status = BehaviorStatus.Running;
      return BehaviorStatus.Running;
    }

    // Start cooldown after completion.
    this.cooldownRemaining = this.cooldownTicks;
    this.status = result;
    return result;
  }

  reset(): void {
    super.reset();
    this.cooldownRemaining = 0;
  }
}

/**
 * TimeLimit: child must complete within N ticks. If still Running after
 * N ticks, returns Failure and resets child.
 */
export class TimeLimit extends BehaviorNode {
  private elapsed = 0;

  constructor(
    private maxTicks: number,
    child: BehaviorNode,
  ) {
    super();
    this.children.push(child);
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    this.elapsed++;
    const result = this.children[0].tick(agent, blackboard);

    if (result === BehaviorStatus.Running && this.elapsed >= this.maxTicks) {
      this.children[0].reset();
      this.status = BehaviorStatus.Failure;
      this.elapsed = 0;
      return BehaviorStatus.Failure;
    }

    if (result !== BehaviorStatus.Running) {
      this.elapsed = 0;
      this.children[0].reset();
    }

    this.status = result;
    return result;
  }

  reset(): void {
    super.reset();
    this.elapsed = 0;
  }
}

/**
 * ForceSuccess: always returns Success regardless of child result.
 * If child is Running, returns Running.
 */
export class ForceSuccess extends BehaviorNode {
  constructor(child: BehaviorNode) {
    super();
    this.children.push(child);
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    const result = this.children[0].tick(agent, blackboard);
    if (result === BehaviorStatus.Running) {
      this.status = BehaviorStatus.Running;
      return BehaviorStatus.Running;
    }
    this.status = BehaviorStatus.Success;
    return BehaviorStatus.Success;
  }
}

/**
 * ForceFailure: always returns Failure regardless of child result.
 * If child is Running, returns Running.
 */
export class ForceFailure extends BehaviorNode {
  constructor(child: BehaviorNode) {
    super();
    this.children.push(child);
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    const result = this.children[0].tick(agent, blackboard);
    if (result === BehaviorStatus.Running) {
      this.status = BehaviorStatus.Running;
      return BehaviorStatus.Running;
    }
    this.status = BehaviorStatus.Failure;
    return BehaviorStatus.Failure;
  }
}

/**
 * RepeatUntil: repeats child until it returns the specified status.
 * Returns Success when target status reached, Failure if max iterations exceeded.
 */
export class RepeatUntil extends BehaviorNode {
  private iterations = 0;

  constructor(
    private targetStatus: BehaviorStatus,
    private maxIterations: number,
    child: BehaviorNode,
  ) {
    super();
    this.children.push(child);
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    while (this.iterations < this.maxIterations) {
      const result = this.children[0].tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running;
      }
      this.iterations++;
      if (result === this.targetStatus) {
        this.status = BehaviorStatus.Success;
        this.iterations = 0;
        this.children[0].reset();
        return BehaviorStatus.Success;
      }
      this.children[0].reset();
    }
    this.status = BehaviorStatus.Failure;
    this.iterations = 0;
    return BehaviorStatus.Failure;
  }

  reset(): void {
    super.reset();
    this.iterations = 0;
  }
}

/**
 * Counter: counts how many times it has been ticked. Succeeds after
 * reaching the target count, then resets. Returns Failure until then.
 */
export class Counter extends BehaviorNode {
  private count = 0;

  constructor(private targetCount: number) {
    super();
  }

  tick(_agent: BehaviorAgent, _blackboard: Blackboard): BehaviorStatus {
    this.count++;
    if (this.count >= this.targetCount) {
      this.count = 0;
      this.status = BehaviorStatus.Success;
      return BehaviorStatus.Success;
    }
    this.status = BehaviorStatus.Failure;
    return BehaviorStatus.Failure;
  }

  reset(): void {
    super.reset();
    this.count = 0;
  }

  /** Get current count. */
  getCount(): number {
    return this.count;
  }
}

// === Utility Nodes ===

/**
 * SubTree: references and executes another BehaviorTree by name.
 * The tree must be registered in the blackboard under "subtrees" map.
 */
export class SubTree extends BehaviorNode {
  constructor(private treeName: string) {
    super();
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    const subtrees = blackboard.get<Map<string, { tick: (a: BehaviorAgent) => BehaviorStatus }>>("subtrees");
    if (!subtrees || !subtrees.has(this.treeName)) {
      this.status = BehaviorStatus.Failure;
      return BehaviorStatus.Failure;
    }
    const tree = subtrees.get(this.treeName)!;
    this.status = tree.tick(agent);
    return this.status;
  }

  getTreeName(): string {
    return this.treeName;
  }
}

/**
 * LogNode: logs a message to the blackboard log array and returns Success.
 * Useful for debugging behavior tree execution.
 */
export class LogNode extends BehaviorNode {
  constructor(
    private message: string,
    private logKey = "bt_log",
  ) {
    super();
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    const log = blackboard.get<string[]>(this.logKey) ?? [];
    log.push(`[${agent.id}] ${this.message}`);
    blackboard.set(this.logKey, log);
    this.status = BehaviorStatus.Success;
    return BehaviorStatus.Success;
  }
}
