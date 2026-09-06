// M13 Group Behavior Engine types.
// Group behavior: mob psychology, collective action, group decision-making,
// and group emotion spread. Extends M9 FlockingSystem (Boids) with
// social-psychological group dynamics. All content is defined by application layer.

/** Types of group emotions. */
export type GroupEmotionType =
  | "calm"        // 平静
  | "excited"     // 兴奋
  | "angry"       // 愤怒
  | "fearful"     // 恐惧
  | "joyful"      // 欢乐
  | "anxious"     // 焦虑
  | "hostile"     // 敌意
  | "euphoric"    // 欣快
  | "sad"         // 悲伤
  | "determined"; // 坚定

/** Status of a collective action. */
export type CollectiveActionStatus = "proposed" | "mobilizing" | "active" | "completed" | "failed" | "cancelled";

/** Types of collective action. */
export type CollectiveActionType =
  | "protest"       // 抗议
  | "celebration"   // 庆祝
  | "migration"     // 迁徙
  | "attack"        // 攻击
  | "defense"       // 防御
  | "construction"  // 建设
  | "ritual"        // 仪式
  | "strike"        // 罢工
  | "feast"         // 盛宴
  | "pilgrimage";   // 朝圣

/** Decision-making methods. */
export type DecisionMethod = "majority_vote" | "consensus" | "leader_decides" | "sortition" | "weighted_vote";

/** Status of a group decision. */
export type GroupDecisionStatus = "proposed" | "debating" | "voting" | "resolved" | "rejected";

