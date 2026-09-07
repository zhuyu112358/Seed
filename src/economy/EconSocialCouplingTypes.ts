/**
 * Economic-Social Coupling System - Type Definitions
 *
 * M14 Economic Foundation Layer - Phase 4
 *
 * Defines types for economic status influencing social relations,
 * economic class dimensions in social norms, and culture-economy interactions.
 */

// Coupling direction
export enum CouplingDirection {
  ECON_TO_SOCIAL = 'econ_to_social',
  SOCIAL_TO_ECON = 'social_to_econ',
  BIDIRECTIONAL = 'bidirectional',
}

// Social relation economic modifier type
export enum RelationEconomicModifierType {
  WEALTH_BASED = 'wealth_based',
  CLASS_BASED = 'class_based',
  TRADE_PARTNER = 'trade_partner',
  EMPLOYER_EMPLOYEE = 'employer_employee',
  LANDLORD_TENANT = 'landlord_tenant',
  DEBTOR_CREDITOR = 'debtor_creditor',
  BUSINESS_PARTNER = 'business_partner',
  PATRON_CLIENT = 'patron_client',
  CUSTOM = 'custom',
}

// Economic class social norm type
export enum EconomicNormType {
  TAX_COMPLIANCE = 'tax_compliance',
  CHARITY = 'charity',
  CONSPICUOUS_CONSUMPTION = 'conspicuous_consumption',
  FRUGALITY = 'frugality',
  HARD_WORK = 'hard_work',
  WEALTH_ACCUMULATION = 'wealth_accumulation',
  REDISTRIBUTION = 'redistribution',
  PROPERTY_RIGHTS = 'property_rights',
  TRADE_ETIQUETTE = 'trade_etiquette',
  CUSTOM = 'custom',
}

// Culture-economy interaction type
export enum CultureEconomyInteractionType {
  CULTURE_INFLUENCES_PRODUCTION = 'culture_influences_production',
  CULTURE_INFLUENCES_CONSUMPTION = 'culture_influences_consumption',
  CULTURE_INFLUENCES_TRADE = 'culture_influences_trade',
  ECON_INFLUENCES_CULTURE = 'econ_influences_culture',
  ECON_DRIVES_CULTURAL_CHANGE = 'econ_drives_cultural_change',
  CULTURAL_RESISTANCE_TO_ECON = 'cultural_resistance_to_econ',
  SYMBIOTIC = 'symbiotic',
  CUSTOM = 'custom',
}

// Coupling event type
export enum CouplingEventType {
  COUPLING_ESTABLISHED = 'coupling.established',
  COUPLING_STRENGTHENED = 'coupling.strengthened',
  COUPLING_WEAKENED = 'coupling.weakened',
  COUPLING_SEVERED = 'coupling.severed',
  ECON_STATUS_CHANGED = 'coupling.econ_status_changed',
  SOCIAL_RELATION_MODIFIED = 'coupling.social_relation_modified',
  NORM_APPLIED = 'coupling.norm_applied',
  NORM_VIOLATED = 'coupling.norm_violated',
  CULTURE_ECON_INTERACTION = 'coupling.culture_econ_interaction',
  FEEDBACK_TRIGGERED = 'coupling.feedback_triggered',
}

