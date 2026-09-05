// Narrative system events.
import { Event } from "../event/Event.js";

/** Emitted when a narrative chain starts. */
export class NarrativeStartedEvent extends Event<{
  chainId: string;
  chainName: string;
}> {
  constructor(chainId: string, chainName: string) {
    super({
      type: "narrative.started",
      payload: { chainId, chainName },
      sourceId: "narrative-system",
    });
  }
}

/** Emitted when a narrative node is entered. */
export class NarrativeNodeEnteredEvent extends Event<{
  chainId: string;
  nodeId: string;
  nodeName: string;
}> {
  constructor(chainId: string, nodeId: string, nodeName: string) {
    super({
      type: "narrative.node_entered",
      payload: { chainId, nodeId, nodeName },
      sourceId: "narrative-system",
    });
  }
}

/** Emitted when a narrative node is exited. */
export class NarrativeNodeExitedEvent extends Event<{
  chainId: string;
  nodeId: string;
  nodeName: string;
}> {
  constructor(chainId: string, nodeId: string, nodeName: string) {
    super({
      type: "narrative.node_exited",
      payload: { chainId, nodeId, nodeName },
      sourceId: "narrative-system",
    });
  }
}

/** Emitted when a narrative chain branches to a non-sequential node. */
export class NarrativeBranchEvent extends Event<{
  chainId: string;
  fromNodeId: string;
  toNodeId: string;
}> {
  constructor(chainId: string, fromNodeId: string, toNodeId: string) {
    super({
      type: "narrative.branch",
      payload: { chainId, fromNodeId, toNodeId },
      sourceId: "narrative-system",
    });
  }
}

/** Emitted when a narrative chain completes. */
export class NarrativeCompletedEvent extends Event<{
  chainId: string;
  chainName: string;
  nodesEntered: number;
}> {
  constructor(chainId: string, chainName: string, nodesEntered: number) {
    super({
      type: "narrative.completed",
      payload: { chainId, chainName, nodesEntered },
      sourceId: "narrative-system",
    });
  }
}
