/**
 * Economic-Social Coupling System
 *
 * M14 Economic Foundation Layer - Phase 4
 *
 * Provides coupling between economic status and social relations, economic class
 * dimensions in social norms, and culture-economy interactions. This system
 * bridges the M13 social/cultural systems with M14 economic systems.
 */

import type { World } from '../engine/World.js';
import type { EventSystem } from '../event/EventSystem.js';
import { Event } from '../event/Event.js';
import {
  CouplingDirection,
  RelationEconomicModifierType,
  EconomicNormType,
  CultureEconomyInteractionType,
  CouplingEventType,
  type RelationEconomicModifier,
  type EconomicSocialNorm,
  type CultureEconomyInteraction,
  type EconSocialCouplingLink,
  type CouplingFeedbackLoop,
  type CouplingMetrics,
  type EconSocialCouplingConfig,
  DEFAULT_ECON_SOCIAL_COUPLING_CONFIG,
  type CouplingHistoryEntry,
} from './EconSocialCouplingTypes.js';

export class EconSocialCouplingSystem {
  readonly name = 'econ-social-coupling-system';
  enabled = true;

  private config: Required<EconSocialCouplingConfig>;
  private modifiers: Map<string, RelationEconomicModifier> = new Map();
  private norms: Map<string, EconomicSocialNorm> = new Map();
  private interactions: Map<string, CultureEconomyInteraction> = new Map();
  private couplingLinks: Map<string, EconSocialCouplingLink> = new Map();
  private feedbackLoops: Map<string, CouplingFeedbackLoop> = new Map();
  private history: CouplingHistoryEntry[] = [];
  private currentTick: number = 0;
  private feedbackCounter: number = 0;
  private modifierIdCounter: number = 0;
  private interactionIdCounter: number = 0;
  private linkIdCounter: number = 0;

