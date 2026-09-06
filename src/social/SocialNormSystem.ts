// M13 Social Norm System.
// Manages social norms: customs, taboos, values, traditions, etiquette, laws.
// Supports norm formation, evolution (mutation + selection + spread),
// violation detection, and social feedback generation.
// All norm content is defined by application layer.

import type { World } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import type {
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
} from "./SocialNormTypes.js";
import { DEFAULT_SOCIAL_NORM_CONFIG } from "./SocialNormTypes.js";

/** WorldSystem: social norm management and evolution. */
export class SocialNormSystem {
  readonly name = "social-norm-system";
  enabled = true;

  private config: SocialNormSystemConfig;
  private norms: Map<string, SocialNorm> = new Map();
  private violations: NormViolation[] = [];
  private feedbacks: SocialFeedback[] = [];
  private eventHistory: NormSystemEvent[] = [];
  private normCounter = 0;
  private violationCounter = 0;
  private feedbackCounter = 0;
  private mutationCounter = 0;

  constructor(config?: Partial<SocialNormSystemConfig>) {
    this.config = { ...DEFAULT_SOCIAL_NORM_CONFIG, ...config };
  }

  // --- Norm Management ---

  /** Add a new social norm. */
  addNorm(
    type: SocialNormType,
    name: string,
    description: string,
    options?: {
      compliantBehavior?: string;
      violatingBehavior?: string;
      scope?: Partial<NormScope>;
      importance?: number;
      complianceRate?: number;
      enforcers?: string[];
      metadata?: Record<string, unknown>;
    },
  ): NormModificationResult {
    if (this.norms.size >= this.config.maxNorms) {
      return { success: false, events: [], failureReason: "Max norms exceeded" };
    }

    this.normCounter++;
    const norm: SocialNorm = {
      id: `norm_${this.normCounter}`,
      type,
      name,
      description,
      compliantBehavior: options?.compliantBehavior ?? "Following the norm",
      violatingBehavior: options?.violatingBehavior ?? "Violating the norm",
      scope: {
        appliesTo: options?.scope?.appliesTo ?? [],
        excludes: options?.scope?.excludes ?? [],
        context: options?.scope?.context,
      },
      importance: options?.importance ?? 50,
      complianceRate: options?.complianceRate ?? 80,
      enforcers: options?.enforcers ?? [],
      active: true,
      establishedTick: 0,
      evolutionHistory: [],
      metadata: options?.metadata,
    };

    this.norms.set(norm.id, norm);

    const event = this.makeEvent("norm.established", norm.id, undefined, undefined, `Norm established: ${name}`);
    return { success: true, norm, events: [event] };
  }

  /** Get a norm by ID. */
  getNorm(normId: string): SocialNorm | undefined {
    return this.norms.get(normId);
  }

  /** Get all active norms. */
  getActiveNorms(): SocialNorm[] {
    return [...this.norms.values()].filter((n) => n.active);
  }

  /** Get norms by type. */
  getNormsByType(type: SocialNormType): SocialNorm[] {
    return this.getActiveNorms().filter((n) => n.type === type);
  }

  /** Get norms applicable to an entity. */
  getNormsForEntity(entityId: string): SocialNorm[] {
    return this.getActiveNorms().filter((n) => {
      if (n.scope.excludes.includes(entityId)) return false;
      if (n.scope.appliesTo.length === 0) return true;
      return n.scope.appliesTo.includes(entityId);
    });
  }

  /** Update a norm's properties. */
  updateNorm(
    normId: string,
    updates: Partial<Pick<SocialNorm, "name" | "description" | "compliantBehavior" | "violatingBehavior" | "importance" | "complianceRate" | "active" | "metadata">>,
  ): boolean {
    const norm = this.norms.get(normId);
    if (!norm) return false;

    Object.assign(norm, updates);
    this.makeEvent("norm.updated", normId, undefined, undefined, `Norm updated: ${norm.name}`);
    return true;
  }

  /** Abolish (remove) a norm. */
  abolishNorm(normId: string): boolean {
    const norm = this.norms.get(normId);
    if (!norm) return false;

    norm.active = false;
    this.makeEvent("norm.abolished", normId, undefined, undefined, `Norm abolished: ${norm.name}`);
    return true;
  }

