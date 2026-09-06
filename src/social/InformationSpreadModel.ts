// M13 Information Spread Model.
// SIR epidemic model for information spread (ideas/rumors/news),
// social influence networks, credibility assessment, and information mutation.
// All content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type {
  InformationItem,
  InformationType,
  InformationState,
  InformationNode,
  InformationMutation,
  CredibilityAssessment,
  InformationSpreadConfig,
  InformationSpreadEvent,
  InformationSpreadEventType,
  InformationSpreadStats,
} from "./InformationSpreadTypes.js";
import { DEFAULT_INFORMATION_SPREAD_CONFIG } from "./InformationSpreadTypes.js";

/** WorldSystem: information spread model with SIR dynamics. */
export class InformationSpreadModel {
  readonly name = "information-spread-model";
  enabled = true;

  private config: InformationSpreadConfig;
  private information: Map<string, InformationItem> = new Map();
  private nodes: Map<string, InformationNode> = new Map();
  // Social influence network: entityId -> Map<connectedEntityId, influenceWeight>
  private influenceNetwork: Map<string, Map<string, number>> = new Map();
  private eventHistory: InformationSpreadEvent[] = [];
  private infoCounter = 0;
  private mutationCounter = 0;
  private currentTick = 0;

  constructor(config?: Partial<InformationSpreadConfig>) {
    this.config = { ...DEFAULT_INFORMATION_SPREAD_CONFIG, ...config };
  }

  // --- Information Management ---

  /** Create a new information item and infect the source. */
  createInformation(
    type: InformationType,
    content: string,
    sourceId: string,
    options?: {
      sourceCredibility?: number;
      infectivity?: number;
      infectiousDuration?: number;
      metadata?: Record<string, unknown>;
    },
  ): InformationItem | null {
    const activeCount = [...this.information.values()].filter((i) => i.active).length;
    if (activeCount >= this.config.maxActiveInformation) return null;

    this.infoCounter++;
    const item: InformationItem = {
      id: `info_${this.infoCounter}`,
      type,
      content,
      sourceId,
      sourceCredibility: options?.sourceCredibility ?? 70,
      infectivity: options?.infectivity ?? 50,
      infectiousDuration: options?.infectiousDuration ?? 50,
      currentCredibility: options?.sourceCredibility ?? 70,
      mutationCount: 0,
      mutationHistory: [],
      createdTick: this.currentTick,
      totalInfected: 1,
      totalSpreadEvents: 0,
      active: true,
      metadata: options?.metadata,
    };

    this.information.set(item.id, item);

    // Ensure source node exists and infect it.
    this.ensureNode(sourceId);
    this.setNodeState(sourceId, item.id, "infected");

    this.makeEvent("info.created", item.id, sourceId, undefined,
      `Information created: ${content.substring(0, 50)} (${type}) by ${sourceId}`);
    return item;
  }

  /** Get an information item by ID. */
  getInformation(infoId: string): InformationItem | undefined {
    return this.information.get(infoId);
  }

  /** Get all active information items. */
  getActiveInformation(): InformationItem[] {
    return [...this.information.values()].filter((i) => i.active);
  }

  /** Get all information items (active + extinct). */
  getAllInformation(): InformationItem[] {
    return [...this.information.values()];
  }

  // --- Node Management ---

  /** Ensure a node exists in the network. */
  private ensureNode(entityId: string): InformationNode {
    let node = this.nodes.get(entityId);
    if (!node) {
      node = {
        entityId,
        states: new Map(),
        infectedAt: new Map(),
        recoveredAt: new Map(),
        spreadCount: 0,
        receiveCount: 0,
        skepticism: 30,
        influence: 30,
      };
      this.nodes.set(entityId, node);
    }
    return node;
  }

  /** Get a node by entity ID. */
  getNode(entityId: string): InformationNode | undefined {
    return this.nodes.get(entityId);
  }

  /** Set a node's skepticism (higher = harder to infect). */
  setNodeSkepticism(entityId: string, skepticism: number): void {
    const node = this.ensureNode(entityId);
    node.skepticism = Math.max(0, Math.min(100, skepticism));
  }

  /** Set a node's influence as a spreader. */
  setNodeInfluence(entityId: string, influence: number): void {
    const node = this.ensureNode(entityId);
    node.influence = Math.max(0, Math.min(100, influence));
  }

