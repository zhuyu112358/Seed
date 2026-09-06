// PathCostSystem: Manages path cost modifiers for navigation.
// Supports circular cost modifier areas (terrain, danger, building, zone, custom)
// that multiply pathfinding cost. Computes effective path cost at any position
// by summing all active modifiers within range.
//
// Seed only provides the cost calculation framework; terrain definitions,
// danger zone placement, and high-level navigation decisions are handled
// by the application layer/Ember.
import { World } from "../engine/World.js";
import { EventSystem } from "../event/EventSystem.js";
import {
  CostModifierType,
  PathCostModifier,
  PathCostConfig,
  DEFAULT_PATH_COST_CONFIG,
  NavigationResult,
} from "./NavigationTypes.js";

export class PathCostSystem {
  readonly name = "pathcost";
  enabled = true;
  private modifiers = new Map<string, PathCostModifier>();
  private modifierCounter = 0;
  /** Path cost configuration. */
  config: PathCostConfig;

  constructor(config?: Partial<PathCostConfig>) {
    this.config = { ...DEFAULT_PATH_COST_CONFIG, ...config };
  }

  private generateId(): string {
    this.modifierCounter++;
    return `costmod_${Date.now()}_${this.modifierCounter}`;
  }

  // --- Modifier management ---

  /**
   * Add a path cost modifier.
   * @param type Type of modifier (terrain/danger/building/zone/custom).
   * @param position Center position of the affected area.
   * @param radius Radius of the affected area.
   * @param costMultiplier Cost multiplier (1.0 = no change, >1 = more expensive, <1 = cheaper).
   * @param name Optional name.
   * @param metadata Optional metadata.
   */
  addModifier(
    type: CostModifierType,
    position: { x: number; z: number },
    radius: number,
    costMultiplier: number,
    name?: string,
    metadata?: Record<string, unknown>,
  ): NavigationResult {
    if (radius <= 0) return { success: false, error: "Radius must be positive" };
    if (costMultiplier <= 0) return { success: false, error: "Cost multiplier must be positive" };

    const id = this.generateId();
    const modifier: PathCostModifier = {
      id,
      type,
      name: name || `${type}_${id}`,
      position: { ...position },
      radius,
      costMultiplier: Math.min(costMultiplier, this.config.maxCostMultiplier),
      active: true,
      metadata,
    };
    this.modifiers.set(id, modifier);
    return { success: true, modifierId: id };
  }

  /** Remove a cost modifier. */
  removeModifier(modifierId: string): NavigationResult {
    if (!this.modifiers.has(modifierId)) return { success: false, error: "Modifier not found" };
    this.modifiers.delete(modifierId);
    return { success: true, modifierId };
  }

  /** Get a modifier by ID. */
  getModifier(modifierId: string): PathCostModifier | undefined {
    return this.modifiers.get(modifierId);
  }

  /** Get all modifiers. */
  getModifiers(): PathCostModifier[] {
    return Array.from(this.modifiers.values());
  }

  /** Get active modifiers only. */
  getActiveModifiers(): PathCostModifier[] {
    return Array.from(this.modifiers.values()).filter((m) => m.active);
  }

  /** Get modifiers by type. */
  getModifiersByType(type: CostModifierType): PathCostModifier[] {
    return Array.from(this.modifiers.values()).filter((m) => m.type === type);
  }

  /** Set a modifier's active state. */
  setModifierActive(modifierId: string, active: boolean): NavigationResult {
    const modifier = this.modifiers.get(modifierId);
    if (!modifier) return { success: false, error: "Modifier not found" };
    modifier.active = active;
    return { success: true, modifierId };
  }

  /** Update a modifier's cost multiplier. */
  setCostMultiplier(modifierId: string, multiplier: number): NavigationResult {
    const modifier = this.modifiers.get(modifierId);
    if (!modifier) return { success: false, error: "Modifier not found" };
    if (multiplier <= 0) return { success: false, error: "Cost multiplier must be positive" };
    modifier.costMultiplier = Math.min(multiplier, this.config.maxCostMultiplier);
    return { success: true, modifierId };
  }

  /** Number of modifiers. */
  get modifierCount(): number {
    return this.modifiers.size;
  }

  // --- Cost calculation ---

  /**
   * Get all active modifiers that affect a given position.
   * @param position Position to check.
   */
  getModifiersAtPosition(position: { x: number; z: number }): PathCostModifier[] {
    const result: PathCostModifier[] = [];
    for (const modifier of this.modifiers.values()) {
      if (!modifier.active) continue;
      const dx = position.x - modifier.position.x;
      const dz = position.z - modifier.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= modifier.radius) {
        result.push(modifier);
      }
    }
    return result;
  }

  /**
   * Compute the total cost multiplier at a position (product of all active modifiers in range).
   * @param position Position to compute cost for.
   * @returns Total cost multiplier (1.0 if no modifiers in range).
   */
  computeCostMultiplier(position: { x: number; z: number }): number {
    let total = 1.0;
    for (const modifier of this.modifiers.values()) {
      if (!modifier.active) continue;
      const dx = position.x - modifier.position.x;
      const dz = position.z - modifier.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= modifier.radius) {
        total *= modifier.costMultiplier;
      }
    }
    return Math.min(total, this.config.maxCostMultiplier);
  }

  /**
   * Compute the effective path cost at a position (base cost * total multiplier).
   * @param position Position to compute cost for.
   * @returns Effective path cost per unit distance.
   */
  computePathCost(position: { x: number; z: number }): number {
    return this.config.baseCost * this.computeCostMultiplier(position);
  }

  /**
   * Compute the cost of moving from one position to another (line segment).
   * Samples points along the segment and averages costs.
   * @param from Start position.
   * @param to End position.
   * @param samples Number of sample points (default 5).
   * @returns Total path cost for the segment.
   */
  computeSegmentCost(
    from: { x: number; z: number },
    to: { x: number; z: number },
    samples = 5,
  ): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance === 0) return 0;

    let totalCost = 0;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pos = { x: from.x + dx * t, z: from.z + dz * t };
      totalCost += this.computePathCost(pos);
    }
    const avgCost = totalCost / (samples + 1);
    return avgCost * distance;
  }

  /**
   * A* cost function compatible with pathfinding systems.
   * Returns the cost of moving from one node to an adjacent node.
   * @param from Start node position.
   * @param to End node position.
   * @returns Cost of the edge.
   */
  aStarCostFunction(from: { x: number; z: number }, to: { x: number; z: number }): number {
    return this.computeSegmentCost(from, to, 3);
  }

  // --- WorldSystem interface ---

  tick(_dt: number, _world: World, _events: EventSystem): void {
    // PathCostSystem is stateless per-tick; costs are computed on demand.
  }

  stop(): void {
    this.modifiers.clear();
    this.modifierCounter = 0;
  }

  // --- Serialization ---

  serialize(): Record<string, unknown> {
    const modifiers: Record<string, PathCostModifier> = {};
    for (const [id, m] of this.modifiers) {
      modifiers[id] = m;
    }
    return { modifiers, modifierCounter: this.modifierCounter, config: this.config };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.modifiers && typeof data.modifiers === "object") {
      for (const [id, m] of Object.entries(data.modifiers as Record<string, PathCostModifier>)) {
        this.modifiers.set(id, m);
      }
    }
    if (typeof data.modifierCounter === "number") {
      this.modifierCounter = data.modifierCounter;
    }
    if (data.config && typeof data.config === "object") {
      this.config = { ...DEFAULT_PATH_COST_CONFIG, ...(data.config as Partial<PathCostConfig>) };
    }
  }
}