  // --- Violation Detection ---

  /** Record a norm violation. */
  recordViolation(
    normId: string,
    violatorId: string,
    context: string,
    severity: NormViolationSeverity = "moderate",
  ): NormViolation | null {
    const norm = this.norms.get(normId);
    if (!norm || !norm.active) return null;

    this.violationCounter++;
    const violation: NormViolation = {
      id: `violation_${this.violationCounter}`,
      normId,
      violatorId,
      context,
      severity,
      socialResponse: this.determineSocialResponse(norm, severity),
      tick: 0,
      resolved: false,
    };

    this.violations.push(violation);
    if (this.violations.length > this.config.maxViolationHistory) {
      this.violations.shift();
    }

    // Reduce compliance rate.
    norm.complianceRate = Math.max(0, norm.complianceRate - this.severityToImpact(severity));

    // Generate social feedback if auto-enabled.
    if (this.config.autoGenerateFeedback) {
      this.generateFeedback(violation, norm);
    }

    this.makeEvent("violation.detected", normId, violation.id, undefined,
      `Violation: ${violatorId} violated ${norm.name} (${severity})`);

    return violation;
  }

  /** Resolve a violation (e.g., apology accepted, punishment served). */
  resolveViolation(violationId: string): boolean {
    const violation = this.violations.find((v) => v.id === violationId);
    if (!violation || violation.resolved) return false;

    violation.resolved = true;
    this.makeEvent("violation.resolved", violation.normId, violationId, undefined,
      `Violation resolved: ${violationId}`);
    return true;
  }

  /** Get all violations. */
  getViolations(limit?: number): NormViolation[] {
    const result = [...this.violations];
    return limit ? result.slice(-limit) : result;
  }

  /** Get unresolved violations. */
  getUnresolvedViolations(): NormViolation[] {
    return this.violations.filter((v) => !v.resolved);
  }

  /** Get violations for a specific entity. */
  getViolationsForEntity(entityId: string): NormViolation[] {
    return this.violations.filter((v) => v.violatorId === entityId);
  }

  // --- Compliance Check ---

  /** Check if a behavior complies with applicable norms. */
  checkCompliance(entityId: string, behavior: string): ComplianceCheckResult[] {
    const applicableNorms = this.getNormsForEntity(entityId);
    const results: ComplianceCheckResult[] = [];

    for (const norm of applicableNorms) {
      const isViolating = behavior.toLowerCase().includes(norm.violatingBehavior.toLowerCase());
      const isComplying = behavior.toLowerCase().includes(norm.compliantBehavior.toLowerCase());

      if (isViolating) {
        const severity = this.estimateSeverity(norm, behavior);
        results.push({
          compliant: false,
          normId: norm.id,
          normName: norm.name,
          violationSeverity: severity,
          explanation: `Behavior "${behavior}" violates norm "${norm.name}" (${norm.type})`,
        });
      } else if (isComplying) {
        results.push({
          compliant: true,
          normId: norm.id,
          normName: norm.name,
          explanation: `Behavior "${behavior}" complies with norm "${norm.name}"`,
        });
      }
    }

    return results;
  }

  // --- Social Feedback ---

  /** Generate social feedback for a violation. */
  private generateFeedback(violation: NormViolation, norm: SocialNorm): SocialFeedback {
    this.feedbackCounter++;
    const intensity = this.severityToIntensity(violation.severity, norm.importance);

    const feedback: SocialFeedback = {
      id: `feedback_${this.feedbackCounter}`,
      type: violation.socialResponse,
      targetId: violation.violatorId,
      sourceIds: norm.enforcers.length > 0 ? norm.enforcers : ["community"],
      intensity,
      normId: norm.id,
      violationId: violation.id,
      tick: 0,
    };

    this.feedbacks.push(feedback);
    if (this.feedbacks.length > this.config.maxFeedbackHistory) {
      this.feedbacks.shift();
    }

    this.makeEvent("feedback.given", norm.id, violation.id, feedback.id,
      `${feedback.type} given to ${violation.violatorId} (intensity: ${intensity})`);

    return feedback;
  }