  constructor(config?: EconSocialCouplingConfig) {
    this.config = { ...DEFAULT_ECON_SOCIAL_COUPLING_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Relation Economic Modifiers
  // ---------------------------------------------------------------------------

  createRelationModifier(
    relationId: string,
    agentAId: string,
    agentBId: string,
    type: RelationEconomicModifierType,
    options?: Partial<RelationEconomicModifier>
  ): RelationEconomicModifier {
    const id = `modifier_${++this.modifierIdCounter}`;
    const modifier: RelationEconomicModifier = {
      id,
      relationId,
      agentAId,
      agentBId,
      type,
      influenceStrength: options?.influenceStrength ?? 0.5,
      wealthDifference: options?.wealthDifference ?? 0,
      classDifference: options?.classDifference ?? 0,
      isActive: options?.isActive ?? true,
      createdTick: this.currentTick,
      metadata: options?.metadata,
    };

    this.modifiers.set(id, modifier);
    this.addToHistory(CouplingEventType.COUPLING_ESTABLISHED, {
      modifierId: id,
      relationId,
      type,
    });

    return modifier;
  }

  getModifier(modifierId: string): RelationEconomicModifier | undefined {
    return this.modifiers.get(modifierId);
  }

  getAllModifiers(): RelationEconomicModifier[] {
    return Array.from(this.modifiers.values());
  }

  getActiveModifiers(): RelationEconomicModifier[] {
    return Array.from(this.modifiers.values()).filter(m => m.isActive);
  }

  getModifiersByAgent(agentId: string): RelationEconomicModifier[] {
    return Array.from(this.modifiers.values())
      .filter(m => m.agentAId === agentId || m.agentBId === agentId);
  }

  getModifiersByRelation(relationId: string): RelationEconomicModifier[] {
    return Array.from(this.modifiers.values()).filter(m => m.relationId === relationId);
  }

  updateModifier(modifierId: string, updates: Partial<RelationEconomicModifier>): boolean {
    const modifier = this.modifiers.get(modifierId);
    if (!modifier) return false;

    const oldStrength = modifier.influenceStrength;
    Object.assign(modifier, updates);

    if (updates.influenceStrength !== undefined && updates.influenceStrength !== oldStrength) {
      const eventType = updates.influenceStrength > oldStrength
        ? CouplingEventType.COUPLING_STRENGTHENED
        : CouplingEventType.COUPLING_WEAKENED;
      this.addToHistory(eventType, { modifierId, oldStrength, newStrength: updates.influenceStrength });
    }

    return true;
  }

  removeModifier(modifierId: string): boolean {
    const modifier = this.modifiers.get(modifierId);
    if (!modifier) return false;

    this.modifiers.delete(modifierId);
    this.addToHistory(CouplingEventType.COUPLING_SEVERED, { modifierId });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Economic Social Norms
  // ---------------------------------------------------------------------------

  addNorm(norm: EconomicSocialNorm): void {
    this.norms.set(norm.id, norm);
  }

  createNorm(
    id: string,
    name: string,
    type: EconomicNormType,
    expectedBehavior: string,
    options?: Partial<EconomicSocialNorm>
  ): EconomicSocialNorm {
    const norm: EconomicSocialNorm = {
      id,
      name,
      type,
      description: options?.description,
      applicableClasses: options?.applicableClasses ?? [],
      expectedBehavior,
      complianceRate: options?.complianceRate ?? 0.7,
      violationPenalty: options?.violationPenalty ?? 10,
      complianceReward: options?.complianceReward ?? 5,
      isActive: options?.isActive ?? true,
      culturalOrigin: options?.culturalOrigin,
      metadata: options?.metadata,
    };
    this.norms.set(id, norm);
    this.addToHistory(CouplingEventType.NORM_APPLIED, {
      normId: id,
      type,
      name,
    });
    return norm;
  }

  getNorm(normId: string): EconomicSocialNorm | undefined {
    return this.norms.get(normId);
  }

  getAllNorms(): EconomicSocialNorm[] {
    return Array.from(this.norms.values());
  }

  getActiveNorms(): EconomicSocialNorm[] {
    return Array.from(this.norms.values()).filter(n => n.isActive);
  }

  getNormsForClass(economicClass: string): EconomicSocialNorm[] {
    return Array.from(this.norms.values())
      .filter(n => n.isActive && (n.applicableClasses.length === 0 || n.applicableClasses.includes(economicClass)));
  }

  applyNorm(normId: string, agentId: string): { success: boolean; socialChange: number } {
    const norm = this.norms.get(normId);
    if (!norm || !norm.isActive) return { success: false, socialChange: 0 };

    // Simulate compliance check (in real system, would check agent behavior)
    const isCompliant = Math.random() < norm.complianceRate;
    const socialChange = isCompliant ? norm.complianceReward : -norm.violationPenalty;

    this.addToHistory(CouplingEventType.NORM_APPLIED, {
      normId,
      agentId,
      isCompliant,
      socialChange,
    });

    return { success: true, socialChange };
  }

  violateNorm(normId: string, agentId: string): { success: boolean; penalty: number } {
    const norm = this.norms.get(normId);
    if (!norm || !norm.isActive) return { success: false, penalty: 0 };

    this.addToHistory(CouplingEventType.NORM_VIOLATED, {
      normId,
      agentId,
      penalty: norm.violationPenalty,
    });

    return { success: true, penalty: norm.violationPenalty };
  }

  removeNorm(normId: string): boolean {
    return this.norms.delete(normId);
  }

  // ---------------------------------------------------------------------------
  // Culture-Economy Interactions
  // ---------------------------------------------------------------------------

  createInteraction(
    name: string,
    type: CultureEconomyInteractionType,
    cultureId: string,
    economicDomain: string,
    direction: CouplingDirection,
    options?: Partial<CultureEconomyInteraction>
  ): CultureEconomyInteraction {
    const id = `interaction_${++this.interactionIdCounter}`;
    const interaction: CultureEconomyInteraction = {
      id,
      name,
      type,
      description: options?.description,
      cultureId,
      economicDomain,
      direction,
      strength: options?.strength ?? 0.5,
      isActive: options?.isActive ?? true,
      effects: options?.effects ?? {},
      createdTick: this.currentTick,
      metadata: options?.metadata,
    };

    this.interactions.set(id, interaction);
    this.addToHistory(CouplingEventType.CULTURE_ECON_INTERACTION, {
      interactionId: id,
      type,
      cultureId,
      economicDomain,
    });

    return interaction;
  }

  getInteraction(interactionId: string): CultureEconomyInteraction | undefined {
    return this.interactions.get(interactionId);
  }

  getAllInteractions(): CultureEconomyInteraction[] {
    return Array.from(this.interactions.values());
  }

  getActiveInteractions(): CultureEconomyInteraction[] {
    return Array.from(this.interactions.values()).filter(i => i.isActive);
  }

  getInteractionsByCulture(cultureId: string): CultureEconomyInteraction[] {
    return Array.from(this.interactions.values()).filter(i => i.cultureId === cultureId);
  }

  getInteractionsByDomain(economicDomain: string): CultureEconomyInteraction[] {
    return Array.from(this.interactions.values()).filter(i => i.economicDomain === economicDomain);
  }

  updateInteraction(interactionId: string, updates: Partial<CultureEconomyInteraction>): boolean {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) return false;
    Object.assign(interaction, updates);
    return true;
  }

  removeInteraction(interactionId: string): boolean {
    return this.interactions.delete(interactionId);
  }

  // ---------------------------------------------------------------------------
  // Coupling Links
  // ---------------------------------------------------------------------------

  createCouplingLink(
    agentId: string,
    economicClass: string,
    options?: Partial<EconSocialCouplingLink>
  ): EconSocialCouplingLink {
    const id = `link_${++this.linkIdCounter}`;

    // Derive social status from economic class
    const classIndex = ['destitute', 'poor', 'working', 'middle', 'upper_middle', 'rich', 'wealthy', 'ultra_rich'].indexOf(economicClass.toLowerCase());
    const derivedSocialStatus = this.config.autoDeriveSocialStatus
      ? Math.max(0, Math.min(100, (classIndex >= 0 ? classIndex * 12.5 : 50)))
      : 50;

    const link: EconSocialCouplingLink = {
      id,
      agentId,
      economicClass,
      derivedSocialStatus,
      wealthInfluence: options?.wealthInfluence ?? derivedSocialStatus * this.config.wealthStatusConversionRate,
      socialCapitalFromEcon: options?.socialCapitalFromEcon ?? derivedSocialStatus * 0.3,
      activeModifiers: options?.activeModifiers ?? [],
      applicableNorms: options?.applicableNorms ?? [],
      activeInteractions: options?.activeInteractions ?? [],
    };

    this.couplingLinks.set(agentId, link);
    return link;
  }

  getCouplingLink(agentId: string): EconSocialCouplingLink | undefined {
    return this.couplingLinks.get(agentId);
  }

  getAllCouplingLinks(): EconSocialCouplingLink[] {
    return Array.from(this.couplingLinks.values());
  }

  updateCouplingLink(agentId: string, updates: Partial<EconSocialCouplingLink>): boolean {
    const link = this.couplingLinks.get(agentId);
    if (!link) return false;
    Object.assign(link, updates);
    return true;
  }

  removeCouplingLink(agentId: string): boolean {
    return this.couplingLinks.delete(agentId);
  }

  // ---------------------------------------------------------------------------
  // Feedback Loops
  // ---------------------------------------------------------------------------

  addFeedbackLoop(loop: CouplingFeedbackLoop): void {
    this.feedbackLoops.set(loop.id, loop);
  }

  createFeedbackLoop(
    id: string,
    name: string,
    feedbackType: 'positive' | 'negative',
    triggerCondition: string,
    effect: string,
    options?: Partial<CouplingFeedbackLoop>
  ): CouplingFeedbackLoop {
    const loop: CouplingFeedbackLoop = {
      id,
      name,
      description: options?.description,
      feedbackType,
      triggerCondition,
      effect,
      strength: options?.strength ?? 0.5,
      isActive: options?.isActive ?? true,
      triggerCount: 0,
      metadata: options?.metadata,
    };
    this.feedbackLoops.set(id, loop);
    return loop;
  }

  getFeedbackLoop(loopId: string): CouplingFeedbackLoop | undefined {
    return this.feedbackLoops.get(loopId);
  }

  getAllFeedbackLoops(): CouplingFeedbackLoop[] {
    return Array.from(this.feedbackLoops.values());
  }

  getActiveFeedbackLoops(): CouplingFeedbackLoop[] {
    return Array.from(this.feedbackLoops.values()).filter(l => l.isActive);
  }

  triggerFeedbackLoop(loopId: string): boolean {
    const loop = this.feedbackLoops.get(loopId);
    if (!loop || !loop.isActive) return false;

    loop.triggerCount++;
    this.addToHistory(CouplingEventType.FEEDBACK_TRIGGERED, {
      loopId,
      feedbackType: loop.feedbackType,
      triggerCount: loop.triggerCount,
    });

    return true;
  }

  removeFeedbackLoop(loopId: string): boolean {
    return this.feedbackLoops.delete(loopId);
  }

  // ---------------------------------------------------------------------------
  // Coupling Metrics
  // ---------------------------------------------------------------------------

  calculateMetrics(): CouplingMetrics {
    const activeModifiers = this.getActiveModifiers();
    const activeNorms = this.getActiveNorms();
    const activeInteractions = this.getActiveInteractions();
    const activeLoops = this.getActiveFeedbackLoops();

    const totalCouplings = this.couplingLinks.size;
    const averageInfluenceStrength = activeModifiers.length > 0
      ? activeModifiers.reduce((sum, m) => sum + m.influenceStrength, 0) / activeModifiers.length
      : 0;

    // Calculate wealth-status correlation (simplified)
    const links = this.getAllCouplingLinks();
    let wealthStatusCorrelation = 0;
    if (links.length > 1) {
      const wealths = links.map(l => l.wealthInfluence);
      const statuses = links.map(l => l.derivedSocialStatus);
      const meanWealth = wealths.reduce((a, b) => a + b, 0) / wealths.length;
      const meanStatus = statuses.reduce((a, b) => a + b, 0) / statuses.length;
      let covariance = 0;
      let wealthVariance = 0;
      let statusVariance = 0;
      for (let i = 0; i < links.length; i++) {
        covariance += (wealths[i] - meanWealth) * (statuses[i] - meanStatus);
        wealthVariance += (wealths[i] - meanWealth) ** 2;
        statusVariance += (statuses[i] - meanStatus) ** 2;
      }
      const denominator = Math.sqrt(wealthVariance * statusVariance);
      wealthStatusCorrelation = denominator > 0 ? covariance / denominator : 0;
    }

    const averageNormCompliance = activeNorms.length > 0
      ? activeNorms.reduce((sum, n) => sum + n.complianceRate, 0) / activeNorms.length
      : 0;

    const totalFeedbackTriggers = activeLoops.reduce((sum, l) => sum + l.triggerCount, 0);

    return {
      totalCouplings,
      averageInfluenceStrength,
      wealthStatusCorrelation,
      economicMobilityRate: 0, // Would be calculated from class change history
      socialMobilityRate: 0,
      averageNormCompliance,
      activeInteractions: activeInteractions.length,
      activeFeedbackLoops: activeLoops.length,
      totalFeedbackTriggers,
      inequalitySocialImpact: averageInfluenceStrength * 0.5,
      culturalResistanceLevel: activeInteractions.filter(i => i.type === CultureEconomyInteractionType.CULTURAL_RESISTANCE_TO_ECON).length * 0.1,
    };
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  private addToHistory(eventType: CouplingEventType, details: Record<string, unknown>, agentId?: string): void {
    if (!this.config.trackHistory) return;

    this.history.push({
      tick: this.currentTick,
      eventType,
      agentId,
      details,
    });

    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
  }

  getHistory(limit?: number): CouplingHistoryEntry[] {
    return limit ? this.history.slice(-limit) : [...this.history];
  }

  getHistoryByAgent(agentId: string, limit?: number): CouplingHistoryEntry[] {
    const filtered = this.history.filter(h => h.agentId === agentId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  // ---------------------------------------------------------------------------
  // Tick / Update
  // ---------------------------------------------------------------------------

  tick(_dt: number, _world: World | null, events: EventSystem | null): void {
    if (!this.enabled) return;
    this.currentTick++;
    this.feedbackCounter++;

    // Check feedback loops at interval
    if (this.config.enableFeedbackLoops && this.feedbackCounter >= this.config.feedbackInterval) {
      this.feedbackCounter = 0;
      this.checkFeedbackLoops(events);
    }
  }

  private checkFeedbackLoops(events: EventSystem | null): void {
    for (const loop of this.getActiveFeedbackLoops()) {
      // In a full implementation, would check triggerCondition against world state
      // For now, randomly trigger based on strength
      if (Math.random() < loop.strength * 0.1) {
        this.triggerFeedbackLoop(loop.id);
        if (events) {
          const event = new Event({
            type: CouplingEventType.FEEDBACK_TRIGGERED,
            payload: { loopId: loop.id, feedbackType: loop.feedbackType },
            sourceId: this.name,
          });
          events.emit(event);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private emitEvent(type: CouplingEventType, payload: Record<string, unknown>, events?: EventSystem | null): void {
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
      modifiers: Array.from(this.modifiers.values()),
      norms: Array.from(this.norms.values()),
      interactions: Array.from(this.interactions.values()),
      couplingLinks: Array.from(this.couplingLinks.values()),
      feedbackLoops: Array.from(this.feedbackLoops.values()),
      history: this.history,
      currentTick: this.currentTick,
      modifierIdCounter: this.modifierIdCounter,
      interactionIdCounter: this.interactionIdCounter,
      linkIdCounter: this.linkIdCounter,
    };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.config) this.config = { ...DEFAULT_ECON_SOCIAL_COUPLING_CONFIG, ...(data.config as object) };
    if (data.modifiers) {
      this.modifiers = new Map((data.modifiers as RelationEconomicModifier[]).map(m => [m.id, m]));
    }
    if (data.norms) {
      this.norms = new Map((data.norms as EconomicSocialNorm[]).map(n => [n.id, n]));
    }
    if (data.interactions) {
      this.interactions = new Map((data.interactions as CultureEconomyInteraction[]).map(i => [i.id, i]));
    }
    if (data.couplingLinks) {
      this.couplingLinks = new Map((data.couplingLinks as EconSocialCouplingLink[]).map(l => [l.agentId, l]));
    }
    if (data.feedbackLoops) {
      this.feedbackLoops = new Map((data.feedbackLoops as CouplingFeedbackLoop[]).map(l => [l.id, l]));
    }
    if (data.history) this.history = data.history as CouplingHistoryEntry[];
    if (typeof data.currentTick === 'number') this.currentTick = data.currentTick;
    if (typeof data.modifierIdCounter === 'number') this.modifierIdCounter = data.modifierIdCounter;
    if (typeof data.interactionIdCounter === 'number') this.interactionIdCounter = data.interactionIdCounter;
    if (typeof data.linkIdCounter === 'number') this.linkIdCounter = data.linkIdCounter;
  }
}
