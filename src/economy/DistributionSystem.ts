/**
 * Distribution System
 *
 * M14 Economic Foundation Layer - Phase 3
 *
 * Provides wealth/resource distribution, inequality measurement (Gini, Palma,
 * quintile ratios), allocation mechanisms, wealth gap analysis, economic class
 * tracking, social mobility metrics, and redistribution policies.
 */

import type { World } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Event } from '../event/Event.js';
import {
  DistributionMethod,
  EconomicClass,
  WealthSourceType,
  DistributionEventType,
  type EconomicAgent,
  type DistributionPool,
  type AllocationResult,
  type WealthTransfer,
  type InequalityMetrics,
  type ClassDistribution,
  type MobilityMetrics,
  type RedistributionPolicy,
  type DistributionConfig,
  DEFAULT_DISTRIBUTION_CONFIG,
  type DistributionStats,
} from './DistributionTypes.js';

export class DistributionSystem {
  readonly name = 'distribution-system';
  enabled = true;

  private config: Required<DistributionConfig>;
  private agents: Map<string, EconomicAgent> = new Map();
  private pools: Map<string, DistributionPool> = new Map();
  private transfers: WealthTransfer[] = [];
  private policies: Map<string, RedistributionPolicy> = new Map();
  private currentTick: number = 0;
  private transferIdCounter: number = 0;
  private redistributionCounter: number = 0;
  private stats: DistributionStats;
  // Track class changes for mobility analysis
  private classHistory: Map<string, Array<{ tick: number; class: EconomicClass; generation: number }>> = new Map();

  constructor(config?: DistributionConfig) {
    this.config = { ...DEFAULT_DISTRIBUTION_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }

  // ---------------------------------------------------------------------------
  // Agent Management
  // ---------------------------------------------------------------------------

  registerAgent(
    id: string,
    options?: Partial<EconomicAgent>
  ): EconomicAgent {
    const agent: EconomicAgent = {
      id,
      name: options?.name,
      wealth: options?.wealth ?? 0,
      currency: options?.currency ?? 0,
      resources: options?.resources ?? {},
      assets: options?.assets ?? {},
      income: options?.income ?? 0,
      expenses: options?.expenses ?? 0,
      economicClass: options?.economicClass ?? EconomicClass.POOR,
      wealthSources: options?.wealthSources ?? this.createEmptyWealthSources(),
      taxBracket: options?.taxBracket ?? 0,
      mobilityScore: options?.mobilityScore ?? 50,
      generation: options?.generation ?? 1,
      metadata: options?.metadata,
    };

    if (this.config.autoCalculateClasses) {
      agent.economicClass = this.calculateEconomicClass(agent.wealth);
    }

    this.agents.set(id, agent);
    this.stats.totalAgents++;
    this.trackClassChange(id, agent.economicClass, agent.generation);
    return agent;
  }

  getAgent(agentId: string): EconomicAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): EconomicAgent[] {
    return Array.from(this.agents.values());
  }

  updateAgent(agentId: string, updates: Partial<EconomicAgent>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const oldClass = agent.economicClass;
    Object.assign(agent, updates);

    // Recalculate total wealth
    agent.wealth = agent.currency +
      Object.values(agent.resources).reduce((a, b) => a + b, 0) +
      Object.values(agent.assets).reduce((a, b) => a + b, 0);

    if (this.config.autoCalculateClasses) {
      agent.economicClass = this.calculateEconomicClass(agent.wealth);
    }

    if (oldClass !== agent.economicClass) {
      this.trackClassChange(agentId, agent.economicClass, agent.generation);
      this.emitEvent(DistributionEventType.CLASS_CHANGED, {
        agentId,
        oldClass,
        newClass: agent.economicClass,
      });
    }

    return true;
  }

  addWealth(agentId: string, amount: number, source: WealthSourceType = WealthSourceType.OTHER): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.currency += amount;
    agent.wealth += amount;
    agent.wealthSources[source] = (agent.wealthSources[source] ?? 0) + amount;

