// CraftingSystem: manages crafting operations in the world.
// Souls can craft items from harvested resources using registered recipes.
// Crafting is asynchronous (takes craftTime ticks); this system processes
// active crafts and emits events on completion.

import type { World, WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import { CraftingRecipe, CraftingRecipeRegistry } from "./CraftingRecipe.js";
import { ResourceInventory } from "./ResourceInventory.js";
import {
  CraftStartEvent,
  CraftCompleteEvent,
  CraftFailEvent,
} from "../event/Event.js";

/** Configuration for CraftingSystem. */
export interface CraftingSystemConfig {
  /** Maximum concurrent crafts per soul. Default 1. */
  maxConcurrentPerSoul?: number;
}

const DEFAULT_CONFIG: Required<CraftingSystemConfig> = {
  maxConcurrentPerSoul: 1,
};

/** State of an active crafting operation. */
interface ActiveCraft {
  /** Soul ID performing the craft. */
  soulId: string;
  /** Recipe being crafted. */
  recipe: CraftingRecipe;
  /** Ticks remaining until completion. */
  ticksRemaining: number;
  /** Total ticks required. */
  totalTicks: number;
}

/**
 * CraftingSystem: manages crafting operations.
 *
 * Recipes are registered via the recipe registry. Souls start crafting via
 * startCraft(), which consumes input resources immediately and begins a
 * countdown. On completion, output resources are added to the soul's inventory.
 */
export class CraftingSystem implements WorldSystem {
  readonly name = "crafting";
  enabled = true;

  private readonly config: Required<CraftingSystemConfig>;
  readonly recipes = new CraftingRecipeRegistry();
  private activeCrafts = new Map<string, ActiveCraft[]>(); // soulId -> active crafts
  /** Inventory lookup: soulId -> ResourceInventory (set by SoulActionSystem or external). */
  private inventories = new Map<string, ResourceInventory>();

  constructor(config?: CraftingSystemConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register an inventory for a soul (so crafting can consume/produce resources). */
  registerInventory(soulId: string, inventory: ResourceInventory): void {
    this.inventories.set(soulId, inventory);
  }

  /** Get a soul's registered inventory. */
  getInventory(soulId: string): ResourceInventory | undefined {
    return this.inventories.get(soulId);
  }

  /** Get active crafts for a soul. */
  getActiveCrafts(soulId: string): ActiveCraft[] {
    return this.activeCrafts.get(soulId) ?? [];
  }

  /** Check if a soul can craft a recipe (has resources + slot available). */
  canCraft(soulId: string, recipeId: string): { canCraft: boolean; reason?: string } {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return { canCraft: false, reason: `recipe not found: ${recipeId}` };

    const crafts = this.activeCrafts.get(soulId) ?? [];
    if (crafts.length >= this.config.maxConcurrentPerSoul) {
      return { canCraft: false, reason: "max concurrent crafts reached" };
    }

    const inventory = this.inventories.get(soulId);
    if (!inventory) return { canCraft: false, reason: "no inventory registered for soul" };

    if (!recipe.canCraft(inventory)) {
      return { canCraft: false, reason: "insufficient resources" };
    }

    return { canCraft: true };
  }

  /**
   * Start crafting a recipe. Consumes input resources immediately.
   * Returns true if crafting started, false otherwise.
   */
  startCraft(soulId: string, recipeId: string, events?: EventSystem): boolean {
    const check = this.canCraft(soulId, recipeId);
    if (!check.canCraft) return false;

    const recipe = this.recipes.get(recipeId)!;
    const inventory = this.inventories.get(soulId)!;

    // Consume input resources.
    for (const input of recipe.inputs) {
      inventory.remove(input.resourceTypeId, input.amount);
    }

    // Start craft operation.
    const craft: ActiveCraft = {
      soulId,
      recipe,
      ticksRemaining: recipe.craftTime,
      totalTicks: recipe.craftTime,
    };
    const crafts = this.activeCrafts.get(soulId) ?? [];
    crafts.push(craft);
    this.activeCrafts.set(soulId, crafts);

    if (events) {
      events.emit(new CraftStartEvent(soulId, recipeId, recipe.name, recipe.craftTime));
    }

    return true;
  }

  tick(_dt: number, _world: World, events: EventSystem): void {
    for (const [soulId, crafts] of this.activeCrafts) {
      for (let i = crafts.length - 1; i >= 0; i--) {
        const craft = crafts[i];
        craft.ticksRemaining--;

        if (craft.ticksRemaining <= 0) {
          // Craft complete — add output to inventory.
          const inventory = this.inventories.get(soulId);
          if (inventory) {
            const added = inventory.add(craft.recipe.outputResourceTypeId, craft.recipe.outputAmount);
            if (added > 0) {
              events.emit(new CraftCompleteEvent(
                soulId, craft.recipe.id, craft.recipe.name,
                craft.recipe.outputResourceTypeId, added,
              ));
            } else {
              // Inventory full — craft fails, resources lost.
              events.emit(new CraftFailEvent(
                soulId, craft.recipe.id, craft.recipe.name, "inventory full",
              ));
            }
          } else {
            events.emit(new CraftFailEvent(
              soulId, craft.recipe.id, craft.recipe.name, "no inventory",
            ));
          }

          // Remove completed craft.
          crafts.splice(i, 1);
        }
      }
      if (crafts.length === 0) {
        this.activeCrafts.delete(soulId);
      }
    }
  }

  start(): void { /* no-op */ }

  stop(): void {
    // Cancel all active crafts (resources already consumed, not refunded).
    this.activeCrafts.clear();
  }

  /** Serialize crafting system state (inventories + active crafts). */
  serialize(): unknown {
    const inventories: Record<string, { items: Record<string, number>; maxCapacity: number }> = {};
    for (const [id, inv] of this.inventories) {
      inventories[id] = { items: inv.getAll(), maxCapacity: inv.maxCapacity };
    }
    const activeCrafts: Record<string, Array<{ recipeId: string; ticksRemaining: number }>> = {};
    for (const [soulId, crafts] of this.activeCrafts) {
      activeCrafts[soulId] = crafts.map((c) => ({
        recipeId: c.recipe.id,
        ticksRemaining: c.ticksRemaining,
      }));
    }
    return { inventories, activeCrafts };
  }

  /** Deserialize crafting system state. Recipes must already be registered. */
  deserialize(data: unknown): void {
    const d = data as {
      inventories?: Record<string, { items: Record<string, number>; maxCapacity: number }>;
      activeCrafts?: Record<string, Array<{ recipeId: string; ticksRemaining: number }>>;
    };
    // Restore inventories.
    this.inventories.clear();
    if (d.inventories) {
      for (const [id, invData] of Object.entries(d.inventories)) {
        const inv = new ResourceInventory({ maxCapacity: invData.maxCapacity });
        for (const [typeId, amount] of Object.entries(invData.items)) {
          inv.add(typeId, amount);
        }
        this.inventories.set(id, inv);
      }
    }
    // Restore active crafts.
    this.activeCrafts.clear();
    if (d.activeCrafts) {
      for (const [soulId, crafts] of Object.entries(d.activeCrafts)) {
        const restored: ActiveCraft[] = [];
        for (const c of crafts) {
          const recipe = this.recipes.get(c.recipeId);
          if (recipe) {
            restored.push({ soulId, recipe, ticksRemaining: c.ticksRemaining, totalTicks: recipe.craftTime });
          }
        }
        if (restored.length > 0) {
          this.activeCrafts.set(soulId, restored);
        }
      }
    }
  }
}
