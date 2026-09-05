// WorldGenerator: procedural world generation framework.
// Plugin-based: generators register generation functions that run in order.
// Uses SeededRandom for deterministic generation.
//
// No hardcoded world content — all generation logic is provided by plugins.
// The framework only coordinates generation order and provides the RNG + world context.

import { World } from "../engine/World.js";
import { SeededRandom } from "./SeededRandom.js";

/** Context passed to each generation plugin. */
export interface GenerationContext {
  /** The world being generated. */
  world: World;
  /** Deterministic RNG for this generation pass. */
  rng: SeededRandom;
  /** The seed used for generation. */
  seed: number | string;
  /** Shared data between generation passes (e.g., terrain height map). */
  data: Map<string, unknown>;
}

/** A generation plugin that modifies the world. */
export interface GenerationPlugin {
  /** Plugin name (must be unique). */
  readonly name: string;
  /**
   * Generate content in the world.
   * Called in registration order. Can read from context.data set by earlier plugins.
   */
  generate(ctx: GenerationContext): void;
}

/** Configuration for WorldGenerator. */
export interface WorldGeneratorConfig {
  /** Seed for deterministic generation. Same seed = same world. */
  seed: number | string;
  /** World name for the generated world. */
  worldName?: string;
  /** Tick rate for the generated world. Default: 60. */
  tickRate?: number;
}

/**
 * WorldGenerator: coordinates procedural world generation.
 *
 * Plugins are registered and run in order. Each plugin receives a GenerationContext
 * with the world, RNG, seed, and shared data map. This allows plugins to build on
 * each other (e.g., terrain plugin sets height map, resource plugin reads it to place
 * resources at appropriate heights).
 *
 * No hardcoded world content — all generation is provided by plugins.
 */
export class WorldGenerator {
  readonly seed: number | string;
  readonly worldName: string;
  readonly tickRate: number;
  private plugins: GenerationPlugin[] = [];

  constructor(config: WorldGeneratorConfig) {
    this.seed = config.seed;
    this.worldName = config.worldName ?? "generated-world";
    this.tickRate = config.tickRate ?? 60;
  }

  /** Register a generation plugin. Plugins run in registration order. */
  addPlugin(plugin: GenerationPlugin): this {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Duplicate generation plugin: ${plugin.name}`);
    }
    this.plugins.push(plugin);
    return this;
  }

  /** Remove a plugin by name. Returns true if removed. */
  removePlugin(name: string): boolean {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx >= 0) {
      this.plugins.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Get registered plugin names in order. */
  getPluginNames(): string[] {
    return this.plugins.map((p) => p.name);
  }

  /**
   * Generate a new world by running all registered plugins in order.
   * @param world Optional existing world to populate. If not provided, a new World is created.
   * @returns The generated world.
   */
  generate(world?: World): World {
    const w = world ?? new World({ name: this.worldName, tickRate: this.tickRate });
    const rng = new SeededRandom(this.seed);
    const data = new Map<string, unknown>();
    const ctx: GenerationContext = { world: w, rng, seed: this.seed, data };

    for (const plugin of this.plugins) {
      plugin.generate(ctx);
    }

    return w;
  }

  /**
   * Generate a world and return both the world and the shared data map.
   * Useful for inspecting what plugins produced (e.g., terrain maps).
   */
  generateWithData(world?: World): { world: World; data: Map<string, unknown> } {
    const w = world ?? new World({ name: this.worldName, tickRate: this.tickRate });
    const rng = new SeededRandom(this.seed);
    const data = new Map<string, unknown>();
    const ctx: GenerationContext = { world: w, rng, seed: this.seed, data };

    for (const plugin of this.plugins) {
      plugin.generate(ctx);
    }

    return { world: w, data };
  }
}
