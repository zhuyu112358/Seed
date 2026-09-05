// BehaviorTreeSystem: WorldSystem that manages and executes behavior trees for multiple agents.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import { BehaviorTree } from "./BehaviorTree.js";
import { BehaviorAgent } from "./BehaviorNode.js";

export class BehaviorTreeSystem {
  enabled = true;
  private trees = new Map<string, BehaviorTree>();
  private agentData = new Map<string, BehaviorAgent>();

  /** Register an agent with a behavior tree. */
  registerAgent(agentId: string, tree: BehaviorTree, agent?: BehaviorAgent): void {
    this.trees.set(agentId, tree);
    if (agent) {
      this.agentData.set(agentId, agent);
    } else {
      this.agentData.set(agentId, { id: agentId });
    }
  }

  /** Unregister an agent. */
  unregisterAgent(agentId: string): boolean {
    this.agentData.delete(agentId);
    return this.trees.delete(agentId);
  }

  /** Check if an agent is registered. */
  hasAgent(agentId: string): boolean {
    return this.trees.has(agentId);
  }

  /** Get the behavior tree for an agent. */
  getTree(agentId: string): BehaviorTree | undefined {
    return this.trees.get(agentId);
  }

  /** Get all registered agent IDs. */
  getAgentIds(): string[] {
    return Array.from(this.trees.keys());
  }

  /** Number of registered agents. */
  get size(): number {
    return this.trees.size;
  }

  /** WorldSystem interface: called each tick. */
  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;
    for (const [agentId, tree] of this.trees) {
      const agent = this.agentData.get(agentId) ?? { id: agentId };
      tree.tick(agent);
    }
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.trees.clear();
    this.agentData.clear();
  }

  /** Reset all behavior trees. */
  resetAll(): void {
    for (const tree of this.trees.values()) {
      tree.reset();
    }
  }

  /** Serialize all tree states. */
  serialize(): Record<string, unknown> {
    const trees: Record<string, unknown> = {};
    for (const [id, tree] of this.trees) {
      trees[id] = tree.serialize();
    }
    return { trees };
  }

  /** Deserialize tree states. Trees must be re-registered by application first. */
  deserialize(data: Record<string, unknown>): void {
    const treesData = data.trees as Record<string, Record<string, unknown>> | undefined;
    if (!treesData) return;
    for (const [id, treeData] of Object.entries(treesData)) {
      const tree = this.trees.get(id);
      if (tree) {
        tree.deserialize(treeData);
      }
    }
  }
}
