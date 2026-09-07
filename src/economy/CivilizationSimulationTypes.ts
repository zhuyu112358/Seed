/**
 * Civilization Simulation System - Type Definitions
 *
 * M14 Economic Foundation Layer - Phase 5
 *
 * Defines types for civilization simulation integrating economy, society,
 * and culture, including civilization rise/fall metrics and multi-civilization
 * interactions.
 */

// Civilization state
export enum CivilizationState {
  EMERGING = 'emerging',
  GROWING = 'growing',
  PROSPERING = 'prospering',
  STAGNATING = 'stagnating',
  DECLINING = 'declining',
  COLLAPSING = 'collapsing',
  COLLAPSED = 'collapsed',
  REVIVING = 'reviving',
}

// Civilization domain score type
export enum CivilizationDomainType {
  ECONOMIC = 'economic',
  SOCIAL = 'social',
  CULTURAL = 'cultural',
  MILITARY = 'military',
  TECHNOLOGICAL = 'technological',
  POLITICAL = 'political',
}

// Civilization interaction type
export enum CivilizationInteractionType {
  TRADE = 'trade',
  ALLIANCE = 'alliance',
  WAR = 'war',
  CULTURAL_EXCHANGE = 'cultural_exchange',
  TECHNOLOGY_TRANSFER = 'technology_transfer',
  MIGRATION = 'migration',
  CONQUEST = 'conquest',
  VASSALAGE = 'vassalage',
  DIPLOMACY = 'diplomacy',
  CUSTOM = 'custom',
}

// Civilization event type
export enum CivilizationEventType {
  CIVILIZATION_CREATED = 'civilization.created',
  CIVILIZATION_UPDATED = 'civilization.updated',
  STATE_CHANGED = 'civilization.state_changed',
  GOLDEN_AGE_STARTED = 'civilization.golden_age_started',
  GOLDEN_AGE_ENDED = 'civilization.golden_age_ended',
  CRISIS_TRIGGERED = 'civilization.crisis_triggered',
  CRISIS_RESOLVED = 'civilization.crisis_resolved',
  COLLAPSE_TRIGGERED = 'civilization.collapse_triggered',
  REVIVAL_TRIGGERED = 'civilization.revival_triggered',
  INTERACTION_STARTED = 'civilization.interaction_started',
  INTERACTION_ENDED = 'civilization.interaction_ended',
  DOMAIN_SCORE_CHANGED = 'civilization.domain_score_changed',
  MILESTONE_REACHED = 'civilization.milestone_reached',
}

// Civilization domain score
export interface CivilizationDomainScore {
  type: CivilizationDomainType;
  // Current score (0-100)
  score: number;
  // Previous score (for trend calculation)
  previousScore: number;
  // Trend direction (-1 declining, 0 stable, 1 rising)
  trend: number;
  // Rate of change per tick
  changeRate: number;
  // Factors contributing to this score
  contributingFactors: Record<string, number>;
}

// Civilization metrics
export interface CivilizationMetrics {
  // Overall civilization score (0-100)
  overallScore: number;
  // Previous overall score
  previousScore: number;
  // Overall trend (-1 declining, 0 stable, 1 rising)
  overallTrend: number;
  // Domain scores
  domainScores: Record<CivilizationDomainType, CivilizationDomainScore>;
  // Population
  population: number;
  // Territory size
  territory: number;
  // Wealth (total economic value)
  wealth: number;
  // Cultural influence (0-100)
  culturalInfluence: number;
  // Technological level (0-100)
  technologyLevel: number;
  // Military strength (0-100)
  militaryStrength: number;
  // Social cohesion (0-100)
  socialCohesion: number;
  // Political stability (0-100)
  politicalStability: number;
  // Happiness/wellbeing (0-100)
  happiness: number;
  // Inequality index (0-1, higher = more unequal)
  inequalityIndex: number;
  // Crisis level (0-100)
  crisisLevel: number;
  // Golden age multiplier (1.0 = normal, >1 = golden age)
  goldenAgeMultiplier: number;
  // Age of civilization (in ticks)
  age: number;
}

