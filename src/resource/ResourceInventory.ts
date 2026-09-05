// ResourceInventory: a component attached to a GameObject (typically a soul)
// that tracks stored resources. Supports add/remove/query operations with
// optional capacity limits.

/** Configuration for creating a resource inventory. */
export interface ResourceInventoryConfig {
  /** Maximum total resource capacity. 0 means unlimited. Default 0. */
  maxCapacity?: number;
  /** Initial resources as { resourceTypeId: amount }. */
  initial?: Record<string, number>;
}

/** A resource inventory component attached to a GameObject. */
export class ResourceInventory {
  private resources = new Map<string, number>();
  readonly maxCapacity: number;

  constructor(config?: ResourceInventoryConfig) {
    this.maxCapacity = config?.maxCapacity ?? 0;
    if (config?.initial) {
      for (const [typeId, amount] of Object.entries(config.initial)) {
        this.resources.set(typeId, amount);
      }
    }
  }

  /** Get the amount of a specific resource type. */
  getAmount(typeId: string): number {
    return this.resources.get(typeId) ?? 0;
  }

  /** Check if the inventory has at least `amount` of a resource type. */
  has(typeId: string, amount = 1): boolean {
    return this.getAmount(typeId) >= amount;
  }

  /** Get the total amount of all resources. */
  getTotal(): number {
    let total = 0;
    for (const amount of this.resources.values()) {
      total += amount;
    }
    return total;
  }

  /** Get the remaining capacity. Infinity if unlimited. */
  getRemainingCapacity(): number {
    if (this.maxCapacity === 0) return Infinity;
    return this.maxCapacity - this.getTotal();
  }

  /**
   * Add resources to the inventory. Returns the actual amount added
   * (may be less than requested if capacity is limited).
   */
  add(typeId: string, amount: number): number {
    if (amount <= 0) return 0;
    const current = this.getAmount(typeId);
    let toAdd = amount;
    if (this.maxCapacity > 0) {
      const remaining = this.maxCapacity - this.getTotal();
      toAdd = Math.min(amount, remaining);
    }
    if (toAdd <= 0) return 0;
    this.resources.set(typeId, current + toAdd);
    return toAdd;
  }

  /**
   * Remove resources from the inventory. Returns the actual amount removed
   * (may be less than requested if insufficient resources).
   */
  remove(typeId: string, amount: number): number {
    if (amount <= 0) return 0;
    const current = this.getAmount(typeId);
    const toRemove = Math.min(amount, current);
    if (toRemove <= 0) return 0;
    const newAmount = current - toRemove;
    if (newAmount === 0) {
      this.resources.delete(typeId);
    } else {
      this.resources.set(typeId, newAmount);
    }
    return toRemove;
  }

  /** Check if the inventory can add `amount` of a resource (capacity check). */
  canAdd(amount: number): boolean {
    if (this.maxCapacity === 0) return true;
    return this.getRemainingCapacity() >= amount;
  }

  /** Get all resource types and amounts as a record. */
  getAll(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [typeId, amount] of this.resources.entries()) {
      result[typeId] = amount;
    }
    return result;
  }

  /** Get the number of distinct resource types in the inventory. */
  get typeCount(): number {
    return this.resources.size;
  }

  /** Clear all resources. */
  clear(): void {
    this.resources.clear();
  }
}
