/**
 * Distribution System - Type Definitions
 *
 * M14 Economic Foundation Layer - Phase 3
 *
 * Defines types for wealth/resource distribution, inequality measurement,
 * allocation mechanisms, wealth gap analysis, and economic social mobility.
 */

// Distribution method
export enum DistributionMethod {
  EQUAL = 'equal',
  PROPORTIONAL = 'proportional',
  NEED_BASED = 'need_based',
  MERIT_BASED = 'merit_based',
  RANDOM = 'random',
  FIRST_COME = 'first_come',
  AUCTION = 'auction',
  LOTTERY = 'lottery',
  CUSTOM = 'custom',
}

// Economic class / stratum
export enum EconomicClass {
  DESTITUTE = 'destitute',
  POOR = 'poor',
  WORKING = 'working',
  MIDDLE = 'middle',
  UPPER_MIDDLE = 'upper_middle',
  RICH = 'rich',
  WEALTHY = 'wealthy',
  ULTRA_RICH = 'ultra_rich',
}

// Wealth source type
export enum WealthSourceType {
  LABOR = 'labor',
  TRADE = 'trade',
  PRODUCTION = 'production',
  INHERITANCE = 'inheritance',
  INVESTMENT = 'investment',
  GOVERNMENT = 'government',
  THEFT = 'theft',
  OTHER = 'other',
}

// Distribution event type
export enum DistributionEventType {
  DISTRIBUTION_STARTED = 'distribution.started',
  DISTRIBUTION_COMPLETED = 'distribution.completed',
  DISTRIBUTION_FAILED = 'distribution.failed',
  ALLOCATION_MADE = 'distribution.allocation_made',
  WEALTH_TRANSFERRED = 'distribution.wealth_transferred',
  INEQUALITY_CHANGED = 'distribution.inequality_changed',
  CLASS_CHANGED = 'distribution.class_changed',
  MOBILITY_EVENT = 'distribution.mobility_event',
  REDISTRIBUTION_POLICY = 'distribution.redistribution_policy',
}

