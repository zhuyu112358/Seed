// CraftingRecipe: defines a production recipe that converts input resources
// into an output item or resource. Recipes are registered at runtime, not
// hardcoded — specific worlds define their own recipes via config.

/** A single input requirement for a recipe. */
export interface RecipeInput {
  /** Resource type ID required. */
  resourceTypeId: string;
  /** Amount required. */
  amount: number;
}

/** Configuration for creating a crafting recipe. */
export interface CraftingRecipeConfig {
  /** Unique recipe ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Input resources required. */
  inputs: RecipeInput[];
  /** Output resource type ID produced. */
  outputResourceTypeId: string;
  /** Output amount produced. Default 1. */
  outputAmount?: number;
  /** Crafting time in ticks. Default 60 (1 second at 60fps). */
  craftTime?: number;
  /** Optional description. */
  description?: string;
}

/** A registered crafting recipe. */
export class CraftingRecipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly inputs: readonly RecipeInput[];
  readonly outputResourceTypeId: string;
  readonly outputAmount: number;
  readonly craftTime: number;

  constructor(config: CraftingRecipeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description ?? "";
    this.inputs = [...config.inputs];
    this.outputResourceTypeId = config.outputResourceTypeId;
    this.outputAmount = config.outputAmount ?? 1;
    this.craftTime = config.craftTime ?? 60;
  }

  /** Check if an inventory has enough resources for this recipe. */
  canCraft(inventory: { getAmount: (typeId: string) => number }): boolean {
    for (const input of this.inputs) {
      if (inventory.getAmount(input.resourceTypeId) < input.amount) {
        return false;
      }
    }
    return true;
  }

  /** Get the total number of input items (sum of all input amounts). */
  get totalInputCount(): number {
    return this.inputs.reduce((sum, i) => sum + i.amount, 0);
  }
}

/** Registry for crafting recipes. */
export class CraftingRecipeRegistry {
  private recipes = new Map<string, CraftingRecipe>();

  /** Register a recipe. Returns the registered CraftingRecipe. */
  register(config: CraftingRecipeConfig): CraftingRecipe {
    const recipe = new CraftingRecipe(config);
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }

  /** Get a recipe by ID. */
  get(id: string): CraftingRecipe | undefined {
    return this.recipes.get(id);
  }

  /** Check if a recipe is registered. */
  has(id: string): boolean {
    return this.recipes.has(id);
  }

  /** Get all registered recipes. */
  getAll(): CraftingRecipe[] {
    return Array.from(this.recipes.values());
  }

  /** Get the number of registered recipes. */
  get size(): number {
    return this.recipes.size;
  }

  /** Remove a recipe. Returns true if it existed. */
  remove(id: string): boolean {
    return this.recipes.delete(id);
  }

  /** Clear all recipes. */
  clear(): void {
    this.recipes.clear();
  }
}
