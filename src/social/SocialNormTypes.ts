// M13 Social Norm System types.
// Social norms: customs, taboos, values, traditions, etiquette, laws.
// Norm formation, spread, evolution, violation detection, and social feedback.
// All norm content is defined by application layer.

/** Categories of social norms. */
export type SocialNormType =
  | "custom"      // 习俗: customary behavior (greetings, eating habits)
  | "taboo"       // 禁忌: forbidden behavior (sacred prohibitions)
  | "value"       // 价值观: shared beliefs (honesty, loyalty, courage)
  | "tradition"   // 传统: long-established practices (festivals, rituals)
  | "etiquette"   // 礼仪: formal rules of conduct (politeness, dress codes)
  | "law";        // 法律: enforced rules (property, contracts, violence)

/** Severity level of a norm violation. */
export type NormViolationSeverity = "minor" | "moderate" | "major" | "catastrophic";

/** Type of social feedback given for behavior. */
export type SocialFeedbackType =
  | "approval"      // 赞许
  | "praise"        // 赞扬
  | "disapproval"   // 不赞成
  | "ostracism"     // 排斥
  | "punishment"    // 惩罚
  | "reward";       // 奖励

/** Scope of a norm (who it applies to). */
export interface NormScope {
  /** Entity IDs this norm applies to. Empty = applies to everyone. */
  appliesTo: string[];
  /** Entity IDs excluded from this norm. */
  excludes: string[];
  /** Geographic or contextual scope description. */
  context?: string;
}

/** A social norm definition. */
export interface SocialNorm {
  /** Unique norm ID. */
  id: string;
  /** Norm category. */
  type: SocialNormType;
  /** Short name. */
  name: string;
  /** Detailed description of the norm. */
  description: string;
  /** What behavior complies with the norm. */
  compliantBehavior: string;
  /** What behavior violates the norm. */
  violatingBehavior: string;
  /** Scope of the norm. */
  scope: NormScope;
  /** How important this norm is (0-100). */
  importance: number;
  /** Current compliance rate (0-100). */
  complianceRate: number;
  /** Entity IDs that enforce this norm. */
  enforcers: string[];
  /** Whether the norm is currently active. */
  active: boolean;
  /** Tick when the norm was established. */
  establishedTick: number;
  /** Evolution history (mutations). */
  evolutionHistory: NormMutation[];
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** A mutation in a norm's evolution. */
export interface NormMutation {
  /** Mutation ID. */
  id: string;
  /** Tick when mutation occurred. */
  tick: number;
  /** What changed. */
  change: string;
  /** Whether the mutation was adopted. */
  adopted: boolean;
  /** Adoption rate at time of mutation. */
  adoptionRate: number;
}

/** A recorded norm violation. */
export interface NormViolation {
  /** Violation ID. */
  id: string;
  /** Norm that was violated. */
  normId: string;
  /** Entity that committed the violation. */
  violatorId: string;
  /** Context description. */
  context: string;
  /** Severity of violation. */
  severity: NormViolationSeverity;
  /** Social response generated. */
  socialResponse: SocialFeedbackType;
  /** Tick when violation occurred. */
  tick: number;
  /** Whether the violation was resolved (e.g., apology accepted). */
  resolved: boolean;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Social feedback event. */
export interface SocialFeedback {
  /** Feedback ID. */
  id: string;
  /** Type of feedback. */
  type: SocialFeedbackType;
  /** Target entity receiving feedback. */
  targetId: string;
  /** Source entities giving feedback. */
  sourceIds: string[];
  /** Intensity of feedback (0-100). */
  intensity: number;
  /** Related norm ID, if applicable. */
  normId?: string;
  /** Related violation ID, if applicable. */
  violationId?: string;
  /** Tick when feedback was given. */
  tick: number;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Configuration for SocialNormSystem. */
export interface SocialNormSystemConfig {
  /** Maximum number of active norms. */
  maxNorms: number;
  /** Maximum violation history size. */
  maxViolationHistory: number;
  /** Maximum feedback history size. */
  maxFeedbackHistory: number;
  /** Whether norms evolve automatically. */
  autoEvolve: boolean;
  /** Mutation rate per tick (0-1). */
  mutationRate: number;
  /** Whether to auto-detect violations. */
  autoDetectViolations: boolean;
  /** Whether to generate social feedback automatically. */
  autoGenerateFeedback: boolean;
  /** Minimum compliance rate before norm is considered weak. */
  weakNormThreshold: number;
  /** Whether to emit events. */
  emitEvents: boolean;
}

/** Default configuration. */
export const DEFAULT_SOCIAL_NORM_CONFIG: SocialNormSystemConfig = {
  maxNorms: 100,
  maxViolationHistory: 500,
  maxFeedbackHistory: 500,
  autoEvolve: true,
  mutationRate: 0.001,
  autoDetectViolations: true,
  autoGenerateFeedback: true,
  weakNormThreshold: 30,
  emitEvents: true,
};

/** Result of a norm modification operation. */
export interface NormModificationResult {
  success: boolean;
  norm?: SocialNorm;
  events: NormSystemEvent[];
  failureReason?: string;
}

/** Event types emitted by SocialNormSystem. */
export type NormSystemEventType =
  | "norm.established"
  | "norm.updated"
  | "norm.abolished"
  | "norm.evolved"
  | "norm.weakened"
  | "norm.strengthened"
  | "violation.detected"
  | "violation.resolved"
  | "feedback.given";

/** Event payload for norm system events. */
export interface NormSystemEvent {
  type: NormSystemEventType;
  normId?: string;
  violationId?: string;
  feedbackId?: string;
  entityId?: string;
  description?: string;
  tick: number;
  metadata?: Record<string, unknown>;
}

/** Result of compliance check. */
export interface ComplianceCheckResult {
  /** Whether the behavior complies. */
  compliant: boolean;
  /** Norm that was checked. */
  normId: string;
  /** Norm name. */
  normName: string;
  /** Severity if violated. */
  violationSeverity?: NormViolationSeverity;
  /** Explanation. */
  explanation: string;
}

/** Statistics for SocialNormSystem. */
export interface SocialNormStats {
  totalNorms: number;
  activeNorms: number;
  normsByType: Record<string, number>;
  totalViolations: number;
  unresolvedViolations: number;
  totalFeedback: number;
  averageComplianceRate: number;
  weakNorms: number;
  totalMutations: number;
}