  /** Give positive social feedback (approval/praise/reward). */
  givePositiveFeedback(
    targetId: string,
    type: SocialFeedbackType,
    sourceIds: string[],
    intensity: number,
    normId?: string,
  ): SocialFeedback {
    this.feedbackCounter++;
    const feedback: SocialFeedback = {
      id: `feedback_${this.feedbackCounter}`,
      type,
      targetId,
      sourceIds,
      intensity: Math.max(0, Math.min(100, intensity)),
      normId,
      tick: 0,
    };

    this.feedbacks.push(feedback);
    if (this.feedbacks.length > this.config.maxFeedbackHistory) {
      this.feedbacks.shift();
    }

    // Increase compliance rate of related norm.
    if (normId) {
      const norm = this.norms.get(normId);
      if (norm) {
        norm.complianceRate = Math.min(100, norm.complianceRate + intensity * 0.1);
      }
    }

    this.makeEvent("feedback.given", normId, undefined, feedback.id,
      `${type} given to ${targetId} (intensity: ${intensity})`);

    return feedback;
  }

  /** Get feedback history. */
  getFeedbacks(limit?: number): SocialFeedback[] {
    const result = [...this.feedbacks];
    return limit ? result.slice(-limit) : result;
  }

  // --- Norm Evolution ---

  /** Evolve norms: mutation, selection, spread. */
  evolveNorms(): number {
    if (!this.config.autoEvolve) return 0;

    let mutations = 0;
    for (const norm of this.getActiveNorms()) {
      // Random mutation based on mutation rate and norm weakness.
      const weaknessFactor = 1 - (norm.complianceRate / 100);
      const mutationChance = this.config.mutationRate * (1 + weaknessFactor * 2);

      if (Math.random() < mutationChance) {
        this.mutateNorm(norm);
        mutations++;
      }

      // Selection: weak norms may be abolished.
      if (norm.complianceRate < this.config.weakNormThreshold && Math.random() < 0.1) {
        this.makeEvent("norm.weakened", norm.id, undefined, undefined,
          `Norm "${norm.name}" is weak (compliance: ${norm.complianceRate.toFixed(1)}%)`);
      }
    }

    return mutations;
  }

  /** Mutate a norm (change its description or behavior slightly). */
  private mutateNorm(norm: SocialNorm): void {
    this.mutationCounter++;
    const mutationId = `mutation_${this.mutationCounter}`;

    // Random mutation type.
    const mutationTypes = ["description", "compliance_rate", "importance", "scope"];
    const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];

    let change = "";
    switch (mutationType) {
      case "description":
        change = `Description refined for "${norm.name}"`;
        break;
      case "compliance_rate":
        const delta = (Math.random() - 0.5) * 10;
        norm.complianceRate = Math.max(0, Math.min(100, norm.complianceRate + delta));
        change = `Compliance rate adjusted by ${delta.toFixed(1)} for "${norm.name}"`;
        break;
      case "importance":
        const impDelta = (Math.random() - 0.5) * 10;
        norm.importance = Math.max(0, Math.min(100, norm.importance + impDelta));
        change = `Importance adjusted by ${impDelta.toFixed(1)} for "${norm.name}"`;
        break;
      case "scope":
        change = `Scope refined for "${norm.name}"`;
        break;
    }

    const adoptionRate = norm.complianceRate / 100;
    const adopted = Math.random() < adoptionRate;

    norm.evolutionHistory.push({
      id: mutationId,
      tick: 0,
      change,
      adopted,
      adoptionRate,
    });

