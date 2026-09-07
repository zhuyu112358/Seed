/**
 * Civilization Simulation System
 *
 * M14 Economic Foundation Layer - Phase 5
 *
 * Provides civilization simulation integrating economy, society, and culture,
 * including civilization rise/fall metrics, crises, milestones, and
 * multi-civilization interactions.
 */

import type { World } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Event } from '../event/Event.js';
import {
  CivilizationState,
  CivilizationDomainType,
  CivilizationInteractionType,
  CivilizationEventType,
  type CivilizationDomainScore,
  type CivilizationMetrics,
  type CivilizationCrisis,
  type CivilizationMilestone,
  type CivilizationInteraction,
  type Civilization,
  type CivilizationSimulationConfig,
  DEFAULT_CIVILIZATION_SIMULATION_CONFIG,
  type CivilizationComparison,
  type CivilizationSimulationStats,
} from './CivilizationSimulationTypes.js';

export class CivilizationSimulationSystem {
  readonly name = 'civilization-simulation-system';
  enabled = true;

  private config: Required<CivilizationSimulationConfig>;
  private civilizations: Map<string, Civilization> = new Map();
  private interactions: Map<string, CivilizationInteraction> = new Map();
  private currentTick: number = 0;
  private metricsCounter: number = 0;
  private interactionIdCounter: number = 0;
  private crisisIdCounter: number = 0;
  private stats: CivilizationSimulationStats;