// Civilization crisis
export interface CivilizationCrisis {
  id: string;
  name: string;
  description?: string;
  // Crisis type
  type: 'economic' | 'social' | 'cultural' | 'military' | 'environmental' | 'political' | 'combined';
  // Severity (0-100)
  severity: number;
  // Duration so far (ticks)
  duration: number;
  // Expected duration (ticks)
  expectedDuration: number;
  // Affected domains
  affectedDomains: CivilizationDomainType[];
  // Impact on each domain
  domainImpacts: Record<CivilizationDomainType, number>;
  // Whether crisis is active
  isActive: boolean;
  // Resolution progress (0-100)
  resolutionProgress: number;
  // Creation tick
  createdTick: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Civilization milestone
export interface CivilizationMilestone {
  id: string;
  name: string;
  description?: string;
  // Category
  category: CivilizationDomainType | 'general';
  // Required score to reach
  requiredScore: number;
  // Whether milestone is reached
  isReached: boolean;
  // Tick when reached
  reachedTick?: number;
  // Effects when reached
  effects: Record<string, number>;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Civilization interaction
export interface CivilizationInteraction {
  id: string;
  type: CivilizationInteractionType;
  // Civilization A ID
  civilizationAId: string;
  // Civilization B ID
  civilizationBId: string;
  // Status
  status: 'pending' | 'active' | 'ended' | 'broken';
  // Strength of interaction (0-1)
  strength: number;
  // Benefits for A (0-100)
  benefitsA: number;
  // Benefits for B (0-100)
  benefitsB: number;
  // Duration so far (ticks)
  duration: number;
  // Start tick
  startTick: number;
  // End tick (if ended)
  endTick?: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Civilization definition
export interface Civilization {
  id: string;
  name: string;
  description?: string;
  // Current state
  state: CivilizationState;
  // Metrics
  metrics: CivilizationMetrics;
  // Active crises
  activeCrises: CivilizationCrisis[];
  // Resolved crises (history)
  resolvedCrises: CivilizationCrisis[];
  // Milestones
  milestones: CivilizationMilestone[];
  // Active interactions
  activeInteractions: string[];
  // Founding tick
  foundingTick: number;
  // Collapse tick (if collapsed)
  collapseTick?: number;
  // Founder/leader ID
  leaderId?: string;
  // Capital location
  capitalLocation?: { x: number; y: number; z: number };
  // Dominant culture ID
  dominantCultureId?: string;
  // Dominant religion/belief system ID
  dominantBeliefId?: string;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Civilization simulation configuration
export interface CivilizationSimulationConfig {
  // Whether to auto-calculate metrics
  autoCalculateMetrics?: boolean;
  // Metrics calculation interval (ticks)
  metricsInterval?: number;
  // Whether to auto-detect state changes
  autoDetectStateChanges?: boolean;
  // Score thresholds for state transitions
  stateThresholds?: {
    emerging: number;
    growing: number;
    prospering: number;
    stagnating: number;
    declining: number;
    collapsing: number;
  };
  // Golden age threshold (overall score must exceed this)
  goldenAgeThreshold?: number;
  // Crisis threshold (crisis level must exceed this)
  crisisThreshold?: number;
  // Collapse threshold (overall score must fall below this)
  collapseThreshold?: number;
  // Whether to enable multi-civilization interactions
  enableInteractions?: boolean;
  // Maximum active interactions per civilization
  maxInteractionsPerCiv?: number;
  // Whether to track milestone progress
  enableMilestones?: boolean;
  // Domain weight in overall score calculation
  domainWeights?: Record<CivilizationDomainType, number>;
}

// Default configuration
export const DEFAULT_CIVILIZATION_SIMULATION_CONFIG: Required<CivilizationSimulationConfig> = {
  autoCalculateMetrics: true,
  metricsInterval: 1,
  autoDetectStateChanges: true,
  stateThresholds: {
    emerging: 10,
    growing: 30,
    prospering: 60,
    stagnating: 50,
    declining: 30,
    collapsing: 15,
  },
  goldenAgeThreshold: 80,
  crisisThreshold: 50,
  collapseThreshold: 10,
  enableInteractions: true,
  maxInteractionsPerCiv: 5,
  enableMilestones: true,
  domainWeights: {
    [CivilizationDomainType.ECONOMIC]: 0.25,
    [CivilizationDomainType.SOCIAL]: 0.2,
    [CivilizationDomainType.CULTURAL]: 0.15,
    [CivilizationDomainType.MILITARY]: 0.15,
    [CivilizationDomainType.TECHNOLOGICAL]: 0.15,
    [CivilizationDomainType.POLITICAL]: 0.1,
  },
};

// Civilization comparison result
export interface CivilizationComparison {
  civilizationAId: string;
  civilizationBId: string;
  // Score difference (A - B)
  scoreDifference: number;
  // Relative power (A / (A + B))
  relativePowerA: number;
  relativePowerB: number;
  // Domain comparisons
  domainDifferences: Record<CivilizationDomainType, number>;
  // Dominant civilization (higher overall score)
  dominant: string;
  // Power ratio (dominant / weaker)
  powerRatio: number;
}

// Civilization simulation statistics
export interface CivilizationSimulationStats {
  totalCivilizations: number;
  activeCivilizations: number;
  collapsedCivilizations: number;
  totalInteractions: number;
  activeInteractions: number;
  totalCrises: number;
  activeCrises: number;
  totalMilestones: number;
  reachedMilestones: number;
  goldenAges: number;
  collapses: number;
  revivals: number;
  averageOverallScore: number;
  highestScore: number;
  lowestScore: number;
}
