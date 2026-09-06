// TaskChainSystem: WorldSystem for multi-step task chains with dependencies.
//
// Manages task chains, step progression, dependency resolution, and task narrative.
// Extends the M6 TaskSystem with chain-level orchestration.
//
// M12 Phase 7: Task Chain Deepening.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { Event } from "../event/Event.js";
import {
  TaskChain,
  TaskChainStatus,
  TaskChainStep,
  ChainStepStatus,
  TaskChainConfig,
  DEFAULT_TASK_CHAIN_CONFIG,
  StepProgressionResult,
  DependencyCheckResult,
} from "./TaskChainTypes.js";

export class TaskChainSystem implements WorldSystem {
  readonly name = "task-chain";
  enabled = true;

  private config: TaskChainConfig;
  private readonly chains = new Map<string, TaskChain>(); // chainId → chain
  private currentTick = 0;
  private eventSystem: EventSystem | null = null;

  constructor(config?: Partial<TaskChainConfig>) {
    this.config = { ...DEFAULT_TASK_CHAIN_CONFIG, ...config };
  }

  // --- Chain Management ---

  /** Register a new task chain. */
  addChain(chain: TaskChain): void {
    this.chains.set(chain.id, chain);
  }

  /** Get a task chain by ID. */
  getChain(chainId: string): TaskChain | undefined {
    return this.chains.get(chainId);
  }

  /** Get all task chains. */
  getAllChains(): TaskChain[] {
    return Array.from(this.chains.values());
  }

  /** Get chains by status. */
  getChainsByStatus(status: TaskChainStatus): TaskChain[] {
    return this.getAllChains().filter(c => c.status === status);
  }

  /** Start a chain (sets status to active, unlocks first available steps). */
  startChain(chainId: string): boolean {
    const chain = this.chains.get(chainId);
    if (!chain || chain.status === "active") return false;
    chain.status = "active";
    chain.startedAt = this.currentTick;
    // Unlock steps with no dependencies.
    if (this.config.autoUnlockSteps) {
      for (const step of chain.steps) {
        if (step.dependencies.length === 0 && step.status === "locked") {
          step.status = "available";
        }
      }
    }
    this.emitChainEvent("taskchain.chain_started", chain);
    return true;
  }

  /** Complete a chain manually. */
  completeChain(chainId: string): boolean {
    const chain = this.chains.get(chainId);
    if (!chain || chain.status !== "active") return false;
    chain.status = "completed";
    chain.completedAt = this.currentTick;
    this.emitChainEvent("taskchain.chain_completed", chain);
    return true;
  }

  /** Fail a chain. */
  failChain(chainId: string, reason?: string): boolean {
    const chain = this.chains.get(chainId);
    if (!chain || chain.status !== "active") return false;
    chain.status = "failed";
    chain.completedAt = this.currentTick;
    this.emitChainEvent("taskchain.chain_failed", chain, { reason });
    return true;
  }

  // --- Step Management ---

  /** Get a step by ID. */
  getStep(chainId: string, stepId: string): TaskChainStep | undefined {
    return this.chains.get(chainId)?.steps.find(s => s.id === stepId);
  }

