// ConsumptionRule: defines a resource consumption rule for souls.
// Rules are registered at runtime — no hardcoded resource types (food, water, etc.).
// The application layer defines what resources are consumed, how much, and how often.
// Seed only executes the rule; consequences of insufficient resources (death, debuff)
// are handled by the application layer via events.

/** Configuration for creating a consumption rule. */
export interface ConsumptionRuleConfig {
  /** Unique rule ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Resource type ID to consume (e.g., "food", "water"). Registered at runtime. */
  resourceTypeId: string;
  /** Amount consumed per interval. Default 1. */
  amount?: number;
  /** Interval in ticks between consumptions. Default 600 (10 seconds at 60fps). */
  intervalTicks?: number;
  /** Optional description. */
  description?: string;
}

/** A registered resource consumption rule. */
export class ConsumptionRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly resourceTypeId: string;
  readonly amount: number;
  readonly intervalTicks: number;

  constructor(config: ConsumptionRuleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description ?? "";
    this.resourceTypeId = config.resourceTypeId;
    this.amount = config.amount ?? 1;
    this.intervalTicks = config.intervalTicks ?? 600;
  }
}

/** Registry for consumption rules. */
export class ConsumptionRuleRegistry {
  private rules = new Map<string, ConsumptionRule>();

  /** Register a rule. Returns the registered ConsumptionRule. */
  register(config: ConsumptionRuleConfig): ConsumptionRule {
    const rule = new ConsumptionRule(config);
    this.rules.set(rule.id, rule);
    return rule;
  }

  /** Get a rule by ID. */
  get(id: string): ConsumptionRule | undefined {
    return this.rules.get(id);
  }

  /** Check if a rule is registered. */
  has(id: string): boolean {
    return this.rules.has(id);
  }

  /** Get all registered rules. */
  getAll(): ConsumptionRule[] {
    return Array.from(this.rules.values());
  }

  /** Get the number of registered rules. */
  get size(): number {
    return this.rules.size;
  }

  /** Remove a rule. Returns true if it existed. */
  remove(id: string): boolean {
    return this.rules.delete(id);
  }

  /** Clear all rules. */
  clear(): void {
    this.rules.clear();
  }
}
