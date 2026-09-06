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