  /** Get available steps (dependencies met, not yet started). */
  getAvailableSteps(chainId: string): TaskChainStep[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];
    return chain.steps.filter(s => s.status === "available");
  }

  /** Get active steps. */
  getActiveSteps(chainId: string): TaskChainStep[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];
    return chain.steps.filter(s => s.status === "active");
  }

  /** Get completed steps. */
  getCompletedSteps(chainId: string): TaskChainStep[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];
    return chain.steps.filter(s => s.status === "completed");
  }

  /** Check if a step's dependencies are satisfied. */
  checkDependencies(chainId: string, stepId: string): DependencyCheckResult {
    const chain = this.chains.get(chainId);
    if (!chain) return { satisfied: false, missingDependencies: [], completedDependencies: [] };
    const step = chain.steps.find(s => s.id === stepId);
    if (!step) return { satisfied: false, missingDependencies: [], completedDependencies: [] };

    const completed: string[] = [];
    const missing: string[] = [];
    for (const depId of step.dependencies) {
      const dep = chain.steps.find(s => s.id === depId);
      // Completed or skipped steps count as dependency-satisfied.
      if (dep && (dep.status === "completed" || dep.status === "skipped")) {
        completed.push(depId);
      } else {
        missing.push(depId);
      }
    }
    return { satisfied: missing.length === 0, missingDependencies: missing, completedDependencies: completed };
  }

  /** Start a step (available → active). */
  startStep(chainId: string, stepId: string): StepProgressionResult {
    const chain = this.chains.get(chainId);
    const step = chain?.steps.find(s => s.id === stepId);
    if (!chain || !step) {
      return { progressed: false, stepId, previousStatus: "locked", newStatus: "locked", reason: "not_found" };
    }
    if (step.status !== "available") {
      return { progressed: false, stepId, previousStatus: step.status, newStatus: step.status, reason: "not_available" };
    }
    // Verify dependencies.
    const depCheck = this.checkDependencies(chainId, stepId);
    if (!depCheck.satisfied) {
      return { progressed: false, stepId, previousStatus: step.status, newStatus: step.status, reason: "dependencies_not_met" };
    }
    const previous = step.status;
    step.status = "active";
    step.startedAt = this.currentTick;
    this.emitStepEvent("taskchain.step_started", chain, step);
    return { progressed: true, stepId, previousStatus: previous, newStatus: "active", reason: "started" };
  }

  /** Complete a step (active → completed), unlock dependents. */
  completeStep(chainId: string, stepId: string): StepProgressionResult {
    const chain = this.chains.get(chainId);
    const step = chain?.steps.find(s => s.id === stepId);
    if (!chain || !step) {
      return { progressed: false, stepId, previousStatus: "locked", newStatus: "locked", reason: "not_found" };
    }
    if (step.status !== "active") {
      return { progressed: false, stepId, previousStatus: step.status, newStatus: step.status, reason: "not_active" };
    }
    const previous = step.status;
    step.status = "completed";
    step.completedAt = this.currentTick;
    this.emitStepEvent("taskchain.step_completed", chain, step);

    // Unlock dependent steps if auto-unlock is enabled.
    if (this.config.autoUnlockSteps) {
      this.unlockDependents(chain, stepId);
    }

    // Auto-complete chain if all steps are done.
    if (this.config.autoCompleteChain) {
      this.checkChainCompletion(chain);
    }

    return { progressed: true, stepId, previousStatus: previous, newStatus: "completed", reason: "completed" };
  }

  /** Fail a step. */
  failStep(chainId: string, stepId: string, reason?: string): StepProgressionResult {
    const chain = this.chains.get(chainId);
    const step = chain?.steps.find(s => s.id === stepId);
    if (!chain || !step) {
      return { progressed: false, stepId, previousStatus: "locked", newStatus: "locked", reason: "not_found" };
    }
    if (step.status !== "active" && step.status !== "available") {
      return { progressed: false, stepId, previousStatus: step.status, newStatus: step.status, reason: "cannot_fail" };
    }
    const previous = step.status;
    step.status = "failed";
    this.emitStepEvent("taskchain.step_failed", chain, step, { reason });

    // Optionally fail the entire chain.
    if (this.config.failChainOnStepFailure && chain.status === "active") {
      this.failChain(chainId, `Step ${stepId} failed: ${reason ?? "unknown"}`);
    }

    return { progressed: true, stepId, previousStatus: previous, newStatus: "failed", reason: "failed" };
  }

  /** Skip a step (available/active → skipped). */
  skipStep(chainId: string, stepId: string): StepProgressionResult {
    const chain = this.chains.get(chainId);
    const step = chain?.steps.find(s => s.id === stepId);
    if (!chain || !step) {
      return { progressed: false, stepId, previousStatus: "locked", newStatus: "locked", reason: "not_found" };
    }
    if (step.status !== "available" && step.status !== "active") {
      return { progressed: false, stepId, previousStatus: step.status, newStatus: step.status, reason: "cannot_skip" };
    }
    const previous = step.status;
    step.status = "skipped";
    this.emitStepEvent("taskchain.step_skipped", chain, step);

    // Unlock dependents (skipped steps count as done for dependency purposes).
    if (this.config.autoUnlockSteps) {
      this.unlockDependents(chain, stepId);
    }
    if (this.config.autoCompleteChain) {
      this.checkChainCompletion(chain);
    }

    return { progressed: true, stepId, previousStatus: previous, newStatus: "skipped", reason: "skipped" };
  }

  // --- Chain Progress ---

  /** Get chain progress (0-1). */
  getChainProgress(chainId: string): number {
    const chain = this.chains.get(chainId);
    if (!chain || chain.steps.length === 0) return 0;
    const completed = chain.steps.filter(s => s.status === "completed" || s.status === "skipped").length;
    return completed / chain.steps.length;
  }

  /** Get the next available step (first in order). */
  getNextStep(chainId: string): TaskChainStep | null {
    const available = this.getAvailableSteps(chainId);
    return available.length > 0 ? available[0] : null;
  }

  // --- Internal helpers ---

  private unlockDependents(chain: TaskChain, completedStepId: string): void {
    for (const step of chain.steps) {
      if (step.status === "locked" && step.dependencies.includes(completedStepId)) {
        const depCheck = this.checkDependencies(chain.id, step.id);
        if (depCheck.satisfied) {
          step.status = "available";
          this.emitStepEvent("taskchain.step_unlocked", chain, step);
        }
      }
    }
  }

  private checkChainCompletion(chain: TaskChain): void {
    if (chain.status !== "active") return;
    const allDone = chain.steps.every(
      s => s.status === "completed" || s.status === "skipped" || s.status === "failed",
    );
    if (allDone) {
      const hasFailure = chain.steps.some(s => s.status === "failed");
      if (hasFailure && this.config.failChainOnStepFailure) {
        this.failChain(chain.id, "One or more steps failed");
      } else {
        this.completeChain(chain.id);
      }
    }
  }

  private emitChainEvent(eventType: string, chain: TaskChain, extra?: Record<string, unknown>): void {
    if (!this.eventSystem || !this.config.emitEvents) return;
    this.eventSystem.emit(new Event({
      type: eventType,
      payload: {
        chainId: chain.id,
        chainName: chain.name,
        status: chain.status,
        stepCount: chain.steps.length,
        ...extra,
      },
      sourceId: chain.id,
    }));
  }

  private emitStepEvent(eventType: string, chain: TaskChain, step: TaskChainStep, extra?: Record<string, unknown>): void {
    if (!this.eventSystem || !this.config.emitEvents) return;
    this.eventSystem.emit(new Event({
      type: eventType,
      payload: {
        chainId: chain.id,
        chainName: chain.name,
        stepId: step.id,
        stepName: step.name,
        stepStatus: step.status,
        narrative: step.narrative,
        ...extra,
      },
      sourceId: chain.id,
    }));
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, events: EventSystem): void {
    this.eventSystem = events;
    this.currentTick++;
  }

  stop(): void {
    this.eventSystem = null;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const chains: Record<string, TaskChain> = {};
    for (const [id, chain] of this.chains) chains[id] = chain;
    return { chains, currentTick: this.currentTick };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.chains && typeof data.chains === "object") {
      for (const [id, chain] of Object.entries(data.chains as Record<string, TaskChain>)) {
        this.chains.set(id, chain);
      }
    }
    if (typeof data.currentTick === "number") this.currentTick = data.currentTick;
  }
}