// Economic-social relation modifier
export interface RelationEconomicModifier {
  id: string;
  relationId: string;
  agentAId: string;
  agentBId: string;
  type: RelationEconomicModifierType;
  // Strength of economic influence on relation (0-1)
  influenceStrength: number;
  // Wealth difference between agents
  wealthDifference: number;
  // Class difference (numeric index difference)
  classDifference: number;
  // Whether this modifier is active
  isActive: boolean;
  // Creation tick
  createdTick: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Economic social norm
export interface EconomicSocialNorm {
  id: string;
  name: string;
  type: EconomicNormType;
  description?: string;
  // Which economic classes this norm applies to (empty = all)
  applicableClasses: string[];
  // Expected behavior description
  expectedBehavior: string;
  // Compliance rate (0-1)
  complianceRate: number;
  // Violation penalty (social cost)
  violationPenalty: number;
  // Compliance reward (social benefit)
  complianceReward: number;
  // Whether norm is currently active
  isActive: boolean;
  // Cultural origin (which culture this norm comes from)
  culturalOrigin?: string;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Culture-economy interaction
export interface CultureEconomyInteraction {
  id: string;
  name: string;
  type: CultureEconomyInteractionType;
  description?: string;
  // Culture ID involved
  cultureId: string;
  // Economic domain affected (production/trade/consumption/distribution)
  economicDomain: string;
  // Direction of influence
  direction: CouplingDirection;
  // Strength of interaction (0-1)
  strength: number;
  // Whether interaction is active
  isActive: boolean;
  // Effects of this interaction
  effects: Record<string, number>;
  // Creation tick
  createdTick: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Economic-social coupling link
export interface EconSocialCouplingLink {
  id: string;
  agentId: string;
  // Economic class of agent
  economicClass: string;
  // Social status derived from economic class (0-100)
  derivedSocialStatus: number;
  // Social influence derived from wealth (0-100)
  wealthInfluence: number;
  // Economic capital converted to social capital
  socialCapitalFromEcon: number;
  // Active relation modifiers for this agent
  activeModifiers: string[];
  // Applicable norms for this agent
  applicableNorms: string[];
  // Culture-economy interactions affecting this agent
  activeInteractions: string[];
}

// Coupling feedback loop
export interface CouplingFeedbackLoop {
  id: string;
  name: string;
  description?: string;
  // Type of feedback (positive = reinforcing, negative = balancing)
  feedbackType: 'positive' | 'negative';
  // Trigger condition description
  triggerCondition: string;
  // Effect description
  effect: string;
  // Strength of feedback (0-1)
  strength: number;
  // Whether loop is active
  isActive: boolean;
  // Number of times triggered
  triggerCount: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Coupling metrics
export interface CouplingMetrics {
  // Total active coupling links
  totalCouplings: number;
  // Average influence strength across all modifiers
  averageInfluenceStrength: number;
  // Correlation between wealth and social status (0-1)
  wealthStatusCorrelation: number;
  // Economic mobility rate (fraction that changed class)
  economicMobilityRate: number;
  // Social mobility rate
  socialMobilityRate: number;
  // Norm compliance average (0-1)
  averageNormCompliance: number;
  // Active culture-economy interactions
  activeInteractions: number;
  // Active feedback loops
  activeFeedbackLoops: number;
  // Total feedback triggers
  totalFeedbackTriggers: number;
  // Economic inequality impact on social cohesion (0-1, higher = more impact)
  inequalitySocialImpact: number;
  // Cultural resistance to economic change (0-1)
  culturalResistanceLevel: number;
}

// Economic-social coupling configuration
export interface EconSocialCouplingConfig {
  // Whether to auto-derive social status from economic class
  autoDeriveSocialStatus?: boolean;
  // Wealth-to-social-status conversion rate (0-1)
  wealthStatusConversionRate?: number;
  // Whether to auto-apply economic norms
  autoApplyNorms?: boolean;
  // Whether to enable feedback loops
  enableFeedbackLoops?: boolean;
  // Feedback loop check interval (ticks)
  feedbackInterval?: number;
  // Whether to enable culture-economy interactions
  enableCultureInteractions?: boolean;
  // Maximum active modifiers per agent
  maxModifiersPerAgent?: number;
  // Whether to track coupling history
  trackHistory?: boolean;
  // Maximum history size
  maxHistorySize?: number;
}

// Default configuration
export const DEFAULT_ECON_SOCIAL_COUPLING_CONFIG: Required<EconSocialCouplingConfig> = {
  autoDeriveSocialStatus: true,
  wealthStatusConversionRate: 0.5,
  autoApplyNorms: true,
  enableFeedbackLoops: true,
  feedbackInterval: 10,
  enableCultureInteractions: true,
  maxModifiersPerAgent: 10,
  trackHistory: true,
  maxHistorySize: 10000,
};

// Coupling history entry
export interface CouplingHistoryEntry {
  tick: number;
  eventType: CouplingEventType;
  agentId?: string;
  details: Record<string, unknown>;
}
