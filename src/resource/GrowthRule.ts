// GrowthRule: defines experience gain rules and level curves for souls.
// Rules are registered at runtime — no hardcoded skill types (mining, crafting, etc.)
// or level curves. The application layer defines what actions grant XP and how much.
// Seed only tracks XP/levels and emits events; level-up consequences (unlocking recipes,
// stat boosts) are handled by the application layer via events.

/** Configuration for creating a growth rule. */
export interface GrowthRuleConfig {
  /** Unique rule ID (e.g., "woodcutting", "crafting"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Event type that triggers XP gain (e.g., "resource.harvest.complete"). */
  triggerEventType: string;
  /** Field name in the event payload that contains the soul ID. Default "soulId". */
  soulIdField?: string;
  /** XP granted per trigger event. Default 10. */
  xpPerEvent?: number;
  /** Base XP required for level 1->2. Default 100. */
  baseXP?: number;
  /** XP growth multiplier per level (curve). Default 1.5 (each level needs 1.5x more XP). */
  growthMultiplier?: number;
  /** Maximum level. Default 100. */
  maxLevel?: number;
  /** Optional description. */
  description?: string;
}

/** A registered growth rule with XP curve. */
export class GrowthRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly triggerEventType: string;
  readonly soulIdField: string;
  readonly xpPerEvent: number;
  readonly baseXP: number;
  readonly growthMultiplier: number;
  readonly maxLevel: number;

  constructor(config: GrowthRuleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description ?? "";
    this.triggerEventType = config.triggerEventType;
    this.soulIdField = config.soulIdField ?? "soulId";
    this.xpPerEvent = config.xpPerEvent ?? 10;
    this.baseXP = config.baseXP ?? 100;
    this.growthMultiplier = config.growthMultiplier ?? 1.5;
    this.maxLevel = config.maxLevel ?? 100;
  }

  /** Calculate XP required to reach a given level (from level-1 to level). */
  xpForLevel(level: number): number {
    if (level <= 1) return 0;
    // Geometric series: baseXP * (multiplier^(level-1) - 1) / (multiplier - 1)
    if (this.growthMultiplier === 1) {
      return this.baseXP * (level - 1);
    }
    return Math.floor(
      this.baseXP * (Math.pow(this.growthMultiplier, level - 1) - 1) / (this.growthMultiplier - 1),
    );
  }

  /** Calculate XP required for the next level from current level. */
  xpForNextLevel(currentLevel: number): number {
    if (currentLevel >= this.maxLevel) return Infinity;
    return this.xpForLevel(currentLevel + 1) - this.xpForLevel(currentLevel);
  }

  /** Calculate level from total XP. */
  levelFromXP(totalXP: number): number {
    let level = 1;
    while (level < this.maxLevel && this.xpForLevel(level + 1) <= totalXP) {
      level++;
    }
    return level;
  }
}

/** Registry for growth rules. */
export class GrowthRuleRegistry {
  private rules = new Map<string, GrowthRule>();

  /** Register a rule. Returns the registered GrowthRule. */
  register(config: GrowthRuleConfig): GrowthRule {
    const rule = new GrowthRule(config);
    this.rules.set(rule.id, rule);
    return rule;
  }

  /** Get a rule by ID. */
  get(id: string): GrowthRule | undefined {
    return this.rules.get(id);
  }

  /** Check if a rule is registered. */
  has(id: string): boolean {
    return this.rules.has(id);
  }

  /** Get all registered rules. */
  getAll(): GrowthRule[] {
    return Array.from(this.rules.values());
  }

  /** Get rules that trigger on a specific event type. */
  getByTriggerEventType(eventType: string): GrowthRule[] {
    return this.getAll().filter((r) => r.triggerEventType === eventType);
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
