// M13 Group Behavior Engine.
// Manages group behavior: mob psychology, collective action, group decision-making,
// and group emotion spread. Extends M9 FlockingSystem (Boids) with
// social-psychological group dynamics.
// All content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type {
  BehaviorGroup,
  GroupMember,
  GroupEmotionType,
  GroupEmotionState,
  MobPsychologyState,
  CollectiveAction,
  CollectiveActionType,
  CollectiveActionStatus,
  GroupDecision,
  DecisionOption,
  DecisionMethod,
  GroupDecisionStatus,
  GroupBehaviorEngineConfig,
  GroupBehaviorEvent,
  GroupBehaviorEventType,
  GroupBehaviorStats,
} from "./GroupBehaviorTypes.js";
import { DEFAULT_GROUP_BEHAVIOR_CONFIG } from "./GroupBehaviorTypes.js";

/** WorldSystem: group behavior engine. */
export class GroupBehaviorEngine {
  readonly name = "group-behavior-engine";
  enabled = true;

  private config: GroupBehaviorEngineConfig;
  private groups: Map<string, BehaviorGroup> = new Map();
  private actions: Map<string, CollectiveAction> = new Map();
  private decisions: Map<string, GroupDecision> = new Map();
  private actionHistory: CollectiveAction[] = [];
  private eventHistory: GroupBehaviorEvent[] = [];
  private groupCounter = 0;
  private actionCounter = 0;
  private decisionCounter = 0;
  private currentTick = 0;

  constructor(config?: Partial<GroupBehaviorEngineConfig>) {
    this.config = { ...DEFAULT_GROUP_BEHAVIOR_CONFIG, ...config };
  }

  // --- Group Management ---

  /** Create a new behavior group. */
  createGroup(
    name: string,
    type: string,
    options?: {
      members?: Array<{ entityId: string; role?: string; influence?: number }>;
      metadata?: Record<string, unknown>;
    },
  ): BehaviorGroup | null {
    if (this.groups.size >= this.config.maxGroups) return null;

    this.groupCounter++;
    const group: BehaviorGroup = {
      id: `group_${this.groupCounter}`,
      name,
      type,
      members: [],
      emotionState: this.createDefaultEmotionState(),
      mobState: this.createDefaultMobState(),
      activeActions: [],
      pendingDecisions: [],
      active: true,
      metadata: options?.metadata,
    };

    this.groups.set(group.id, group);

    // Add initial members.
    if (options?.members) {
      for (const m of options.members) {
        this.addMember(group.id, m.entityId, m.role, m.influence);
      }
    }

    this.makeEvent("group.created", group.id, undefined, undefined, undefined,
      `Group created: ${name} (${type})`);
    return group;
  }

  /** Get a group by ID. */
  getGroup(groupId: string): BehaviorGroup | undefined {
    return this.groups.get(groupId);
  }

  /** Get all active groups. */
  getActiveGroups(): BehaviorGroup[] {
    return [...this.groups.values()].filter((g) => g.active);
  }

  /** Disband a group. */
  disbandGroup(groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    group.active = false;
    this.makeEvent("group.disbanded", groupId, undefined, undefined, undefined,
      `Group disbanded: ${group.name}`);
    return true;
  }

  // --- Member Management ---

  /** Add a member to a group. */
  addMember(
    groupId: string,
    entityId: string,
    role = "follower",
    influence = 20,
  ): boolean {
    const group = this.groups.get(groupId);
    if (!group || !group.active) return false;
    if (group.members.length >= this.config.maxMembersPerGroup) return false;
    if (group.members.some((m) => m.entityId === entityId)) return false;

    const member: GroupMember = {
      entityId,
      role,
      emotion: "calm",
      emotionIntensity: 10,
      influence,
      participation: 50,
      anonymous: false,
    };

    group.members.push(member);
    this.recalculateEmotionState(group);
    this.makeEvent("group.member_joined", groupId, entityId, undefined, undefined,
      `${entityId} joined group ${group.name} as ${role}`);
    return true;
  }