  /** Get a node's infection state for an information item. */
  getNodeState(entityId: string, infoId: string): InformationState {
    return this.nodes.get(entityId)?.states.get(infoId) ?? "susceptible";
  }

  /** Set a node's state for an information item. */
  setNodeState(entityId: string, infoId: string, state: InformationState): void {
    const node = this.ensureNode(entityId);
    node.states.set(infoId, state);

    if (state === "infected") {
      node.infectedAt.set(infoId, this.currentTick);
    } else if (state === "recovered") {
      node.recoveredAt.set(infoId, this.currentTick);
    }
  }

  // --- Social Influence Network ---

  /** Add a directed influence connection between two entities. */
  addInfluenceConnection(fromId: string, toId: string, weight: number): void {
    this.ensureNode(fromId);
    this.ensureNode(toId);

    if (!this.influenceNetwork.has(fromId)) {
      this.influenceNetwork.set(fromId, new Map());
    }
    this.influenceNetwork.get(fromId)!.set(toId, Math.max(0, Math.min(100, weight)));
  }

  /** Get influence connections from an entity. */
  getInfluenceConnections(entityId: string): Map<string, number> {
    return this.influenceNetwork.get(entityId) ?? new Map();
  }

  /** Remove an influence connection. */
  removeInfluenceConnection(fromId: string, toId: string): void {
    this.influenceNetwork.get(fromId)?.delete(toId);
  }

  // --- SIR Spread Model ---

  /** Spread information from an infected node to its connections. */
  spreadInformation(infoId: string, fromId: string): number {
    const info = this.information.get(infoId);
    if (!info || !info.active) return 0;

    const fromNode = this.nodes.get(fromId);
    if (!fromNode || fromNode.states.get(infoId) !== "infected") return 0;

    let newInfections = 0;
    const connections = this.getInfluenceConnections(fromId);

    for (const [toId, influenceWeight] of connections.entries()) {
      const toState = this.getNodeState(toId, infoId);
      if (toState !== "susceptible" && toState !== "exposed") continue;

      // Calculate infection probability based on:
      // - base infection rate
      // - information infectivity
      // - source influence
      // - connection weight
      // - target skepticism (reduces probability)
      const toNode = this.ensureNode(toId);
      const infectionProbability = Math.min(0.95,
        this.config.baseInfectionRate *
        (info.infectivity / 50) *
        (fromNode.influence / 50) *
        (influenceWeight / 50) *
        (1 - toNode.skepticism / 150)
      );

      if (Math.random() < infectionProbability) {
        // Infect the target.
        if (toState === "exposed") {
          this.setNodeState(toId, infoId, "infected");
        } else {
          this.setNodeState(toId, infoId, "infected");
        }
        info.totalInfected++;
        info.totalSpreadEvents++;
        fromNode.spreadCount++;
        toNode.receiveCount++;
        newInfections++;

        this.makeEvent("info.infected", infoId, toId, fromId,
          `${toId} infected by ${fromId} with info ${info.id} (prob: ${infectionProbability.toFixed(3)})`);

        // Apply mutation during spread.
        if (this.config.enableMutation && Math.random() < this.config.mutationRate) {
          this.mutateInformation(infoId, toId);
        }
      } else if (toState === "susceptible") {
        // Expose but not infect.
        this.setNodeState(toId, infoId, "exposed");
        toNode.receiveCount++;
      }
    }

    if (newInfections > 0) {
      this.makeEvent("info.spread", infoId, fromId, undefined,
        `${fromId} spread info ${info.id} to ${newInfections} new nodes`);
    }

    return newInfections;
  }

  /** Recover infected nodes (SIR R transition). */
  recoverInfectedNodes(infoId: string): number {
    const info = this.information.get(infoId);
    if (!info || !info.active) return 0;

    let recovered = 0;
    for (const node of this.nodes.values()) {
      if (node.states.get(infoId) !== "infected") continue;

      const infectedAt = node.infectedAt.get(infoId) ?? 0;
      const duration = this.currentTick - infectedAt;

      // Recovery probability increases with duration.
      const recoveryProbability = Math.min(0.5,
        this.config.baseRecoveryRate * (1 + duration / info.infectiousDuration));

      if (duration >= info.infectiousDuration || Math.random() < recoveryProbability) {
        this.setNodeState(node.entityId, infoId, "recovered");
        recovered++;
      }
    }

    if (recovered > 0) {
      this.makeEvent("info.recovered", infoId, undefined, undefined,
        `${recovered} nodes recovered from info ${info.id}`);
    }

    return recovered;
  }

