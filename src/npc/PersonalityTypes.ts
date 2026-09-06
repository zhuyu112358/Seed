// NPC Personality types for M12 Phase 2: NPC AI deepening.
//
// Seed provides the personality framework (traits, tendencies, decision style).
// Ember decides how personality affects decisions. Application layer configures
// personality profiles and trait weights.

/** Big Five (OCEAN) personality traits. Each scored 0-100. */
export interface BigFiveTraits {
  /** Openness to experience: curiosity, creativity, preference for novelty. */
  openness: number;
  /** Conscientiousness: organization, responsibility, self-discipline. */
  conscientiousness: number;
  /** Extraversion: sociability, assertiveness, energy from social interaction. */
  extraversion: number;
  /** Agreeableness: cooperativeness, compassion, trust in others. */
  agreeableness: number;
  /** Neuroticism: emotional instability, anxiety, moodiness. */
  neuroticism: number;
}

/** Default neutral personality (all 50). */
export const NEUTRAL_PERSONALITY: BigFiveTraits = {
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  neuroticism: 50,
};

/** Preset personality archetypes. */
export const PERSONALITY_ARCHETYPES: Record<string, BigFiveTraits> = {
  // Social, outgoing, energetic.
  socialite: { openness: 60, conscientiousness: 40, extraversion: 90, agreeableness: 70, neuroticism: 30 },
  // Careful, organized, responsible.
  guardian: { openness: 30, conscientiousness: 90, extraversion: 30, agreeableness: 70, neuroticism: 40 },
  // Curious, creative, imaginative.
  explorer: { openness: 95, conscientiousness: 40, extraversion: 60, agreeableness: 50, neuroticism: 50 },
  // Aggressive, competitive, dominant.
  warrior: { openness: 40, conscientiousness: 60, extraversion: 70, agreeableness: 20, neuroticism: 50 },
  // Calm, peaceful, cooperative.
  diplomat: { openness: 60, conscientiousness: 70, extraversion: 50, agreeableness: 90, neuroticism: 20 },
  // Anxious, cautious, risk-averse.
  worrier: { openness: 40, conscientiousness: 70, extraversion: 20, agreeableness: 60, neuroticism: 90 },
  // Ambitious, disciplined, achievement-focused.
  achiever: { openness: 60, conscientiousness: 95, extraversion: 60, agreeableness: 40, neuroticism: 40 },
  // Relaxed, easygoing, carefree.
  laidback: { openness: 50, conscientiousness: 30, extraversion: 50, agreeableness: 70, neuroticism: 15 },
};

/** Behavioral tendencies derived from personality. */
export interface BehavioralTendencies {
  /** Social interaction tendency (0-1, higher = more social). */
  socialTendency: number;
  /** Risk taking tendency (0-1, higher = more risk-seeking). */
  riskTendency: number;
  /** Aggression tendency (0-1, higher = more aggressive). */
  aggressionTendency: number;
  /** Cooperation tendency (0-1, higher = more cooperative). */
  cooperationTendency: number;
  /** Curiosity tendency (0-1, higher = more curious). */
  curiosityTendency: number;
  /** Patience tendency (0-1, higher = more patient). */
  patienceTendency: number;
  /** Anxiety tendency (0-1, higher = more anxious). */
  anxietyTendency: number;
  /** Leadership tendency (0-1, higher = more dominant/leadership-oriented). */
  leadershipTendency: number;
}

/** Decision style derived from personality. */
export interface DecisionStyle {
  /** Risk preference: "risk_averse" | "cautious" | "neutral" | "risk_seeking" | "reckless". */
  riskPreference: "risk_averse" | "cautious" | "neutral" | "risk_seeking" | "reckless";
  /** Patience level: "impatient" | "short" | "moderate" | "long" | "very_patient". */
  patienceLevel: "impatient" | "short" | "moderate" | "long" | "very_patient";
  /** Social preference: "solitary" | "reserved" | "balanced" | "social" | "gregarious". */
  socialPreference: "solitary" | "reserved" | "balanced" | "social" | "gregarious";
  /** Conflict style: "avoidant" | "accommodating" | "compromising" | "competitive" | "collaborative". */
  conflictStyle: "avoidant" | "accommodating" | "compromising" | "competitive" | "collaborative";
  /** Learning style: "conservative" | "practical" | "balanced" | "experimental" | "innovative". */
  learningStyle: "conservative" | "practical" | "balanced" | "experimental" | "innovative";
}

/** A complete NPC personality profile. */
export interface PersonalityProfile {
  /** Entity ID this profile belongs to. */
  entityId: string;
  /** Big Five trait scores (0-100 each). */
  traits: BigFiveTraits;
  /** Derived behavioral tendencies. */
  tendencies: BehavioralTendencies;
  /** Derived decision style. */
  decisionStyle: DecisionStyle;
  /** Optional archetype name if created from a preset. */
  archetype?: string;
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/** Configuration for personality system. */
export interface PersonalityConfig {
  /** Whether to auto-derive tendencies from traits. Default true. */
  autoDeriveTendencies: boolean;
  /** Whether to auto-derive decision style from traits. Default true. */
  autoDeriveDecisionStyle: boolean;
  /** Trait value clamping minimum. Default 0. */
  minTrait: number;
  /** Trait value clamping maximum. Default 100. */
  maxTrait: number;
}

/** Default personality system configuration. */
export const DEFAULT_PERSONALITY_CONFIG: PersonalityConfig = {
  autoDeriveTendencies: true,
  autoDeriveDecisionStyle: true,
  minTrait: 0,
  maxTrait: 100,
};
