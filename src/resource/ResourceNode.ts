// ResourceNode: a component attached to a GameObject that makes it a
// harvestable resource node. Contains current amount, max amount, regen
// rate, and harvest time. Resource nodes are generic — the resource type
// is referenced by ID and resolved via the ResourceTypeRegistry.

/** Configuration for creating a resource node. */
export interface ResourceNodeConfig {
  /** ID of the resource type this node provides. */
  resourceTypeId: string;
  /** Current amount of resource available. Defaults to maxAmount. */
  currentAmount?: number;
  /** Maximum amount this node can hold. Default 100. */
  maxAmount?: number;
  /** Amount regenerated per tick (if renewable). Default 0.1. */
  regenRate?: number;
  /** Time in ticks required to harvest one unit. Default 30 (0.5s at 60fps). */
  harvestTime?: number;
  /** Amount harvested per harvest action. Default 1. */
  harvestAmount?: number;
  /** Whether this node can regenerate. Default true. */
  renewable?: boolean;
}

/** State of an active harvest operation. */
export interface HarvestState {
  /** ID of the soul harvesting this node. */
  harvesterId: string;
  /** Ticks remaining until harvest completes. */
  ticksRemaining: number;
  /** Total ticks required for this harvest. */
  totalTicks: number;
}

/** A resource node component attached to a GameObject. */
export class ResourceNode {
  readonly resourceTypeId: string;
  readonly maxAmount: number;
  readonly regenRate: number;
  readonly harvestTime: number;
  readonly harvestAmount: number;
  readonly renewable: boolean;

  currentAmount: number;
  /** Active harvest operation, or null if not being harvested. */
  harvestState: HarvestState | null = null;

  constructor(config: ResourceNodeConfig) {
    this.resourceTypeId = config.resourceTypeId;
    this.maxAmount = config.maxAmount ?? 100;
    this.currentAmount = config.currentAmount ?? this.maxAmount;
    this.regenRate = config.regenRate ?? 0.1;
    this.harvestTime = config.harvestTime ?? 30;
    this.harvestAmount = config.harvestAmount ?? 1;
    this.renewable = config.renewable ?? true;
  }

  /** Whether this node has any resource available to harvest. */
  get isAvailable(): boolean {
    return this.currentAmount > 0;
  }

  /** Whether this node is currently being harvested. */
  get isBeingHarvested(): boolean {
    return this.harvestState !== null;
  }

  /** Harvest progress as a fraction (0-1), or 0 if not harvesting. */
  get harvestProgress(): number {
    if (!this.harvestState) return 0;
    return 1 - this.harvestState.ticksRemaining / this.harvestState.totalTicks;
  }

  /**
   * Start harvesting this node. Returns true if harvesting started,
   * false if the node is depleted or already being harvested.
   */
  startHarvest(harvesterId: string): boolean {
    if (!this.isAvailable) return false;
    if (this.isBeingHarvested) return false;
    this.harvestState = {
      harvesterId,
      ticksRemaining: this.harvestTime,
      totalTicks: this.harvestTime,
    };
    return true;
  }

  /**
   * Tick the harvest operation. Returns the amount harvested if complete,
   * or 0 if still in progress. Completing a harvest reduces currentAmount
   * and clears harvestState.
   */
  tickHarvest(): number {
    if (!this.harvestState) return 0;
    this.harvestState.ticksRemaining--;
    if (this.harvestState.ticksRemaining <= 0) {
      const harvested = Math.min(this.harvestAmount, this.currentAmount);
      this.currentAmount -= harvested;
      this.harvestState = null;
      return harvested;
    }
    return 0;
  }

  /** Cancel the current harvest operation. */
  cancelHarvest(): void {
    this.harvestState = null;
  }

  /**
   * Regenerate resource. Call once per tick. Does nothing if not renewable
   * or already at max. Returns the amount regenerated.
   */
  regenerate(): number {
    if (!this.renewable) return 0;
    if (this.currentAmount >= this.maxAmount) return 0;
    const regen = Math.min(this.regenRate, this.maxAmount - this.currentAmount);
    this.currentAmount += regen;
    return regen;
  }

  /** Get a snapshot of this node's state for perception. */
  getSnapshot(): {
    resourceTypeId: string;
    currentAmount: number;
    maxAmount: number;
    isAvailable: boolean;
    isBeingHarvested: boolean;
    harvestProgress: number;
  } {
    return {
      resourceTypeId: this.resourceTypeId,
      currentAmount: this.currentAmount,
      maxAmount: this.maxAmount,
      isAvailable: this.isAvailable,
      isBeingHarvested: this.isBeingHarvested,
      harvestProgress: this.harvestProgress,
    };
  }
}
