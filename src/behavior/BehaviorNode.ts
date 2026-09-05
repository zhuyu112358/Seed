// Behavior tree nodes: base, composites, decorators, and leaves.
// All decision logic is in callbacks defined by the application layer.
import { BehaviorStatus } from "./BehaviorStatus.js";
import { Blackboard } from "./Blackboard.js";

/** Agent context passed to behavior tree ticks. */
export interface BehaviorAgent {
  id: string;
  [key: string]: unknown;
}

/** Base class for all behavior tree nodes. */
export abstract class BehaviorNode {
  protected status: BehaviorStatus = BehaviorStatus.Success;
  protected children: BehaviorNode[] = [];

  /** Execute this node for one tick. */
  abstract tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus;

  /** Reset node state (for Running nodes). */
  reset(): void {
    this.status = BehaviorStatus.Success;
    for (const child of this.children) {
      child.reset();
    }
  }

  /** Add a child node. Returns this for chaining. */
  addChild(node: BehaviorNode): this {
    this.children.push(node);
    return this;
  }

  /** Get current status. */
  getStatus(): BehaviorStatus {
    return this.status;
  }
}

// === Composite Nodes ===

/** Sequence: executes children in order. Succeeds if all succeed, fails on first failure. */
export class Sequence extends BehaviorNode {
  private currentIndex = 0;

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const result = child.tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running;
      }
      if (result === BehaviorStatus.Failure) {
        this.status = BehaviorStatus.Failure;
        this.currentIndex = 0;
        return BehaviorStatus.Failure;
      }
      this.currentIndex++;
    }
    this.status = BehaviorStatus.Success;
    this.currentIndex = 0;
    return BehaviorStatus.Success;
  }

  reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}

/** Selector: executes children in order. Succeeds on first success, fails if all fail. */
export class Selector extends BehaviorNode {
  private currentIndex = 0;

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const result = child.tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running;
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

/** Parallel success policy. */
export enum ParallelPolicy {
  RequireAll = "require_all",   // Succeeds only when all children succeed
  RequireAny = "require_any",   // Succeeds when any child succeeds
  RequireCount = "require_count", // Succeeds when N children succeed
}

/** Parallel: executes all children each tick. Success based on policy. */
export class Parallel extends BehaviorNode {
  private childResults: Map<number, BehaviorStatus> = new Map();

  constructor(
    private policy: ParallelPolicy = ParallelPolicy.RequireAll,
    private requiredCount = 1,
  ) {
    super();
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    let successCount = 0;
    let failureCount = 0;
    let runningCount = 0;

    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      const existing = this.childResults.get(i);
      if (existing === BehaviorStatus.Success || existing === BehaviorStatus.Failure) {
        if (existing === BehaviorStatus.Success) successCount++;
        else failureCount++;
        continue;
      }
      const result = child.tick(agent, blackboard);
      this.childResults.set(i, result);
      if (result === BehaviorStatus.Success) successCount++;
      else if (result === BehaviorStatus.Failure) failureCount++;
      else runningCount++;
    }

    // Check policy
    if (this.policy === ParallelPolicy.RequireAll) {
      if (successCount === this.children.length) {
        this.status = BehaviorStatus.Success;
        this.childResults.clear();
        return BehaviorStatus.Success;
      }
      if (failureCount > 0) {
        this.status = BehaviorStatus.Failure;
        this.childResults.clear();
        return BehaviorStatus.Failure;
      }
    } else if (this.policy === ParallelPolicy.RequireAny) {
      if (successCount > 0) {
        this.status = BehaviorStatus.Success;
        this.childResults.clear();
        return BehaviorStatus.Success;
      }
      if (failureCount === this.children.length) {
        this.status = BehaviorStatus.Failure;
        this.childResults.clear();
        return BehaviorStatus.Failure;
      }
    } else if (this.policy === ParallelPolicy.RequireCount) {
      if (successCount >= this.requiredCount) {
        this.status = BehaviorStatus.Success;
        this.childResults.clear();
        return BehaviorStatus.Success;
      }
      if (failureCount > this.children.length - this.requiredCount) {
        this.status = BehaviorStatus.Failure;
        this.childResults.clear();
        return BehaviorStatus.Failure;
      }
    }

    this.status = BehaviorStatus.Running;
    return BehaviorStatus.Running;
  }

  reset(): void {
    super.reset();
    this.childResults.clear();
  }
}

// === Decorator Nodes ===

/** Inverter: inverts child result (Success<->Failure, Running stays Running). */
export class Inverter extends BehaviorNode {
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
    this.status = result === BehaviorStatus.Success ? BehaviorStatus.Failure : BehaviorStatus.Success;
    return this.status;
  }
}

/** Repeater: repeats child N times. Succeeds after N successes, fails on first failure. */
export class Repeater extends BehaviorNode {
  private count = 0;

  constructor(private repeatCount: number, child: BehaviorNode) {
    super();
    this.children.push(child);
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    while (this.count < this.repeatCount) {
      const result = this.children[0].tick(agent, blackboard);
      if (result === BehaviorStatus.Running) {
        this.status = BehaviorStatus.Running;
        return BehaviorStatus.Running;
      }
      if (result === BehaviorStatus.Failure) {
        this.status = BehaviorStatus.Failure;
        this.count = 0;
        return BehaviorStatus.Failure;
      }
      this.count++;
      this.children[0].reset();
    }
    this.status = BehaviorStatus.Success;
    this.count = 0;
    return BehaviorStatus.Success;
  }

  reset(): void {
    super.reset();
    this.count = 0;
  }
}

/** UntilFail: repeats child until it fails. Always succeeds when child fails. */
export class UntilFail extends BehaviorNode {
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
    if (result === BehaviorStatus.Failure) {
      this.status = BehaviorStatus.Success;
      this.children[0].reset();
      return BehaviorStatus.Success;
    }
    this.children[0].reset();
    this.status = BehaviorStatus.Running;
    return BehaviorStatus.Running;
  }
}

// === Leaf Nodes ===

/** ActionNode: executes a callback action. Callback returns BehaviorStatus. */
export class ActionNode extends BehaviorNode {
  constructor(
    private name: string,
    private action: (agent: BehaviorAgent, blackboard: Blackboard) => BehaviorStatus,
  ) {
    super();
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    this.status = this.action(agent, blackboard);
    return this.status;
  }

  getName(): string {
    return this.name;
  }
}

/** ConditionNode: checks a condition. Returns Success if true, Failure if false. */
export class ConditionNode extends BehaviorNode {
  constructor(
    private name: string,
    private condition: (agent: BehaviorAgent, blackboard: Blackboard) => boolean,
  ) {
    super();
  }

  tick(agent: BehaviorAgent, blackboard: Blackboard): BehaviorStatus {
    this.status = this.condition(agent, blackboard) ? BehaviorStatus.Success : BehaviorStatus.Failure;
    return this.status;
  }

  getName(): string {
    return this.name;
  }
}

/** WaitNode: waits N ticks before succeeding. */
export class WaitNode extends BehaviorNode {
  private elapsed = 0;

  constructor(private waitTicks: number) {
    super();
  }

  tick(_agent: BehaviorAgent, _blackboard: Blackboard): BehaviorStatus {
    this.elapsed++;
    if (this.elapsed >= this.waitTicks) {
      this.status = BehaviorStatus.Success;
      this.elapsed = 0;
      return BehaviorStatus.Success;
    }
    this.status = BehaviorStatus.Running;
    return BehaviorStatus.Running;
  }

  reset(): void {
    super.reset();
    this.elapsed = 0;
  }
}