  /** Remove a member from a group. */
  removeMember(groupId: string, entityId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const index = group.members.findIndex((m) => m.entityId === entityId);
    if (index === -1) return false;

    group.members.splice(index, 1);
    this.recalculateEmotionState(group);
    this.makeEvent("group.member_left", groupId, entityId, undefined, undefined,
      `${entityId} left group ${group.name}`);
    return true;
  }

  /** Get groups an entity belongs to. */
  getGroupsForEntity(entityId: string): BehaviorGroup[] {
    return this.getActiveGroups().filter((g) =>
      g.members.some((m) => m.entityId === entityId),
    );
  }

  /** Set a member's emotion. */
  setMemberEmotion(
    groupId: string,
    entityId: string,
    emotion: GroupEmotionType,
    intensity: number,
  ): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const member = group.members.find((m) => m.entityId === entityId);
    if (!member) return false;

    member.emotion = emotion;
    member.emotionIntensity = Math.max(0, Math.min(100, intensity));
    this.recalculateEmotionState(group);
    return true;
  }

  /** Set member anonymity (increases mob psychology effects). */
  setMemberAnonymity(groupId: string, entityId: string, anonymous: boolean): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const member = group.members.find((m) => m.entityId === entityId);
    if (!member) return false;

    member.anonymous = anonymous;
    return true;
  }

  // --- Group Emotion ---

  /** Get current group emotion state. */
  getGroupEmotion(groupId: string): GroupEmotionState | null {
    return this.groups.get(groupId)?.emotionState ?? null;
  }

  /** Set group emotion (influences all members). */
  setGroupEmotion(groupId: string, emotion: GroupEmotionType, intensity: number): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    for (const member of group.members) {
      member.emotion = emotion;
      member.emotionIntensity = Math.max(0, Math.min(100, intensity));
    }

    this.recalculateEmotionState(group);
    this.makeEvent("group.emotion_changed", groupId, undefined, undefined, undefined,
      `Group emotion changed to ${emotion} (intensity: ${intensity})`);
    return true;
  }

  /** Spread emotion from one member to others in the group. */
  spreadEmotion(groupId: string, sourceEntityId: string, spreadFactor = 1.0): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const source = group.members.find((m) => m.entityId === sourceEntityId);
    if (!source) return false;

    const rate = this.config.emotionSpreadRate * spreadFactor;
    let changed = false;

    for (const member of group.members) {
      if (member.entityId === sourceEntityId) continue;

      // Higher influence source spreads more effectively.
      const influenceFactor = source.influence / 50; // 0.4 at influence=20
      const spreadAmount = source.emotionIntensity * rate * influenceFactor;

      if (member.emotion !== source.emotion) {
        // Gradually shift toward source emotion.
        if (Math.random() < spreadAmount / 100) {
          member.emotion = source.emotion;
          member.emotionIntensity = Math.max(member.emotionIntensity, spreadAmount * 0.5);
          changed = true;
        }
      } else {
        // Same emotion: increase intensity.
        member.emotionIntensity = Math.min(100, member.emotionIntensity + spreadAmount * 0.3);
        changed = true;
      }
    }

    if (changed) {
      this.recalculateEmotionState(group);
    }
    return changed;
  }

  // --- Mob Psychology ---

  /** Get current mob psychology state. */
  getMobState(groupId: string): MobPsychologyState | null {
    return this.groups.get(groupId)?.mobState ?? null;
  }

  /** Update mob psychology for a group based on current state. */
  updateMobPsychology(groupId: string): MobPsychologyState | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const size = group.members.length;
    const arousal = group.emotionState.arousal;
    const anonymousCount = group.members.filter((m) => m.anonymous).length;
    const anonymityRatio = size > 0 ? anonymousCount / size : 0;

    // Polarization: increases with arousal and negative valence.
    const negativeValence = Math.max(0, -group.emotionState.valence);
    const polarization = Math.min(100,
      arousal * 0.4 + negativeValence * 0.3 + size * 0.1 + anonymityRatio * 20);

    // Deindividuation: increases with group size and anonymity.
    const deindividuation = Math.min(100,
      size * 0.3 + anonymityRatio * 40 + arousal * 0.2);

    // Irrationality: increases with polarization and deindividuation.
    const irrationality = Math.min(100,
      polarization * 0.4 + deindividuation * 0.3 + arousal * 0.2);

    // Action tendency: increases with arousal, irrationality, and dominant negative emotions.
    const actionProneEmotions: GroupEmotionType[] = ["angry", "hostile", "excited", "determined", "fearful"];
    const actionEmotionBonus = actionProneEmotions.includes(group.emotionState.dominantEmotion) ? 20 : 0;
    const actionTendency = Math.min(100,
      arousal * 0.3 + irrationality * 0.3 + actionEmotionBonus + size * 0.1);

    // Suggestibility: increases with deindividuation and arousal.
    const suggestibility = Math.min(100,
      deindividuation * 0.5 + arousal * 0.2 + size * 0.1);

    const wasMob = group.mobState.isMob;
    const isMob = actionTendency >= this.config.mobThreshold && irrationality >= this.config.mobThreshold * 0.7;

    group.mobState = {
      polarization,
      deindividuation,
      irrationality,
      actionTendency,
      suggestibility,
      isMob,
    };

    // Emit mob formation/dispersal events.
    if (isMob && !wasMob) {
      this.makeEvent("group.mob_formed", groupId, undefined, undefined, undefined,
        `Mob formed in group ${group.name} (action tendency: ${actionTendency.toFixed(0)})`);
    } else if (!isMob && wasMob) {
      this.makeEvent("group.mob_dispersed", groupId, undefined, undefined, undefined,
        `Mob dispersed in group ${group.name}`);
    }

    return group.mobState;
  }

  // --- Collective Action ---

  /** Start a collective action. */
  startCollectiveAction(
    groupId: string,
    type: CollectiveActionType,
    name: string,
    target: string,
    options?: {
      description?: string;
      maxParticipants?: number;
      expectedDurationTicks?: number;
      initialParticipants?: string[];
      metadata?: Record<string, unknown>;
    },
  ): CollectiveAction | null {
    const group = this.groups.get(groupId);
    if (!group || !group.active) return null;

    this.actionCounter++;
    const action: CollectiveAction = {
      id: `action_${this.actionCounter}`,
      type,
      name,
      description: options?.description ?? "",
      target,
      status: "mobilizing",
      participants: options?.initialParticipants ?? [],
      maxParticipants: options?.maxParticipants ?? group.members.length,
      progress: 0,
      startTick: null,
      expectedDurationTicks: options?.expectedDurationTicks ?? 100,
      turnedViolent: false,
      metadata: options?.metadata,
    };

    this.actions.set(action.id, action);
    group.activeActions.push(action.id);

    // If group is in mob state, action may turn violent.
    if (group.mobState.isMob && (type === "protest" || type === "attack" || type === "strike")) {
      if (Math.random() < group.mobState.irrationality / 100) {
        action.turnedViolent = true;
        this.makeEvent("group.action_violent", groupId, undefined, action.id, undefined,
          `Action "${name}" turned violent (mob irrationality: ${group.mobState.irrationality.toFixed(0)})`);
      }
    }

    this.makeEvent("group.action_started", groupId, undefined, action.id, undefined,
      `Collective action started: ${name} (${type}) targeting ${target}`);
    return action;
  }

  /** Get a collective action by ID. */
  getAction(actionId: string): CollectiveAction | undefined {
    return this.actions.get(actionId);
  }

  /** Get active actions for a group. */
  getGroupActions(groupId: string): CollectiveAction[] {
    const group = this.groups.get(groupId);
    if (!group) return [];
    return group.activeActions
      .map((id) => this.actions.get(id))
      .filter((a): a is CollectiveAction => a !== undefined);
  }

  /** Add a participant to a collective action. */
  addActionParticipant(actionId: string, entityId: string): boolean {
    const action = this.actions.get(actionId);
    if (!action) return false;
    if (action.participants.length >= action.maxParticipants) return false;
    if (action.participants.includes(entityId)) return false;

    action.participants.push(entityId);

    // Auto-start if enough participants.
    if (action.status === "mobilizing" && action.participants.length >= action.maxParticipants * 0.5) {
      action.status = "active";
      action.startTick = this.currentTick;
    }

    return true;
  }

  /** Complete a collective action. */
  completeAction(actionId: string, success = true): boolean {
    const action = this.actions.get(actionId);
    if (!action) return false;
    if (action.status === "completed" || action.status === "failed" || action.status === "cancelled") {
      return false;
    }

    action.status = success ? "completed" : "failed";
    action.progress = success ? 100 : action.progress;

    // Remove from group's active actions.
    for (const group of this.groups.values()) {
      group.activeActions = group.activeActions.filter((id) => id !== actionId);
    }

    // Move to history.
    this.actionHistory.push(action);
    if (this.actionHistory.length > this.config.maxActionHistory) {
      this.actionHistory.shift();
    }

    this.makeEvent(success ? "group.action_completed" : "group.action_failed",
      undefined, undefined, actionId, undefined,
      `Collective action ${success ? "completed" : "failed"}: ${action.name}`);
    return true;
  }

  // --- Group Decision ---

  /** Propose a group decision. */
  proposeDecision(
    groupId: string,
    issue: string,
    options: Array<{ id: string; text: string }>,
    method: DecisionMethod = "majority_vote",
    options2?: {
      description?: string;
      leaderId?: string;
      metadata?: Record<string, unknown>;
    },
  ): GroupDecision | null {
    const group = this.groups.get(groupId);
    if (!group || !group.active) return null;

    this.decisionCounter++;
    const decision: GroupDecision = {
      id: `decision_${this.decisionCounter}`,
      issue,
      description: options2?.description ?? "",
      method,
      status: "proposed",
      options: options.map((o) => ({ id: o.id, text: o.text, votes: 0, voters: [] })),
      votedEntities: [],
      leaderId: options2?.leaderId,
      proposedTick: this.currentTick,
      metadata: options2?.metadata,
    };

    this.decisions.set(decision.id, decision);
    group.pendingDecisions.push(decision.id);

    this.makeEvent("group.decision_proposed", groupId, undefined, undefined, decision.id,
      `Decision proposed: ${issue} (method: ${method})`);
    return decision;
  }

  /** Cast a vote on a decision. */
  vote(decisionId: string, entityId: string, optionId: string): boolean {
    const decision = this.decisions.get(decisionId);
    if (!decision) return false;
    if (decision.status !== "voting" && decision.status !== "proposed") return false;
    if (decision.votedEntities.includes(entityId)) return false;

    const option = decision.options.find((o) => o.id === optionId);
    if (!option) return false;

    option.votes++;
    option.voters.push(entityId);
    decision.votedEntities.push(entityId);
    decision.status = "voting";

    return true;
  }

  /** Resolve a decision (count votes or leader decides). */
  resolveDecision(decisionId: string): GroupDecision | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;
    if (decision.status === "resolved" || decision.status === "rejected") return null;

    let resolvedOptionId: string | undefined;

    switch (decision.method) {
      case "majority_vote":
      case "weighted_vote": {
        const sorted = [...decision.options].sort((a, b) => b.votes - a.votes);
        if (sorted.length > 0 && sorted[0].votes > 0) {
          resolvedOptionId = sorted[0].id;
          decision.status = "resolved";
        } else {
          decision.status = "rejected";
        }
        break;
      }
      case "consensus": {
        // Consensus: all options with votes > 0, or unanimous if only one option has votes.
        const votedOptions = decision.options.filter((o) => o.votes > 0);
        if (votedOptions.length === 1) {
          resolvedOptionId = votedOptions[0].id;
          decision.status = "resolved";
        } else if (votedOptions.length === 0) {
          decision.status = "rejected";
        } else {
          decision.status = "rejected"; // No consensus
        }
        break;
      }
      case "leader_decides": {
        if (decision.leaderId && decision.options.length > 0) {
          // Leader picks first option (application layer can override).
          resolvedOptionId = decision.options[0].id;
          decision.status = "resolved";
        } else {
          decision.status = "rejected";
        }
        break;
      }
      case "sortition": {
        // Random selection.
        if (decision.options.length > 0) {
          const randomIndex = Math.floor(Math.random() * decision.options.length);
          resolvedOptionId = decision.options[randomIndex].id;
          decision.status = "resolved";
        } else {
          decision.status = "rejected";
        }
        break;
      }
    }

    decision.resolvedOptionId = resolvedOptionId;

    // Remove from group's pending decisions.
    for (const group of this.groups.values()) {
      group.pendingDecisions = group.pendingDecisions.filter((id) => id !== decisionId);
    }

    this.makeEvent("group.decision_resolved", undefined, undefined, undefined, decisionId,
      `Decision resolved: ${decision.issue} → ${resolvedOptionId ?? "rejected"}`);
    return decision;
  }

  /** Get a decision by ID. */
  getDecision(decisionId: string): GroupDecision | undefined {
    return this.decisions.get(decisionId);
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;

    this.currentTick++;

    // Auto-spread emotions.
    if (this.config.autoSpreadEmotions) {
      for (const group of this.getActiveGroups()) {
        if (group.members.length > 1) {
          // Pick the most emotionally intense member as spread source.
          const source = [...group.members].sort((a, b) => b.emotionIntensity - a.emotionIntensity)[0];
          if (source && source.emotionIntensity > 20) {
            this.spreadEmotion(group.id, source.entityId, 0.5);
          }
        }
      }
    }

    // Auto-update mob psychology.
    if (this.config.autoUpdateMobPsychology) {
      for (const group of this.getActiveGroups()) {
        this.updateMobPsychology(group.id);
      }
    }

    // Auto-progress collective actions.
    if (this.config.autoProgressActions) {
      for (const action of this.actions.values()) {
        if (action.status === "active" && action.startTick !== null) {
          const elapsed = this.currentTick - action.startTick;
          action.progress = Math.min(100, (elapsed / action.expectedDurationTicks) * 100);
          if (action.progress >= 100) {
            this.completeAction(action.id, true);
          }
        }
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
      groups: [...this.groups.values()],
      actions: [...this.actions.values()],
      decisions: [...this.decisions.values()],
      actionHistory: this.actionHistory.slice(-50),
      eventHistory: this.eventHistory.slice(-50),
      counters: {
        group: this.groupCounter,
        action: this.actionCounter,
        decision: this.decisionCounter,
      },
      currentTick: this.currentTick,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_GROUP_BEHAVIOR_CONFIG, ...(data.config as object) };
    this.groups.clear();
    this.actions.clear();
    this.decisions.clear();

    const groups = data.groups as BehaviorGroup[];
    for (const group of groups) {
      this.groups.set(group.id, group);
    }

    const actions = data.actions as CollectiveAction[];
    for (const action of actions) {
      this.actions.set(action.id, action);
    }

    const decisions = data.decisions as GroupDecision[];
    for (const decision of decisions) {
      this.decisions.set(decision.id, decision);
    }

    this.actionHistory = (data.actionHistory as CollectiveAction[]) ?? [];
    this.eventHistory = (data.eventHistory as GroupBehaviorEvent[]) ?? [];

    const counters = data.counters as Record<string, number>;
    this.groupCounter = counters?.group ?? this.groups.size;
    this.actionCounter = counters?.action ?? this.actions.size;
    this.decisionCounter = counters?.decision ?? this.decisions.size;
    this.currentTick = (data.currentTick as number) ?? 0;
  }

  // --- Statistics ---

  getStats(): GroupBehaviorStats {
    const activeGroups = this.getActiveGroups();
    let totalMembers = 0;
    let mobGroups = 0;
    let totalArousal = 0;
    const emotionCounts: Record<string, number> = {};

    for (const group of activeGroups) {
      totalMembers += group.members.length;
      if (group.mobState.isMob) mobGroups++;
      totalArousal += group.emotionState.arousal;
      const dom = group.emotionState.dominantEmotion;
      emotionCounts[dom] = (emotionCounts[dom] ?? 0) + 1;
    }

    const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as GroupEmotionType | undefined ?? null;

    return {
      totalGroups: this.groups.size,
      activeGroups: activeGroups.length,
      totalMembers,
      mobGroups,
      activeActions: [...this.actions.values()].filter((a) => a.status === "active" || a.status === "mobilizing").length,
      pendingDecisions: [...this.decisions.values()].filter((d) => d.status === "proposed" || d.status === "voting").length,
      averageGroupSize: activeGroups.length > 0 ? totalMembers / activeGroups.length : 0,
      averageArousal: activeGroups.length > 0 ? totalArousal / activeGroups.length : 0,
      dominantEmotion,
    };
  }

  // --- Internal Helpers ---

  private createDefaultEmotionState(): GroupEmotionState {
    const distribution: Record<GroupEmotionType, number> = {
      calm: 0, excited: 0, angry: 0, fearful: 0, joyful: 0,
      anxious: 0, hostile: 0, euphoric: 0, sad: 0, determined: 0,
    };
    return {
      dominantEmotion: "calm",
      dominantIntensity: 0,
      distribution,
      arousal: 0,
      valence: 0,
    };
  }

  private createDefaultMobState(): MobPsychologyState {
    return {
      polarization: 0,
      deindividuation: 0,
      irrationality: 0,
      actionTendency: 0,
      suggestibility: 0,
      isMob: false,
    };
  }

  /** Recalculate group emotion state from member emotions. */
  private recalculateEmotionState(group: BehaviorGroup): void {
    if (group.members.length === 0) {
      group.emotionState = this.createDefaultEmotionState();
      return;
    }

    const distribution: Record<GroupEmotionType, number> = {
      calm: 0, excited: 0, angry: 0, fearful: 0, joyful: 0,
      anxious: 0, hostile: 0, euphoric: 0, sad: 0, determined: 0,
    };

    let totalIntensity = 0;
    let totalValence = 0;
    const positiveEmotions: GroupEmotionType[] = ["joyful", "euphoric", "excited", "calm", "determined"];
    const negativeEmotions: GroupEmotionType[] = ["angry", "fearful", "anxious", "hostile", "sad"];

    for (const member of group.members) {
      distribution[member.emotion]++;
      totalIntensity += member.emotionIntensity;
      if (positiveEmotions.includes(member.emotion)) {
        totalValence += member.emotionIntensity;
      } else if (negativeEmotions.includes(member.emotion)) {
        totalValence -= member.emotionIntensity;
      }
    }

    // Find dominant emotion.
    let dominantEmotion: GroupEmotionType = "calm";
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion as GroupEmotionType;
      }
    }

    const dominantMembers = group.members.filter((m) => m.emotion === dominantEmotion);
    const dominantIntensity = dominantMembers.length > 0
      ? dominantMembers.reduce((sum, m) => sum + m.emotionIntensity, 0) / dominantMembers.length
      : 0;

    group.emotionState = {
      dominantEmotion,
      dominantIntensity,
      distribution,
      arousal: totalIntensity / group.members.length,
      valence: group.members.length > 0 ? totalValence / group.members.length : 0,
    };
  }

  private makeEvent(
    type: GroupBehaviorEventType,
    groupId?: string,
    entityId?: string,
    actionId?: string,
    decisionId?: string,
    description?: string,
  ): GroupBehaviorEvent {
    const event: GroupBehaviorEvent = {
      type,
      groupId,
      entityId,
      actionId,
      decisionId,
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
