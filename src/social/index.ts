// Social system module exports.
export type {
  SocialRelationType,
  SocialRelation,
  SocialRelationChange,
  SocialInteractionContext,
} from "./SocialTypes.js";
export {
  SocialRelationChangedEvent,
  SocialTrustChangedEvent,
  SocialInteractionEvent,
} from "./SocialEvents.js";
export { SocialGraph } from "./SocialGraph.js";

// M13 Enhanced Social Relation Graph
export type {
  RelationCategory,
  RelationSubtype,
  RelationStrength,
  RichSocialRelation,
  RelationEventType,
  RelationEventPayload,
  RelationModificationResult,
  SocialPathResult,
  SocialGroup,
  SocialRelationGraphConfig,
} from "./SocialRelationTypes.js";
export {
  DEFAULT_RELATION_STRENGTH,
  DEFAULT_SOCIAL_RELATION_CONFIG,
} from "./SocialRelationTypes.js";
export { SocialRelationGraph } from "./SocialRelationGraph.js";

// M13 Social Norm System
export type {
  SocialNorm,
  SocialNormType,
  NormViolation,
  NormViolationSeverity,
  SocialFeedback,
  SocialFeedbackType,
  SocialNormSystemConfig,
  NormModificationResult,
  NormSystemEvent,
  NormSystemEventType,
  ComplianceCheckResult,
  SocialNormStats,
  NormScope,
  NormMutation,
} from "./SocialNormTypes.js";
export { DEFAULT_SOCIAL_NORM_CONFIG } from "./SocialNormTypes.js";
export { SocialNormSystem } from "./SocialNormSystem.js";

// M13 Social Event System
export type {
  SocialEvent,
  SocialEventType,
  SocialEventStatus,
  EventParticipant,
  EventParticipantRole,
  ParticipationStatus,
  EventSocialImpact,
  SocialEventSystemConfig,
  EventCreationResult,
  SocialEventSystemEvent,
  SocialEventSystemEventType,
  SocialEventStats,
} from "./SocialEventTypes.js";
export { DEFAULT_SOCIAL_EVENT_CONFIG } from "./SocialEventTypes.js";
export { SocialEventSystem } from "./SocialEventSystem.js";

// M13 Group Behavior Engine
export type {
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
export { DEFAULT_GROUP_BEHAVIOR_CONFIG } from "./GroupBehaviorTypes.js";
export { GroupBehaviorEngine } from "./GroupBehaviorEngine.js";

// M13 Information Spread Model
export type {
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
export { DEFAULT_INFORMATION_SPREAD_CONFIG } from "./InformationSpreadTypes.js";
export { InformationSpreadModel } from "./InformationSpreadModel.js";

// M13 Social Mobility System
export type {
  SocialClass,
  MobilityType,
  MobilityEvent,
  SocialStatus,
  MobilityResult,
  SocialMobilityConfig,
  SocialMobilityEvent,
  SocialMobilityEventType,
  SocialMobilityStats,
} from "./SocialMobilityTypes.js";
export { DEFAULT_SOCIAL_MOBILITY_CONFIG, SOCIAL_CLASS_RANK } from "./SocialMobilityTypes.js";
export { SocialMobilitySystem } from "./SocialMobilitySystem.js";
