// Narrative system types. All narrative content is defined by the application layer.
import type { World } from "../engine/World.js";

/** Narrative chain status. */
export type NarrativeStatus = "idle" | "active" | "paused" | "completed";

/** Context passed to narrative condition and action callbacks. */
export interface NarrativeContext {
  chainId: string;
  nodeId: string;
  world: World;
  blackboard: Record<string, unknown>;
  [key: string]: unknown;
}

/** A single node in a narrative chain. */
export interface NarrativeNode {
  id: string;
  name: string;
  description?: string;
  /** Conditions that must be met to enter this node. If empty, enters immediately on transition. */
  entryConditions?: ((ctx: NarrativeContext) => boolean)[];
  /** Actions executed when entering this node. */
  onEnter?: ((ctx: NarrativeContext) => void)[];
  /** Conditions that must be met to exit this node. If empty, never auto-exits. */
  exitConditions?: ((ctx: NarrativeContext) => boolean)[];
  /** Actions executed when exiting this node. */
  onExit?: ((ctx: NarrativeContext) => void)[];
  /** Optional branch targets: condition -> target node id. If none, proceeds to next node in sequence. */
  branches?: { condition: (ctx: NarrativeContext) => boolean; targetNodeId: string }[];
  /** Whether this node is a terminal node (chain completes when entered). */
  terminal?: boolean;
}

/** Definition of a narrative chain (template, registered at runtime by application). */
export interface NarrativeChainDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: NarrativeNode[];
  /** Whether the chain can be restarted after completion. */
  repeatable?: boolean;
  /** Auto-start when conditions are met (if set, checked each tick). */
  autoStartConditions?: ((ctx: NarrativeContext) => boolean)[];
}

/** Runtime instance of a narrative chain. */
export class NarrativeChainInstance {
  readonly chainId: string;
  status: NarrativeStatus;
  currentNodeIndex: number;
  blackboard: Record<string, unknown>;
  startedAt: number;
  completedAt?: number;
  /** Number of times nodes have been entered (for progress tracking). */
  nodesEntered: number;

  constructor(chainId: string, tick: number) {
    this.chainId = chainId;
    this.status = "idle";
    this.currentNodeIndex = -1;
    this.blackboard = {};
    this.startedAt = tick;
    this.nodesEntered = 0;
  }

  /** Get current node id, or null if not active. */
  getCurrentNodeId(nodes: NarrativeNode[]): string | null {
    if (this.currentNodeIndex < 0 || this.currentNodeIndex >= nodes.length) return null;
    return nodes[this.currentNodeIndex].id;
  }

  /** Get progress percentage (0-1). */
  getProgress(nodes: NarrativeNode[]): number {
    if (nodes.length === 0) return 1;
    if (this.status === "completed") return 1;
    if (this.currentNodeIndex < 0) return 0;
    return (this.currentNodeIndex + 1) / nodes.length;
  }

  /** Serialize to plain object. */
  serialize(): Record<string, unknown> {
    return {
      chainId: this.chainId,
      status: this.status,
      currentNodeIndex: this.currentNodeIndex,
      blackboard: this.blackboard,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      nodesEntered: this.nodesEntered,
    };
  }
}