/** A member of a group. */
export interface GroupMember {
  /** Entity ID of the member. */
  entityId: string;
  /** Role in the group (leader, follower, etc.). */
  role: string;
  /** Current individual emotion. */
  emotion: GroupEmotionType;
  /** Emotion intensity (0-100). */
  emotionIntensity: number;
  /** Social influence within the group (0-100). */
  influence: number;
  /** Participation level in group activities (0-100). */
  participation: number;
  /** Whether the member is anonymous within the group (increases mob psychology). */
  anonymous: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Group emotion state (distribution of emotions across members). */
export interface GroupEmotionState {
  /** Dominant emotion in the group. */
  dominantEmotion: GroupEmotionType;
  /** Intensity of the dominant emotion (0-100). */
  dominantIntensity: number;
  /** Distribution of emotions across all members. */
  distribution: Record<GroupEmotionType, number>;
  /** Overall emotional arousal (0-100). */
  arousal: number;
  /** Emotional valence (-100 to 100, negative=unpleasant, positive=pleasant). */
  valence: number;
}

/** Mob psychology state of a group. */
export interface MobPsychologyState {
  /** Polarization level (0-100, higher = more extreme views). */
  polarization: number;
  /** Deindividuation level (0-100, higher = less individual identity). */
  deindividuation: number;
  /** Irrationality level (0-100, higher = less rational decision-making). */
  irrationality: number;
  /** Action tendency (0-100, higher = more likely to take collective action). */
  actionTendency: number;
  /** Suggestibility level (0-100, higher = more susceptible to leader influence). */
  suggestibility: number;
  /** Whether the group is in a mob state (threshold exceeded). */
  isMob: boolean;
}

/** A collective action undertaken by a group. */
export interface CollectiveAction {
  /** Unique action ID. */
  id: string;
  /** Action type. */
  type: CollectiveActionType;
  /** Short name. */
  name: string;
  /** Description of the action. */
  description: string;
  /** Target entity or location (application-defined). */
  target: string;
  /** Current status. */
  status: CollectiveActionStatus;
  /** Participating entity IDs. */
  participants: string[];
  /** Maximum participants. */
  maxParticipants: number;
  /** Progress (0-100). */
  progress: number;
  /** Tick when action started. */
  startTick: number | null;
  /** Tick when action is expected to complete. */
  expectedDurationTicks: number;
  /** Whether the action turned violent (mob psychology). */
  turnedViolent: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A decision option. */
export interface DecisionOption {
  /** Option ID. */
  id: string;
  /** Option text/description. */
  text: string;
  /** Number of votes received. */
  votes: number;
  /** Entity IDs that voted for this option. */
  voters: string[];
}

/** A group decision. */
export interface GroupDecision {
  /** Unique decision ID. */
  id: string;
  /** Issue being decided. */
  issue: string;
  /** Description of the decision. */
  description: string;
  /** Decision method. */
  method: DecisionMethod;
  /** Current status. */
  status: GroupDecisionStatus;
  /** Available options. */
  options: DecisionOption[];
  /** Entity IDs that have voted. */
  votedEntities: string[];
  /** Leader entity ID (for leader_decides method). */
  leaderId?: string;
  /** Resolved option ID (if resolved). */
  resolvedOptionId?: string;
  /** Tick when decision was proposed. */
  proposedTick: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A group definition. */
export interface BehaviorGroup {
  /** Unique group ID. */
  id: string;
  /** Group name. */
  name: string;
  /** Group type (application-defined). */
  type: string;
  /** Members of the group. */
  members: GroupMember[];
  /** Current group emotion state. */
  emotionState: GroupEmotionState;
  /** Current mob psychology state. */
  mobState: MobPsychologyState;
  /** Active collective actions. */
  activeActions: string[];
  /** Pending decisions. */
  pendingDecisions: string[];
  /** Whether the group is currently active. */
  active: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Configuration for GroupBehaviorEngine. */
export interface GroupBehaviorEngineConfig {
  /** Maximum number of groups. */
  maxGroups: number;
  /** Maximum members per group. */
  maxMembersPerGroup: number;
  /** Emotion spread rate per tick (0-1). */
  emotionSpreadRate: number;
  /** Mob psychology threshold (0-100, above this = mob state). */
  mobThreshold: number;
  /** Whether to auto-update mob psychology. */
  autoUpdateMobPsychology: boolean;
  /** Whether to auto-spread emotions. */
  autoSpreadEmotions: boolean;
  /** Whether to auto-progress collective actions. */
  autoProgressActions: boolean;
  /** Whether to emit events. */
  emitEvents: boolean;
  /** Maximum action history. */
  maxActionHistory: number;
}

/** Default configuration. */
export const DEFAULT_GROUP_BEHAVIOR_CONFIG: GroupBehaviorEngineConfig = {
  maxGroups: 50,
  maxMembersPerGroup: 200,
  emotionSpreadRate: 0.1,
  mobThreshold: 60,
  autoUpdateMobPsychology: true,
  autoSpreadEmotions: true,
  autoProgressActions: true,
  emitEvents: true,
  maxActionHistory: 200,
};

/** Event types emitted by GroupBehaviorEngine. */
export type GroupBehaviorEventType =
  | "group.created"
  | "group.disbanded"
  | "group.emotion_changed"
  | "group.mob_formed"
  | "group.mob_dispersed"
  | "group.action_started"
  | "group.action_completed"
  | "group.action_failed"
  | "group.action_violent"
  | "group.decision_proposed"
  | "group.decision_resolved"
  | "group.member_joined"
  | "group.member_left";

/** Event payload for group behavior events. */
export interface GroupBehaviorEvent {
  type: GroupBehaviorEventType;
  groupId?: string;
  entityId?: string;
  actionId?: string;
  decisionId?: string;
  description?: string;
  tick: number;
  metadata?: Record<string, unknown>;
}

/** Statistics for GroupBehaviorEngine. */
export interface GroupBehaviorStats {
  totalGroups: number;
  activeGroups: number;
  totalMembers: number;
  mobGroups: number;
  activeActions: number;
  pendingDecisions: number;
  averageGroupSize: number;
  averageArousal: number;
  dominantEmotion: GroupEmotionType | null;
}