    if (adopted) {
      this.makeEvent("norm.evolved", norm.id, undefined, undefined,
        `Norm "${norm.name}" evolved: ${change}`);
    }
  }

  /** Get evolution history for a norm. */
  getEvolutionHistory(normId: string): SocialNorm["evolutionHistory"] {
    return this.norms.get(normId)?.evolutionHistory ?? [];
  }

  // --- WorldSystem Interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    if (!this.enabled) return;

    // Auto-evolve norms.
    if (this.config.autoEvolve) {
      this.evolveNorms();
    }
  }

  stop(): void {
    // Cleanup if needed.
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    return {
      config: this.config,
      norms: [...this.norms.values()],
      violations: this.violations.slice(-100),
      feedbacks: this.feedbacks.slice(-100),
      eventHistory: this.eventHistory.slice(-100),
      counters: {
        norm: this.normCounter,
        violation: this.violationCounter,
        feedback: this.feedbackCounter,
        mutation: this.mutationCounter,
      },
    };
  }

  deserialize(data: Record<string, unknown>): void {
    this.config = { ...DEFAULT_SOCIAL_NORM_CONFIG, ...(data.config as object) };
    this.norms.clear();
    this.violations = [];
    this.feedbacks = [];
    this.eventHistory = [];

    const norms = data.norms as SocialNorm[];
    for (const norm of norms) {
      this.norms.set(norm.id, norm);
    }

    this.violations = (data.violations as NormViolation[]) ?? [];
    this.feedbacks = (data.feedbacks as SocialFeedback[]) ?? [];
    this.eventHistory = (data.eventHistory as NormSystemEvent[]) ?? [];

    const counters = data.counters as Record<string, number>;
    this.normCounter = counters?.norm ?? this.norms.size;
    this.violationCounter = counters?.violation ?? this.violations.length;
    this.feedbackCounter = counters?.feedback ?? this.feedbacks.length;
    this.mutationCounter = counters?.mutation ?? 0;
  }

  // --- Statistics ---

  getStats(): SocialNormStats {
    const active = this.getActiveNorms();
    const normsByType: Record<string, number> = {};
    let totalCompliance = 0;
    let weakNorms = 0;
    let totalMutations = 0;

    for (const norm of active) {
      normsByType[norm.type] = (normsByType[norm.type] ?? 0) + 1;
      totalCompliance += norm.complianceRate;
      if (norm.complianceRate < this.config.weakNormThreshold) weakNorms++;
      totalMutations += norm.evolutionHistory.length;
    }

    return {
      totalNorms: this.norms.size,
      activeNorms: active.length,
      normsByType,
      totalViolations: this.violations.length,
      unresolvedViolations: this.getUnresolvedViolations().length,
      totalFeedback: this.feedbacks.length,
      averageComplianceRate: active.length > 0 ? totalCompliance / active.length : 0,
      weakNorms,
      totalMutations,
    };
  }

  // --- Internal Helpers ---

  private determineSocialResponse(norm: SocialNorm, severity: NormViolationSeverity): SocialFeedbackType {
    // Taboos and laws get harsher responses.
    const harshTypes: SocialNormType[] = ["taboo", "law"];
    const isHarsh = harshTypes.includes(norm.type);

    switch (severity) {
      case "minor":
        return isHarsh ? "disapproval" : "disapproval";
      case "moderate":
        return isHarsh ? "punishment" : "disapproval";
      case "major":
        return isHarsh ? "punishment" : "ostracism";
      case "catastrophic":
        return "ostracism";
    }
  }

  private severityToImpact(severity: NormViolationSeverity): number {
    switch (severity) {
      case "minor": return 2;
      case "moderate": return 5;
      case "major": return 10;
      case "catastrophic": return 20;
    }
  }

  private severityToIntensity(severity: NormViolationSeverity, importance: number): number {
    const base = this.severityToImpact(severity) * 5;
    return Math.min(100, base * (importance / 50));
  }

  private estimateSeverity(norm: SocialNorm, behavior: string): NormViolationSeverity {
    // Simple heuristic: more important norms + explicit violating behavior = higher severity.
    if (norm.importance >= 80) return "major";
    if (norm.importance >= 60) return "moderate";
    return "minor";
  }

  private makeEvent(
    type: NormSystemEventType,
    normId?: string,
    violationId?: string,
    feedbackId?: string,
    description?: string,
  ): NormSystemEvent {
    const event: NormSystemEvent = {
      type,
      normId,
      violationId,
      feedbackId,
      description,
      tick: 0,
    };
    this.eventHistory.push(event);
    if (this.eventHistory.length > 500) {
      this.eventHistory.shift();
    }
    return event;
  }
}
