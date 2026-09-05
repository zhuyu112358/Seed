// BehaviorTree: container for a behavior tree with its own blackboard.
import { BehaviorStatus } from "./BehaviorStatus.js";
import { Blackboard } from "./Blackboard.js";
import { BehaviorNode, BehaviorAgent } from "./BehaviorNode.js";

export class BehaviorTree {
  private root: BehaviorNode;
  private blackboard: Blackboard;
  private lastStatus: BehaviorStatus = BehaviorStatus.Success;
  private tickCount = 0;

  constructor(root: BehaviorNode, blackboard?: Blackboard) {
    this.root = root;
    this.blackboard = blackboard ?? new Blackboard();
  }

  /** Execute one tick of the behavior tree. */
  tick(agent: BehaviorAgent): BehaviorStatus {
    this.tickCount++;
    this.lastStatus = this.root.tick(agent, this.blackboard);
    return this.lastStatus;
  }

  /** Reset the entire tree. */
  reset(): void {
    this.root.reset();
    this.lastStatus = BehaviorStatus.Success;
  }

  /** Get the blackboard. */
  getBlackboard(): Blackboard {
    return this.blackboard;
  }

  /** Get last execution status. */
  getLastStatus(): BehaviorStatus {
    return this.lastStatus;
  }

  /** Get total tick count. */
  getTickCount(): number {
    return this.tickCount;
  }

  /** Set the root node. */
  setRoot(root: BehaviorNode): void {
    this.root = root;
  }

  /** Serialize tree state (blackboard + tickCount + lastStatus). */
  serialize(): Record<string, unknown> {
    return {
      blackboard: this.blackboard.toJSON(),
      tickCount: this.tickCount,
      lastStatus: this.lastStatus,
    };
  }

  /** Deserialize tree state. Tree structure must be rebuilt by application. */
  deserialize(data: Record<string, unknown>): void {
    if (data.blackboard && typeof data.blackboard === "object") {
      const bb = Blackboard.fromJSON(data.blackboard as Record<string, unknown>);
      this.blackboard = bb;
    }
    if (typeof data.tickCount === "number") {
      this.tickCount = data.tickCount;
    }
    if (typeof data.lastStatus === "string") {
      this.lastStatus = data.lastStatus as BehaviorStatus;
    }
  }
}