  /** Check if information has gone extinct (no active infected nodes). */
  checkExtinction(infoId: string): boolean {
    const info = this.information.get(infoId);
    if (!info || !info.active) return false;

    const infectedCount = [...this.nodes.values()].filter(
      (n) => n.states.get(infoId) === "infected",
    ).length;

    if (infectedCount === 0) {
      info.active = false;
      this.makeEvent("info.extinct", infoId, undefined, undefined,
        `Information ${info.id} has gone extinct (total infected: ${info.totalInfected})`);
      return true;
    }
    return false;
  }

  // --- Information Mutation ---

  /** Mutate information content during spread. */
  mutateInformation(infoId: string, mutatedBy: string): InformationMutation | null {
    const info = this.information.get(infoId);
    if (!info || !info.active) return null;

    this.mutationCounter++;
    const originalContent = info.content;

    // Simple mutation: append/modify content marker.
    // Application layer can define more sophisticated mutation.
    const mutatedContent = `${originalContent} [variant ${this.mutationCounter}]`;
    info.content = mutatedContent;
    info.mutationCount++;

    // Credibility decreases with each mutation.
    const credibilityImpact = -(5 + Math.random() * 10);
    info.currentCredibility = Math.max(0, info.currentCredibility + credibilityImpact);

    const mutation: InformationMutation = {
      id: `mutation_${this.mutationCounter}`,
      originalContent,
      mutatedContent,
      mutatedBy,
      tick: this.currentTick,
      credibilityImpact,
    };

    info.mutationHistory.push(mutation);

    this.makeEvent("info.mutated", infoId, mutatedBy, undefined,
      `Information ${info.id} mutated by ${mutatedBy} (credibility impact: ${credibilityImpact.toFixed(1)})`);
    return mutation;
  }

  /** Get mutation history for an information item. */
  getMutationHistory(infoId: string): InformationMutation[] {
    return this.information.get(infoId)?.mutationHistory ?? [];
  }

  // --- Credibility Assessment ---

  /** Assess the credibility of an information item. */
  assessCredibility(infoId: string): CredibilityAssessment | null {
    const info = this.information.get(infoId);
    if (!info) return null;

    // Source credibility component.
    const sourceScore = info.sourceCredibility;

    // Type credibility: rumors and gossip are inherently less credible.
    const typeCredibility: Record<InformationType, number> = {
      idea: 70,
      rumor: 25,
      news: 75,
      gossip: 20,
      propaganda: 35,
      knowledge: 90,
      meme: 40,
      warning: 60,
      tradition: 80,
    };
    const typeScore = typeCredibility[info.type] ?? 50;

    // Mutation penalty: each mutation reduces credibility.
    const mutationPenalty = info.mutationCount * 8;

    // Spread saturation: over-spread information loses credibility.
    const spreadPenalty = Math.min(20, info.totalSpreadEvents * 0.5);

    // Overall credibility.
    const overallCredibility = Math.max(0, Math.min(100,
      (sourceScore * 0.35 + typeScore * 0.35) - mutationPenalty - spreadPenalty));

    const likelyTrue = overallCredibility >= this.config.credibilityThreshold;

    const assessment: CredibilityAssessment = {
      infoId,
      overallCredibility: Math.round(overallCredibility),
      sourceScore,
      typeScore,
      mutationPenalty,
      spreadPenalty,
      likelyTrue,
      explanation: likelyTrue
        ? `Information is likely true (credibility: ${Math.round(overallCredibility)}%)`
        : `Information is likely false or unreliable (credibility: ${Math.round(overallCredibility)}%)`,
    };

    this.makeEvent("info.credibility_assessed", infoId, undefined, undefined,
      `Credibility assessed for ${info.id}: ${Math.round(overallCredibility)}% (${likelyTrue ? "likely true" : "likely false"})`);

    return assessment;
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;

    this.currentTick++;

    // Auto-spread: each infected node spreads to its connections.
    if (this.config.autoSpread) {
      for (const info of this.getActiveInformation()) {
        for (const node of this.nodes.values()) {
          if (node.states.get(info.id) === "infected") {
            this.spreadInformation(info.id, node.entityId);
          }
        }
      }
    }

    // Auto-recover.
    if (this.config.autoRecover) {
      for (const info of this.getActiveInformation()) {
        this.recoverInfectedNodes(info.id);
        this.checkExtinction(info.id);
      }
    }
  }