    if (this.config.autoCalculateClasses) {
      const oldClass = agent.economicClass;
      agent.economicClass = this.calculateEconomicClass(agent.wealth);
      if (oldClass !== agent.economicClass) {
        this.trackClassChange(agentId, agent.economicClass, agent.generation);
      }
    }

    return true;
  }

  removeWealth(agentId: string, amount: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    if (agent.currency < amount) return false;

    agent.currency -= amount;
    agent.wealth -= amount;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Distribution Pools
  // ---------------------------------------------------------------------------

  createPool(
    id: string,
    name: string,
    resourceType: string,
    totalAmount: number,
    method: DistributionMethod,
    eligibleAgents: string[],
    options?: Partial<DistributionPool>
  ): DistributionPool {
    const pool: DistributionPool = {
      id,
      name,
      description: options?.description,
      resourceType,
      totalAmount,
      distributedAmount: 0,
      method,
      eligibleAgents: [...eligibleAgents],
      allocations: {},
      createdTick: this.currentTick,
      expiresAtTick: options?.expiresAtTick,
      isComplete: false,
      metadata: options?.metadata,
    };
    this.pools.set(id, pool);
    this.stats.totalPools++;
    return pool;
  }

  getPool(poolId: string): DistributionPool | undefined {
    return this.pools.get(poolId);
  }

  getAllPools(): DistributionPool[] {
    return Array.from(this.pools.values());
  }

  getActivePools(): DistributionPool[] {
    return Array.from(this.pools.values()).filter(p => !p.isComplete);
  }

  executeDistribution(poolId: string): AllocationResult[] {
    const pool = this.pools.get(poolId);
    if (!pool) return [{ success: false, reason: `Pool not found: ${poolId}` }];
    if (pool.isComplete) return [{ success: false, reason: 'Distribution already complete' }];

    this.emitEvent(DistributionEventType.DISTRIBUTION_STARTED, { poolId });

    const results: AllocationResult[] = [];
    const remaining = pool.totalAmount - pool.distributedAmount;

    if (remaining <= 0) {
      pool.isComplete = true;
      return [{ success: false, reason: 'No remaining amount' }];
    }

    switch (pool.method) {
      case DistributionMethod.EQUAL:
        results.push(...this.distributeEqual(pool, remaining));
        break;
      case DistributionMethod.PROPORTIONAL:
        results.push(...this.distributeProportional(pool, remaining));
        break;
      case DistributionMethod.NEED_BASED:
        results.push(...this.distributeNeedBased(pool, remaining));
        break;
      case DistributionMethod.MERIT_BASED:
        results.push(...this.distributeMeritBased(pool, remaining));
        break;
      case DistributionMethod.RANDOM:
        results.push(...this.distributeRandom(pool, remaining));
        break;
      case DistributionMethod.FIRST_COME:
        results.push(...this.distributeFirstCome(pool, remaining));
        break;
      default:
        results.push({ success: false, reason: `Unsupported method: ${pool.method}` });
    }

    // Check if complete
    if (pool.distributedAmount >= pool.totalAmount || pool.eligibleAgents.length === 0) {
      pool.isComplete = true;
      this.stats.completedPools++;
      this.emitEvent(DistributionEventType.DISTRIBUTION_COMPLETED, {
        poolId,
        totalDistributed: pool.distributedAmount,
      });
    }

    return results;
  }

  private distributeEqual(pool: DistributionPool, amount: number): AllocationResult[] {
    const results: AllocationResult[] = [];
    const eligible = pool.eligibleAgents.filter(id => !pool.allocations[id]);
    if (eligible.length === 0) return results;

    const perAgent = amount / eligible.length;
    for (const agentId of eligible) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      pool.allocations[agentId] = perAgent;
      pool.distributedAmount += perAgent;
      this.addWealth(agentId, perAgent, WealthSourceType.GOVERNMENT);
      this.stats.totalDistributed += perAgent;

      results.push({ success: true, agentId, amount: perAgent });
      this.emitEvent(DistributionEventType.ALLOCATION_MADE, {
        poolId: pool.id,
        agentId,
        amount: perAgent,
      });
    }
    return results;
  }

  private distributeProportional(pool: DistributionPool, amount: number): AllocationResult[] {
    const results: AllocationResult[] = [];
    const eligible = pool.eligibleAgents.filter(id => !pool.allocations[id]);
    if (eligible.length === 0) return results;

    // Proportional to current wealth (higher wealth gets more)
    const totalWealth = eligible.reduce((sum, id) => {
      const agent = this.agents.get(id);
      return sum + (agent?.wealth ?? 0);
    }, 0);

    if (totalWealth === 0) {
      return this.distributeEqual(pool, amount);
    }

    for (const agentId of eligible) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      const share = (agent.wealth / totalWealth) * amount;
      pool.allocations[agentId] = share;
      pool.distributedAmount += share;
      this.addWealth(agentId, share, WealthSourceType.GOVERNMENT);
      this.stats.totalDistributed += share;

      results.push({ success: true, agentId, amount: share });
    }
    return results;
  }

  private distributeNeedBased(pool: DistributionPool, amount: number): AllocationResult[] {
    const results: AllocationResult[] = [];
    const eligible = pool.eligibleAgents
      .filter(id => !pool.allocations[id])
      .map(id => this.agents.get(id))
      .filter((a): a is EconomicAgent => !!a)
      // Sort by wealth ascending (poorest first)
      .sort((a, b) => a.wealth - b.wealth);

    if (eligible.length === 0) return results;

    // Calculate need weights (poorer = higher weight)
    const weights = eligible.map(agent => {
      const need = agent.wealth < this.config.povertyLine ? 2 : 1;
      return need;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Distribute proportionally to need weight
    for (let i = 0; i < eligible.length; i++) {
      const agent = eligible[i];
      const share = (weights[i] / totalWeight) * amount;
      pool.allocations[agent.id] = share;
      pool.distributedAmount += share;
      this.addWealth(agent.id, share, WealthSourceType.GOVERNMENT);
      this.stats.totalDistributed += share;
      results.push({ success: true, agentId: agent.id, amount: share });
    }
    return results;
  }

  private distributeMeritBased(pool: DistributionPool, amount: number): AllocationResult[] {
    const results: AllocationResult[] = [];
    const eligible = pool.eligibleAgents
      .filter(id => !pool.allocations[id])
      .map(id => this.agents.get(id))
      .filter((a): a is EconomicAgent => !!a)
      // Sort by income descending (higher income = more merit)
      .sort((a, b) => b.income - a.income);

    if (eligible.length === 0) return results;

    const totalIncome = eligible.reduce((sum, a) => sum + a.income, 0);
    if (totalIncome === 0) return this.distributeEqual(pool, amount);

    for (const agent of eligible) {
      const share = (agent.income / totalIncome) * amount;
      pool.allocations[agent.id] = share;
      pool.distributedAmount += share;
      this.addWealth(agent.id, share, WealthSourceType.GOVERNMENT);
      this.stats.totalDistributed += share;
      results.push({ success: true, agentId: agent.id, amount: share });
    }
    return results;
  }

  private distributeRandom(pool: DistributionPool, amount: number): AllocationResult[] {
    const results: AllocationResult[] = [];
    const eligible = pool.eligibleAgents.filter(id => !pool.allocations[id]);
    if (eligible.length === 0) return results;

    // Random allocation: pick random agents until amount is exhausted
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    let remaining = amount;
    for (const agentId of shuffled) {
      if (remaining <= 0) break;
      const share = Math.random() * remaining;
      pool.allocations[agentId] = share;
      pool.distributedAmount += share;
      this.addWealth(agentId, share, WealthSourceType.GOVERNMENT);
      this.stats.totalDistributed += share;
      remaining -= share;
      results.push({ success: true, agentId, amount: share });
    }
    return results;
  }

  private distributeFirstCome(pool: DistributionPool, amount: number): AllocationResult[] {
    const results: AllocationResult[] = [];
    const eligible = pool.eligibleAgents.filter(id => !pool.allocations[id]);
    if (eligible.length === 0) return results;

    // First come first served: give to agents in order until exhausted
    const perAgent = amount / eligible.length;
    let remaining = amount;
    for (const agentId of eligible) {
      if (remaining <= 0) break;
      const share = Math.min(perAgent, remaining);
      pool.allocations[agentId] = share;
      pool.distributedAmount += share;
      this.addWealth(agentId, share, WealthSourceType.GOVERNMENT);
      this.stats.totalDistributed += share;
      remaining -= share;
      results.push({ success: true, agentId, amount: share });
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Wealth Transfers
  // ---------------------------------------------------------------------------

  transferWealth(
    fromAgentId: string,
    toAgentId: string,
    amount: number,
    reason: string,
    isRedistribution: boolean = false
  ): boolean {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);
    if (!fromAgent || !toAgent) return false;
    if (fromAgent.currency < amount) return false;

    fromAgent.currency -= amount;
    fromAgent.wealth -= amount;
    toAgent.currency += amount;
    toAgent.wealth += amount;

    if (this.config.trackTransfers) {
      const transfer: WealthTransfer = {
        id: `transfer_${++this.transferIdCounter}`,
        fromAgentId,
        toAgentId,
        amount,
        resourceType: 'currency',
        reason,
        tick: this.currentTick,
        isRedistribution,
      };
      this.transfers.push(transfer);
      if (this.transfers.length > this.config.maxTransferHistory) {
        this.transfers.shift();
      }
      this.stats.totalTransfers++;
      if (isRedistribution) this.stats.totalRedistributions++;
    }

    this.emitEvent(DistributionEventType.WEALTH_TRANSFERRED, {
      fromAgentId,
      toAgentId,
      amount,
      reason,
      isRedistribution,
    });

    return true;
  }

  getTransferHistory(agentId?: string, limit?: number): WealthTransfer[] {
    let transfers = [...this.transfers];
    if (agentId) {
      transfers = transfers.filter(t => t.fromAgentId === agentId || t.toAgentId === agentId);
    }
    return limit ? transfers.slice(-limit) : transfers;
  }

  // ---------------------------------------------------------------------------
  // Inequality Measurement
  // ---------------------------------------------------------------------------

  calculateInequality(): InequalityMetrics {
    const agents = this.getAllAgents();
    const n = agents.length;
    if (n === 0) {
      return this.createEmptyInequalityMetrics();
    }

    const wealths = agents.map(a => a.wealth).sort((a, b) => a - b);
    const totalWealth = wealths.reduce((a, b) => a + b, 0);

    // Gini coefficient
    let gini = 0;
    if (totalWealth > 0 && n > 1) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          sum += Math.abs(wealths[i] - wealths[j]);
        }
      }
      gini = sum / (2 * n * totalWealth);
    }

    // Palma ratio: top 10% / bottom 40%
    const top10Count = Math.max(1, Math.floor(n * 0.1));
    const bottom40Count = Math.max(1, Math.floor(n * 0.4));
    const top10Wealth = wealths.slice(-top10Count).reduce((a, b) => a + b, 0);
    const bottom40Wealth = wealths.slice(0, bottom40Count).reduce((a, b) => a + b, 0);
    const palmaRatio = bottom40Wealth > 0 ? top10Wealth / bottom40Wealth : Infinity;

    // Quintile share ratio (Q5/Q1)
    const quintileSize = Math.max(1, Math.floor(n / 5));
    const q1Wealth = wealths.slice(0, quintileSize).reduce((a, b) => a + b, 0);
    const q5Wealth = wealths.slice(-quintileSize).reduce((a, b) => a + b, 0);
    const quintileShareRatio = q1Wealth > 0 ? q5Wealth / q1Wealth : Infinity;

    // Top 1% and 10% shares
    const top1Count = Math.max(1, Math.floor(n * 0.01));
    const top1Wealth = wealths.slice(-top1Count).reduce((a, b) => a + b, 0);
    const top1PercentShare = totalWealth > 0 ? top1Wealth / totalWealth : 0;
    const top10PercentShare = totalWealth > 0 ? top10Wealth / totalWealth : 0;

    // Bottom 50% share
    const bottom50Count = Math.max(1, Math.floor(n * 0.5));
    const bottom50Wealth = wealths.slice(0, bottom50Count).reduce((a, b) => a + b, 0);
    const bottom50PercentShare = totalWealth > 0 ? bottom50Wealth / totalWealth : 0;

    // Mean, median, std dev
    const meanWealth = totalWealth / n;
    const medianWealth = n % 2 === 0
      ? (wealths[n / 2 - 1] + wealths[n / 2]) / 2
      : wealths[Math.floor(n / 2)];
    const variance = wealths.reduce((sum, w) => sum + (w - meanWealth) ** 2, 0) / n;
    const wealthStdDev = Math.sqrt(variance);
    const coefficientOfVariation = meanWealth > 0 ? wealthStdDev / meanWealth : 0;

    // Poverty
    const povertyLine = this.config.povertyLine;
    const povertyCount = wealths.filter(w => w < povertyLine).length;
    const povertyRate = povertyCount / n;

    return {
      giniCoefficient: gini,
      palmaRatio,
      quintileShareRatio,
      top1PercentShare,
      top10PercentShare,
      bottom50PercentShare,
      wealthGap: wealths[wealths.length - 1] - wealths[0],
      meanWealth,
      medianWealth,
      wealthStdDev,
      coefficientOfVariation,
      povertyCount,
      povertyRate,
      povertyLine,
    };
  }

  // ---------------------------------------------------------------------------
  // Class Distribution
  // ---------------------------------------------------------------------------

  calculateClassDistribution(): ClassDistribution {
    const agents = this.getAllAgents();
    const classCounts: Record<EconomicClass, number> = {} as Record<EconomicClass, number>;
    const classWealth: Record<EconomicClass, number> = {} as Record<EconomicClass, number>;

    for (const cls of Object.values(EconomicClass)) {
      classCounts[cls] = 0;
      classWealth[cls] = 0;
    }

    let totalWealth = 0;
    for (const agent of agents) {
      classCounts[agent.economicClass]++;
      classWealth[agent.economicClass] += agent.wealth;
      totalWealth += agent.wealth;
    }

    const n = agents.length;
    const classPercentages: Record<EconomicClass, number> = {} as Record<EconomicClass, number>;
    const classWealthShare: Record<EconomicClass, number> = {} as Record<EconomicClass, number>;
    const classAverageWealth: Record<EconomicClass, number> = {} as Record<EconomicClass, number>;

    for (const cls of Object.values(EconomicClass)) {
      classPercentages[cls] = n > 0 ? classCounts[cls] / n : 0;
      classWealthShare[cls] = totalWealth > 0 ? classWealth[cls] / totalWealth : 0;
      classAverageWealth[cls] = classCounts[cls] > 0 ? classWealth[cls] / classCounts[cls] : 0;
    }

    return {
      classCounts,
      classPercentages,
      classWealth,
      classWealthShare,
      classAverageWealth,
    };
  }

  calculateEconomicClass(wealth: number): EconomicClass {
    const boundaries = this.config.classBoundaries;
    const classes = Object.values(EconomicClass);
    let result = EconomicClass.DESTITUTE;
    for (const cls of classes) {
      if (wealth >= boundaries[cls]) {
        result = cls;
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Social Mobility
  // ---------------------------------------------------------------------------

  calculateMobility(): MobilityMetrics {
    const agents = this.getAllAgents();
    const transitionMatrix: Record<string, Record<string, number>> = {};
    let upwardMoves = 0;
    let downwardMoves = 0;
    let totalClassChanges = 0;
    let totalMobilityScore = 0;

    for (const agent of agents) {
      totalMobilityScore += agent.mobilityScore;
      const history = this.classHistory.get(agent.id) ?? [];
      for (let i = 1; i < history.length; i++) {
        const from = history[i - 1].class;
        const to = history[i].class;
        if (from !== to) {
          if (!transitionMatrix[from]) transitionMatrix[from] = {};
          transitionMatrix[from][to] = (transitionMatrix[from][to] ?? 0) + 1;
          totalClassChanges++;
          const fromIndex = Object.values(EconomicClass).indexOf(from);
          const toIndex = Object.values(EconomicClass).indexOf(to);
          if (toIndex > fromIndex) upwardMoves++;
          else if (toIndex < fromIndex) downwardMoves++;
        }
      }
    }

    const n = agents.length;
    return {
      intergenerationalElasticity: n > 0 ? 1 - (totalMobilityScore / n / 100) : 0,
      upwardMobilityRate: n > 0 ? upwardMoves / n : 0,
      downwardMobilityRate: n > 0 ? downwardMoves / n : 0,
      transitionMatrix,
      averageClassChange: totalClassChanges > 0 ? totalClassChanges / n : 0,
      averageMobilityScore: n > 0 ? totalMobilityScore / n : 0,
    };
  }

  private trackClassChange(agentId: string, newClass: EconomicClass, generation: number): void {
    if (!this.classHistory.has(agentId)) {
      this.classHistory.set(agentId, []);
    }
    this.classHistory.get(agentId)!.push({
      tick: this.currentTick,
      class: newClass,
      generation,
    });
  }

  // ---------------------------------------------------------------------------
  // Redistribution Policies
  // ---------------------------------------------------------------------------

  addPolicy(policy: RedistributionPolicy): void {
    this.policies.set(policy.id, policy);
    this.stats.policiesActive = Array.from(this.policies.values()).filter(p => p.enabled).length;
  }

  getPolicy(policyId: string): RedistributionPolicy | undefined {
    return this.policies.get(policyId);
  }

  getAllPolicies(): RedistributionPolicy[] {
    return Array.from(this.policies.values());
  }

  removePolicy(policyId: string): boolean {
    const result = this.policies.delete(policyId);
    this.stats.policiesActive = Array.from(this.policies.values()).filter(p => p.enabled).length;
    return result;
  }

  applyRedistribution(): void {
    if (!this.config.enableRedistribution) return;

    const policies = Array.from(this.policies.values())
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of policies) {
      this.applyPolicy(policy);
    }

    this.redistributionCounter++;
    this.stats.redistributionCounter = this.redistributionCounter;
  }

  private applyPolicy(policy: RedistributionPolicy): void {
    const agents = this.getAllAgents();

    switch (policy.type) {
      case 'tax': {
        // Progressive tax: tax agents above threshold
        for (const agent of agents) {
          if (agent.wealth >= (policy.threshold ?? 0)) {
            const taxAmount = agent.currency * policy.rate;
            if (taxAmount > 0) {
              this.removeWealth(agent.id, taxAmount);
              this.stats.totalDistributed += taxAmount;
            }
          }
        }
        break;
      }
      case 'wealth_tax': {
        // Wealth tax: tax on total wealth
        for (const agent of agents) {
          if (agent.wealth >= (policy.threshold ?? 0)) {
            const taxAmount = agent.wealth * policy.rate;
            if (taxAmount > 0 && agent.currency >= taxAmount) {
              this.removeWealth(agent.id, taxAmount);
            }
          }
        }
        break;
      }
      case 'welfare': {
        // Welfare: give to agents below threshold
        for (const agent of agents) {
          if (agent.wealth < (policy.threshold ?? this.config.povertyLine)) {
            const welfareAmount = policy.rate * (policy.threshold ?? this.config.povertyLine);
            this.addWealth(agent.id, welfareAmount, WealthSourceType.GOVERNMENT);
          }
        }
        break;
      }
      case 'universal_basic_income': {
        // UBI: give to all agents
        for (const agent of agents) {
          this.addWealth(agent.id, policy.rate, WealthSourceType.GOVERNMENT);
        }
        break;
      }
      case 'subsidy': {
        // Subsidy: give to agents in specific class or below threshold
        for (const agent of agents) {
          if (agent.wealth < (policy.threshold ?? Infinity)) {
            this.addWealth(agent.id, policy.rate, WealthSourceType.GOVERNMENT);
          }
        }
        break;
      }
    }

    this.emitEvent(DistributionEventType.REDISTRIBUTION_POLICY, {
      policyId: policy.id,
      policyType: policy.type,
    });
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats(): DistributionStats {
    this.stats.totalWealth = this.getAllAgents().reduce((sum, a) => sum + a.wealth, 0);
    this.stats.totalCurrency = this.getAllAgents().reduce((sum, a) => sum + a.currency, 0);
    this.stats.activePools = this.getActivePools().length;
    this.stats.averageAllocation = this.stats.totalDistributed > 0
      ? this.stats.totalDistributed / Object.keys(this.pools).length : 0;
    return { ...this.stats };
  }

  // ---------------------------------------------------------------------------
  // Tick / Update
  // ---------------------------------------------------------------------------

  tick(_dt: number, _world: World | null, events: EventSystem | null): void {
    if (!this.enabled) return;
    this.currentTick++;

    // Apply redistribution at interval
    if (this.config.enableRedistribution &&
        this.currentTick % this.config.redistributionInterval === 0) {
      this.applyRedistribution();
    }

    // Check for inequality warnings
    const inequality = this.calculateInequality();
    if (inequality.giniCoefficient > this.config.giniWarningThreshold) {
      this.emitEvent(DistributionEventType.INEQUALITY_CHANGED, {
        giniCoefficient: inequality.giniCoefficient,
        warning: true,
      }, events);
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private emitEvent(type: DistributionEventType, payload: Record<string, unknown>, events?: EventSystem | null): void {
    if (events) {
      const event = new Event({ type, payload, sourceId: this.name });
      events.emit(event);
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      agents: Array.from(this.agents.values()),
      pools: Array.from(this.pools.values()),
      transfers: this.transfers,
      policies: Array.from(this.policies.values()),
      currentTick: this.currentTick,
      transferIdCounter: this.transferIdCounter,
      redistributionCounter: this.redistributionCounter,
      stats: this.stats,
      classHistory: Array.from(this.classHistory.entries()),
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config) this.config = { ...DEFAULT_DISTRIBUTION_CONFIG, ...(data.config as object) };
    if (data.agents) {
      this.agents = new Map((data.agents as EconomicAgent[]).map(a => [a.id, a]));
    }
    if (data.pools) {
      this.pools = new Map((data.pools as DistributionPool[]).map(p => [p.id, p]));
    }
    if (data.transfers) this.transfers = data.transfers as WealthTransfer[];
    if (data.policies) {
      this.policies = new Map((data.policies as RedistributionPolicy[]).map(p => [p.id, p]));
    }
    if (typeof data.currentTick === 'number') this.currentTick = data.currentTick;
    if (typeof data.transferIdCounter === 'number') this.transferIdCounter = data.transferIdCounter;
    if (typeof data.redistributionCounter === 'number') this.redistributionCounter = data.redistributionCounter;
    if (data.stats) this.stats = data.stats as DistributionStats;
    if (data.classHistory) {
      this.classHistory = new Map(data.classHistory as Array<[string, Array<{ tick: number; class: EconomicClass; generation: number }>]>);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private createEmptyWealthSources(): Record<WealthSourceType, number> {
    const sources = {} as Record<WealthSourceType, number>;
    for (const type of Object.values(WealthSourceType)) {
      sources[type] = 0;
    }
    return sources;
  }

  private createEmptyStats(): DistributionStats {
    return {
      totalAgents: 0,
      totalPools: 0,
      activePools: 0,
      completedPools: 0,
      totalDistributed: 0,
      totalTransfers: 0,
      totalRedistributions: 0,
      averageAllocation: 0,
      totalWealth: 0,
      totalCurrency: 0,
      policiesActive: 0,
      redistributionCounter: 0,
    };
  }

  private createEmptyInequalityMetrics(): InequalityMetrics {
    return {
      giniCoefficient: 0,
      palmaRatio: 0,
      quintileShareRatio: 0,
      top1PercentShare: 0,
      top10PercentShare: 0,
      bottom50PercentShare: 0,
      wealthGap: 0,
      meanWealth: 0,
      medianWealth: 0,
      wealthStdDev: 0,
      coefficientOfVariation: 0,
      povertyCount: 0,
      povertyRate: 0,
      povertyLine: this.config.povertyLine,
    };
  }
}
