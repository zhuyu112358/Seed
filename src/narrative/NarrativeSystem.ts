// NarrativeSystem: manages narrative chains, node transitions, and event emission.
// All narrative content (nodes, conditions, actions) is defined by the application layer.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  NarrativeChainDefinition,
  NarrativeChainInstance,
  NarrativeNode,
  NarrativeContext,
} from "./NarrativeTypes.js";
import {
  NarrativeStartedEvent,
  NarrativeNodeEnteredEvent,
  NarrativeNodeExitedEvent,
  NarrativeBranchEvent,
  NarrativeCompletedEvent,
} from "./NarrativeEvents.js";

export class NarrativeSystem {
  readonly name = "narrative";
  enabled = true;
  private definitions = new Map<string, NarrativeChainDefinition>();
  /** chainId -> NarrativeChainInstance */
  private instances = new Map<string, NarrativeChainInstance>();

  /** Register a narrative chain definition. Throws if ID already exists. */
  registerChain(definition: NarrativeChainDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Narrative chain already exists: ${definition.id}`);
    }
    this.definitions.set(definition.id, definition);
  }

  /** Remove a narrative chain definition. */
  unregisterChain(chainId: string): boolean {
    return this.definitions.delete(chainId);
  }

  /** Get a chain definition by ID. */
  getChainDefinition(chainId: string): NarrativeChainDefinition | undefined {
    return this.definitions.get(chainId);
  }

  /** Get all registered chain IDs. */
  getChainIds(): string[] {
    return Array.from(this.definitions.keys());
  }

  /** Start a narrative chain. Returns the instance or null if already active. */
  startChain(chainId: string, events: EventSystem, tick: number): NarrativeChainInstance | null {
    const def = this.definitions.get(chainId);
    if (!def) return null;
    const existing = this.instances.get(chainId);
    if (existing && existing.status === "active") return null;
    if (existing && existing.status === "completed" && !def.repeatable) return null;

    const instance = new NarrativeChainInstance(chainId, tick);
    instance.status = "active";
    this.instances.set(chainId, instance);

    events.emit(new NarrativeStartedEvent(chainId, def.name));

    // Enter the first node.
    this.enterNode(instance, def, 0, events);
    return instance;
  }

  /** Pause an active narrative chain. */
  pauseChain(chainId: string): boolean {
    const instance = this.instances.get(chainId);
    if (!instance || instance.status !== "active") return false;
    instance.status = "paused";
    return true;
  }

  /** Resume a paused narrative chain. */
  resumeChain(chainId: string): boolean {
    const instance = this.instances.get(chainId);
    if (!instance || instance.status !== "paused") return false;
    instance.status = "active";
    return true;
  }

  /** Reset a narrative chain to idle state. */
  resetChain(chainId: string, tick: number): boolean {
    const def = this.definitions.get(chainId);
    if (!def) return false;
    const instance = new NarrativeChainInstance(chainId, tick);
    this.instances.set(chainId, instance);
    return true;
  }

  /** Get the active instance for a chain. */
  getInstance(chainId: string): NarrativeChainInstance | undefined {
    return this.instances.get(chainId);
  }

  /** Get all active chain instances. */
  getActiveChains(): NarrativeChainInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.status === "active");
  }

  /** Check if all entry conditions are met for a node. */
  private checkEntryConditions(node: NarrativeNode, ctx: NarrativeContext): boolean {
    if (!node.entryConditions || node.entryConditions.length === 0) return true;
    for (const condition of node.entryConditions) {
      if (!condition(ctx)) return false;
    }
    return true;
  }

  /** Check if any exit condition is met for a node. */
  private checkExitConditions(node: NarrativeNode, ctx: NarrativeContext): boolean {
    if (!node.exitConditions || node.exitConditions.length === 0) return false;
    for (const condition of node.exitConditions) {
      if (condition(ctx)) return true;
    }
    return false;
  }

  /** Enter a node by index. Executes onEnter actions and emits event. */
  private enterNode(
    instance: NarrativeChainInstance,
    def: NarrativeChainDefinition,
    nodeIndex: number,
    events: EventSystem,
  ): void {
    if (nodeIndex < 0 || nodeIndex >= def.nodes.length) return;
    const node = def.nodes[nodeIndex];
    instance.currentNodeIndex = nodeIndex;
    instance.nodesEntered++;

    const ctx = this.makeContext(instance, def, node);

    // Execute onEnter actions.
    if (node.onEnter) {
      for (const action of node.onEnter) {
        action(ctx);
      }
    }

    events.emit(new NarrativeNodeEnteredEvent(def.id, node.id, node.name));

    // If terminal node, complete the chain.
    if (node.terminal) {
      this.completeChain(instance, def, events);
    }
  }

  /** Exit the current node. Executes onExit actions and emits event. */
  private exitCurrentNode(
    instance: NarrativeChainInstance,
    def: NarrativeChainDefinition,
    events: EventSystem,
  ): NarrativeNode | null {
    if (instance.currentNodeIndex < 0) return null;
    const node = def.nodes[instance.currentNodeIndex];
    const ctx = this.makeContext(instance, def, node);

    // Execute onExit actions.
    if (node.onExit) {
      for (const action of node.onExit) {
        action(ctx);
      }
    }

    events.emit(new NarrativeNodeExitedEvent(def.id, node.id, node.name));
    return node;
  }

  /** Determine the next node index based on branches or sequential progression. */
  private getNextNodeIndex(
    instance: NarrativeChainInstance,
    def: NarrativeChainDefinition,
    currentNode: NarrativeNode,
  ): { index: number; branched: boolean } {
    const ctx = this.makeContext(instance, def, currentNode);

    // Check branches first.
    if (currentNode.branches) {
      for (const branch of currentNode.branches) {
        if (branch.condition(ctx)) {
          const targetIndex = def.nodes.findIndex((n) => n.id === branch.targetNodeId);
          if (targetIndex >= 0) {
            return { index: targetIndex, branched: true };
          }
        }
      }
    }

    // Sequential progression.
    const nextIndex = instance.currentNodeIndex + 1;
    if (nextIndex >= def.nodes.length) {
      return { index: -1, branched: false }; // End of chain.
    }
    return { index: nextIndex, branched: false };
  }

  /** Complete a narrative chain. */
  private completeChain(
    instance: NarrativeChainInstance,
    def: NarrativeChainDefinition,
    events: EventSystem,
  ): void {
    instance.status = "completed";
    instance.completedAt = Date.now();
    events.emit(new NarrativeCompletedEvent(def.id, def.name, instance.nodesEntered));
  }

  /** Make a narrative context for callbacks. */
  private makeContext(
    instance: NarrativeChainInstance,
    def: NarrativeChainDefinition,
    node: NarrativeNode,
  ): NarrativeContext {
    return {
      chainId: def.id,
      nodeId: node.id,
      world: {} as World, // Will be set during tick if world is available.
      blackboard: instance.blackboard,
    };
  }

  /** WorldSystem interface: called each tick. Advances active chains. */
  tick(_dt: number, world: World, events: EventSystem): void {
    if (!this.enabled) return;

    for (const [chainId, instance] of this.instances) {
      if (instance.status !== "active") continue;
      const def = this.definitions.get(chainId);
      if (!def) continue;
      if (instance.currentNodeIndex < 0) continue;

      const currentNode = def.nodes[instance.currentNodeIndex];
      const ctx = this.makeContext(instance, def, currentNode);
      ctx.world = world;

      // Check if current node should exit.
      if (this.checkExitConditions(currentNode, ctx)) {
        const exitedNode = this.exitCurrentNode(instance, def, events);
        if (!exitedNode) continue;

        const { index: nextIndex, branched } = this.getNextNodeIndex(instance, def, exitedNode);

        if (branched) {
          events.emit(new NarrativeBranchEvent(chainId, exitedNode.id, def.nodes[nextIndex].id));
        }

        if (nextIndex < 0) {
          // End of chain.
          this.completeChain(instance, def, events);
        } else {
          // Check entry conditions for next node.
          const nextNode = def.nodes[nextIndex];
          if (this.checkEntryConditions(nextNode, { ...ctx, nodeId: nextNode.id })) {
            this.enterNode(instance, def, nextIndex, events);
          }
          // If entry conditions not met, stay at current node (exited but waiting).
          // In a more complex implementation, could add a "waiting" state.
        }
      }
    }
  }

  /** WorldSystem interface: cleanup. */
  stop(): void {
    this.definitions.clear();
    this.instances.clear();
  }

  /** Number of registered chains. */
  get chainCount(): number {
    return this.definitions.size;
  }

  /** Serialize all narrative state. */
  serialize(): Record<string, unknown> {
    const instances: Record<string, unknown> = {};
    for (const [chainId, instance] of this.instances) {
      instances[chainId] = instance.serialize();
    }
    return { instances };
  }
}