  stop(): void {
    // Cleanup if needed.
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      information: [...this.information.values()],
      nodes: [...this.nodes.values()].map((n) => ({
        ...n,
        states: [...n.states.entries()],
        infectedAt: [...n.infectedAt.entries()],
        recoveredAt: [...n.recoveredAt.entries()],
      })),
      influenceNetwork: [...this.influenceNetwork.entries()].map(([k, v]) => [k, [...v.entries()]]),
      eventHistory: this.eventHistory.slice(-100),
      counters: {
        info: this.infoCounter,
        mutation: this.mutationCounter,
      },
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_INFORMATION_SPREAD_CONFIG, ...(data.config as object) };
    this.information.clear();
    this.nodes.clear();
    this.influenceNetwork.clear();

    const infos = data.information as InformationItem[];
    for (const info of infos) {
      this.information.set(info.id, info);
    }

    const nodes = (data.nodes as Array<{
      entityId: string;
      states: Array<[string, InformationState]>;
      infectedAt: Array<[string, number]>;
      recoveredAt: Array<[string, number]>;
      spreadCount: number;
      receiveCount: number;
      skepticism: number;
      influence: number;
    }>) ?? [];
    for (const n of nodes) {
      const node: InformationNode = {
        entityId: n.entityId,
        states: new Map(n.states),
        infectedAt: new Map(n.infectedAt),
        recoveredAt: new Map(n.recoveredAt),
        spreadCount: n.spreadCount,
        receiveCount: n.receiveCount,
        skepticism: n.skepticism,
        influence: n.influence,
      };
      this.nodes.set(n.entityId, node);
    }

    const network = (data.influenceNetwork as Array<[string, Array<[string, number]>]>) ?? [];
    for (const [fromId, connections] of network) {
      this.influenceNetwork.set(fromId, new Map(connections));
    }

    this.eventHistory = (data.eventHistory as InformationSpreadEvent[]) ?? [];
    const counters = data.counters as Record<string, number>;
    this.infoCounter = counters?.info ?? this.information.size;
    this.mutationCounter = counters?.mutation ?? 0;
    this.currentTick = (data.currentTick as number) ?? 0;
  }

  // --- Statistics ---

  getStats(): InformationSpreadStats {
    const allInfos = this.getAllInformation();
    const activeInfos = this.getActiveInformation();
    let totalInfected = 0;
    let totalSpread = 0;
    let totalMutations = 0;
    let totalCredibility = 0;
    const typeCounts: Record<string, number> = {};
    let mostInfectedInfo: string | null = null;
    let maxInfected = 0;

    for (const info of allInfos) {
      totalInfected += info.totalInfected;
      totalSpread += info.totalSpreadEvents;
      totalMutations += info.mutationCount;
      totalCredibility += info.currentCredibility;
      typeCounts[info.type] = (typeCounts[info.type] ?? 0) + 1;
      if (info.totalInfected > maxInfected) {
        maxInfected = info.totalInfected;
        mostInfectedInfo = info.id;
      }
    }

    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as InformationType | undefined ?? null;

    return {
      totalInformation: allInfos.length,
      activeInformation: activeInfos.length,
      extinctInformation: allInfos.length - activeInfos.length,
      totalNodes: this.nodes.size,
      totalInfected,
      totalSpreadEvents: totalSpread,
      totalMutations,
      averageCredibility: allInfos.length > 0 ? totalCredibility / allInfos.length : 0,
      mostInfectedInfo,
      dominantInformationType: dominantType,
    };
  }

  // --- Internal Helpers ---

  private makeEvent(
    type: InformationSpreadEventType,
    infoId?: string,
    entityId?: string,
    fromEntityId?: string,
    description?: string,
  ): InformationSpreadEvent {
    const event: InformationSpreadEvent = {
      type,
      infoId,
      entityId,
      fromEntityId,
      description,
      tick: this.currentTick,
    };
    this.eventHistory.push(event);
    if (this.eventHistory.length > 500) {
      this.eventHistory.shift();
    }
    return event;
  }
}