  constructor(config?: CivilizationSimulationConfig) {
    this.config = { ...DEFAULT_CIVILIZATION_SIMULATION_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }

  // ---------------------------------------------------------------------------
  // Civilization Management
  // ---------------------------------------------------------------------------

  createCivilization(
    id: string,
    name: string,
    options?: Partial<Civilization>
  ): Civilization {
    const metrics = this.createInitialMetrics();
    const civilization: Civilization = {
      id,
      name,
      description: options?.description,
      state: options?.state ?? CivilizationState.EMERGING,
      metrics: options?.metrics ?? metrics,
      activeCrises: options?.activeCrises ?? [],
      resolvedCrises: options?.resolvedCrises ?? [],
      milestones: options?.milestones ?? this.createDefaultMilestones(),
      activeInteractions: options?.activeInteractions ?? [],
      foundingTick: this.currentTick,
      collapseTick: options?.collapseTick,
      leaderId: options?.leaderId,
      capitalLocation: options?.capitalLocation,
      dominantCultureId: options?.dominantCultureId,
      dominantBeliefId: options?.dominantBeliefId,
      metadata: options?.metadata,
    };

    this.civilizations.set(id, civilization);
    this.stats.totalCivilizations++;
    this.stats.activeCivilizations++;

    this.emitEvent(CivilizationEventType.CIVILIZATION_CREATED, {
      civilizationId: id,
      name,
    });

    return civilization;
  }

  getCivilization(civilizationId: string): Civilization | undefined {
    return this.civilizations.get(civilizationId);
  }

  getAllCivilizations(): Civilization[] {
    return Array.from(this.civilizations.values());
  }

  getActiveCivilizations(): Civilization[] {
    return Array.from(this.civilizations.values())
      .filter(c => c.state !== CivilizationState.COLLAPSED);
  }

  getCivilizationsByState(state: CivilizationState): Civilization[] {
    return Array.from(this.civilizations.values()).filter(c => c.state === state);
  }

  updateCivilization(civilizationId: string, updates: Partial<Civilization>): boolean {
    const civ = this.civilizations.get(civilizationId);
    if (!civ) return false;
    Object.assign(civ, updates);
    this.emitEvent(CivilizationEventType.CIVILIZATION_UPDATED, { civilizationId });
    return true;
  }

  updateMetrics(civilizationId: string, metricUpdates: Partial<CivilizationMetrics>): boolean {
    const civ = this.civilizations.get(civilizationId);
    if (!civ) return false;

    const oldScore = civ.metrics.overallScore;
    Object.assign(civ.metrics, metricUpdates);

    if (metricUpdates.overallScore !== undefined && metricUpdates.overallScore !== oldScore) {
      this.emitEvent(CivilizationEventType.DOMAIN_SCORE_CHANGED, {
        civilizationId,
        oldScore,
        newScore: metricUpdates.overallScore,
      });

      // Check for state changes
      if (this.config.autoDetectStateChanges) {
        this.checkStateChange(civ);
      }

      // Check for golden age
      this.checkGoldenAge(civ);

      // Check for collapse
      this.checkCollapse(civ);

      // Check milestones
      if (this.config.enableMilestones) {
        this.checkMilestones(civ);
      }
    }

    return true;
  }

  updateDomainScore(
    civilizationId: string,
    domain: CivilizationDomainType,
    score: number
  ): boolean {
    const civ = this.civilizations.get(civilizationId);
    if (!civ) return false;

    const domainScore = civ.metrics.domainScores[domain];
    const oldScore = domainScore.score;
    domainScore.previousScore = oldScore;
    domainScore.score = Math.max(0, Math.min(100, score));
    domainScore.trend = score > oldScore ? 1 : (score < oldScore ? -1 : 0);
    domainScore.changeRate = score - oldScore;

    // Recalculate overall score
    this.recalculateOverallScore(civ);

    return true;
  }

  private recalculateOverallScore(civ: Civilization): void {
    const oldScore = civ.metrics.overallScore;
    let weightedSum = 0;
    let totalWeight = 0;

    for (const domain of Object.values(CivilizationDomainType)) {
      const weight = this.config.domainWeights[domain] ?? 0.1;
      weightedSum += civ.metrics.domainScores[domain].score * weight;
      totalWeight += weight;
    }

    civ.metrics.previousScore = oldScore;
    civ.metrics.overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    civ.metrics.overallTrend = civ.metrics.overallScore > oldScore ? 1 :
      (civ.metrics.overallScore < oldScore ? -1 : 0);

    if (civ.metrics.overallScore !== oldScore) {
      this.emitEvent(CivilizationEventType.DOMAIN_SCORE_CHANGED, {
        civilizationId: civ.id,
        oldScore,
        newScore: civ.metrics.overallScore,
      });

      if (this.config.autoDetectStateChanges) {
        this.checkStateChange(civ);
      }
      this.checkGoldenAge(civ);
      this.checkCollapse(civ);
      if (this.config.enableMilestones) {
        this.checkMilestones(civ);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  private checkStateChange(civ: Civilization): void {
    const score = civ.metrics.overallScore;
    const thresholds = this.config.stateThresholds;
    let newState = civ.state;

    if (score >= thresholds.prospering) {
      newState = CivilizationState.PROSPERING;
    } else if (score >= thresholds.growing) {
      newState = CivilizationState.GROWING;
    } else if (score >= thresholds.emerging) {
      newState = CivilizationState.EMERGING;
    } else if (score >= thresholds.collapsing) {
      newState = CivilizationState.DECLINING;
    } else {
      newState = CivilizationState.COLLAPSING;
    }

    // Stagnating: score around 50 with low trend
    if (score >= thresholds.stagnating - 5 && score <= thresholds.stagnating + 5 &&
        Math.abs(civ.metrics.overallTrend) < 0.5) {
      newState = CivilizationState.STAGNATING;
    }

    if (newState !== civ.state) {
      const oldState = civ.state;
      civ.state = newState;
      this.emitEvent(CivilizationEventType.STATE_CHANGED, {
        civilizationId: civ.id,
        oldState,
        newState,
      });
    }
  }

  private checkGoldenAge(civ: Civilization): void {
    const isGoldenAge = civ.metrics.overallScore >= this.config.goldenAgeThreshold;
    const wasGoldenAge = civ.metrics.goldenAgeMultiplier > 1.0;

    if (isGoldenAge && !wasGoldenAge) {
      civ.metrics.goldenAgeMultiplier = 1.5;
      this.stats.goldenAges++;
      this.emitEvent(CivilizationEventType.GOLDEN_AGE_STARTED, {
        civilizationId: civ.id,
        score: civ.metrics.overallScore,
      });
    } else if (!isGoldenAge && wasGoldenAge) {
      civ.metrics.goldenAgeMultiplier = 1.0;
      this.emitEvent(CivilizationEventType.GOLDEN_AGE_ENDED, {
        civilizationId: civ.id,
      });
    }
  }

  private checkCollapse(civ: Civilization): void {
    if (civ.metrics.overallScore < this.config.collapseThreshold &&
        civ.state !== CivilizationState.COLLAPSED) {
      civ.state = CivilizationState.COLLAPSED;
      civ.collapseTick = this.currentTick;
      this.stats.collapses++;
      this.stats.activeCivilizations--;
      this.stats.collapsedCivilizations++;
      this.emitEvent(CivilizationEventType.COLLAPSE_TRIGGERED, {
        civilizationId: civ.id,
        score: civ.metrics.overallScore,
      });
    }
  }

  reviveCivilization(civilizationId: string): boolean {
    const civ = this.civilizations.get(civilizationId);
    if (!civ || civ.state !== CivilizationState.COLLAPSED) return false;

    civ.state = CivilizationState.REVIVING;
    civ.collapseTick = undefined;
    civ.metrics.overallScore = this.config.stateThresholds.emerging + 5;
    civ.metrics.goldenAgeMultiplier = 1.0;
    this.stats.revivals++;
    this.stats.activeCivilizations++;
    this.stats.collapsedCivilizations--;

    this.emitEvent(CivilizationEventType.REVIVAL_TRIGGERED, {
      civilizationId,
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // Crisis Management
  // ---------------------------------------------------------------------------

  triggerCrisis(
    civilizationId: string,
    name: string,
    type: CivilizationCrisis['type'],
    severity: number,
    options?: Partial<CivilizationCrisis>
  ): CivilizationCrisis | null {
    const civ = this.civilizations.get(civilizationId);
    if (!civ) return null;

    const crisis: CivilizationCrisis = {
      id: `crisis_${++this.crisisIdCounter}`,
      name,
      description: options?.description,
      type,
      severity: Math.max(0, Math.min(100, severity)),
      duration: 0,
      expectedDuration: options?.expectedDuration ?? 50,
      affectedDomains: options?.affectedDomains ?? [CivilizationDomainType.ECONOMIC],
      domainImpacts: options?.domainImpacts ?? this.createEmptyDomainImpacts(),
      isActive: true,
      resolutionProgress: 0,
      createdTick: this.currentTick,
      metadata: options?.metadata,
    };

    civ.activeCrises.push(crisis);
    civ.metrics.crisisLevel = Math.min(100, civ.metrics.crisisLevel + severity * 0.5);
    this.stats.totalCrises++;
    this.stats.activeCrises++;

    this.emitEvent(CivilizationEventType.CRISIS_TRIGGERED, {
      civilizationId,
      crisisId: crisis.id,
      name,
      type,
      severity,
    });

    return crisis;
  }

  resolveCrisis(civilizationId: string, crisisId: string): boolean {
    const civ = this.civilizations.get(civilizationId);
    if (!civ) return false;

    const crisisIndex = civ.activeCrises.findIndex(c => c.id === crisisId);
    if (crisisIndex === -1) return false;

    const crisis = civ.activeCrises[crisisIndex];
    crisis.isActive = false;
    crisis.resolutionProgress = 100;
    civ.resolvedCrises.push(crisis);
    civ.activeCrises.splice(crisisIndex, 1);
    civ.metrics.crisisLevel = Math.max(0, civ.metrics.crisisLevel - crisis.severity * 0.5);
    this.stats.activeCrises--;

    this.emitEvent(CivilizationEventType.CRISIS_RESOLVED, {
      civilizationId,
      crisisId,
    });

    return true;
  }

  getActiveCrises(civilizationId: string): CivilizationCrisis[] {
    const civ = this.civilizations.get(civilizationId);
    return civ?.activeCrises ?? [];
  }

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  private createDefaultMilestones(): CivilizationMilestone[] {
    return [
      {
        id: 'milestone_founding',
        name: 'Civilization Founded',
        category: 'general',
        requiredScore: 0,
        isReached: true,
        reachedTick: 0,
        effects: {},
      },
      {
        id: 'milestone_early_development',
        name: 'Early Development',
        category: CivilizationDomainType.ECONOMIC,
        requiredScore: 20,
        isReached: false,
        effects: { economicBonus: 5 },
      },
      {
        id: 'milestone_cultural_flowering',
        name: 'Cultural Flowering',
        category: CivilizationDomainType.CULTURAL,
        requiredScore: 40,
        isReached: false,
        effects: { culturalBonus: 10 },
      },
      {
        id: 'milestone_technological_breakthrough',
        name: 'Technological Breakthrough',
        category: CivilizationDomainType.TECHNOLOGICAL,
        requiredScore: 50,
        isReached: false,
        effects: { techBonus: 15 },
      },
      {
        id: 'milestone_golden_age',
        name: 'Golden Age',
        category: 'general',
        requiredScore: 80,
        isReached: false,
        effects: { allBonus: 10 },
      },
    ];
  }

  private checkMilestones(civ: Civilization): void {
    for (const milestone of civ.milestones) {
      if (!milestone.isReached && civ.metrics.overallScore >= milestone.requiredScore) {
        milestone.isReached = true;
        milestone.reachedTick = this.currentTick;
        this.stats.reachedMilestones++;

        this.emitEvent(CivilizationEventType.MILESTONE_REACHED, {
          civilizationId: civ.id,
          milestoneId: milestone.id,
          milestoneName: milestone.name,
          score: civ.metrics.overallScore,
        });
      }
    }
  }

  getMilestones(civilizationId: string): CivilizationMilestone[] {
    const civ = this.civilizations.get(civilizationId);
    return civ?.milestones ?? [];
  }

  getReachedMilestones(civilizationId: string): CivilizationMilestone[] {
    return this.getMilestones(civilizationId).filter(m => m.isReached);
  }

  // ---------------------------------------------------------------------------
  // Multi-Civilization Interactions
  // ---------------------------------------------------------------------------

  startInteraction(
    civilizationAId: string,
    civilizationBId: string,
    type: CivilizationInteractionType,
    options?: Partial<CivilizationInteraction>
  ): CivilizationInteraction | null {
    if (!this.config.enableInteractions) return null;

    const civA = this.civilizations.get(civilizationAId);
    const civB = this.civilizations.get(civilizationBId);
    if (!civA || !civB) return null;
    if (civA.state === CivilizationState.COLLAPSED || civB.state === CivilizationState.COLLAPSED) return null;
    if (civA.activeInteractions.length >= this.config.maxInteractionsPerCiv) return null;
    if (civB.activeInteractions.length >= this.config.maxInteractionsPerCiv) return null;

    const id = `interaction_${++this.interactionIdCounter}`;
    const interaction: CivilizationInteraction = {
      id,
      type,
      civilizationAId,
      civilizationBId,
      status: 'active',
      strength: options?.strength ?? 0.5,
      benefitsA: options?.benefitsA ?? 10,
      benefitsB: options?.benefitsB ?? 10,
      duration: 0,
      startTick: this.currentTick,
      metadata: options?.metadata,
    };

    this.interactions.set(id, interaction);
    civA.activeInteractions.push(id);
    civB.activeInteractions.push(id);
    this.stats.totalInteractions++;
    this.stats.activeInteractions++;

    this.emitEvent(CivilizationEventType.INTERACTION_STARTED, {
      interactionId: id,
      type,
      civilizationAId,
      civilizationBId,
    });

    return interaction;
  }

  endInteraction(interactionId: string): boolean {
    const interaction = this.interactions.get(interactionId);
    if (!interaction || interaction.status !== 'active') return false;

    interaction.status = 'ended';
    interaction.endTick = this.currentTick;

    const civA = this.civilizations.get(interaction.civilizationAId);
    const civB = this.civilizations.get(interaction.civilizationBId);
    if (civA) civA.activeInteractions = civA.activeInteractions.filter(id => id !== interactionId);
    if (civB) civB.activeInteractions = civB.activeInteractions.filter(id => id !== interactionId);

    this.stats.activeInteractions--;

    this.emitEvent(CivilizationEventType.INTERACTION_ENDED, {
      interactionId,
    });

    return true;
  }

  getInteraction(interactionId: string): CivilizationInteraction | undefined {
    return this.interactions.get(interactionId);
  }

  getAllInteractions(): CivilizationInteraction[] {
    return Array.from(this.interactions.values());
  }

  getActiveInteractions(): CivilizationInteraction[] {
    return Array.from(this.interactions.values()).filter(i => i.status === 'active');
  }

  getInteractionsForCivilization(civilizationId: string): CivilizationInteraction[] {
    return Array.from(this.interactions.values())
      .filter(i => i.civilizationAId === civilizationId || i.civilizationBId === civilizationId);
  }

  // ---------------------------------------------------------------------------
  // Civilization Comparison
  // ---------------------------------------------------------------------------

  /**
   * Compare two civilizations across all domains and metrics.
   * Computes score differences, relative power ratios, domain-by-domain
   * comparisons, and overall civilization strength assessment.
   * @param civilizationAId - ID of first civilization to compare
   * @param civilizationBId - ID of second civilization to compare
   * @returns CivilizationComparison containing domain score differences,
   *          overall score ratio, relative power assessment, and comparison summary
   */
  compareCivilizations(civilizationAId: string, civilizationBId: string): CivilizationComparison | null {
    const civA = this.civilizations.get(civilizationAId);
    const civB = this.civilizations.get(civilizationBId);
    if (!civA || !civB) return null;

    const scoreA = civA.metrics.overallScore;
    const scoreB = civB.metrics.overallScore;
    const totalScore = scoreA + scoreB;

    const domainDifferences = {} as Record<CivilizationDomainType, number>;
    for (const domain of Object.values(CivilizationDomainType)) {
      domainDifferences[domain] =
        civA.metrics.domainScores[domain].score - civB.metrics.domainScores[domain].score;
    }

    return {
      civilizationAId,
      civilizationBId,
      scoreDifference: scoreA - scoreB,
      relativePowerA: totalScore > 0 ? scoreA / totalScore : 0.5,
      relativePowerB: totalScore > 0 ? scoreB / totalScore : 0.5,
      domainDifferences,
      dominant: scoreA >= scoreB ? civilizationAId : civilizationBId,
      powerRatio: Math.min(scoreA, scoreB) > 0 ? Math.max(scoreA, scoreB) / Math.min(scoreA, scoreB) : Infinity,
    };
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats(): CivilizationSimulationStats {
    const civs = this.getAllCivilizations();
    const activeCivs = this.getActiveCivilizations();

    this.stats.totalCivilizations = civs.length;
    this.stats.activeCivilizations = activeCivs.length;
    this.stats.collapsedCivilizations = civs.filter(c => c.state === CivilizationState.COLLAPSED).length;
    this.stats.totalInteractions = this.interactions.size;
    this.stats.activeInteractions = this.getActiveInteractions().length;
    this.stats.totalCrises = civs.reduce((sum, c) => sum + c.activeCrises.length + c.resolvedCrises.length, 0);
    this.stats.activeCrises = civs.reduce((sum, c) => sum + c.activeCrises.length, 0);
    this.stats.totalMilestones = civs.reduce((sum, c) => sum + c.milestones.length, 0);
    this.stats.reachedMilestones = civs.reduce((sum, c) => sum + c.milestones.filter(m => m.isReached).length, 0);

    const scores = activeCivs.map(c => c.metrics.overallScore);
    this.stats.averageOverallScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    this.stats.highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    this.stats.lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    return { ...this.stats };
  }

  // ---------------------------------------------------------------------------
  // Tick / Update
  // ---------------------------------------------------------------------------

  tick(_dt: number, _world: World | null, events: EventSystem | null): void {
    if (!this.enabled) return;
    this.currentTick++;
    this.metricsCounter++;

    if (this.config.autoCalculateMetrics && this.metricsCounter >= this.config.metricsInterval) {
      this.metricsCounter = 0;
      this.updateAllCivilizationAges();
      this.updateActiveCrises();
      this.updateActiveInteractions();
    }
  }

  private updateAllCivilizationAges(): void {
    for (const civ of this.getActiveCivilizations()) {
      civ.metrics.age = this.currentTick - civ.foundingTick;
    }
  }

  private updateActiveCrises(): void {
    for (const civ of this.getActiveCivilizations()) {
      for (const crisis of civ.activeCrises) {
        crisis.duration++;
        // Auto-resolve if duration exceeds expected
        if (crisis.duration >= crisis.expectedDuration) {
          crisis.resolutionProgress = Math.min(100, crisis.resolutionProgress + 10);
          if (crisis.resolutionProgress >= 100) {
            this.resolveCrisis(civ.id, crisis.id);
          }
        }
      }
    }
  }

  private updateActiveInteractions(): void {
    for (const interaction of this.getActiveInteractions()) {
      interaction.duration++;
      // Apply benefits
      const civA = this.civilizations.get(interaction.civilizationAId);
      const civB = this.civilizations.get(interaction.civilizationBId);
      if (civA && civA.state !== CivilizationState.COLLAPSED) {
        // Apply small score boost based on benefits
      }
      if (civB && civB.state !== CivilizationState.COLLAPSED) {
        // Apply small score boost based on benefits
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private emitEvent(type: CivilizationEventType, payload: Record<string, unknown>, events?: EventSystem | null): void {
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
      civilizations: Array.from(this.civilizations.values()),
      interactions: Array.from(this.interactions.values()),
      currentTick: this.currentTick,
      interactionIdCounter: this.interactionIdCounter,
      crisisIdCounter: this.crisisIdCounter,
      stats: this.stats,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config) this.config = { ...DEFAULT_CIVILIZATION_SIMULATION_CONFIG, ...(data.config as object) };
    if (data.civilizations) {
      this.civilizations = new Map((data.civilizations as Civilization[]).map(c => [c.id, c]));
    }
    if (data.interactions) {
      this.interactions = new Map((data.interactions as CivilizationInteraction[]).map(i => [i.id, i]));
    }
    if (typeof data.currentTick === 'number') this.currentTick = data.currentTick;
    if (typeof data.interactionIdCounter === 'number') this.interactionIdCounter = data.interactionIdCounter;
    if (typeof data.crisisIdCounter === 'number') this.crisisIdCounter = data.crisisIdCounter;
    if (data.stats) this.stats = data.stats as CivilizationSimulationStats;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private createInitialMetrics(): CivilizationMetrics {
    const domainScores = {} as Record<CivilizationDomainType, CivilizationDomainScore>;
    for (const domain of Object.values(CivilizationDomainType)) {
      domainScores[domain] = {
        type: domain,
        score: 10,
        previousScore: 10,
        trend: 1,
        changeRate: 0,
        contributingFactors: {},
      };
    }

    return {
      overallScore: 10,
      previousScore: 10,
      overallTrend: 1,
      domainScores,
      population: 100,
      territory: 10,
      wealth: 100,
      culturalInfluence: 10,
      technologyLevel: 10,
      militaryStrength: 10,
      socialCohesion: 50,
      politicalStability: 50,
      happiness: 50,
      inequalityIndex: 0.3,
      crisisLevel: 0,
      goldenAgeMultiplier: 1.0,
      age: 0,
    };
  }

  private createEmptyStats(): CivilizationSimulationStats {
    return {
      totalCivilizations: 0,
      activeCivilizations: 0,
      collapsedCivilizations: 0,
      totalInteractions: 0,
      activeInteractions: 0,
      totalCrises: 0,
      activeCrises: 0,
      totalMilestones: 0,
      reachedMilestones: 0,
      goldenAges: 0,
      collapses: 0,
      revivals: 0,
      averageOverallScore: 0,
      highestScore: 0,
      lowestScore: 0,
    };
  }

  private createEmptyDomainImpacts(): Record<CivilizationDomainType, number> {
    const impacts = {} as Record<CivilizationDomainType, number>;
    for (const domain of Object.values(CivilizationDomainType)) {
      impacts[domain] = 0;
    }
    return impacts;
  }
}