// Agent economic profile
export interface EconomicAgent {
  id: string;
  name?: string;
  // Total wealth (currency + asset value)
  wealth: number;
  // Liquid currency
  currency: number;
  // Resource holdings
  resources: Record<string, number>;
  // Asset values (buildings, land, etc.)
  assets: Record<string, number>;
  // Income per tick
  income: number;
  // Expenses per tick
  expenses: number;
  // Economic class
  economicClass: EconomicClass;
  // Wealth source breakdown
  wealthSources: Record<WealthSourceType, number>;
  // Tax bracket (0-1)
  taxBracket: number;
  // Social mobility score (0-100, higher = more mobile)
  mobilityScore: number;
  // Generation (for intergenerational wealth tracking)
  generation: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Distribution pool
export interface DistributionPool {
  id: string;
  name: string;
  description?: string;
  // Resource type being distributed (or 'currency' for money)
  resourceType: string;
  // Total amount available
  totalAmount: number;
  // Amount already distributed
  distributedAmount: number;
  // Distribution method
  method: DistributionMethod;
  // Eligible agent IDs
  eligibleAgents: string[];
  // Allocations made (agentId -> amount)
  allocations: Record<string, number>;
  // Creation tick
  createdTick: number;
  // Expiration tick
  expiresAtTick?: number;
  // Whether distribution is complete
  isComplete: boolean;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Allocation result
export interface AllocationResult {
  success: boolean;
  agentId?: string;
  amount?: number;
  reason?: string;
}

// Wealth transfer
export interface WealthTransfer {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  resourceType: string;
  reason: string;
  tick: number;
  // Whether this is a forced redistribution (tax, welfare, etc.)
  isRedistribution: boolean;
}

// Inequality metrics
export interface InequalityMetrics {
  // Gini coefficient (0 = perfect equality, 1 = maximum inequality)
  giniCoefficient: number;
  // Palma ratio (share of top 10% / share of bottom 40%)
  palmaRatio: number;
  // Quintile share ratio (Q5/Q1)
  quintileShareRatio: number;
  // Top 1% wealth share
  top1PercentShare: number;
  // Top 10% wealth share
  top10PercentShare: number;
  // Bottom 50% wealth share
  bottom50PercentShare: number;
  // Wealth gap (max - min)
  wealthGap: number;
  // Mean wealth
  meanWealth: number;
  // Median wealth
  medianWealth: number;
  // Standard deviation of wealth
  wealthStdDev: number;
  // Coefficient of variation
  coefficientOfVariation: number;
  // Number of agents below poverty line
  povertyCount: number;
  // Poverty rate (0-1)
  povertyRate: number;
  // Poverty line threshold
  povertyLine: number;
}

// Class distribution
export interface ClassDistribution {
  // Count per economic class
  classCounts: Record<EconomicClass, number>;
  // Percentage per economic class (0-1)
  classPercentages: Record<EconomicClass, number>;
  // Total wealth per class
  classWealth: Record<EconomicClass, number>;
  // Wealth share per class (0-1)
  classWealthShare: Record<EconomicClass, number>;
  // Average wealth per class
  classAverageWealth: Record<EconomicClass, number>;
}

// Social mobility metrics
export interface MobilityMetrics {
  // Intergenerational elasticity (0 = perfect mobility, 1 = no mobility)
  intergenerationalElasticity: number;
  // Absolute mobility rate (fraction that move up at least one class)
  upwardMobilityRate: number;
  // Downward mobility rate
  downwardMobilityRate: number;
  // Class transition matrix (fromClass -> toClass -> count)
  transitionMatrix: Record<string, Record<string, number>>;
  // Average class change per generation
  averageClassChange: number;
  // Mobility score average (0-100)
  averageMobilityScore: number;
}

// Redistribution policy
export interface RedistributionPolicy {
  id: string;
  name: string;
  description?: string;
  // Policy type
  type: 'tax' | 'welfare' | 'subsidy' | 'universal_basic_income' | 'wealth_tax' | 'custom';
  // Enabled
  enabled: boolean;
  // Rate (0-1) for tax/welfare
  rate: number;
  // Threshold (for progressive tax, minimum income for welfare, etc.)
  threshold?: number;
  // Resource type affected
  resourceType: string;
  // Priority (higher = applied first)
  priority: number;
  // Custom metadata
  metadata?: Record<string, unknown>;
}

// Distribution system configuration
export interface DistributionConfig {
  // Default distribution method
  defaultMethod?: DistributionMethod;
  // Poverty line (wealth threshold)
  povertyLine?: number;
  // Whether to auto-calculate economic classes
  autoCalculateClasses?: boolean;
  // Class boundaries (wealth thresholds)
  classBoundaries?: Record<EconomicClass, number>;
  // Whether to track wealth transfers
  trackTransfers?: boolean;
  // Maximum transfer history size
  maxTransferHistory?: number;
  // Whether to enable redistribution policies
  enableRedistribution?: boolean;
  // Redistribution tick interval
  redistributionInterval?: number;
  // Whether to enable social mobility tracking
  enableMobilityTracking?: boolean;
  // Gini coefficient warning threshold
  giniWarningThreshold?: number;
}

// Default configuration
export const DEFAULT_DISTRIBUTION_CONFIG: Required<DistributionConfig> = {
  defaultMethod: DistributionMethod.EQUAL,
  povertyLine: 100,
  autoCalculateClasses: true,
  classBoundaries: {
    [EconomicClass.DESTITUTE]: 0,
    [EconomicClass.POOR]: 50,
    [EconomicClass.WORKING]: 200,
    [EconomicClass.MIDDLE]: 500,
    [EconomicClass.UPPER_MIDDLE]: 1000,
    [EconomicClass.RICH]: 5000,
    [EconomicClass.WEALTHY]: 20000,
    [EconomicClass.ULTRA_RICH]: 100000,
  },
  trackTransfers: true,
  maxTransferHistory: 10000,
  enableRedistribution: true,
  redistributionInterval: 10,
  enableMobilityTracking: true,
  giniWarningThreshold: 0.5,
};

// Distribution statistics
export interface DistributionStats {
  totalAgents: number;
  totalPools: number;
  activePools: number;
  completedPools: number;
  totalDistributed: number;
  totalTransfers: number;
  totalRedistributions: number;
  averageAllocation: number;
  totalWealth: number;
  totalCurrency: number;
  policiesActive: number;
  redistributionCounter: number;
}
